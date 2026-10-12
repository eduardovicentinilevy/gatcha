/**
 * Configuração da aplicação, lida UMA vez das variáveis de ambiente e validada
 * com Zod no boot (fail-fast): se algo estiver errado o container nem sobe,
 * em vez de falhar no meio de uma requisição.
 *
 * No Cloud Run, segredos (DATABASE_URL, JWT_SECRET) devem vir do Secret Manager
 * montados como variáveis de ambiente — nunca versionados no repositório.
 */
import { z } from 'zod';

const inteiro = (padrao, min, max) => z.coerce.number().int().min(min).max(max).default(padrao);

const booleano = (padrao) =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(padrao ? 'true' : 'false')
    .transform((v) => v === 'true' || v === '1');

const lista = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: inteiro(8080, 1, 65535),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),

    // Banco
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
    // Opcional: usuário DONO das tabelas, só para `npm run migrate`. Em produção a API usa
    // DATABASE_URL com um usuário que só lê e escreve dados (db/producao/papeis.sql).
    DATABASE_URL_MIGRACAO: z.string().trim().default(''),
    // Cloud Run escala horizontalmente: (instâncias máx.) x (DB_POOL_MAX) precisa
    // caber no max_connections do Postgres gerenciado (planos gratuitos são pequenos).
    DB_POOL_MAX: inteiro(5, 1, 50),
    DB_SSL: booleano(true),
    DB_STATEMENT_TIMEOUT_MS: inteiro(10_000, 100, 60_000),

    // HTTP
    // Saltos de proxy confiáveis para ler o IP real do X-Forwarded-For
    // (Cloud Run = 1; Firebase Hosting -> Cloud Run = 2). Nunca use "true".
    // Obrigatório para a API em produção (conferido no boot, src/config/servidor.js): errar
    // para mais deixa o visitante forjar o IP; para menos, todo mundo parece um IP só e o
    // bloqueio de login trava a equipe inteira. Vazio conta como "não definido" (não como 0).
    TRUST_PROXY: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.coerce.number().int().min(0).max(5).optional()),
    // Origens exatas (https://site.com.br), separadas por vírgula. Vazio = sem CORS, que é o
    // certo quando o Firebase serve o site e a /api na mesma origem.
    CORS_ORIGINS: lista,
    RATE_LIMIT_PUBLICO_POR_MIN: inteiro(120, 1, 10_000),
    RATE_LIMIT_INTERESSES_POR_15MIN: inteiro(10, 1, 1_000), // "Quero conhecer" (adoção)
    RATE_LIMIT_FOTOS_POR_15MIN: inteiro(60, 1, 1_000), // envios de foto por pessoa da equipe
    // Teto do espaço das fotos no banco (soma de todas). Protege o plano do banco de encher.
    IMAGENS_MAX_MB: inteiro(300, 10, 100_000),
    // Só para desenvolvimento: em produção o site vem do Firebase Hosting.
    SERVIR_FRONTEND: booleano(false),

    // Fuso do café: datas e prazos de retenção (LGPD) contam no horário de São Paulo.
    TZ_NEGOCIO: z.string().default('America/Sao_Paulo'),

    // Painel administrativo: login (bcrypt) + token JWT de curta duração.
    // JWT_SECRET é SEGREDO (Secret Manager em produção): >= 32 caracteres aleatórios,
    // ex.: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))".
    // Vazio = login desativado (a API responde 503 em /api/auth/login).
    JWT_SECRET: z.string().default('').refine((v) => v === '' || v.length >= 32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
    // Protege dados GUARDADOS no banco: o IP nos limites de taxa vira um HMAC com ela.
    // SEGREDO, >= 32 caracteres, DIFERENTE do JWT_SECRET (cada chave com um papel só).
    // Obrigatória para a API em produção.
    CHAVE_DADOS: z.string().trim().default('').refine((v) => v === '' || v.length >= 32, 'CHAVE_DADOS deve ter ao menos 32 caracteres'),
    ADMIN_TOKEN_MINUTOS: inteiro(15, 5, 120),
    RATE_LIMIT_LOGIN_POR_15MIN: inteiro(10, 1, 1_000),
    LOGIN_MAX_FALHAS_POR_EMAIL: inteiro(5, 3, 20), // por e-mail + IP
    LOGIN_MAX_FALHAS_GLOBAL_POR_EMAIL: inteiro(30, 5, 1_000), // por e-mail, somando todos os IPs (ataque distribuído)

    // Retenção de dados pessoais (LGPD). Interesses de adoção e log de acessos:
    // prazos propostos, [CONFIRMAR] com o Gatchá. (As reservas são feitas no balcão: o site não guarda nenhuma.)
    RETENCAO_INTERESSES_DIAS: inteiro(180, 30, 3650),
    RETENCAO_ACESSOS_DIAS: inteiro(90, 30, 3650),
  })
  .superRefine((env, ctx) => {
    const problema = (campo, message) => ctx.addIssue({ code: 'custom', path: [campo], message });
    const producao = env.NODE_ENV === 'production';
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: env.TZ_NEGOCIO });
    } catch {
      problema('TZ_NEGOCIO', 'Fuso horário IANA inválido');
    }
    for (const origem of env.CORS_ORIGINS) {
      const erro = problemaDeOrigem(origem, { producao });
      if (erro) problema('CORS_ORIGINS', erro);
    }
    if (env.CHAVE_DADOS && env.CHAVE_DADOS === env.JWT_SECRET) {
      problema('CHAVE_DADOS', 'precisa ser diferente do JWT_SECRET');
    }
    if (producao) {
      for (const campo of ['DATABASE_URL', 'DATABASE_URL_MIGRACAO']) {
        if (SENHAS_DE_EXEMPLO.test(env[campo])) problema(campo, 'usa a senha de exemplo do projeto: em produção, use uma senha forte e única');
      }
    }
  });

