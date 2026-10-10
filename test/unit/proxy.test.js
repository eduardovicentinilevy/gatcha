import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarVerificadorDeProxy } from '../../src/middlewares/proxy.js';

function montar(saltos, amostra = 10) {
  const registros = [];
  const logger = Object.fromEntries(['error', 'warn', 'info'].map((nivel) => [nivel, (msg, campos) => registros.push({ nivel, msg, campos })]));
  const verificar = criarVerificadorDeProxy({ saltos, logger, amostra });
  const chamar = (xff, vezes = 1) => {
    for (let i = 0; i < vezes; i++) {
      let seguiu = false;
      verificar({ get: (nome) => (nome === 'x-forwarded-for' ? xff : undefined) }, {}, () => (seguiu = true));
      assert.ok(seguiu, 'nunca bloqueia a requisição');
    }
  };
  return { chamar, registros };
}

test('TRUST_PROXY certo: uma linha "confere" ao fim da amostra, sem IP no log', () => {
  const { chamar, registros } = montar(2);
  chamar('203.0.113.7, 198.51.100.1', 9);
  assert.equal(registros.length, 0, 'só relata ao fechar a amostra');
  chamar('203.0.113.7, 198.51.100.1');
  assert.equal(registros.length, 1);
  assert.equal(registros[0].nivel, 'info');
  assert.deepEqual(registros[0].campos, { trust_proxy: 2, amostra: 10, menos: 0, iguais: 10, mais: 0 });
  assert.ok(!JSON.stringify(registros).includes('203.0.113'));
  chamar('1.1.1.1', 50);
  assert.equal(registros.length, 1, 'uma vez por instância');
});

test('TRUST_PROXY alto demais (IP forjável): ERRO', () => {
  const { chamar, registros } = montar(2);
  chamar('203.0.113.7', 10); // Cloud Run direto configurado como se tivesse o Firebase
  assert.equal(registros[0].nivel, 'error');
  assert.match(registros[0].msg, /forjado/);
});

test('TRUST_PROXY baixo demais (todos com o mesmo IP): AVISO', () => {
  const { chamar, registros } = montar(1);
  chamar('203.0.113.7, 198.51.100.1', 10);
  assert.equal(registros[0].nivel, 'warn');
  assert.match(registros[0].msg, /BAIXO/);
});

test('TRUST_PROXY 0 com proxy na frente também é avisado (antes ficava calado)', () => {
  const { chamar, registros } = montar(0);
  chamar('203.0.113.7', 10);
  assert.equal(registros[0].nivel, 'warn');
});

test('sondas de saúde e chamadas internas (sem X-Forwarded-For) não entram na conta', () => {
  const { chamar, registros } = montar(2);
  chamar(undefined, 30);
  assert.equal(registros.length, 0, 'nenhum alarme falso');
  chamar('203.0.113.7, 198.51.100.1', 10);
  assert.equal(registros[0].nivel, 'info');
});

test('poucos acessos diretos ao *.run.app não viram alarme de configuração', () => {
  const { chamar, registros } = montar(2);
  chamar('203.0.113.7, 198.51.100.1', 8);
  chamar('203.0.113.99', 2);
  assert.equal(registros[0].nivel, 'warn');
  assert.match(registros[0].msg, /run\.app/);
});
