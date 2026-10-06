/**
 * Tratamento CENTRALIZADO de erros (Global Error Handler).
 *
 * Contrato único de erro para o front-end:
 *   { "erro": { "codigo": "VAGAS_INSUFICIENTES", "mensagem": "...", "detalhes": {...}, "request_id": "..." } }
 *
 * Falhas inesperadas viram 500 com mensagem genérica — stack trace, SQL e
 * mensagens do driver NUNCA vão para o cliente, só para o log (com request_id
 * para correlacionar).
 */
import { AppError } from '../lib/erros.js';
import { logger, serializarErro } from '../lib/logger.js';

// Erros transitórios do Postgres: o cliente pode simplesmente tentar de novo.
const PG_TRANSITORIOS = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '55P03', // lock_not_available (lock_timeout)
  '57014', // query_canceled (statement_timeout)
  '53300', // too_many_connections
  '57P01', // admin_shutdown
]);

// Banco fora do ar ou endereço errado (erros de rede do driver).
const BANCO_FORA = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', '57P03' /* cannot_connect_now */, '28P01' /* senha do banco errada */, '3D000' /* banco não existe */]);

export function rotaNaoEncontrada(_req, _res, next) {
  next(new AppError(404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.'));
}

// eslint-disable-next-line no-unused-vars -- o Express identifica error handlers pela aridade 4
export function tratadorDeErros(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let codigo = 'ERRO_INTERNO';
  let mensagem = 'Ocorreu um erro inesperado. Tente novamente mais tarde.';
  let detalhes;

  if (err instanceof AppError) {
    ({ status, codigo, detalhes } = err);
    mensagem = err.message;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    codigo = 'JSON_INVALIDO';
    mensagem = 'O corpo da requisição não é um JSON válido.';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    codigo = 'CORPO_MUITO_GRANDE';
    mensagem = 'O corpo da requisição é grande demais.';
  } else if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 && err.expose) {
    // Demais erros 4xx do body-parser (charset/encoding não suportado etc.)
    status = err.status;
    codigo = 'REQUISICAO_INVALIDA';
    mensagem = 'Requisição inválida.';
  } else if (BANCO_FORA.has(err?.code) || BANCO_FORA.has(err?.cause?.code)) {
    // Postgres desligado/inacessível: 503 claro em vez de "erro inesperado".
    status = 503;
    codigo = 'BANCO_INDISPONIVEL';
    mensagem = 'O sistema está sem acesso ao banco de dados agora. Tente de novo em instantes.';
    res.set('Retry-After', '5');
  } else if (PG_TRANSITORIOS.has(err?.code) || /timeout exceeded when trying to connect/i.test(err?.message ?? '')) {
    status = 503;
    codigo = 'SERVICO_OCUPADO';
    mensagem = 'O sistema está ocupado no momento. Tente novamente em alguns segundos.';
    res.set('Retry-After', '2');
  }

  const contexto = { request_id: req.id, metodo: req.method, rota: req.originalUrl.split('?')[0], status };
  if (status >= 500) logger.error('Falha ao processar requisição', { ...contexto, erro: serializarErro(err) });
  else logger.debug('Requisição rejeitada', { ...contexto, codigo });

  res.status(status).json({ erro: { codigo, mensagem, ...(detalhes && { detalhes }), request_id: req.id } });
}
