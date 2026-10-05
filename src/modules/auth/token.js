/**
 * Token de sessão do painel: JWT assinado (HS256) com validade curta.
 *
 * - Validade padrão 15 min (ADMIN_TOKEN_MINUTOS); sem refresh token na v1: ao
 *   expirar, a equipe entra de novo.
 * - A verificação FIXA o algoritmo (HS256) e confere issuer/audience: rejeita
 *   tokens "alg: none", de outro algoritmo ou de outro sistema.
 * - O payload tem só o necessário (id do usuário): nada de dados pessoais.
 * - Sem lista de revogação: apagar o usuário já invalida o acesso, pois o
 *   middleware confere se ele ainda existe a cada requisição.
 */
import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../../config/env.js';

const ISSUER = 'gatcha-api';
const AUDIENCE = 'gatcha-painel';
const ALGORITMO = 'HS256';

const chave = () => new TextEncoder().encode(config.auth.jwtSecret);

export const loginConfigurado = () => config.auth.jwtSecret.length >= 32;

export async function emitirToken(usuarioId, { agora = new Date() } = {}) {
  const emitidoEm = Math.floor(agora.getTime() / 1000);
  const expiraEm = emitidoEm + config.auth.tokenMinutos * 60;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALGORITMO, typ: 'JWT' })
    .setSubject(String(usuarioId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt(emitidoEm)
    .setExpirationTime(expiraEm)
    .sign(chave());
  return { token, expiraEm: new Date(expiraEm * 1000).toISOString() };
}

/** @returns {Promise<{ id: number, emitidoEm: number } | null>} usuário e instante de emissão (s), ou null se inválido/expirado */
export async function verificarToken(token, { agora = new Date() } = {}) {
  try {
    const { payload } = await jwtVerify(token, chave(), {
      algorithms: [ALGORITMO],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: agora,
    });
    const id = Number(payload.sub);
    return Number.isSafeInteger(id) && id > 0 && Number.isInteger(payload.iat) ? { id, emitidoEm: payload.iat } : null;
  } catch {
    return null;
  }
}
