/**
 * SÓ PARA DESENVOLVIMENTO: cadastra no banco LOCAL o cardápio e os gatos de exemplo
 * (web/public/dados-exemplo), para o site e o painel terem o que mostrar.
 *   npm run dev:popular
 * Só preenche tabelas vazias (não duplica nem apaga nada) e recusa produção ou banco remoto.
 * Rodar de novo também troca os textos de teste das versões antigas dos dados de exemplo.
 */
import { readFile } from 'node:fs/promises';
import { config } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);
const ler = async (arquivo) => JSON.parse(await readFile(new URL(`../web/public/dados-exemplo/${arquivo}`, import.meta.url), 'utf8'));

try {
  if (config.isProducao || !HOSTS_LOCAIS.has(new URL(config.db.url).hostname)) {
    console.error('Recusado: este script só roda em desenvolvimento, com o banco na sua máquina.');
    process.exitCode = 1;
  } else {
    const vazia = async (tabela) => (await pool.query(`SELECT NOT EXISTS (SELECT 1 FROM ${tabela}) AS vazia`)).rows[0].vazia;
    if (await vazia('itens_cardapio')) {
      const { itens } = await ler('cardapio.json');
      for (const i of itens) {
        await pool.query(
          'INSERT INTO itens_cardapio (categoria, nome, descricao, preco_centavos, ativo, selos, foto_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [i.categoria, i.nome, i.descricao, i.preco_centavos, i.ativo, i.selos ?? [], i.foto_url],
        );
      }
      console.log(`Cardápio: ${itens.length} itens cadastrados.`);
    } else console.log('Cardápio já tem itens: nada feito.');

    if (await vazia('gatos')) {
      const { gatos } = await ler('gatos.json');
      for (const g of gatos) {
        await pool.query('INSERT INTO gatos (nome, idade_meses, sexo, personalidade, foto_url, status) VALUES ($1, $2, $3, $4, $5, $6)', [
          g.nome, g.idade_meses, g.sexo, g.personalidade, g.foto_url, g.status,
        ]);
      }
      console.log(`Gatos: ${gatos.length} cadastrados.`);
    } else console.log('Gatos já cadastrados: nada feito.');

    // Bancos populados por versões antigas deste script: troca os textos de teste pelos de agora.
    const textos = await pool.query(
      `WITH g AS (UPDATE gatos SET personalidade = 'preguiçoso, rei da caixa de papelão'
                  WHERE personalidade = 'já adotado: não deve aparecer no site' RETURNING 1),
            i AS (UPDATE itens_cardapio SET nome = 'Brownie de chocolate',
                         descricao = 'Chocolate meio amargo com nozes. Volta quando chegar a próxima fornada.'
                  WHERE nome = 'Brownie (fora de linha)' RETURNING 1)
       SELECT (SELECT count(*) FROM g) + (SELECT count(*) FROM i) AS total`,
    );
    if (Number(textos.rows[0].total) > 0) console.log(`Textos de teste antigos atualizados: ${textos.rows[0].total}.`);
  }
} catch (err) {
  console.error('Falha:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
