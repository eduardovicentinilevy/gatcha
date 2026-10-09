import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarVerificadorDeProxy } from '../../src/middlewares/proxy.js';

function montar(saltos) {
  const registros = [];
  const logger = { error: (msg, campos) => registros.push(['error', msg, campos]), warn: (msg, campos) => registros.push(['warn', msg, campos]) };
  const verificar = criarVerificadorDeProxy({ saltos, logger });
  const chamar = (xff) => {
    let seguiu = false;
    verificar({ get: (nome) => (nome === 'x-forwarded-for' ? xff : undefined) }, {}, () => (seguiu = true));
    assert.ok(seguiu, 'nunca bloqueia a requisição');
  };
  return { chamar, registros };
}

test('TRUST_PROXY certo (endereços = saltos): nada no log', () => {
  const { chamar, registros } = montar(2);
  chamar('203.0.113.7, 198.51.100.1');
  assert.equal(registros.length, 0);
});

test('TRUST_PROXY alto demais (IP forjável): ERRO uma vez só, sem IP no log', () => {
  const { chamar, registros } = montar(2);
  chamar('203.0.113.7'); // Cloud Run direto, mas configurado como se tivesse o Firebase
  chamar('203.0.113.8');
  chamar(undefined);
  assert.equal(registros.length, 1);
  const [nivel, msg, campos] = registros[0];
  assert.equal(nivel, 'error');
  assert.match(msg, /forjado/);
  assert.deepEqual(campos, { trust_proxy: 2, enderecos_x_forwarded_for: 1 });
  assert.ok(!JSON.stringify(registros).includes('203.0.113'), 'não grava IP');
});

test('mais endereços que TRUST_PROXY: AVISO uma vez só', () => {
  const { chamar, registros } = montar(1);
  chamar('1.1.1.1, 203.0.113.7');
  chamar('1.1.1.1, 2.2.2.2, 203.0.113.7');
  assert.deepEqual(registros.map((r) => r[0]), ['warn']);
});

test('TRUST_PROXY=0 (sem proxy): não confere nada', () => {
  const { chamar, registros } = montar(0);
  chamar('1.1.1.1');
  chamar(undefined);
  assert.equal(registros.length, 0);
});