// Senhas dos arquivos de exemplo (docker-compose, CI, script do pgAdmin): nunca em produção.
const SENHAS_DE_EXEMPLO = /:(gatcha_dev|gatcha_ci|senha)@/;

/** Origem do CORS precisa ser exata: esquema + domínio (+ porta), sem curinga, caminho ou barra no fim. */
function problemaDeOrigem(origem, { producao }) {
  let url;
  try {
    url = new URL(origem);
  } catch {
    return `origem inválida: "${origem}" (use algo como https://gatcha.com.br; nunca "*")`;
  }
  if (url.origin !== origem) return `"${origem}" não é uma origem exata (sem caminho nem barra no fim): use ${url.origin}`;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol === 'https:' || (url.protocol === 'http:' && local && !producao)) return null;
  return `"${origem}" precisa usar https${producao ? '' : ' (http só para localhost)'}`;
}

function carregar() {
  const resultado = schema.safeParse(process.env);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`).join('\n');
    // Sem logger aqui: o logger depende da config. Mensagem não inclui valores (podem ser segredos).
    console.error(`Configuração inválida:\n${problemas}`);
    process.exit(1);
  }
  const e = resultado.data;
  return Object.freeze({
    env: e.NODE_ENV,
    isProducao: e.NODE_ENV === 'production',
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    db: Object.freeze({
      url: e.DATABASE_URL,
      urlMigracao: e.DATABASE_URL_MIGRACAO || e.DATABASE_URL,
      poolMax: e.DB_POOL_MAX,
      ssl: e.DB_SSL,
      statementTimeoutMs: e.DB_STATEMENT_TIMEOUT_MS,
    }),
    http: Object.freeze({
      trustProxy: e.TRUST_PROXY ?? 1,
      trustProxyDefinido: e.TRUST_PROXY !== undefined,
      corsOrigins: e.CORS_ORIGINS,
      rateLimitPublicoPorMin: e.RATE_LIMIT_PUBLICO_POR_MIN,
      rateLimitInteressesPor15Min: e.RATE_LIMIT_INTERESSES_POR_15MIN,
      rateLimitFotosPor15Min: e.RATE_LIMIT_FOTOS_POR_15MIN,
      servirFrontend: e.SERVIR_FRONTEND,
    }),
    fuso: e.TZ_NEGOCIO,
    auth: Object.freeze({
      jwtSecret: e.JWT_SECRET,
      tokenMinutos: e.ADMIN_TOKEN_MINUTOS,
      maxFalhasPorEmail: e.LOGIN_MAX_FALHAS_POR_EMAIL,
      maxFalhasGlobalPorEmail: e.LOGIN_MAX_FALHAS_GLOBAL_POR_EMAIL,
      rateLimitLoginPor15Min: e.RATE_LIMIT_LOGIN_POR_15MIN,
    }),
    dados: Object.freeze({ chave: e.CHAVE_DADOS }),
    imagens: Object.freeze({ maxBytesTotal: e.IMAGENS_MAX_MB * 1024 * 1024 }),
    retencao: Object.freeze({
      interessesDias: e.RETENCAO_INTERESSES_DIAS,
      acessosDias: e.RETENCAO_ACESSOS_DIAS,
    }),
  });
}

export const config = carregar();
