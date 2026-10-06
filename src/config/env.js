/**
 * Configuração da aplicação, lida UMA vez das variáveis de ambiente e validada
 * com Zod no boot (fail-fast): se algo estiver errado o container nem sobe,
 * em vez de falhar no meio de uma reserva.
 *
 * No Cloud Run, segredos (DATABASE_URL, JWT_SECRET) devem vir do Secret Manager
 * montados como variáveis de ambiente — nunca versionados no repositório.
 */
import { z } from 'zod';
import { parseHora } from '../lib/tempo.js';
import { PASSO_MIN } from '../modules/reservas/disponibilidade.js';

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

/**
 * "11:00-13:00,14:00-19:00" -> [{ inicio: 660, fim: 780 }, { inicio: 840, fim: 1140 }]
 *
 * Escreva o horário REAL da área dos gatos (ex.: 10:30-11:50,13:10-17:30). A agenda
 * trabalha em células de 15 min, então a janela é arredondada PARA DENTRO (início
 * para cima, fim para baixo): nunca se vende um minuto fora do horário real.
 * 10:30-11:50 vira 10:30-11:45; 13:10-17:30 vira 13:15-17:30.
 */
const janelas = z
  .string()
  .default('10:30-11:50,13:10-17:30')
  .transform((valor, ctx) => {
    const resultado = [];
    for (const trecho of valor.split(',').map((s) => s.trim()).filter(Boolean)) {
      const m = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(trecho);
      const inicioReal = m && parseHora(m[1]);
      const fimReal = m && parseHora(m[2]);
      if (inicioReal == null || fimReal == null || fimReal <= inicioReal) {
        ctx.addIssue({ code: 'custom', message: `Janela inválida: "${trecho}" (use HH:MM-HH:MM, fim depois do início)` });
        return z.NEVER;
      }
      const inicio = Math.ceil(inicioReal / PASSO_MIN) * PASSO_MIN;
      const fim = Math.floor(fimReal / PASSO_MIN) * PASSO_MIN;
      if (fim - inicio < PASSO_MIN) {
        ctx.addIssue({ code: 'custom', message: `Janela "${trecho}" é curta demais: precisa caber ao menos ${PASSO_MIN} min na grade de ${PASSO_MIN} em ${PASSO_MIN} min` });
        return z.NEVER;
      }
      resultado.push({ inicio, fim });
    }
    resultado.sort((a, b) => a.inicio - b.inicio);
    for (let i = 1; i < resultado.length; i++) {
      if (resultado[i].inicio < resultado[i - 1].fim) {
        ctx.addIssue({ code: 'custom', message: 'Janelas do gatil não podem se sobrepor' });
        return z.NEVER;
      }
    }
    if (resultado.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Defina ao menos uma janela do gatil' });
      return z.NEVER;
    }
    return resultado;
  });

