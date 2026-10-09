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

test('produção exige TRUST_PROXY explícito (o valor errado trava o login ou deixa forjar IP)', () => {
  const sem = carregar({ NODE_ENV: 'production' });
  assert.equal(sem.ok, false);
  assert.match(sem.erro, /TRUST_PROXY: obrigatório em produção/);
  assert.equal(carregar({ NODE_ENV: 'production', TRUST_PROXY: '2' }).http.trustProxy, 2);
  assert.equal(carregar({ NODE_ENV: 'development' }).http.trustProxy, 1, 'fora de produção continua com o padrão');
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
