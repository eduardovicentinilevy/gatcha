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

const LOCK_INTERESSES = 7305;

/**
 * Registra o interesse num gato que existe e ainda não foi adotado, respeitando tetos que
 * NÃO dependem do IP (quem acessa a API direto pode trocar de IP à vontade):
 * `porContatoDia` pedidos do mesmo contato em 24 h e `geralPorHora` pedidos no total por hora.
 * Conferir e gravar acontecem sob uma trava (sem corrida entre envios simultâneos).
 * @param {import('pg').PoolClient} client dentro de uma transação (comTransacao)
 * @returns {Promise<'criado' | 'indisponivel' | 'limite'>}
 */
export async function inserirInteresse(client, { gato_id, nome, contato, mensagem }, { porContatoDia, geralPorHora }) {
  await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_INTERESSES]);
  const { rows: [contagem] } = await client.query(
    `SELECT (SELECT count(*) FROM interesses_adocao WHERE contato = $1 AND criado_em > now() - interval '24 hours')::int AS do_contato,
            (SELECT count(*) FROM interesses_adocao WHERE criado_em > now() - interval '1 hour')::int AS na_hora`,
    [contato],
  );
  if (contagem.do_contato >= porContatoDia || contagem.na_hora >= geralPorHora) return 'limite';
  const { rowCount } = await client.query(
    `INSERT INTO interesses_adocao (gato_id, nome, contato, mensagem)
     SELECT id, $2, $3, $4 FROM gatos WHERE id = $1 AND status <> 'adotado'`,
    [gato_id, nome, contato, mensagem],
  );
  return rowCount > 0 ? 'criado' : 'indisponivel';
}
