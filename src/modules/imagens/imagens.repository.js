/** SQL das fotos. O id é um UUID aleatório: não dá para adivinhar nem enumerar. */

export async function inserirImagem(executor, { dados, largura, altura }) {
  const { rows } = await executor.query(
    'INSERT INTO imagens (dados, largura, altura, bytes) VALUES ($1, $2, $3, $4) RETURNING id, largura, altura, bytes',
    [dados, largura, altura, dados.length],
  );
  return rows[0];
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
