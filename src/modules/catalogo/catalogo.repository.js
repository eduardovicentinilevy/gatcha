/** SQL público do cardápio, dos gatos e dos interesses de adoção. Tudo parametrizado. */

export async function listarCardapio(executor) {
  const { rows } = await executor.query(
    `SELECT id::int, categoria, nome, descricao, preco_centavos, ativo, selos, foto_url
       FROM itens_cardapio WHERE ativo ORDER BY categoria, id`,
  );
  return rows;
}

/** Gatos adotados saem do site (continuam no painel). */
export async function listarGatosPublicos(executor) {
  const { rows } = await executor.query(
    `SELECT id::int, nome, idade_meses, sexo, personalidade, foto_url, status
       FROM gatos WHERE status <> 'adotado' ORDER BY id`,
  );
  return rows;
}

/** Só registra interesse num gato que existe e ainda não foi adotado (uma instrução, sem corrida). */
export async function inserirInteresse(executor, { gato_id, nome, contato, mensagem }) {
  const { rows } = await executor.query(
    `INSERT INTO interesses_adocao (gato_id, nome, contato, mensagem)
     SELECT id, $2, $3, $4 FROM gatos WHERE id = $1 AND status <> 'adotado'
     RETURNING id`,
    [gato_id, nome, contato, mensagem],
  );
  return rows[0] ?? null;
}
