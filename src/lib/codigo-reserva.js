import { randomInt } from 'node:crypto';

/**
 * Alfabeto sem caracteres ambíguos (0/O, 1/I/L) — o cliente lê o código no
 * e-mail e às vezes dita no balcão. 31 símbolos.
 */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const PREFIXO = 'GATCHA-';
export const TAMANHO = 6;

/**
 * Gera um código como "GATCHA-7K3QXP".
 *
 * Usa crypto.randomInt (CSPRNG, sem viés de módulo) e não Math.random: o código
 * funciona como credencial para cancelar a reserva pelo link do e-mail, então
 * precisa ser imprevisível. 31^6 ≈ 887 milhões de combinações — com rate
 * limiting, enumerar códigos válidos é inviável (4 caracteres dariam só ~923 mil).
 */
export function gerarCodigoReserva() {
  let sufixo = '';
  for (let i = 0; i < TAMANHO; i++) sufixo += ALFABETO[randomInt(ALFABETO.length)];
  return PREFIXO + sufixo;
}

export const RE_CODIGO_RESERVA = new RegExp(`^${PREFIXO}[${ALFABETO}]{${TAMANHO}}$`);
