import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

let totp;
before(async () => {
  configurarAmbienteDeTeste({ JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-ok' });
  totp = await import('../../src/modules/auth/totp.js');
});

// RFC 6238, apêndice B (SHA-1), com os 6 últimos dígitos dos códigos de 8 dígitos.
const SEGREDO_RFC = Buffer.from('12345678901234567890');
const VETORES = [
  [59, '287082'],
  [1111111109, '081804'],
  [1234567890, '005924'],
  [2000000000, '279037'],
];

test('TOTP bate com os vetores oficiais da RFC 6238', () => {
  for (const [segundos, codigo] of VETORES) {
    assert.equal(totp.gerarCodigo(SEGREDO_RFC, { agora: segundos * 1000 }), codigo);
    assert.equal(totp.conferirCodigo(SEGREDO_RFC, codigo, { agora: segundos * 1000 }), Math.floor(segundos / 30));
  }
});

test('aceita relógio do celular 30 s adiantado ou atrasado, não mais que isso', () => {
  const t = 1234567890 * 1000;
  assert.notEqual(totp.conferirCodigo(SEGREDO_RFC, '005924', { agora: t + 30_000 }), null);
  assert.notEqual(totp.conferirCodigo(SEGREDO_RFC, '005924', { agora: t - 30_000 }), null);
  assert.equal(totp.conferirCodigo(SEGREDO_RFC, '005924', { agora: t + 60_000 }), null);
  assert.equal(totp.conferirCodigo(SEGREDO_RFC, '005924', { agora: t - 60_000 }), null);
});

test('código já usado (ou de um passo anterior a ele) é recusado', () => {
  const t = 1234567890 * 1000;
  const passo = totp.conferirCodigo(SEGREDO_RFC, '005924', { agora: t });
  assert.equal(totp.conferirCodigo(SEGREDO_RFC, '005924', { agora: t, ultimoPasso: passo }), null);
  assert.equal(totp.conferirCodigo(SEGREDO_RFC, '005924', { agora: t, ultimoPasso: String(passo) }), null, 'bigint do banco chega como texto');
});

test('formato errado nem é conferido', () => {
  for (const codigo of ['', '12345', '1234567', 'abcdef', '12 345', null, 123456]) {
    assert.equal(totp.conferirCodigo(SEGREDO_RFC, codigo), null);
  }
});

test('chave em Base32 (o que se digita no app) e link otpauth', () => {
  assert.equal(totp.paraBase32(SEGREDO_RFC), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.equal(totp.paraBase32(totp.gerarSegredo()).length, 32);
  const link = totp.linkOtpauth({ chave: 'ABC', email: 'equipe@gatcha.com.br' });
  assert.match(link, /^otpauth:\/\/totp\/Gatch%C3%A1%3Aequipe%40gatcha\.com\.br\?secret=ABC&issuer=Gatch%C3%A1&/);
});

test('segredo guardado criptografado: só volta para o mesmo usuário e sem alteração', () => {
  const segredo = totp.gerarSegredo();
  const cifrado = totp.cifrarSegredo(segredo, 7);
  assert.match(cifrado, /^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.ok(!cifrado.includes(totp.paraBase32(segredo)), 'o segredo não aparece no texto guardado');
  assert.notEqual(totp.cifrarSegredo(segredo, 7), cifrado, 'IV novo a cada cifra');
  assert.deepEqual(totp.decifrarSegredo(cifrado, 7), segredo);
  assert.throws(() => totp.decifrarSegredo(cifrado, 8), 'segredo copiado para outro usuário não serve');
  const [v, iv, tag, dados] = cifrado.split('.');
  const adulterado = [v, iv, tag, `${dados.slice(0, -2)}AA`].join('.');
  assert.throws(() => totp.decifrarSegredo(adulterado, 7));
});
