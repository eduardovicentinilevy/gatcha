import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

const URL_BANCO = process.env.TEST_DATABASE_URL;

describe('Cancelamento pelo link do e-mail (integração)', { skip: !URL_BANCO && 'TEST_DATABASE_URL não definida' }, () => {
  let servidor, base, pool, caixa, agoraNoFuso, somarDias, amanha;

  const dados = (extra = {}) => ({ data: amanha, hora_inicio: '14:00', duracao_min: 15, pessoas: 2, nome: 'Cliente Teste', telefone: '11912345678', email: 'cliente@exemplo.com', ...extra });
  const json = (metodo, rota, corpo) => fetch(`${base}${rota}`, { method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const reservar = (extra) => json('POST', '/api/reservas', dados(extra));
  /** Lê código e token do link no e-mail "enviado" (é assim que o cliente os recebe). */
  const linkDoEmail = () => {
    const email = caixa.at(-1);
    const [, codigo, token] = /\/cancelar#(GATCHA-[0-9A-Z]{6})\.([\w-]{32})/.exec(email.texto);
    return { codigo, token, email };
  };
  const cancelar = (codigo, token) => json('DELETE', `/api/reservas/${codigo}`, { token });
  const vagas = async (hora) => (await (await fetch(`${base}/api/horarios?data=${amanha}`)).json()).horarios.find((h) => h.hora_inicio === hora).vagas_15min;

  before(async () => {
    configurarAmbienteDeTeste({ DATABASE_URL: URL_BANCO, DB_POOL_MAX: '10', CANCELAMENTO_ATE_HORAS_ANTES: '1', SITE_URL: 'https://gatcha.exemplo.com/' });
    const { migrar } = await import('../../src/db/migrar.js');
    await migrar({ connectionString: URL_BANCO, ssl: false });
    ({ pool } = await import('../../src/db/pool.js'));
    ({ caixaDeSaidaDeTeste: caixa } = await import('../../src/lib/email.js'));
    ({ agoraNoFuso, somarDias } = await import('../../src/lib/tempo.js'));
    const { criarApp } = await import('../../src/app.js');
    amanha = somarDias(agoraNoFuso('America/Sao_Paulo').data, 1);
    servidor = criarApp().listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE reservas, bloqueios RESTART IDENTITY');
    caixa.length = 0;
  });

  after(async () => {
    await new Promise((r) => servidor?.close(r));
    await pool?.end();
  });

  test('a reserva dispara o e-mail com o link; o token não aparece na resposta da API', async () => {
    const res = await reservar();
    assert.equal(res.status, 201);
    const texto = JSON.stringify(await res.json());
    assert.equal(caixa.length, 1);
    const { codigo, token, email } = linkDoEmail();
    assert.equal(email.para, 'cliente@exemplo.com');
    assert.ok(email.texto.includes(`https://gatcha.exemplo.com/cancelar#${codigo}.${token}`), 'link usa SITE_URL sem barra dupla');
    assert.ok(!texto.includes(token) && !texto.includes('token'), 'a API não devolve o token');
    // só o hash fica no banco
    const { rows } = await pool.query('SELECT token_cancelamento_hash FROM reservas WHERE codigo = $1', [codigo]);
    assert.match(rows[0].token_cancelamento_hash, /^[0-9a-f]{64}$/);
    assert.notEqual(rows[0].token_cancelamento_hash, token);
  });

  test('cancelar libera as vagas e não dá pra cancelar duas vezes', async () => {
    assert.equal((await reservar({ pessoas: 4 })).status, 201);
    const { codigo, token } = linkDoEmail();
    assert.equal(await vagas('14:00'), 2); // capacidade de teste 6 - 4
    const res = await cancelar(codigo, token);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).reserva, { codigo, data: amanha, hora_inicio: '14:00', status: 'cancelada' });
    assert.equal(await vagas('14:00'), 6);
    const outra = await cancelar(codigo, token);
    assert.equal(outra.status, 409);
    assert.equal((await outra.json()).erro.codigo, 'RESERVA_NAO_ATIVA');
  });

  test('token errado, código inexistente e reserva sem token dão a MESMA resposta 404', async () => {
    await reservar();
    const { codigo } = linkDoEmail();
    const erradoMesmoFormato = 'A'.repeat(32);
    await pool.query(`INSERT INTO reservas (codigo, data, hora_inicio, duracao_min, pessoas, nome, telefone, email) VALUES ('GATCHA-SEMTKN', $1, '15:00', 15, 1, 'Antiga', '11900000000', 'a@a.com')`, [amanha]);
    const respostas = [await cancelar(codigo, erradoMesmoFormato), await cancelar('GATCHA-ZZZZZZ', erradoMesmoFormato), await cancelar('GATCHA-SEMTKN', erradoMesmoFormato)];
    const corpos = [];
    for (const r of respostas) {
      assert.equal(r.status, 404);
      corpos.push(await r.json());
    }
    assert.equal(new Set(corpos.map((c) => JSON.stringify([c.erro.codigo, c.erro.mensagem]))).size, 1);
    const { rows } = await pool.query('SELECT status FROM reservas WHERE codigo = $1', [codigo]);
    assert.equal(rows[0].status, 'confirmada');
  });

  test('entradas malformadas são recusadas (400) e o token não pode ir na URL', async () => {
    await reservar();
    const { codigo, token } = linkDoEmail();
    for (const corpo of [{}, { token: 'curto' }, { token: `${token}x` }, { token, extra: 1 }, { token: `${token.slice(0, 30)}<>` }]) {
      assert.equal((await json('DELETE', `/api/reservas/${codigo}`, corpo)).status, 400, JSON.stringify(corpo));
    }
    assert.equal((await cancelar('codigo-invalido', token)).status, 400);
    assert.equal((await fetch(`${base}/api/reservas/${codigo}?token=${token}`, { method: 'DELETE' })).status, 415);
  });

  test('fora do prazo (menos de 1 hora antes) não cancela pelo site', async () => {
    await reservar();
    const { codigo, token } = linkDoEmail();
    // a reserva passa a ser daqui a menos de 1 hora
    const { data, minutos } = agoraNoFuso('America/Sao_Paulo');
    const alvo = Math.ceil((minutos + 20) / 15) * 15; // entre 20 e 35 min daqui, na grade de 15 min
    await pool.query(`UPDATE reservas SET data = $2, hora_inicio = make_time($3, $4, 0) WHERE codigo = $1`, [codigo, alvo >= 1440 ? somarDias(data, 1) : data, Math.floor((alvo % 1440) / 60), alvo % 60]);
    const res = await cancelar(codigo, token);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).erro.codigo, 'FORA_DO_PRAZO_DE_CANCELAMENTO');
    const { rows } = await pool.query('SELECT status FROM reservas WHERE codigo = $1', [codigo]);
    assert.equal(rows[0].status, 'confirmada');
  });
});
});
