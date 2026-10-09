import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

const URL_BANCO = process.env.TEST_DATABASE_URL;
const SENHA = 'Matcha-e-gatos-2026!';

describe('Painel: login, token e log de acessos (integração)', { skip: !URL_BANCO && 'TEST_DATABASE_URL não definida' }, () => {
  let servidor, base, pool, gerarHash, criarUsuario, expurgar, totp, definirSegredo2fa;

  const post = (corpo, rota = '/api/auth/login') =>
    fetch(`${base}${rota}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const login = (email = 'equipe@gatcha.com.br', senha = SENHA, ip, codigo) =>
    fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', ...(ip && { 'x-forwarded-for': ip }) }, body: JSON.stringify({ email, senha, ...(codigo && { codigo }) }) });
  const corpo = async (res) => ({ status: res.status, ...(await res.json()) });
  /** Ativa o 2FA do usuário 1 e devolve o segredo (o "celular" do teste). */
  async function ativar2fa() {
    const segredo = totp.gerarSegredo();
    await definirSegredo2fa(pool, { id: 1, segredoCifrado: totp.cifrarSegredo(segredo, 1) });
    return segredo;
  }
  /** Um código de 6 dígitos que certamente NÃO é o certo agora (nem 30 s antes/depois). */
  const codigoErrado = (segredo) => {
    const validos = [-30_000, 0, 30_000].map((d) => totp.gerarCodigo(segredo, { agora: Date.now() + d }));
    return ['111111', '222222', '333333', '444444'].find((c) => !validos.includes(c));
  };
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
    ({ expurgar } = await import('../../src/modules/lgpd/expurgo.js'));
    totp = await import('../../src/modules/auth/totp.js');
    ({ definirSegredo2fa } = await import('../../src/modules/auth/auth.repository.js'));
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

  test('2FA: só a senha não entra; senha + código do app entra; o mesmo código não serve de novo', async () => {
    const segredo = await ativar2fa();
    const semCodigo = await corpo(await login());
    assert.equal(semCodigo.status, 401);
    assert.equal(semCodigo.erro.codigo, 'CODIGO_2FA_NECESSARIO');
    assert.equal(semCodigo.token, undefined);

    const errado = await corpo(await login(undefined, undefined, undefined, codigoErrado(segredo)));
    assert.equal(errado.status, 401);
    assert.equal(errado.erro.codigo, 'CODIGO_2FA_INVALIDO');

    const codigo = totp.gerarCodigo(segredo);
    const certo = await corpo(await login(undefined, undefined, undefined, codigo.replace(/(\d{3})/, '$1 ')));
    assert.equal(certo.status, 200, 'aceita "123 456", como alguns apps mostram');
    assert.equal((await eu(certo.token)).status, 200);

    const reuso = await corpo(await login(undefined, undefined, undefined, codigo));
    assert.equal(reuso.status, 401, 'código já usado não vale de novo');
    assert.equal(reuso.erro.codigo, 'CODIGO_2FA_INVALIDO');

    const eventos = (await pool.query('SELECT evento FROM acessos_admin ORDER BY id')).rows.map((r) => r.evento);
    assert.deepEqual(eventos, ['login_falha', 'falha_2fa', 'login_ok', 'acesso', 'falha_2fa']);
  });

  test('2FA: senha errada com código certo não diz nada sobre o código', async () => {
    const segredo = await ativar2fa();
    const r = await corpo(await login(undefined, 'Senha-Errada-123!', undefined, totp.gerarCodigo(segredo)));
    assert.equal(r.status, 401);
    assert.equal(r.erro.codigo, 'CREDENCIAIS_INVALIDAS');
  });

  test('2FA: código errado conta no bloqueio de força bruta', async () => {
    const segredo = await ativar2fa();
    for (let i = 0; i < 5; i++) assert.equal((await login(undefined, undefined, '203.0.113.9', codigoErrado(segredo))).status, 401);
    const bloqueado = await corpo(await login(undefined, undefined, '203.0.113.9', totp.gerarCodigo(segredo)));
    assert.equal(bloqueado.status, 429, 'nem o código certo passa durante o bloqueio');
  });

  test('2FA: código errado demais pausa a conta por 24 h (quem tem a senha não chuta códigos para sempre)', async () => {
    const segredo = await ativar2fa();
    await pool.query("UPDATE usuarios_admin SET senha_alterada_em = now() - interval '2 hours' WHERE id = 1"); // 2FA ativado há 2 h
    // 10 códigos errados há 20 min: fora do bloqueio de 15 min, dentro do limite diário do 2FA.
    await pool.query("INSERT INTO acessos_admin (usuario_id, email, evento, status, criado_em) SELECT 1, 'equipe@gatcha.com.br', 'falha_2fa', 401, now() - interval '20 minutes' FROM generate_series(1, 10)");
    const r = await corpo(await login(undefined, undefined, '198.51.100.20', totp.gerarCodigo(segredo)));
    assert.equal(r.status, 429);
    assert.equal(r.erro.codigo, 'MUITAS_TENTATIVAS_2FA');
    // Trocar a senha (quem tem a senha errada fora) zera a contagem.
    await pool.query("UPDATE usuarios_admin SET senha_alterada_em = now() WHERE id = 1");
    assert.equal((await login(undefined, undefined, '198.51.100.20', totp.gerarCodigo(segredo))).status, 200);
  });

  test('2FA: segredo ilegível (ex.: JWT_SECRET trocado) dá erro claro e NÃO deixa entrar', async () => {
    const segredo = totp.gerarSegredo();
    await definirSegredo2fa(pool, { id: 1, segredoCifrado: totp.cifrarSegredo(segredo, 99) }); // cifrado para outro usuário
    const r = await corpo(await login(undefined, undefined, undefined, totp.gerarCodigo(segredo)));
    assert.equal(r.status, 503);
    assert.equal(r.erro.codigo, 'DOIS_FATORES_INDISPONIVEL');
    assert.equal(r.token, undefined);
  });

  test('2FA: ativar ou desativar encerra as sessões abertas', async () => {
    const { token } = await (await login()).json();
    assert.equal((await eu(token)).status, 200);
    await new Promise((r) => setTimeout(r, 1100)); // o token guarda o instante em segundos
    await ativar2fa();
    assert.equal((await eu(token)).status, 401);
  });

  test('LGPD: o expurgo apaga o vencido (interesses, acessos) e preserva o resto', async () => {
    await pool.query('TRUNCATE interesses_adocao, gatos RESTART IDENTITY CASCADE');
    await pool.query("INSERT INTO gatos (nome, sexo) VALUES ('Mochi', 'macho')");
    await pool.query("INSERT INTO interesses_adocao (gato_id, nome, contato, criado_em) VALUES (1, 'Velho', 'v@v.com', now() - interval '200 days'), (1, 'Novo', 'n@n.com', now() - interval '10 days')");
    await pool.query("INSERT INTO acessos_admin (email, evento, criado_em) VALUES ('x@y.com', 'acesso', now() - interval '100 days'), ('x@y.com', 'acesso', now())");
    const apagados = await expurgar(pool, { retencao: { interessesDias: 180, acessosDias: 90 }, fuso: 'America/Sao_Paulo' });
    assert.deepEqual(apagados, { interesses: 1, acessos: 1 });
    const { rows } = await pool.query('SELECT nome FROM interesses_adocao');
    assert.deepEqual(rows.map((r) => r.nome), ['Novo']);
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
