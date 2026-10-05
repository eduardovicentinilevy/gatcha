import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENV = fileURLToPath(new URL('../../src/config/env.js', import.meta.url));
const executar = (extra, expressao) =>
  spawnSync(process.execPath, ['-e', `import(${JSON.stringify(ENV)}).then((m) => console.log(${expressao}))`], {
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: 'postgres://x@127.0.0.1:1/x', ...extra },
    encoding: 'utf8',
  });
const carregar = (extra) => executar(extra, `[...m.config.gatil.diasAbertos].join(',')`);
const carregarJanelas = (extra) => executar(extra, 'JSON.stringify(m.config.gatil.janelas)');
const min = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

test('padrão: segunda a sábado, área dos gatos 10h30-11h50 e 13h10-17h30 (arredondada para dentro)', () => {
  const env = { GATIL_DIAS: undefined, GATIL_JANELAS: undefined };
  const dias = carregar(env);
  assert.equal(dias.status, 0, dias.stderr);
  assert.equal(dias.stdout.trim(), '1,2,3,4,5,6');

  const janelas = carregarJanelas(env);
  assert.equal(janelas.status, 0, janelas.stderr);
  assert.deepEqual(JSON.parse(janelas.stdout), [
    { inicio: min('10:30'), fim: min('11:45') }, // 11:50 -> 11:45
    { inicio: min('13:15'), fim: min('17:30') }, // 13:10 -> 13:15
  ]);
});

test('janela fora da grade de 15 min nunca vende minutos fora do horário real', () => {
  const r = carregarJanelas({ GATIL_JANELAS: '10:05-11:55' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [{ inicio: min('10:15'), fim: min('11:45') }]);
});

test('janela curta demais para a grade, invertida ou mal escrita impede a API de subir', () => {
  for (const valor of ['10:01-10:14', '10:20-10:29', '12:00-11:00', '10h30-11h50', '10:30-24:00', '']) {
    const r = carregarJanelas({ GATIL_JANELAS: valor });
    assert.equal(r.status, 1, `GATIL_JANELAS="${valor}" deveria falhar`);
    assert.match(r.stderr, /GATIL_JANELAS/);
  }
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
