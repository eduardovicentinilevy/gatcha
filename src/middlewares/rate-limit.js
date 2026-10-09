/**
 * Limitação de taxa por IP (o IP real vem do X-Forwarded-For via "trust proxy").
 *
 * Os limites que protegem algo sensível (login, formulário de adoção, envio de
 * fotos) contam no Postgres e valem para TODAS as instâncias do Cloud Run.
 * O teto geral das rotas públicas fica em memória (por instância), de propósito:
 * é só um freio contra excesso, e contar no banco custaria uma escrita a cada
 * visita ao site. O número máximo de instâncias do deploy limita o total.
 */
import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';
import { AppError } from '../lib/erros.js';
import { LimitePostgres } from './limite-postgres.js';

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

/** Login do painel: teto por IP (além do bloqueio por e-mail feito no banco). */
export const limiteLogin = rateLimit({
  ...comum,
  store: new LimitePostgres('login'),
  identifier: 'login',
  windowMs: 15 * 60_000,
  limit: config.auth.rateLimitLoginPor15Min,
});

/** "Quero conhecer" (interesse em adoção): teto baixo contra spam de formulário. */
export const limiteInteresse = rateLimit({
  ...comum,
  store: new LimitePostgres('interesse'),
  identifier: 'interesse-adocao',
  windowMs: 15 * 60_000,
  limit: config.http.rateLimitInteressesPor15Min,
});

/** Envio de fotos pelo painel: teto por PESSOA da equipe (já autenticada), não por IP. */
export const limiteFotos = rateLimit({
  ...comum,
  store: new LimitePostgres('fotos'),
  identifier: 'fotos',
  windowMs: 15 * 60_000,
  limit: config.http.rateLimitFotosPor15Min,
  keyGenerator: (req) => `usuario:${req.admin.id}`,
});
