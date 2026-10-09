import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

const URL_BANCO = process.env.TEST_DATABASE_URL;

describe('Limites de taxa no Postgres (integração)', { skip: !URL_BANCO && 'TEST_DATABASE_URL não definida' }, () => {
  let pool, LimitePostgres, apagarLimitesVencidos;
  /** Duas "instâncias do Cloud Run": cada uma com o seu objeto, o mesmo banco. */
  const instancia = (prefixo = 'login', janelaMs = 60_000) => {
    const store = new LimitePostgres(prefixo);
    store.init({ windowMs: janelaMs });
    return store;
  };

  before(async () => {
    configurarAmbienteDeTeste({ DATABASE_URL: URL_BANCO, JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-ok' });
    const { migrar } = await import('../../src/db/migrar.js');
    await migrar({ connectionString: URL_BANCO, ssl: false });
    ({ pool } = await import('../../src/db/pool.js'));
    ({ LimitePostgres, apagarLimitesVencidos } = await import('../../src/middlewares/limite-postgres.js'));
  });

  beforeEach(() => pool.query('TRUNCATE limites_taxa'));
  after(() => pool?.end());

  test('a contagem é a MESMA em todas as instâncias (o MemoryStore contaria cada uma à parte)', async () => {
    const a = instancia();
    const b = instancia();
    assert.equal((await a.increment('203.0.113.7')).totalHits, 1);
    assert.equal((await b.increment('203.0.113.7')).totalHits, 2);
    assert.equal((await a.increment('203.0.113.7')).totalHits, 3);
    assert.equal((await b.get('203.0.113.7')).totalHits, 3);
  });

  test('acessos simultâneos não se perdem (sem corrida)', async () => {
    const lojas = Array.from({ length: 5 }, () => instancia());
    await Promise.all(Array.from({ length: 50 }, (_, i) => lojas[i % 5].increment('198.51.100.1')));
    assert.equal((await lojas[0].get('198.51.100.1')).totalHits, 50);
  });

  test('a janela vence sozinha e a contagem recomeça', async () => {
    const a = instancia('login', 60_000);
    await a.increment('203.0.113.7');
    const { resetTime } = await a.increment('203.0.113.7');
    assert.ok(resetTime > new Date() && resetTime <= new Date(Date.now() + 61_000));
    await pool.query("UPDATE limites_taxa SET expira_em = now() - interval '1 second'");
    assert.equal(await a.get('203.0.113.7'), undefined);
    assert.equal((await a.increment('203.0.113.7')).totalHits, 1);
  });

  test('limitadores e clientes diferentes não se misturam', async () => {
    await instancia('login').increment('203.0.113.7');
    await instancia('login').increment('203.0.113.7');
    assert.equal((await instancia('interesse').increment('203.0.113.7')).totalHits, 1);
    assert.equal((await instancia('login').increment('203.0.113.8')).totalHits, 1);
  });

  test('o IP não fica gravado no banco (só um HMAC)', async () => {
    await instancia().increment('203.0.113.7');
    const { rows } = await pool.query('SELECT chave FROM limites_taxa');
    assert.equal(rows.length, 1);
    assert.match(rows[0].chave, /^[\w-]{43}$/);
    assert.ok(!rows[0].chave.includes('203.0.113.7'));
  });

  test('decrement e resetKey (usados pelo express-rate-limit)', async () => {
    const a = instancia();
    await a.increment('x');
    await a.increment('x');
    await a.decrement('x');
    assert.equal((await a.get('x')).totalHits, 1);
    await a.resetKey('x');
    assert.equal(await a.get('x'), undefined);
  });

  test('expurgo apaga só as janelas vencidas', async () => {
    await instancia().increment('vencido');
    await pool.query("UPDATE limites_taxa SET expira_em = now() - interval '1 minute'");
    await instancia().increment('ativo');
    assert.equal(await apagarLimitesVencidos(pool), 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM limites_taxa')).rows[0].n, 1);
  });
});
