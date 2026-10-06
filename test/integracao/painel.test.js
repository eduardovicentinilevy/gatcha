import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

const URL_BANCO = process.env.TEST_DATABASE_URL;
const SENHA = 'Matcha-e-gatos-2026!';

describe('Painel administrativo (integração)', { skip: !URL_BANCO && 'TEST_DATABASE_URL não definida' }, () => {
  let servidor, base, pool, token, agoraNoFuso, somarDias, amanha;

  const chamar = (metodo, rota, corpo, t = token) =>
    fetch(`${base}/api/admin${rota}`, {
      method: metodo,
      headers: { ...(corpo !== undefined && { 'content-type': 'application/json' }), ...(t && { authorization: `Bearer ${t}` }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  const publico = (rota) => fetch(`${base}/api${rota}`);
  const reservar = (extra = {}) =>
    fetch(`${base}/api/reservas`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: amanha, hora_inicio: '14:00', duracao_min: 15, pessoas: 2, nome: 'Cliente Teste', telefone: '11912345678', email: 'cliente@exemplo.com', ...extra }),
    });

  before(async () => {
    configurarAmbienteDeTeste({ DATABASE_URL: URL_BANCO, DB_POOL_MAX: '10', JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-ok', RATE_LIMIT_LOGIN_POR_15MIN: '1000' });
    const { migrar } = await import('../../src/db/migrar.js');
    await migrar({ connectionString: URL_BANCO, ssl: false });
    ({ pool } = await import('../../src/db/pool.js'));
    ({ agoraNoFuso, somarDias } = await import('../../src/lib/tempo.js'));
    const { gerarHash } = await import('../../src/modules/auth/senha.js');
    const { criarUsuario } = await import('../../src/modules/auth/auth.repository.js');
    await pool.query('TRUNCATE acessos_admin, usuarios_admin RESTART IDENTITY CASCADE');
    await criarUsuario(pool, { email: 'equipe@gatcha.com.br', senhaHash: await gerarHash(SENHA) });
    const { criarApp } = await import('../../src/app.js');
    amanha = somarDias(agoraNoFuso('America/Sao_Paulo').data, 1);
    servidor = criarApp().listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${servidor.address().port}`;
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'equipe@gatcha.com.br', senha: SENHA }) });
    ({ token } = await login.json());
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE reservas, bloqueios, interesses_adocao, gatos, itens_cardapio RESTART IDENTITY CASCADE');
  });

  after(async () => {
    await new Promise((r) => servidor?.close(r));
    await pool?.end();
  });

  test('TODAS as rotas do painel exigem login (sem token ou com token falso = 401)', async () => {
    const rotas = [['GET', '/reservas'], ['PATCH', '/reservas/GATCHA-AAAAAA', { status: 'cancelada' }], ['GET', '/bloqueios'], ['POST', '/bloqueios', {}], ['DELETE', '/bloqueios/1'],
      ['GET', '/gatos'], ['POST', '/gatos', {}], ['PATCH', '/gatos/1', {}], ['DELETE', '/gatos/1'], ['GET', '/cardapio'], ['POST', '/cardapio', {}], ['PATCH', '/cardapio/1', {}], ['DELETE', '/cardapio/1'],
      ['GET', '/interesses'], ['PATCH', '/interesses/1', { status: 'repassado' }]];
    for (const [metodo, rota, corpo] of rotas) {
      assert.equal((await chamar(metodo, rota, corpo, null)).status, 401, `${metodo} ${rota} sem token`);
      assert.equal((await chamar(metodo, rota, corpo, 'a.b.c')).status, 401, `${metodo} ${rota} token falso`);
    }
  });

  test('reservas: lista com dados de contato, filtra por status e cancelar libera a vaga', async () => {
    await reservar({ pessoas: 4 });
    const lista = await (await chamar('GET', `/reservas?de=${amanha}&ate=${amanha}`)).json();
    assert.equal(lista.reservas.length, 1);
    const r = lista.reservas[0];
    assert.equal(r.nome, 'Cliente Teste');
    assert.equal(r.telefone, '11912345678');
    assert.ok(!('token_cancelamento_hash' in r));

    assert.equal((await chamar('PATCH', `/reservas/${r.codigo}`, { status: 'cancelada' })).status, 200);
    const horarios = await (await fetch(`${base}/api/horarios?data=${amanha}`)).json();
    assert.equal(horarios.horarios.find((h) => h.hora_inicio === '14:00').vagas_15min, 6);
    assert.equal((await (await chamar('GET', `/reservas?de=${amanha}&ate=${amanha}&status=confirmada`)).json()).reservas.length, 0);

    // cancelada é definitiva; código inexistente = 404; status inválido = 400
    assert.equal((await chamar('PATCH', `/reservas/${r.codigo}`, { status: 'confirmada' })).status, 409);
    assert.equal((await chamar('PATCH', '/reservas/GATCHA-ZZZZZZ', { status: 'cancelada' })).status, 404);
    assert.equal((await chamar('PATCH', `/reservas/${r.codigo}`, { status: 'qualquer' })).status, 400);
    assert.equal((await chamar('PATCH', `/reservas/${r.codigo}`, { status: 'cancelada', nome: 'X' })).status, 400);
  });

  test('reservas: marcar comparecimento e voltar atrás', async () => {
    await reservar();
    const { codigo } = (await (await chamar('GET', `/reservas?de=${amanha}&ate=${amanha}`)).json()).reservas[0];
    assert.equal((await chamar('PATCH', `/reservas/${codigo}`, { status: 'compareceu' })).status, 200);
    assert.equal((await chamar('PATCH', `/reservas/${codigo}`, { status: 'cancelada' })).status, 409);
    assert.equal((await chamar('PATCH', `/reservas/${codigo}`, { status: 'confirmada' })).status, 200);
  });

  test('reservas: período invertido ou longo demais é recusado', async () => {
    assert.equal((await chamar('GET', `/reservas?de=${amanha}&ate=2020-01-01`)).status, 400);
    assert.equal((await chamar('GET', '/reservas?de=2024-01-01&ate=2026-12-31')).status, 400);
  });

  test('bloqueios: criar fecha o horário na grade pública, avisa reservas afetadas e apagar reabre', async () => {
    await reservar({ hora_inicio: '14:00' });
    const res = await chamar('POST', '/bloqueios', { data: amanha, hora_inicio: '14:00', hora_fim: '15:00', motivo: 'Limpeza' });
    assert.equal(res.status, 201);
    const corpo = await res.json();
    assert.equal(corpo.reservas_afetadas, 1);
    assert.equal(corpo.bloqueio.motivo, 'Limpeza');
    const grade = async () => (await (await fetch(`${base}/api/horarios?data=${amanha}`)).json()).horarios.find((h) => h.hora_inicio === '14:15').vagas_15min;
    assert.equal(await grade(), 0);
    const outra = await reservar({ hora_inicio: '14:15', email: 'outro@exemplo.com', telefone: '11999990000' });
    assert.equal(outra.status, 409);
    assert.equal((await outra.json()).erro.codigo, 'HORARIO_BLOQUEADO');
    assert.equal((await chamar('DELETE', `/bloqueios/${corpo.bloqueio.id}`)).status, 204);
    assert.equal(await grade(), 6);
    assert.equal((await chamar('DELETE', `/bloqueios/${corpo.bloqueio.id}`)).status, 404);
  });

  test('bloqueios: validação (fim depois do início, grade de 15 min, 24:00 permitido)', async () => {
    const post = (b) => chamar('POST', '/bloqueios', { data: amanha, hora_inicio: '14:00', hora_fim: '15:00', ...b });
    assert.equal((await post({ hora_fim: '13:00' })).status, 400);
    assert.equal((await post({ hora_inicio: '14:10' })).status, 400);
    assert.equal((await post({ data: '2026-02-30' })).status, 400);
    assert.equal((await post({ hora_inicio: '18:00', hora_fim: '24:00' })).status, 201);
  });

  test('gatos: criar aparece no site; adotado some do site; apagar com interessado é 409', async () => {
    const criado = await chamar('POST', '/gatos', { nome: 'Matcha', sexo: 'femea', idade_meses: 8, personalidade: ' curiosa, brincalhona ', foto_url: '/img/gatos/matcha.jpg' });
    assert.equal(criado.status, 201);
    const { gato } = await criado.json();
    assert.equal(gato.personalidade, 'curiosa, brincalhona');
    assert.equal(gato.status, 'disponivel');
    assert.equal((await (await publico('/gatos')).json()).gatos.length, 1);

    // interessado
    const interesse = await fetch(`${base}/api/interesses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gato_id: gato.id, nome: 'Maria Silva', contato: '(11) 91234-5678', mensagem: 'Quero conhecer!' }) });
    assert.equal(interesse.status, 201);
    assert.equal((await chamar('DELETE', `/gatos/${gato.id}`)).status, 409);

    assert.equal((await chamar('PATCH', `/gatos/${gato.id}`, { status: 'adotado' })).status, 200);
    assert.equal((await (await publico('/gatos')).json()).gatos.length, 0);
    assert.equal((await chamar('GET', '/gatos').then((r) => r.json())).gatos.length, 1); // painel ainda vê
    const novo = await fetch(`${base}/api/interesses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gato_id: gato.id, nome: 'Maria Silva', contato: 'maria@exemplo.com' }) });
    assert.equal(novo.status, 409); // já adotado
  });

  test('gatos: validação (sexo, idade, foto só https ou caminho do site, campos extras)', async () => {
    const post = (b) => chamar('POST', '/gatos', { nome: 'Mochi', sexo: 'macho', ...b });
    assert.equal((await post({})).status, 201);
    for (const ruim of [{ sexo: 'outro' }, { idade_meses: -1 }, { idade_meses: 361 }, { idade_meses: 1.5 }, { foto_url: 'http://x.com/a.jpg' }, { foto_url: 'javascript:alert(1)' }, { foto_url: '//evil.com/a.jpg' }, { nome: '<b>x</b>' }, { status: 'sumiu' }, { id: 5 }, { personalidade: 'a'.repeat(501) }]) {
      assert.equal((await post(ruim)).status, 400, JSON.stringify(ruim));
    }
    assert.equal((await chamar('PATCH', '/gatos/1', {})).status, 400);
    assert.equal((await chamar('PATCH', '/gatos/999', { nome: 'Fantasma' })).status, 404);
    assert.equal((await chamar('PATCH', '/gatos/abc', { nome: 'X' })).status, 400);
  });

  test('cardápio: CRUD, só ativos no site, selos validados e duplicado = 409', async () => {
    const criar = (b) => chamar('POST', '/cardapio', { categoria: 'Bebidas', nome: 'Matchá latte', preco_centavos: 2200, ...b });
    const res = await criar({ descricao: 'Batido na hora', selos: ['mais_pedido', 'mais_pedido', 'vegano'] });
    assert.equal(res.status, 201);
    const { item } = await res.json();
    assert.deepEqual(item.selos, ['mais_pedido', 'vegano']);
    assert.equal((await criar({})).status, 409);
    assert.equal((await criar({ nome: 'Hojicha' })).status, 201);

    assert.equal((await (await publico('/cardapio')).json()).itens.length, 2);
    assert.equal((await chamar('PATCH', `/cardapio/${item.id}`, { ativo: false, preco_centavos: 2300 })).status, 200);
    const publicos = (await (await publico('/cardapio')).json()).itens;
    assert.deepEqual(publicos.map((i) => i.nome), ['Hojicha']);
    assert.equal((await chamar('GET', '/cardapio').then((r) => r.json())).itens.length, 2);

    for (const ruim of [{ preco_centavos: -1 }, { preco_centavos: 12.5 }, { selos: ['gratis'] }, { ativo: 'sim' }, { foto_url: 'ftp://x' }, { nome: '' }]) {
      assert.equal((await criar({ nome: 'Outro', ...ruim })).status, 400, JSON.stringify(ruim));
    }
    assert.equal((await chamar('DELETE', `/cardapio/${item.id}`)).status, 204);
    assert.equal((await chamar('DELETE', `/cardapio/${item.id}`)).status, 404);
  });

  test('interessados: listar com o nome do gato e marcar como repassado', async () => {
    const { gato } = await (await chamar('POST', '/gatos', { nome: 'Tofu', sexo: 'macho' })).json();
    await fetch(`${base}/api/interesses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gato_id: gato.id, nome: 'Joana', contato: 'JOANA@Exemplo.com' }) });
    const lista = (await (await chamar('GET', '/interesses?status=novo')).json()).interesses;
    assert.equal(lista.length, 1);
    assert.equal(lista[0].gato, 'Tofu');
    assert.equal(lista[0].contato, 'joana@exemplo.com');
    assert.equal((await chamar('PATCH', `/interesses/${lista[0].id}`, { status: 'repassado' })).status, 200);
    assert.equal((await (await chamar('GET', '/interesses?status=novo')).json()).interesses.length, 0);
    assert.equal((await chamar('PATCH', '/interesses/999', { status: 'repassado' })).status, 404);
  });

  test('interesse público: valida contato, gato inexistente e não ecoa dados', async () => {
    const { gato } = await (await chamar('POST', '/gatos', { nome: 'Sakura', sexo: 'femea' })).json();
    const enviar = (b) => fetch(`${base}/api/interesses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gato_id: gato.id, nome: 'Ana Lima', contato: 'ana@exemplo.com', ...b }) });
    const ok = await enviar({});
    assert.equal(ok.status, 201);
    assert.deepEqual(await ok.json(), { ok: true });
    for (const ruim of [{ contato: 'sem-arroba' }, { contato: '123' }, { nome: '<script>' }, { gato_id: 'x' }, { mensagem: 'a'.repeat(1001) }, { extra: 1 }]) {
      assert.equal((await enviar(ruim)).status, 400, JSON.stringify(ruim));
    }
    assert.equal((await enviar({ gato_id: 99999 })).status, 409);
  });

  test('o log de acessos registra as ações do painel (sem corpo nem token)', async () => {
    await chamar('POST', '/gatos', { nome: 'Wasabi', sexo: 'macho' });
    await new Promise((r) => setTimeout(r, 100));
    const { rows } = await pool.query(`SELECT metodo, rota, status FROM acessos_admin WHERE rota = '/api/admin/gatos' AND metodo = 'POST'`);
    assert.ok(rows.length >= 1);
    assert.equal(rows[0].status, 201);
  });
});
