/** SQL público do cardápio e dos gatos (só leitura). Tudo parametrizado. */

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
