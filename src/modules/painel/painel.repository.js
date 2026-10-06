/**
 * SQL do painel. Tudo parametrizado; os nomes de coluna dos UPDATEs vêm de uma allowlist
 * fixa no código (as chaves do schema validado), nunca de texto do cliente.
 */
const HORA = "to_char(hora_inicio, 'HH24:MI')";

// ---------------------------------------------------------------- reservas
export async function listarReservas(executor, { de, ate, status }) {
  const { rows } = await executor.query(
    `SELECT codigo, data, ${HORA} AS hora_inicio, duracao_min, pessoas, nome, telefone, email, status, criado_em
       FROM reservas
      WHERE data BETWEEN $1::date AND $2::date AND ($3::text IS NULL OR status = $3)
      ORDER BY data, hora_inicio, id
      LIMIT 1000`,
    [de, ate, status ?? null],
  );
  return rows;
}

/** Muda o status só se o estado atual permitir (transição validada no SQL, sem corrida). */
export async function mudarStatusReserva(executor, { codigo, para, deStatus }) {
  const { rows } = await executor.query(
    `UPDATE reservas
        SET status = $2::text, cancelada_em = CASE WHEN $2::text = 'cancelada' THEN now() ELSE NULL END
      WHERE codigo = $1 AND status = ANY($3::text[])
      RETURNING codigo, data, ${HORA} AS hora_inicio, status`,
    [codigo, para, deStatus],
  );
  return rows[0] ?? null;
}

export async function existeReserva(executor, codigo) {
  const { rowCount } = await executor.query('SELECT 1 FROM reservas WHERE codigo = $1', [codigo]);
  return rowCount > 0;
}

// ---------------------------------------------------------------- bloqueios
export async function listarBloqueios(executor, de) {
  const { rows } = await executor.query(
    `SELECT id::int, data, ${HORA} AS hora_inicio, to_char(hora_fim, 'HH24:MI') AS hora_fim, motivo
       FROM bloqueios WHERE data >= $1::date ORDER BY data, hora_inicio, id LIMIT 500`,
    [de],
  );
  return rows;
}

export async function criarBloqueio(executor, b) {
  const { rows } = await executor.query(
    `INSERT INTO bloqueios (data, hora_inicio, hora_fim, motivo)
     VALUES ($1::date, $2::time, $3::time, $4)
     RETURNING id::int, data, ${HORA} AS hora_inicio, to_char(hora_fim, 'HH24:MI') AS hora_fim, motivo`,
    [b.data, b.hora_inicio, b.hora_fim, b.motivo],
  );
  return rows[0];
}

/** Reservas confirmadas que o bloqueio atinge (o painel avisa a equipe para contatar essas pessoas). */
export async function contarReservasAtingidas(executor, b) {
  const { rows } = await executor.query(
    `SELECT count(*)::int AS total FROM reservas
      WHERE data = $1::date AND status = 'confirmada'
        AND hora_inicio < $3::time
        AND hora_inicio + make_interval(mins => duracao_min) > $2::time`,
    [b.data, b.hora_inicio, b.hora_fim],
  );
  return rows[0].total;
}

export async function apagarBloqueio(executor, id) {
  const { rowCount } = await executor.query('DELETE FROM bloqueios WHERE id = $1', [id]);
  return rowCount > 0;
}

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

// ---------------------------------------------------------------- interesses
export async function listarInteresses(executor, status) {
  const { rows } = await executor.query(
    `SELECT i.id::int, i.gato_id::int, g.nome AS gato, i.nome, i.contato, i.mensagem, i.status, i.criado_em
       FROM interesses_adocao i JOIN gatos g ON g.id = i.gato_id
      WHERE ($1::text IS NULL OR i.status = $1)
      ORDER BY i.criado_em DESC LIMIT 500`,
    [status ?? null],
  );
  return rows;
}

export async function mudarStatusInteresse(executor, id, status) {
  const { rows } = await executor.query('UPDATE interesses_adocao SET status = $2 WHERE id = $1 RETURNING id::int, status', [id, status]);
  return rows[0] ?? null;
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
