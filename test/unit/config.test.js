import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENV = fileURLToPath(new URL('../../src/config/env.js', import.meta.url));
const carregar = (extra) =>
  spawnSync(process.execPath, ['-e', `import(${JSON.stringify(ENV)}).then((m) => console.log([...m.config.gatil.diasAbertos].join(',')))`], {
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: 'postgres://x@127.0.0.1:1/x', ...extra },
    encoding: 'utf8',
  });

test('GATIL_DIAS válido é aceito', () => {
  const r = carregar({ GATIL_DIAS: '2, 3,6' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '2,3,6');
});

test('GATIL_DIAS vazio ou com entrada vazia impede a API de subir (não vira "domingo")', () => {
  for (const valor of ['', '2,,3', '7', 'seg']) {
    const r = carregar({ GATIL_DIAS: valor });
    assert.equal(r.status, 1, `GATIL_DIAS="${valor}" deveria falhar`);
    assert.match(r.stderr, /GATIL_DIAS/);
  }
});
