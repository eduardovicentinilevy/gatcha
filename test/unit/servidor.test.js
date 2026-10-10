import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemasDoServidor } from '../../src/config/servidor.js';

const configDe = ({ producao = true, trustProxy, chave = 'x'.repeat(40) } = {}) => ({
  isProducao: producao,
  http: { trustProxy: trustProxy ?? 1, trustProxyDefinido: trustProxy !== undefined },
  dados: { chave },
});

test('fora de produção, a API sobe sem TRUST_PROXY nem CHAVE_DADOS', () => {
  assert.deepEqual(problemasDoServidor(configDe({ producao: false, chave: '' })), []);
});

test('em produção, a API exige TRUST_PROXY (>= 1) e CHAVE_DADOS', () => {
  assert.deepEqual(problemasDoServidor(configDe({ trustProxy: 2 })), []);
  assert.match(problemasDoServidor(configDe({}))[0], /TRUST_PROXY: obrigatório/);
  assert.match(problemasDoServidor(configDe({ trustProxy: 0 }))[0], /TRUST_PROXY: 0 não serve/);
  assert.match(problemasDoServidor(configDe({ trustProxy: 1, chave: '' }))[0], /CHAVE_DADOS: obrigatória/);
});
