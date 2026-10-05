import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres-ok';
configurarAmbienteDeTeste({ JWT_SECRET: SEGREDO, ADMIN_TOKEN_MINUTOS: '15' });
const { validarSenha, gerarHash, conferirSenha } = await import('../../src/modules/auth/senha.js');
const { emitirToken, verificarToken } = await import('../../src/modules/auth/token.js');

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const assinar = (header, payload, segredo = SEGREDO) => {
  const corpo = `${b64(header)}.${b64(payload)}`;
  return `${corpo}.${createHmac('sha256', segredo).update(corpo).digest('base64url')}`;
};
const agora = () => Math.floor(Date.now() / 1000);
const payloadValido = (extra = {}) => ({ sub: '7', iss: 'gatcha-api', aud: 'gatcha-painel', iat: agora(), exp: agora() + 600, ...extra });

test('política de senha', () => {
  assert.equal(validarSenha('Matcha-e-gatos-2026!'), null);
  assert.match(validarSenha('curta1'), /ao menos 12/);
  assert.match(validarSenha('a'.repeat(73)), /no máximo 72/);
  assert.match(validarSenha('aaaaaaaaaaaaaa'), /repetitiva/);
  assert.match(validarSenha('Gatcha123456'), /muito comum/);
  assert.match(validarSenha('maria.silva-2026-x', { email: 'maria.silva@gatcha.com.br' }), /e-mail/);
  assert.match(validarSenha(undefined), /Informe/);
});

test('bcrypt: hash não revela a senha, é salgado e confere só a senha certa', async () => {
  const senha = 'Matcha-e-gatos-2026!';
  const [a, b] = await Promise.all([gerarHash(senha), gerarHash(senha)]);
  assert.match(a, /^\$2[aby]\$12\$.{53}$/);
  assert.notEqual(a, b, 'cada hash tem seu próprio sal');
  assert.ok(!a.includes(senha));
  assert.equal(await conferirSenha(senha, a), true);
  assert.equal(await conferirSenha(senha + 'x', a), false);
});

test('token válido volta o id do usuário e expira em 15 min', async () => {
  const { token, expiraEm } = await emitirToken(42);
  assert.equal(await verificarToken(token), 42);
  const minutos = (new Date(expiraEm) - Date.now()) / 60_000;
  assert.ok(minutos > 14 && minutos <= 15, `expira em ${minutos} min`);
  assert.equal(await verificarToken(token, { agora: new Date(Date.now() + 16 * 60_000) }), null, 'expirado');
});

test('token forjado ou adulterado é recusado', async () => {
  assert.equal(await verificarToken(assinar({ alg: 'HS256', typ: 'JWT' }, payloadValido())), 7, 'controle: o token bem formado passa');
  const casos = {
    'alg none': `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payloadValido())}.`,
    'segredo errado': assinar({ alg: 'HS256', typ: 'JWT' }, payloadValido(), 'outro-segredo-com-mais-de-32-caracteres!!'),
    'algoritmo HS512': assinar({ alg: 'HS512', typ: 'JWT' }, payloadValido()),
    'issuer errado': assinar({ alg: 'HS256', typ: 'JWT' }, payloadValido({ iss: 'outro' })),
    'audience errada': assinar({ alg: 'HS256', typ: 'JWT' }, payloadValido({ aud: 'outro' })),
    'expirado': assinar({ alg: 'HS256', typ: 'JWT' }, payloadValido({ exp: agora() - 10 })),
    'sub inválido': assinar({ alg: 'HS256', typ: 'JWT' }, payloadValido({ sub: 'abc' })),
    'lixo': 'isto.nao.eh-um-jwt',
    'vazio': '',
  };
  for (const [nome, token] of Object.entries(casos)) assert.equal(await verificarToken(token), null, nome);
  const { token } = await emitirToken(1);
  assert.equal(await verificarToken(token.slice(0, -2) + 'xx'), null, 'assinatura adulterada');
});