/** "1,2,3,4,5,6" -> Set {1,2,3,4,5,6}  (0 = domingo ... 6 = sábado) */
const diasDaSemana = z
  .string()
  .default('1,2,3,4,5,6')
  .transform((valor, ctx) => {
    const partes = valor.split(',').map((s) => s.trim());
    // Number('') === 0 viraria "domingo": entradas vazias são erro, não domingo.
    const dias = partes.map((s) => (/^[0-6]$/.test(s) ? Number(s) : NaN));
    if (dias.some((d) => Number.isNaN(d))) {
      ctx.addIssue({ code: 'custom', message: 'GATIL_DIAS deve conter números de 0 (domingo) a 6 (sábado)' });
      return z.NEVER;
    }
    return new Set(dias);
  });

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
    RATE_LIMIT_RESERVAS_POR_15MIN: inteiro(10, 1, 1_000),
    // Só para desenvolvimento: em produção o site vem do Firebase Hosting.
    SERVIR_FRONTEND: booleano(false),

    // Regras do negócio (valores provisórios até o Gatchá confirmar as pendências)
    TZ_NEGOCIO: z.string().default('America/Sao_Paulo'),
    GATIL_CAPACIDADE: inteiro(8, 1, 50),
    GATIL_DIAS: diasDaSemana,
    GATIL_JANELAS: janelas,
    RESERVA_MAX_PESSOAS: inteiro(4, 1, 50),
    RESERVA_ANTECEDENCIA_MAX_DIAS: inteiro(14, 0, 365),
    RESERVA_MAX_ATIVAS_POR_CONTATO: inteiro(3, 1, 100),
    // Cancelamento pelo link do e-mail: até N horas antes do horário da reserva.
    CANCELAMENTO_ATE_HORAS_ANTES: inteiro(1, 0, 72),
    RATE_LIMIT_CANCELAMENTO_POR_15MIN: inteiro(20, 1, 1_000),

    // E-mail (confirmação e link de cancelamento).
    //  log      = só desenvolvimento: escreve o e-mail no terminal (o link de cancelamento fica visível lá).
    //  smtp     = envia de verdade por EMAIL_SMTP_URL (SEGREDO, ex.: smtps://usuario:senha@smtp.exemplo.com:465).
    //  desligado = não envia nada.
    EMAIL_TRANSPORTE: z.enum(['log', 'smtp', 'desligado']).default('log'),
    EMAIL_SMTP_URL: z.string().trim().default(''),
    EMAIL_REMETENTE: z.string().trim().min(3).max(200).default('Gatchá <nao-responda@localhost>'),
    // Endereço público do site: base dos links enviados por e-mail (sem barra no final).
    SITE_URL: z
      .url({ protocol: /^https?$/ })
      .transform((v) => v.replace(/\/+$/, ''))
      .default('http://localhost:5173'),

    // Painel administrativo: login (bcrypt) + token JWT de curta duração.
    // JWT_SECRET é SEGREDO (Secret Manager em produção): >= 32 caracteres aleatórios,
    // ex.: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))".
    // Vazio = login desativado (a API responde 503 em /api/auth/login).
    JWT_SECRET: z.string().default('').refine((v) => v === '' || v.length >= 32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
    ADMIN_TOKEN_MINUTOS: inteiro(15, 5, 120),
    RATE_LIMIT_LOGIN_POR_15MIN: inteiro(10, 1, 1_000),
    LOGIN_MAX_FALHAS_POR_EMAIL: inteiro(5, 3, 20), // por e-mail + IP
    LOGIN_MAX_FALHAS_GLOBAL_POR_EMAIL: inteiro(30, 5, 1_000), // por e-mail, somando todos os IPs (ataque distribuído)

    // Retenção de dados pessoais (LGPD). Reservas: 90 dias após a visita (escopo).
    // Interesses de adoção e log de acessos: prazos propostos, [CONFIRMAR] com o Gatchá.
    RETENCAO_RESERVAS_DIAS: inteiro(90, 30, 3650),
    RETENCAO_INTERESSES_DIAS: inteiro(180, 30, 3650),
    RETENCAO_ACESSOS_DIAS: inteiro(90, 30, 3650),

    // Avaliações do Google (Places API). Opcionais: sem elas, o site mostra as avaliações de exemplo.
    // A chave é SEGREDO: em produção, venha do Secret Manager. Restrinja-a à "Places API (New)".
    GOOGLE_PLACES_API_KEY: z.string().trim().default(''),
    GOOGLE_PLACE_ID: z.string().trim().regex(/^[\w-]*$/, 'GOOGLE_PLACE_ID inválido').default(''),
    AVALIACOES_CACHE_HORAS: inteiro(6, 1, 72),
  })
  .superRefine((env, ctx) => {
    if (env.RESERVA_MAX_PESSOAS > env.GATIL_CAPACIDADE) {
      ctx.addIssue({ code: 'custom', path: ['RESERVA_MAX_PESSOAS'], message: 'Não pode exceder GATIL_CAPACIDADE' });
    }
    if (env.EMAIL_TRANSPORTE === 'smtp' && !env.EMAIL_SMTP_URL) {
      ctx.addIssue({ code: 'custom', path: ['EMAIL_SMTP_URL'], message: 'Obrigatória quando EMAIL_TRANSPORTE=smtp' });
    }
    if (env.NODE_ENV === 'production' && env.EMAIL_TRANSPORTE === 'log') {
      // O modo "log" escreve o link de cancelamento (credencial) no log: proibido em produção.
      ctx.addIssue({ code: 'custom', path: ['EMAIL_TRANSPORTE'], message: 'Em produção use smtp (ou desligado)' });
    }
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
      rateLimitReservasPor15Min: e.RATE_LIMIT_RESERVAS_POR_15MIN,
      rateLimitCancelamentoPor15Min: e.RATE_LIMIT_CANCELAMENTO_POR_15MIN,
      servirFrontend: e.SERVIR_FRONTEND,
    }),
    gatil: Object.freeze({
      fuso: e.TZ_NEGOCIO,
      capacidade: e.GATIL_CAPACIDADE,
      diasAbertos: e.GATIL_DIAS,
      janelas: Object.freeze(e.GATIL_JANELAS.map(Object.freeze)),
      maxPessoasPorReserva: e.RESERVA_MAX_PESSOAS,
      antecedenciaMaxDias: e.RESERVA_ANTECEDENCIA_MAX_DIAS,
      maxReservasAtivasPorContato: e.RESERVA_MAX_ATIVAS_POR_CONTATO,
      cancelamentoAteHorasAntes: e.CANCELAMENTO_ATE_HORAS_ANTES,
    }),
    siteUrl: e.SITE_URL,
    email: Object.freeze({ transporte: e.EMAIL_TRANSPORTE, smtpUrl: e.EMAIL_SMTP_URL, remetente: e.EMAIL_REMETENTE }),
    auth: Object.freeze({
      jwtSecret: e.JWT_SECRET,
      tokenMinutos: e.ADMIN_TOKEN_MINUTOS,
      maxFalhasPorEmail: e.LOGIN_MAX_FALHAS_POR_EMAIL,
      maxFalhasGlobalPorEmail: e.LOGIN_MAX_FALHAS_GLOBAL_POR_EMAIL,
      rateLimitLoginPor15Min: e.RATE_LIMIT_LOGIN_POR_15MIN,
    }),
    retencao: Object.freeze({
      reservasDias: e.RETENCAO_RESERVAS_DIAS,
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
