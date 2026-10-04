import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

/**
 * Atribui um ID único à requisição (devolvido em X-Request-Id para o suporte
 * correlacionar com os logs) e registra um access log enxuto ao final.
 * O ID é sempre gerado aqui — nunca aceito do cliente (evita log injection/spoofing).
 * Não registramos IP, query string nem corpo (minimização de dados pessoais).
 */
export function contextoDaRequisicao(req, res, next) {
  req.id = randomUUID();
  res.set('X-Request-Id', req.id);

  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    logger.info('requisicao', {
      request_id: req.id,
      metodo: req.method,
      rota: req.originalUrl.split('?')[0],
      status: res.statusCode,
      duracao_ms: Number((process.hrtime.bigint() - inicio) / 1_000_000n),
    });
  });
  next();
}
