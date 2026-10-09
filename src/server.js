/**
 * Ponto de entrada no Cloud Run.
 * Stateless: nenhum estado de negócio em memória/disco — qualquer instância
 * atende qualquer requisição, e o Cloud Run pode criar/destruir instâncias à vontade.
 */
import { config } from './config/env.js';
import { criarApp } from './app.js';
import { pool } from './db/pool.js';
import { logger, serializarErro } from './lib/logger.js';

const servidor = criarApp().listen(config.port, () => {
  logger.info('API Gatchá no ar', { porta: config.port, ambiente: config.env });
  verificarBanco();
});

/** Avisa logo no boot se o banco estiver inacessível, em vez de só na primeira requisição. */
async function verificarBanco() {
  try {
    await pool.query('SELECT 1');
    if (config.isProducao) await verificarPrivilegios();
  } catch (err) {
    const dica =
      err.code === '42P01'
        ? 'Tabelas não encontradas: rode `npm run migrate:dev`.'
        : 'Banco inacessível: confira a DATABASE_URL no .env e se o Postgres está rodando (`npm run db:up` com Docker).';
    logger.error(dica, { erro: { codigo: err.code, mensagem: err.message } });
  }
}

/**
 * Menor privilégio: se a API puder apagar tabelas, uma falha no código vira um estrago
 * no banco inteiro. Em produção ela deve usar um usuário que só lê e escreve dados.
 */
async function verificarPrivilegios() {
  const { rows } = await pool.query(
    `SELECT r.rolsuper AS superusuario,
            EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = current_schema() AND tableowner = current_user) AS dono
       FROM pg_roles r WHERE r.rolname = current_user`,
  );
  const { superusuario, dono } = rows[0] ?? {};
  if (superusuario || dono) {
    logger.warn(`O usuário do banco da API é ${superusuario ? 'superusuário' : 'dono das tabelas'}: em produção, use um usuário que só lê e escreve dados (db/producao/papeis.sql).`);
  }
}

/**
 * Graceful shutdown: o Cloud Run envia SIGTERM e dá ~10s antes do SIGKILL.
 * Paramos de aceitar conexões, deixamos as requisições em andamento (e suas
 * transações) terminarem e então fechamos o pool.
 */
let encerrando = false;
function encerrar(sinal) {
  if (encerrando) return;
  encerrando = true;
  logger.info('Encerrando', { sinal });

  setTimeout(() => {
    logger.error('Encerramento excedeu o prazo; forçando saída');
    process.exit(1);
  }, 8_000).unref();

  servidor.close(async () => {
    await pool.end().catch((err) => logger.error('Erro ao fechar pool', { erro: serializarErro(err) }));
    process.exit(0);
  });
  servidor.closeIdleConnections();
}

process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));

// Estado desconhecido = melhor reiniciar a instância do que continuar servindo.
process.on('unhandledRejection', (err) => {
  logger.error('unhandledRejection', { erro: serializarErro(err) });
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { erro: serializarErro(err) });
  process.exit(1);
});
