/** SQL das fotos. O id é um UUID aleatório: não dá para adivinhar nem enumerar. */

const LOCK_ESPACO_FOTOS = 7304;

/** Espaço já ocupado pelas fotos (soma de uma coluna inteira: rápido até dezenas de milhares de fotos). */
export async function espacoUsado(executor) {
  const { rows } = await executor.query('SELECT coalesce(sum(bytes), 0)::bigint AS usado FROM imagens');
  return Number(rows[0].usado);
}

/**
 * Grava a foto só se o espaço total continuar dentro do teto (IMAGENS_MAX_MB).
 * Conferir e gravar acontecem sob uma trava: dois envios ao mesmo tempo não passam
 * juntos do teto (cada um veria a soma sem o outro).
 * @param {import('pg').PoolClient} client dentro de uma transação (comTransacao)
 * @returns {Promise<object | null>} a imagem, ou null se o espaço acabou
 */
export async function inserirImagem(client, { dados, largura, altura }, { maxBytesTotal }) {
  await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ESPACO_FOTOS]);
  if ((await espacoUsado(client)) + dados.length > maxBytesTotal) return null;
  const { rows } = await client.query(
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
