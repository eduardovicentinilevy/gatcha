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
    // Cloud Run escala horizontalmente: (instâncias máx.) x (DB_POOL_MAX) precisa
    // caber no max_connections do Postgres gerenciado (planos gratuitos são pequenos).
    DB_POOL_MAX: inteiro(5, 1, 50),
    DB_SSL: booleano(true),
    DB_STATEMENT_TIMEOUT_MS: inteiro(10_000, 100, 60_000),

    // HTTP
    // Saltos de proxy confiáveis para ler o IP real do X-Forwarded-For
    // (Cloud Run = 1; Firebase Hosting -> Cloud Run = 2). Nunca use "true".
    TRUST_PROXY: inteiro(1, 0, 5),
    CORS_ORIGINS: lista,
    RATE_LIMIT_PUBLICO_POR_MIN: inteiro(120, 1, 10_000),
    RATE_LIMIT_INTERESSES_POR_15MIN: inteiro(10, 1, 1_000), // "Quero conhecer" (adoção)
    // Só para desenvolvimento: em produção o site vem do Firebase Hosting.
    SERVIR_FRONTEND: booleano(false),

    // Fuso do café: datas e prazos de retenção (LGPD) contam no horário de São Paulo.
    TZ_NEGOCIO: z.string().default('America/Sao_Paulo'),

    // Painel administrativo: login (bcrypt) + token JWT de curta duração.
    // JWT_SECRET é SEGREDO (Secret Manager em produção): >= 32 caracteres aleatórios,
    // ex.: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))".
    // Vazio = login desativado (a API responde 503 em /api/auth/login).
    JWT_SECRET: z.string().default('').refine((v) => v === '' || v.length >= 32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
    ADMIN_TOKEN_MINUTOS: inteiro(15, 5, 120),
    RATE_LIMIT_LOGIN_POR_15MIN: inteiro(10, 1, 1_000),
    LOGIN_MAX_FALHAS_POR_EMAIL: inteiro(5, 3, 20), // por e-mail + IP
    LOGIN_MAX_FALHAS_GLOBAL_POR_EMAIL: inteiro(30, 5, 1_000), // por e-mail, somando todos os IPs (ataque distribuído)

    // Retenção de dados pessoais (LGPD). Interesses de adoção e log de acessos:
    // prazos propostos, [CONFIRMAR] com o Gatchá. (As reservas são feitas no balcão: o site não guarda nenhuma.)
    RETENCAO_INTERESSES_DIAS: inteiro(180, 30, 3650),
    RETENCAO_ACESSOS_DIAS: inteiro(90, 30, 3650),

    // Avaliações do Google (Places API). Opcionais: sem elas, o site mostra as avaliações de exemplo.
    // A chave é SEGREDO: em produção, venha do Secret Manager. Restrinja-a à "Places API (New)".
    GOOGLE_PLACES_API_KEY: z.string().trim().default(''),
    GOOGLE_PLACE_ID: z.string().trim().regex(/^[\w-]*$/, 'GOOGLE_PLACE_ID inválido').default(''),
    AVALIACOES_CACHE_HORAS: inteiro(6, 1, 72),
  })
  .superRefine((env, ctx) => {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: env.TZ_NEGOCIO });
    } catch {
      ctx.addIssue({ code: 'custom', path: ['TZ_NEGOCIO'], message: 'Fuso horário IANA inválido' });
    }
  });

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
      poolMax: e.DB_POOL_MAX,
      ssl: e.DB_SSL,
      statementTimeoutMs: e.DB_STATEMENT_TIMEOUT_MS,
    }),
    http: Object.freeze({
      trustProxy: e.TRUST_PROXY,
      corsOrigins: e.CORS_ORIGINS,
      rateLimitPublicoPorMin: e.RATE_LIMIT_PUBLICO_POR_MIN,
      rateLimitInteressesPor15Min: e.RATE_LIMIT_INTERESSES_POR_15MIN,
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
    retencao: Object.freeze({
      interessesDias: e.RETENCAO_INTERESSES_DIAS,
      acessosDias: e.RETENCAO_ACESSOS_DIAS,
    }),
    google: Object.freeze({
      placesApiKey: e.GOOGLE_PLACES_API_KEY,
      placeId: e.GOOGLE_PLACE_ID,
      cacheMs: e.AVALIACOES_CACHE_HORAS * 3_600_000,
    }),
  });
}

export const config = carregar();
