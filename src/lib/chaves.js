/**
 * Uma derivação só para as subchaves dos dados guardados (HKDF-SHA256 a partir da
 * CHAVE_DADOS). Cada uso tem o seu "propósito": as chaves saem independentes, e
 * vazar uma não entrega as outras.
 */
import { hkdfSync } from 'node:crypto';
import { config } from '../config/env.js';

// Fora de produção sem CHAVE_DADOS (testes, primeiro npm run dev) usa esta chave FIXA e
// PÚBLICA. Em produção a API nem sobe sem a CHAVE_DADOS (src/config/servidor.js).
const CHAVE_DE_DESENVOLVIMENTO = 'gatcha-desenvolvimento-nao-usar-em-producao';

const cache = new Map();

/** @param {string} proposito ex.: 'totp-v1', 'limites-de-taxa-v1' @returns {Buffer} 32 bytes */
export function derivarChave(proposito) {
  if (!cache.has(proposito)) {
    const mestre = config.dados.chave || (config.isProducao ? '' : CHAVE_DE_DESENVOLVIMENTO);
    if (!mestre) throw new Error('CHAVE_DADOS não configurada');
    cache.set(proposito, Buffer.from(hkdfSync('sha256', mestre, 'gatcha', proposito, 32)));
  }
  return cache.get(proposito);
}
