import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

/** A config é validada no import e encerra o processo se estiver errada: roda num processo à parte. */
function carregar(env) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', "const { config } = await import('./src/config/env.js'); console.log(JSON.stringify(config.http))"], {
    env: { PATH: process.env.PATH, DATABASE_URL: 'postgres://app:Senha-Forte-123@db.exemplo/gatcha', ...env },
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  return r.status === 0 ? { ok: true, http: JSON.parse(r.stdout) } : { ok: false, erro: r.stderr };
}

test('config compartilhada: os JOBS de produção (migrações, limpeza) carregam sem TRUST_PROXY nem CHAVE_DADOS', () => {
  const job = carregar({ NODE_ENV: 'production' });
  assert.equal(job.ok, true, job.erro);
  assert.equal(job.http.trustProxyDefinido, false);
});

test('TRUST_PROXY vazio conta como "não definido" (antes virava 0)', () => {
  const vazio = carregar({ NODE_ENV: 'production', TRUST_PROXY: '' });
  assert.equal(vazio.http.trustProxyDefinido, false);
  assert.equal(carregar({ NODE_ENV: 'production', TRUST_PROXY: '2' }).http.trustProxy, 2);
  assert.equal(carregar({ NODE_ENV: 'development' }).http.trustProxy, 1, 'fora de produção continua com o padrão');
});

test('CHAVE_DADOS: ao menos 32 caracteres e diferente do JWT_SECRET', () => {
  const segredo = 'z'.repeat(40);
  assert.match(carregar({ CHAVE_DADOS: 'curta' }).erro, /CHAVE_DADOS deve ter ao menos 32/);
  assert.match(carregar({ CHAVE_DADOS: segredo, JWT_SECRET: segredo }).erro, /CHAVE_DADOS: precisa ser diferente do JWT_SECRET/);
});

test('CORS: só origens exatas com https; nunca "*"', () => {
  const prod = { NODE_ENV: 'production', TRUST_PROXY: '2' };
  for (const [origem, motivo] of [
    ['*', /nunca "\*"/],
    ['https://gatcha.com.br/', /origem exata/],
    ['https://gatcha.com.br/admin', /origem exata/],
    ['http://gatcha.com.br', /https/],
    ['http://localhost:5173', /https/],
    ['gatcha.com.br', /origem inválida/],
  ]) {
    const r = carregar({ ...prod, CORS_ORIGINS: origem });
    assert.equal(r.ok, false, origem);
    assert.match(r.erro, motivo, origem);
  }
  assert.deepEqual(carregar({ ...prod, CORS_ORIGINS: 'https://gatcha.com.br, https://www.gatcha.com.br' }).http.corsOrigins, ['https://gatcha.com.br', 'https://www.gatcha.com.br']);
  assert.equal(carregar({ NODE_ENV: 'development', CORS_ORIGINS: 'http://localhost:5173' }).ok, true, 'http só para localhost, fora de produção');
});

test('produção recusa a senha de exemplo do banco, sem mostrar a URL no erro', () => {
  for (const campo of ['DATABASE_URL', 'DATABASE_URL_MIGRACAO']) {
    const r = carregar({ NODE_ENV: 'production', TRUST_PROXY: '1', [campo]: 'postgres://gatcha:gatcha_dev@db.exemplo/gatcha' });
    assert.equal(r.ok, false, campo);
    assert.match(r.erro, new RegExp(`${campo}: usa a senha de exemplo`));
    assert.ok(!r.erro.includes('gatcha_dev'), 'a mensagem não vaza a URL');
  }
  assert.equal(carregar({ NODE_ENV: 'development', DATABASE_URL: 'postgres://gatcha:gatcha_dev@localhost:5433/gatcha' }).ok, true, 'em desenvolvimento pode');
});

test('o SERVIDOR de produção recusa subir sem TRUST_PROXY ou CHAVE_DADOS (sem mostrar valores)', () => {
  const r = spawnSync(process.execPath, ['src/server.js'], {
    env: { PATH: process.env.PATH, NODE_ENV: 'production', DATABASE_URL: 'postgres://app:Senha-Forte-123@127.0.0.1:1/gatcha', TRUST_PROXY: '' },
    encoding: 'utf8',
    cwd: process.cwd(),
    timeout: 10_000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /TRUST_PROXY: obrigatório/);
  assert.match(r.stderr, /CHAVE_DADOS: obrigatória/);
  assert.ok(!r.stderr.includes('Senha-Forte-123'));
});
