/**
 * Limitação de taxa por IP (o IP real vem do X-Forwarded-For via "trust proxy").
 *
 * ATENÇÃO (escala horizontal): o MemoryStore é por instância do Cloud Run. Com
 * N instâncias o limite efetivo é até N x o configurado. Para a v1 de um café
 * é aceitável (instâncias máximas baixas). Se precisar de limite global, troque
 * o `store` por um compartilhado (ex.: Redis/Memorystore) sem mudar as rotas,
 * ou aplique Cloud Armor na frente do serviço.
 */
import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';
import { AppError } from '../lib/erros.js';

function aoExceder(_req, _res, next) {
  next(new AppError(429, 'MUITAS_REQUISICOES', 'Muitas requisições. Aguarde alguns instantes e tente novamente.'));
}

const comum = { standardHeaders: 'draft-8', legacyHeaders: false, handler: aoExceder };

/** Teto geral para todas as rotas públicas da API. */
export const limitePublico = rateLimit({
  ...comum,
  identifier: 'publico',
  windowMs: 60_000,
  limit: config.http.rateLimitPublicoPorMin,
});

/** Teto específico e bem mais baixo para criação de reservas (anti-spam / anti-bot). */
export const limiteCriacaoReserva = rateLimit({
  ...comum,
  identifier: 'criar-reserva',
  windowMs: 15 * 60_000,
  limit: config.http.rateLimitReservasPor15Min,
});

/** Login do painel: teto por IP (além do bloqueio por e-mail feito no banco). */
export const limiteLogin = rateLimit({
  ...comum,
  identifier: 'login',
  windowMs: 15 * 60_000,
  limit: config.auth.rateLimitLoginPor15Min,
});

/** Cancelamento pelo link do e-mail: o token é longo demais para adivinhar; o teto só barra abuso. */
export const limiteCancelamento = rateLimit({
  ...comum,
  identifier: 'cancelar-reserva',
  windowMs: 15 * 60_000,
  limit: config.http.rateLimitCancelamentoPor15Min,
});

/** "Quero conhecer" (interesse em adoção): como a reserva, evita spam de formulário. */
export const limiteInteresse = rateLimit({
  ...comum,
  identifier: 'interesse-adocao',
  windowMs: 15 * 60_000,
  limit: config.http.rateLimitReservasPor15Min,
});
