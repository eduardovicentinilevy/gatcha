/**
 * Testes de integração contra um PostgreSQL REAL (a garantia de concorrência
 * só pode ser provada no banco). Defina TEST_DATABASE_URL para rodar, ex.:
 *   TEST_DATABASE_URL=postgres://gatcha:senha@localhost:5432/gatcha_test npm test
 * Sem a variável, a suíte é pulada.
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

const URL_BANCO = process.env.TEST_DATABASE_URL;

describe('API de reservas (integração)', { skip: !URL_BANCO && 'TEST_DATABASE_URL não definida' }, () => {
  let servidor, base, pool, agoraNoFuso, somarDias, RE_CODIGO_RESERVA;
  let amanha;

  const reserva = (extra = {}) => ({
    data: amanha,
    hora_inicio: '14:00',
    duracao_min: 15,
    pessoas: 2,
    nome: 'Cliente Teste',
    telefone: '11912345678',
    email: 'cliente@exemplo.com',
    ...extra,
  });

  // Gera contatos distintos para não esbarrar no limite de reservas ativas por contato.
  let seq = 0;
  const contatoUnico = () => {
    seq += 1;
    return { email: `c${seq}@exemplo.com`, telefone: `1191${String(seq).padStart(7, '0')}` };
  };

  const post = (corpo, headers = { 'content-type': 'application/json' }) =>
    fetch(`${base}/api/reservas`, {
      method: 'POST',
      headers,
      body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
    });

  const getHorarios = (data) => fetch(`${base}/api/horarios?data=${encodeURIComponent(data)}`);

  before(async () => {
    configurarAmbienteDeTeste({ DATABASE_URL: URL_BANCO, DB_POOL_MAX: '10' });
    const { migrar } = await import('../../src/db/migrar.js');
    await migrar({ connectionString: URL_BANCO, ssl: false });

    ({ pool } = await import('../../src/db/pool.js'));
    ({ agoraNoFuso, somarDias } = await import('../../src/lib/tempo.js'));
    ({ RE_CODIGO_RESERVA } = await import('../../src/lib/codigo-reserva.js'));
    const { criarApp } = await import('../../src/app.js');

    amanha = somarDias(agoraNoFuso('America/Sao_Paulo').data, 1);
    servidor = criarApp().listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE reservas, bloqueios RESTART IDENTITY');
  });

  after(async () => {
    await new Promise((r) => servidor?.close(r));
    await pool?.end();
  });

  // ---------------------------------------------------------------------------
  // GET /api/horarios
  // ---------------------------------------------------------------------------
  test('GET /horarios devolve a grade do dia com vagas por duração', async () => {
    const res = await getHorarios(amanha);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const corpo = await res.json();
    assert.equal(corpo.aberto, true);
    assert.equal(corpo.capacidade, 6);
    assert.equal(corpo.horarios.length, 16); // 8 células em cada janela de 2h
    assert.deepEqual(corpo.horarios[0], { hora_inicio: '10:00', vagas_15min: 6, vagas_30min: 6 });
    // 11:45 + 30 min ultrapassaria o fim da janela
    assert.deepEqual(corpo.horarios[7], { hora_inicio: '11:45', vagas_15min: 6, vagas_30min: 0 });
  });

  test('GET /horarios rejeita datas inválidas ou fora do período (400)', async () => {
    const hoje = agoraNoFuso('America/Sao_Paulo').data;
    for (const data of ['2026-02-30', '10/10/2026', "2026-10-10' OR 1=1--", somarDias(hoje, -1), somarDias(hoje, 15)]) {
      const res = await getHorarios(data);
      assert.equal(res.status, 400, data);
      const { erro } = await res.json();
      assert.ok(['DADOS_INVALIDOS', 'DATA_FORA_DO_PERIODO'].includes(erro.codigo));
      assert.ok(erro.request_id);
    }
    const semData = await fetch(`${base}/api/horarios`);
    assert.equal(semData.status, 400);
  });

  // ---------------------------------------------------------------------------
  // POST /api/reservas
  // ---------------------------------------------------------------------------
  test('POST /reservas cria a reserva (201) com código único e normaliza os dados', async () => {
    const res = await post(reserva({ telefone: '(11) 91234-5678', email: 'Cliente@Exemplo.com' }));
    assert.equal(res.status, 201);
    const { reserva: r } = await res.json();
    assert.match(r.codigo, RE_CODIGO_RESERVA);
    assert.equal(r.data, amanha);
    assert.equal(r.hora_inicio, '14:00');
    assert.equal(r.status, 'confirmada');
    assert.equal(r.email, undefined, 'e-mail não deve ser ecoado na resposta');

    const { rows } = await pool.query('SELECT telefone, email FROM reservas WHERE codigo = $1', [r.codigo]);
    assert.deepEqual(rows[0], { telefone: '11912345678', email: 'cliente@exemplo.com' });
  });

  test('REGRA DE OURO: 20 requisições simultâneas nunca excedem a capacidade', async () => {
    // Capacidade 6, cada pedido de 2 pessoas -> exatamente 3 sucessos.
    const respostas = await Promise.all(
      Array.from({ length: 20 }, () => post(reserva({ hora_inicio: '14:30', ...contatoUnico() }))),
    );
    const status = respostas.map((r) => r.status).sort();
    assert.equal(status.filter((s) => s === 201).length, 3, `status: ${status}`);
    assert.equal(status.filter((s) => s === 409).length, 17, `status: ${status}`);

    const corpo409 = await respostas.find((r) => r.status === 409).json();
    assert.equal(corpo409.erro.codigo, 'VAGAS_INSUFICIENTES');

    const { rows } = await pool.query(
      "SELECT coalesce(sum(pessoas), 0)::int AS total FROM reservas WHERE data = $1 AND hora_inicio = '14:30'",
      [amanha],
    );
    assert.equal(rows[0].total, 6);
  });

  test('REGRA DE OURO: corrida pela ÚLTIMA vaga com durações sobrepostas', async () => {
    await post(reserva({ hora_inicio: '10:00', duracao_min: 30, pessoas: 4, ...contatoUnico() }));
    await post(reserva({ hora_inicio: '10:15', duracao_min: 15, pessoas: 1, ...contatoUnico() }));
    // Resta 1 vaga às 10:15. Dez pessoas disputam ao mesmo tempo, via 10:00/30min e 10:15/15min.
    const respostas = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        post(reserva({ hora_inicio: i % 2 ? '10:00' : '10:15', duracao_min: i % 2 ? 30 : 15, pessoas: 1, ...contatoUnico() })),
      ),
    );
    assert.equal(respostas.filter((r) => r.status === 201).length, 1);

    const horarios = (await (await getHorarios(amanha)).json()).horarios;
    assert.equal(horarios.find((h) => h.hora_inicio === '10:15').vagas_15min, 0);
  });

  test('reserva de 30 min respeita a ocupação das duas células', async () => {
    assert.equal((await post(reserva({ hora_inicio: '10:00', duracao_min: 30, pessoas: 4, ...contatoUnico() }))).status, 201);
    const res = await post(reserva({ hora_inicio: '10:15', pessoas: 3, ...contatoUnico() }));
    assert.equal(res.status, 409);
    assert.deepEqual((await res.json()).erro.detalhes, { vagas_disponiveis: 2 });

    const horarios = (await (await getHorarios(amanha)).json()).horarios;
    assert.deepEqual(horarios.find((h) => h.hora_inicio === '10:00'), { hora_inicio: '10:00', vagas_15min: 2, vagas_30min: 2 });
    assert.deepEqual(horarios.find((h) => h.hora_inicio === '10:30'), { hora_inicio: '10:30', vagas_15min: 6, vagas_30min: 6 });
  });

  test('reservas canceladas liberam a vaga', async () => {
    await pool.query(
      `INSERT INTO reservas (codigo, data, hora_inicio, duracao_min, pessoas, nome, telefone, email, status)
       VALUES ('GATCHA-CANCEL', $1, '15:00', 15, 6, 'X Y', '11999999999', 'x@y.com', 'cancelada')`,
      [amanha],
    );
    assert.equal((await post(reserva({ hora_inicio: '15:00', pessoas: 4 }))).status, 201);
  });

  test('horário bloqueado pela equipe retorna 409 HORARIO_BLOQUEADO', async () => {
    await pool.query("INSERT INTO bloqueios (data, hora_inicio, hora_fim, motivo) VALUES ($1, '15:00', '15:30', 'Limpeza')", [amanha]);
    for (const extra of [{ hora_inicio: '15:15' }, { hora_inicio: '14:45', duracao_min: 30 }]) {
      const res = await post(reserva(extra));
      assert.equal(res.status, 409);
      assert.equal((await res.json()).erro.codigo, 'HORARIO_BLOQUEADO');
    }
    const horarios = (await (await getHorarios(amanha)).json()).horarios;
    assert.deepEqual(horarios.find((h) => h.hora_inicio === '14:45'), { hora_inicio: '14:45', vagas_15min: 6, vagas_30min: 0 });
  });

  test('limite de reservas ativas por contato (409)', async () => {
    for (const hora of ['10:00', '10:15', '10:30']) assert.equal((await post(reserva({ hora_inicio: hora }))).status, 201);
    const res = await post(reserva({ hora_inicio: '10:45', email: 'outro@exemplo.com' })); // mesmo telefone
    assert.equal(res.status, 409);
    assert.equal((await res.json()).erro.codigo, 'LIMITE_DE_RESERVAS_ATIVAS');
  });

  test('regras de agenda retornam 400 com código específico', async () => {
    const hoje = agoraNoFuso('America/Sao_Paulo').data;
    const casos = [
      [{ hora_inicio: '12:00' }, 'HORARIO_FORA_DO_FUNCIONAMENTO'],
      [{ hora_inicio: '11:45', duracao_min: 30 }, 'HORARIO_FORA_DO_FUNCIONAMENTO'],
      [{ data: somarDias(hoje, -1) }, 'DATA_FORA_DO_PERIODO'],
      [{ data: somarDias(hoje, 15) }, 'DATA_FORA_DO_PERIODO'],
    ];
    for (const [extra, codigo] of casos) {
      const res = await post(reserva(extra));
      assert.equal(res.status, 400, JSON.stringify(extra));
      assert.equal((await res.json()).erro.codigo, codigo);
    }
  });

  test('entrada maliciosa ou malformada é barrada antes do banco', async () => {
    const invalidos = [
      reserva({ status: 'compareceu' }),
      reserva({ nome: "Robert'); DROP TABLE reservas;--" }),
      reserva({ nome: '<img src=x onerror=alert(1)>' }),
      reserva({ pessoas: '2' }),
      reserva({ pessoas: 5 }),
    ];
    for (const corpo of invalidos) {
      const res = await post(corpo);
      assert.equal(res.status, 400);
      const { erro } = await res.json();
      assert.equal(erro.codigo, 'DADOS_INVALIDOS');
      assert.ok(Array.isArray(erro.detalhes.campos) && erro.detalhes.campos.length > 0);
    }

    const jsonQuebrado = await post('{"data": ');
    assert.equal(jsonQuebrado.status, 400);
    assert.equal((await jsonQuebrado.json()).erro.codigo, 'JSON_INVALIDO');

    const semJson = await post('data=2026-10-10', { 'content-type': 'application/x-www-form-urlencoded' });
    assert.equal(semJson.status, 415);

    const gigante = await post(reserva({ nome: 'a'.repeat(20_000) }));
    assert.equal(gigante.status, 413);

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM reservas');
    assert.equal(rows[0].n, 0);
  });

  test('rota inexistente devolve 404 no formato padrão e headers de segurança', async () => {
    const res = await fetch(`${base}/api/nao-existe`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).erro.codigo, 'ROTA_NAO_ENCONTRADA');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('x-request-id'));
  });
});
