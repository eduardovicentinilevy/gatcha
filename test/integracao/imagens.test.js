import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

const URL_BANCO = process.env.TEST_DATABASE_URL;
const SENHA = 'Matcha-e-gatos-2026!';
const fixture = (nome) => readFileSync(new URL(`../fixtures/${nome}`, import.meta.url));

describe('Fotos do painel (integração)', { skip: !URL_BANCO && 'TEST_DATABASE_URL não definida' }, () => {
  let servidor, base, pool, token, sharp, apagarImagensOrfas, LimitePostgres;

  const enviar = (corpo, tipo = 'image/jpeg', t = token) =>
    fetch(`${base}/api/admin/imagens`, { method: 'POST', headers: { 'content-type': tipo, ...(t && { authorization: `Bearer ${t}` }) }, body: corpo });

  before(async () => {
    configurarAmbienteDeTeste({
      DATABASE_URL: URL_BANCO, DB_POOL_MAX: '10', JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-ok', RATE_LIMIT_LOGIN_POR_15MIN: '1000',
      IMAGENS_MAX_MB: '10', RATE_LIMIT_FOTOS_POR_15MIN: '30',
    });
    const { migrar } = await import('../../src/db/migrar.js');
    await migrar({ connectionString: URL_BANCO, ssl: false });
    ({ pool } = await import('../../src/db/pool.js'));
    ({ default: sharp } = await import('sharp'));
    ({ apagarImagensOrfas } = await import('../../src/modules/imagens/imagens.repository.js'));
    ({ LimitePostgres } = await import('../../src/middlewares/limite-postgres.js'));
    const { gerarHash } = await import('../../src/modules/auth/senha.js');
    const { criarUsuario } = await import('../../src/modules/auth/auth.repository.js');
    await pool.query('TRUNCATE acessos_admin, usuarios_admin, limites_taxa RESTART IDENTITY CASCADE');
    await criarUsuario(pool, { email: 'equipe@gatcha.com.br', senhaHash: await gerarHash(SENHA) });
    const { criarApp } = await import('../../src/app.js');
    servidor = criarApp().listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${servidor.address().port}`;
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'equipe@gatcha.com.br', senha: SENHA }) });
    ({ token } = await login.json());
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE imagens, interesses_adocao, gatos, itens_cardapio, limites_taxa RESTART IDENTITY CASCADE');
  });

  after(async () => {
    await new Promise((r) => servidor?.close(r));
    await pool?.end();
  });

  test('foto de celular vira WebP pequeno, na orientação certa e SEM metadados (GPS, aparelho)', async () => {
    const original = fixture('foto-celular.jpg'); // 3000x2000, orientação 6 (em pé), EXIF com GPS e marca
    const res = await enviar(original);
    assert.equal(res.status, 201);
    const { imagem } = await res.json();
    assert.match(imagem.url, /^\/api\/imagens\/[0-9a-f-]{36}\.webp$/);
    assert.deepEqual([imagem.largura, imagem.altura], [1067, 1600]); // girada e reduzida (máx. 1600)

    const servida = await fetch(base + imagem.url);
    assert.equal(servida.status, 200);
    assert.equal(servida.headers.get('content-type'), 'image/webp');
    assert.match(servida.headers.get('cache-control'), /immutable/);
    assert.equal(servida.headers.get('x-content-type-options'), 'nosniff');
    const dados = Buffer.from(await servida.arrayBuffer());
    const meta = await sharp(dados).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.exif, undefined, 'sem EXIF');
    assert.ok(!dados.includes('CelularX'));
    assert.ok(dados.length < original.length);
  });

  test('PNG também é aceito; imagem pequena não é ampliada', async () => {
    const { imagem } = await (await enviar(fixture('pequena.png'), 'image/png')).json();
    assert.deepEqual([imagem.largura, imagem.altura], [400, 300]);
  });

  test('arquivo disfarçado, corrompido ou de tipo não aceito é recusado', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    for (const [corpo, tipo, status] of [
      [html, 'image/jpeg', 400], // "jpg" que é HTML
      [svg, 'image/png', 400],
      [fixture('foto-celular.jpg').subarray(0, 500), 'image/jpeg', 400], // cortado
      [Buffer.alloc(0), 'image/jpeg', 400],
      [svg, 'image/svg+xml', 415],
      [fixture('pequena.png'), 'application/octet-stream', 415],
    ]) {
      const res = await enviar(corpo, tipo);
      assert.equal(res.status, status, `${tipo} ${corpo.length}b`);
    }
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM imagens')).rows[0].n, 0);
  });

  test('"bomba" de pixels e arquivo grande demais são recusados', async () => {
    const enorme = await sharp({ create: { width: 10000, height: 5000, channels: 3, background: '#000' } }).png({ compressionLevel: 9 }).toBuffer();
    assert.equal((await enviar(enorme, 'image/png')).status, 400);
    assert.equal((await enviar(Buffer.alloc(9 * 1024 * 1024, 1))).status, 413);
  });

  test('só a equipe envia (401 sem login); qualquer um vê; id inválido ou inexistente', async () => {
    assert.equal((await enviar(fixture('pequena.png'), 'image/png', null)).status, 401);
    assert.equal((await fetch(`${base}/api/imagens/../../etc/passwd`)).status, 404);
    assert.equal((await fetch(`${base}/api/imagens/nao-e-uuid.webp`)).status, 400);
    assert.equal((await fetch(`${base}/api/imagens/00000000-0000-0000-0000-000000000000.webp`)).status, 404);
  });

  test('a foto enviada é usada no gato e aparece no site; fotos sem uso são limpas depois de 1 dia', async () => {
    const { imagem } = await (await enviar(fixture('pequena.png'), 'image/png')).json();
    const { imagem: solta } = await (await enviar(fixture('pequena.png'), 'image/png')).json();
    const criar = await fetch(`${base}/api/admin/gatos`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ nome: 'Matcha', sexo: 'femea', foto_url: imagem.url }) });
    assert.equal(criar.status, 201);
    assert.equal((await (await fetch(`${base}/api/gatos`)).json()).gatos[0].foto_url, imagem.url);

    assert.equal(await apagarImagensOrfas(pool), 0, 'recentes ficam (podem estar num formulário aberto)');
    await pool.query("UPDATE imagens SET criado_em = now() - interval '2 days'");
    assert.equal(await apagarImagensOrfas(pool), 1);
    assert.equal((await fetch(base + imagem.url)).status, 200);
    assert.equal((await fetch(base + solta.url)).status, 404);
  });

  test('teto de espaço: a foto que passaria do limite é recusada (507) e nada é gravado', async () => {
    // Enche o banco até o teto do teste (IMAGENS_MAX_MB=10) com fotos falsas.
    await pool.query('INSERT INTO imagens (dados, largura, altura, bytes) SELECT $1, 1, 1, $2 FROM generate_series(1, 4)', [Buffer.alloc(2_621_440), 2_621_440]);
    const res = await enviar(fixture('pequena.png'), 'image/png');
    assert.equal(res.status, 507);
    assert.equal((await res.json()).erro.codigo, 'ESPACO_DE_FOTOS_CHEIO');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM imagens')).rows[0].n, 4);

    await pool.query('DELETE FROM imagens WHERE id IN (SELECT id FROM imagens LIMIT 1)');
    assert.equal((await enviar(fixture('pequena.png'), 'image/png')).status, 201, 'liberou espaço, volta a aceitar');
  });

  test('envio de fotos tem limite por pessoa (429), barrado ANTES de ler a foto', async () => {
    const limite = new LimitePostgres('fotos');
    await pool.query("INSERT INTO limites_taxa (chave, contagem, expira_em) VALUES ($1, 30, now() + interval '10 minutes')", [limite.chave('usuario:1')]);
    const res = await enviar(fixture('foto-celular.jpg'));
    assert.equal(res.status, 429);
    assert.equal((await res.json()).erro.codigo, 'MUITAS_REQUISICOES');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM imagens')).rows[0].n, 0);
  });

  test('teto de espaço sob envios SIMULTÂNEOS: só passa o que cabe (sem corrida)', async () => {
    const primeira = await (await enviar(fixture('pequena.png'), 'image/png')).json();
    const tamanho = primeira.imagem.bytes;
    await pool.query('TRUNCATE imagens');
    // Deixa livre espaço para UMA foto e meia, e manda três ao mesmo tempo.
    const livre = Math.floor(tamanho * 1.5);
    const resto = 10 * 1024 * 1024 - 3 * 2_621_440 - livre;
    await pool.query('INSERT INTO imagens (dados, largura, altura, bytes) SELECT $1, 1, 1, $2 FROM generate_series(1, 3)', [Buffer.alloc(2_621_440), 2_621_440]);
    await pool.query('INSERT INTO imagens (dados, largura, altura, bytes) VALUES ($1, 1, 1, $2)', [Buffer.alloc(resto), resto]);
    const respostas = await Promise.all([1, 2, 3].map(() => enviar(fixture('pequena.png'), 'image/png')));
    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 507, 507]);
    const { rows } = await pool.query('SELECT sum(bytes)::bigint AS total FROM imagens');
    assert.ok(Number(rows[0].total) <= 10 * 1024 * 1024, 'nunca passa do teto');
  });
});
