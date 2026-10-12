import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

const URL_BANCO = process.env.TEST_DATABASE_URL;
const SENHA = 'Matcha-e-gatos-2026!';

describe('Painel: login, token e log de acessos (integração)', { skip: !URL_BANCO && 'TEST_DATABASE_URL não definida' }, () => {
  let servidor, base, pool, gerarHash, criarUsuario, apagarAcessosAntigos;

  const post = (corpo, rota = '/api/auth/login') =>
    fetch(`${base}${rota}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const login = (email = 'equipe@gatcha.com.br', senha = SENHA, ip) =>
    fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', ...(ip && { 'x-forwarded-for': ip }) }, body: JSON.stringify({ email, senha }) });
  const eu = (token) => fetch(`${base}/api/admin/eu`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  before(async () => {
    configurarAmbienteDeTeste({
      DATABASE_URL: URL_BANCO, DB_POOL_MAX: '10', LOG_LEVEL: 'silent',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-ok', LOGIN_MAX_FALHAS_POR_EMAIL: '5', LOGIN_MAX_FALHAS_GLOBAL_POR_EMAIL: '8', RATE_LIMIT_LOGIN_POR_15MIN: '1000',
    });
    const { migrar } = await import('../../src/db/migrar.js');
    await migrar({ connectionString: URL_BANCO, ssl: false });
    ({ pool } = await import('../../src/db/pool.js'));
    ({ gerarHash } = await import('../../src/modules/auth/senha.js'));
    ({ criarUsuario } = await import('../../src/modules/auth/auth.repository.js'));
    ({ apagarAcessosAntigos } = await import('../../src/modules/auth/auth.repository.js'));
    const { criarApp } = await import('../../src/app.js');
    servidor = criarApp().listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE acessos_admin, usuarios_admin, limites_taxa RESTART IDENTITY CASCADE');
    await criarUsuario(pool, { email: 'equipe@gatcha.com.br', senhaHash: await gerarHash(SENHA) });
  });

  after(async () => {
    await new Promise((r) => servidor?.close(r));
    await pool?.end();
  });

  test('login correto devolve token de curta duração e o token abre o painel', async () => {
    const res = await login();
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.deepEqual(corpo.usuario, { email: 'equipe@gatcha.com.br' });
    assert.ok(corpo.token.split('.').length === 3);
    assert.ok(!JSON.stringify(corpo).includes(SENHA));
    const painel = await eu(corpo.token);
    assert.equal(painel.status, 200);
    assert.deepEqual(await painel.json(), { usuario: { email: 'equipe@gatcha.com.br' } });
  });

  test('e-mail é normalizado (maiúsculas e espaços)', async () => {
    assert.equal((await login('  EQUIPE@Gatcha.com.br ')).status, 200);
  });

  test('senha errada e e-mail inexistente dão a MESMA resposta (não revela quem existe)', async () => {
    const [errada, inexistente] = [await login('equipe@gatcha.com.br', 'senha-errada-qualquer'), await login('ninguem@gatcha.com.br')];
    assert.equal(errada.status, 401);
    assert.equal(inexistente.status, 401);
    const [a, b] = [await errada.json(), await inexistente.json()];
    assert.equal(a.erro.codigo, 'CREDENCIAIS_INVALIDAS');
    assert.equal(a.erro.mensagem, b.erro.mensagem);
    assert.equal(a.erro.codigo, b.erro.codigo);
  });

  test('FORÇA BRUTA: após 5 falhas o e-mail é bloqueado, mesmo com a senha certa', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await login('equipe@gatcha.com.br', `errada-${i}-xxxxxxxx`)).status, 401);
    const bloqueado = await login();
    assert.equal(bloqueado.status, 429);
    assert.equal((await bloqueado.json()).erro.codigo, 'MUITAS_TENTATIVAS');
    // e-mails que não existem também bloqueiam (não revela quais existem)
    for (let i = 0; i < 5; i++) await login('fantasma@gatcha.com.br', `errada-${i}-xxxxxxxx`);
    assert.equal((await login('fantasma@gatcha.com.br')).status, 429);
  });

  test('FORÇA BRUTA em paralelo: 30 tentativas simultâneas não passam do limite', async () => {
    const respostas = await Promise.all(Array.from({ length: 30 }, (_, i) => login('equipe@gatcha.com.br', `paralela-${i}-xxxxxxx`)));
    const status = respostas.map((r) => r.status);
    assert.equal(status.filter((s) => s === 401).length, 5, `status: ${status}`);
    assert.equal(status.filter((s) => s === 429).length, 25, `status: ${status}`);
  });

  test('ATAQUE DE TRANCAMENTO: quem erra a senha de propósito de outro IP não tranca a conta da equipe', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await login('equipe@gatcha.com.br', `ataque-${i}-xxxxxxxx`, '203.0.113.9')).status, 401);
    assert.equal((await login('equipe@gatcha.com.br', SENHA, '203.0.113.9')).status, 429, 'o IP do atacante fica bloqueado');
    assert.equal((await login('equipe@gatcha.com.br', SENHA, '198.51.100.7')).status, 200, 'a equipe, de outro IP, entra normalmente');
  });

  test('ataque distribuído: muitas falhas somando vários IPs bloqueiam o e-mail (limite global)', async () => {
    for (let i = 0; i < 8; i++) assert.equal((await login('equipe@gatcha.com.br', `distribuido-${i}-xxxxx`, `203.0.113.${10 + i}`)).status, 401);
    assert.equal((await login('equipe@gatcha.com.br', SENHA, '198.51.100.7')).status, 429);
  });

  test('tentativas BLOQUEADAS não prolongam o bloqueio: ele expira sozinho', async () => {
    for (let i = 0; i < 5; i++) await login('equipe@gatcha.com.br', `errada-${i}-xxxxxxxx`);
    for (let i = 0; i < 6; i++) assert.equal((await login('equipe@gatcha.com.br', SENHA)).status, 429); // insistindo (mais que o limite)
    // 16 minutos depois: as falhas reais saíram da janela; as tentativas bloqueadas (recentes) não contam
    await pool.query("UPDATE acessos_admin SET criado_em = now() - interval '16 minutes' WHERE status = 401");
    assert.equal((await login()).status, 200);
  });

  test('trocar a senha encerra as sessões já emitidas', async () => {
    const { token } = await (await login()).json();
    assert.equal((await eu(token)).status, 200);
    await pool.query("UPDATE usuarios_admin SET senha_hash = senha_hash, senha_alterada_em = now() + interval '5 seconds'");
    assert.equal((await eu(token)).status, 401);
  });

  test('login correto zera as falhas anteriores', async () => {
    for (let i = 0; i < 4; i++) await login('equipe@gatcha.com.br', `errada-${i}-xxxxxxxx`);
    assert.equal((await login()).status, 200);
    for (let i = 0; i < 4; i++) assert.equal((await login('equipe@gatcha.com.br', `outra-${i}-xxxxxxxxx`)).status, 401);
  });

  test('rotas do painel exigem token válido', async () => {
    assert.equal((await eu()).status, 401);
    assert.equal((await eu('lixo')).status, 401);
    assert.equal((await fetch(`${base}/api/admin/eu`, { headers: { authorization: 'Basic abc' } })).status, 401);
    const { token } = await (await login()).json();
    // usuário apagado = sessão encerrada, mesmo com token ainda dentro da validade
    await pool.query('DELETE FROM usuarios_admin');
    const depois = await eu(token);
    assert.equal(depois.status, 401);
    assert.equal((await depois.json()).erro.codigo, 'NAO_AUTENTICADO');
  });

  test('entrada inválida no login é barrada (400) sem tocar no banco', async () => {
    for (const corpo of [{}, { email: 'x' }, { email: 'a@b.com' }, { email: 'a@b.com', senha: '' }, { email: 'a@b.com', senha: 'x'.repeat(201) }, { email: 'a@b.com', senha: 'x', admin: true }]) {
      assert.equal((await post(corpo)).status, 400, JSON.stringify(corpo).slice(0, 40));
    }
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM acessos_admin');
    assert.equal(rows[0].n, 0);
  });

  test('LOG DE ACESSOS: registra logins e acessos ao painel, nunca a senha nem o token', async () => {
    await login('equipe@gatcha.com.br', 'senha-errada-qualquer');
    const { token } = await (await login()).json();
    await eu(token);
    await new Promise((r) => setTimeout(r, 300)); // o log do acesso é gravado ao fim da resposta
    const { rows } = await pool.query('SELECT evento, email, metodo, rota, status, ip, usuario_id FROM acessos_admin ORDER BY id');
    assert.deepEqual(rows.map((r) => r.evento), ['login_falha', 'login_ok', 'acesso']);
    assert.deepEqual(rows.map((r) => r.status), [401, 200, 200]);
    assert.equal(rows[2].rota, '/api/admin/eu');
    assert.equal(rows[2].metodo, 'GET');
    assert.equal(rows[2].status, 200);
    assert.ok(rows[2].usuario_id && rows[2].ip);
    const tudo = JSON.stringify((await pool.query('SELECT * FROM acessos_admin')).rows);
    assert.ok(!tudo.includes(SENHA) && !tudo.includes('senha-errada-qualquer') && !tudo.includes(token));
  });

  test('só o hash bcrypt fica no banco; a senha em texto nunca', async () => {
    const { rows } = await pool.query('SELECT senha_hash FROM usuarios_admin');
    assert.match(rows[0].senha_hash, /^\$2[aby]\$12\$/);
    assert.ok(!rows[0].senha_hash.includes(SENHA));
    await assert.rejects(pool.query("INSERT INTO usuarios_admin (email, senha_hash) VALUES ('x@y.com', 'texto-puro')"), /usuarios_admin_hash_bcrypt/);
  });

  test('limite por IP do login: só as tentativas que FALHAM contam', async () => {
    const contagem = async () => (await pool.query('SELECT coalesce(sum(contagem), 0)::int AS n FROM limites_taxa')).rows[0].n;
    // O express-rate-limit só desconta o login certo DEPOIS de responder: espera o desconto chegar ao banco.
    const contagemAssentada = async (esperada) => {
      for (let i = 0; i < 40 && (await contagem()) !== esperada; i++) await new Promise((r) => setTimeout(r, 50));
      return contagem();
    };
    assert.equal((await login()).status, 200);
    assert.equal(await contagemAssentada(0), 0, 'login certo não gasta o limite (equipe no Wi-Fi do café)');
    assert.equal((await login(undefined, 'Senha-Errada-123!')).status, 401);
    assert.equal(await contagem(), 1);
  });

  test('limpeza: apaga o log de acessos antigo e preserva o recente', async () => {
    await pool.query("INSERT INTO acessos_admin (email, evento, rota, criado_em) VALUES ('x@y.com', 'acesso', '/velho', now() - interval '100 days'), ('x@y.com', 'acesso', '/novo', now())");
    assert.equal(await apagarAcessosAntigos(pool, { dias: 90, fuso: 'America/Sao_Paulo' }), 1);
    const { rows } = await pool.query("SELECT rota FROM acessos_admin WHERE email = 'x@y.com'");
    assert.deepEqual(rows.map((r) => r.rota), ['/novo']);
  });
});

describe('Painel sem JWT_SECRET configurado', { skip: !URL_BANCO && 'TEST_DATABASE_URL não definida' }, () => {
  test('login fica desativado (503) em vez de aceitar qualquer coisa', async () => {
    const { spawnSync } = await import('node:child_process');
    const script = `
      const { criarApp } = await import('./src/app.js');
      const s = criarApp().listen(0); await new Promise((r) => s.once('listening', r));
      const r = await fetch('http://127.0.0.1:' + s.address().port + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@b.com', senha: 'x' }) });
      console.log(r.status, (await r.json()).erro.codigo); s.close(); process.exit(0);`;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'silent', DB_SSL: 'false', JWT_SECRET: '', DATABASE_URL: URL_BANCO }, encoding: 'utf8', cwd: process.cwd(),
    });
    assert.equal(r.stdout.trim(), '503 LOGIN_INDISPONIVEL', r.stderr);
  });
});
