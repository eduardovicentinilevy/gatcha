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
});

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
