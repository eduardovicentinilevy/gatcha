/**
 * 2FA por app autenticador (TOTP, RFC 6238): códigos de 6 dígitos que mudam a
 * cada 30 s (Google Authenticator, Microsoft Authenticator, Authy...).
 *
 * - Aceita o código do passo atual e o de 1 passo antes/depois (relógio do celular
 *   adiantado ou atrasado), e nunca um passo já usado (sem reuso de código).
 * - O segredo fica CRIPTOGRAFADO no banco (AES-256-GCM) com uma chave derivada do
 *   JWT_SECRET e amarrado ao id do usuário: copiar o segredo de uma linha para
 *   outra não funciona, e um vazamento só do banco não revela os segredos.
 *   Consequência: trocar o JWT_SECRET exige reativar o 2FA (npm run admin:2fa).
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../../config/env.js';

const PASSO_S = 30;
const DIGITOS = 6;
const TOLERANCIA = 1; // passos aceitos antes/depois do atual
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Segredo novo: 160 bits aleatórios (o tamanho do HMAC-SHA1). */
export const gerarSegredo = () => randomBytes(20);

/** Base32 (RFC 4648, sem "="): o formato que os apps autenticadores pedem. */
export function paraBase32(bytes) {
  let saida = '';
  let valor = 0;
  let bits = 0;
  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
    valor &= (1 << bits) - 1;
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

/** Link para cadastrar no app (alguns aceitam abrir direto; o normal é digitar a chave). */
export function linkOtpauth({ chave, email }) {
  const emissor = 'Gatchá';
  return `otpauth://totp/${encodeURIComponent(`${emissor}:${email}`)}?secret=${chave}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PASSO_S}`;
}

function codigoDoPasso(segredo, passo) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const hmac = createHmac('sha1', segredo).update(contador).digest();
  const deslocamento = hmac[hmac.length - 1] & 0xf;
  const numero = (hmac.readUInt32BE(deslocamento) & 0x7fffffff) % 10 ** DIGITOS;
  return String(numero).padStart(DIGITOS, '0');
}

/** O código que o app mostra agora (usado nos testes, que fazem o papel do celular). */
export const gerarCodigo = (segredo, { agora = Date.now() } = {}) => codigoDoPasso(segredo, Math.floor(agora / 1000 / PASSO_S));

/**
 * @param {Buffer} segredo
 * @param {string} codigo
 * @param {{ agora?: number, ultimoPasso?: number | string | null }} [opcoes]
 * @returns {number | null} o passo aceito (grave-o para impedir reuso), ou null
 */
export function conferirCodigo(segredo, codigo, { agora = Date.now(), ultimoPasso = null } = {}) {
  if (typeof codigo !== 'string' || !new RegExp(`^\\d{${DIGITOS}}$`).test(codigo)) return null;
  const atual = Math.floor(agora / 1000 / PASSO_S);
  const minimo = ultimoPasso === null || ultimoPasso === undefined ? -Infinity : Number(ultimoPasso) + 1;
  let aceito = null;
  // Confere todos os passos da janela, sem parar no primeiro: mesmo tempo para código certo ou errado.
  for (let d = -TOLERANCIA; d <= TOLERANCIA; d++) {
    const passo = atual + d;
    const confere = timingSafeEqual(Buffer.from(codigoDoPasso(segredo, passo)), Buffer.from(codigo));
    if (confere && passo >= minimo && aceito === null) aceito = passo;
  }
  return aceito;
}

// ---------------------------------------------------------------- segredo em repouso
const chaveDeCifra = () => Buffer.from(hkdfSync('sha256', config.auth.jwtSecret, 'gatcha', 'totp-v1', 32));
const contexto = (usuarioId) => Buffer.from(`usuario:${usuarioId}`);

/** "v1.<iv>.<tag>.<dados>" em base64url. */
export function cifrarSegredo(segredo, usuarioId) {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chaveDeCifra(), iv).setAAD(contexto(usuarioId));
  const dados = Buffer.concat([cifra.update(segredo), cifra.final()]);
  return ['v1', iv, cifra.getAuthTag(), dados].map((parte) => (typeof parte === 'string' ? parte : parte.toString('base64url'))).join('.');
}

/** Lança erro se o texto foi alterado, é de outro usuário ou o JWT_SECRET mudou. */
export function decifrarSegredo(texto, usuarioId) {
  const [versao, iv, tag, dados] = String(texto).split('.');
  if (versao !== 'v1' || !iv || !tag || !dados) throw new Error('Formato do segredo do 2FA desconhecido');
  const decifra = createDecipheriv('aes-256-gcm', chaveDeCifra(), Buffer.from(iv, 'base64url')).setAAD(contexto(usuarioId));
  decifra.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decifra.update(Buffer.from(dados, 'base64url')), decifra.final()]);
}
