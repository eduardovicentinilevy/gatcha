/**
 * A config é lida no import, então cada arquivo de teste chama isto ANTES de
 * importar (dinamicamente) os módulos da aplicação. O node --test roda cada
 * arquivo num processo separado, então não há vazamento entre arquivos.
 */
export function configurarAmbienteDeTeste(sobrescritas = {}) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://invalido@127.0.0.1:1/nao_usado',
    DB_SSL: 'false',
    TZ_NEGOCIO: 'America/Sao_Paulo',
    GATIL_CAPACIDADE: '6',
    GATIL_DIAS: '0,1,2,3,4,5,6',
    GATIL_JANELAS: '10:00-12:00,14:00-16:00',
    RESERVA_MAX_PESSOAS: '4',
    RESERVA_ANTECEDENCIA_MAX_DIAS: '14',
    RESERVA_MAX_ATIVAS_POR_CONTATO: '3',
    RATE_LIMIT_PUBLICO_POR_MIN: '10000',
    RATE_LIMIT_RESERVAS_POR_15MIN: '1000',
    ...sobrescritas,
  });
}
