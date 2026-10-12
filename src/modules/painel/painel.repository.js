/**
 * SQL do painel. Tudo parametrizado; os nomes de coluna dos UPDATEs vêm de uma allowlist
 * fixa no código (as chaves do schema validado), nunca de texto do cliente.
 */
// ---------------------------------------------------------------- gatos
const COLUNAS_GATO = 'id::int, nome, idade_meses, sexo, personalidade, foto_url, status';
const CAMPOS_GATO = new Set(['nome', 'idade_meses', 'sexo', 'personalidade', 'foto_url', 'status']);

export async function listarGatos(executor) {
  const { rows } = await executor.query(`SELECT ${COLUNAS_GATO} FROM gatos ORDER BY id`);
  return rows;
}

export async function criarGato(executor, g) {
  const { rows } = await executor.query(
    `INSERT INTO gatos (nome, idade_meses, sexo, personalidade, foto_url, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUNAS_GATO}`,
    [g.nome, g.idade_meses, g.sexo, g.personalidade, g.foto_url, g.status],
  );
  return rows[0];
}

export const alterarGato = (executor, id, campos) => atualizar(executor, 'gatos', COLUNAS_GATO, CAMPOS_GATO, id, campos);

export async function apagarGato(executor, id) {
  const { rowCount } = await executor.query('DELETE FROM gatos WHERE id = $1', [id]);
  return rowCount > 0;
}

// ---------------------------------------------------------------- cardápio
const COLUNAS_ITEM = 'id::int, categoria, nome, descricao, preco_centavos, ativo, selos, foto_url';
const CAMPOS_ITEM = new Set(['categoria', 'nome', 'descricao', 'preco_centavos', 'ativo', 'selos', 'foto_url']);

export async function listarItens(executor) {
  const { rows } = await executor.query(`SELECT ${COLUNAS_ITEM} FROM itens_cardapio ORDER BY categoria, id`);
  return rows;
}

export async function criarItem(executor, i) {
  const { rows } = await executor.query(
    `INSERT INTO itens_cardapio (categoria, nome, descricao, preco_centavos, ativo, selos, foto_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUNAS_ITEM}`,
    [i.categoria, i.nome, i.descricao, i.preco_centavos, i.ativo, i.selos, i.foto_url],
  );
  return rows[0];
}

export const alterarItem = (executor, id, campos) => atualizar(executor, 'itens_cardapio', COLUNAS_ITEM, CAMPOS_ITEM, id, campos);

export async function apagarItem(executor, id) {
  const { rowCount } = await executor.query('DELETE FROM itens_cardapio WHERE id = $1', [id]);
  return rowCount > 0;
}

// ---------------------------------------------------------------- util
/** UPDATE parcial. Colunas só da allowlist; valores sempre por parâmetro. */
async function atualizar(executor, tabela, colunas, permitidas, id, campos) {
  const chaves = Object.keys(campos).filter((c) => permitidas.has(c));
  if (chaves.length === 0) return null;
  const sets = chaves.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const { rows } = await executor.query(`UPDATE ${tabela} SET ${sets} WHERE id = $1 RETURNING ${colunas}`, [id, ...chaves.map((c) => campos[c])]);
  return rows[0] ?? null;
}
