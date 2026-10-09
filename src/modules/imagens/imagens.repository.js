/** SQL das fotos. O id é um UUID aleatório: não dá para adivinhar nem enumerar. */

/**
 * Grava a foto só se o espaço total das fotos continuar dentro do teto (IMAGENS_MAX_MB).
 * @returns {Promise<object | null>} a imagem, ou null se o espaço acabou
 */
export async function inserirImagem(executor, { dados, largura, altura }, { maxBytesTotal }) {
  const { rows } = await executor.query(
    `INSERT INTO imagens (dados, largura, altura, bytes)
     SELECT $1, $2, $3, $4::int
      WHERE (SELECT coalesce(sum(bytes), 0) FROM imagens) + $4::int <= $5::bigint
     RETURNING id, largura, altura, bytes`,
    [dados, largura, altura, dados.length, maxBytesTotal],
  );
  return rows[0] ?? null;
}

export async function buscarImagem(executor, id) {
  const { rows } = await executor.query('SELECT dados FROM imagens WHERE id = $1', [id]);
  return rows[0]?.dados ?? null;
}

/**
 * Apaga fotos que nenhum gato ou item usa (trocadas, ou enviadas e não salvas).
 * Só as com mais de 1 dia: uma foto recém-enviada ainda pode estar num formulário aberto.
 */
export async function apagarImagensOrfas(executor) {
  const { rowCount } = await executor.query(
    `DELETE FROM imagens i
      WHERE i.criado_em < now() - interval '1 day'
        AND NOT EXISTS (SELECT 1 FROM gatos g WHERE g.foto_url = '/api/imagens/' || i.id || '.webp')
        AND NOT EXISTS (SELECT 1 FROM itens_cardapio c WHERE c.foto_url = '/api/imagens/' || i.id || '.webp')`,
  );
  return rowCount;
}
