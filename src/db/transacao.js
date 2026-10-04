/**
 * Unit of Work: executa `trabalho(client)` dentro de UMA transação, em UMA
 * conexão dedicada do pool. Faz COMMIT se a função resolver e ROLLBACK se
 * lançar — o chamador nunca esquece de liberar a conexão ou de desfazer.
 */
import { pool } from './pool.js';
import { logger, serializarErro } from '../lib/logger.js';

// Allowlist: o nível de isolamento entra no SQL como texto, então nunca pode
// vir de entrada externa — apenas destes valores fixos.
const ISOLAMENTOS = Object.freeze({
  READ_COMMITTED: 'READ COMMITTED',
  REPEATABLE_READ: 'REPEATABLE READ',
  SERIALIZABLE: 'SERIALIZABLE',
});

/**
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} trabalho
 * @param {{ isolamento?: keyof typeof ISOLAMENTOS, lockTimeoutMs?: number }} [opcoes]
 * @returns {Promise<T>}
 */
export async function comTransacao(trabalho, { isolamento = 'READ_COMMITTED', lockTimeoutMs = 5_000 } = {}) {
  const nivel = ISOLAMENTOS[isolamento];
  if (!nivel) throw new Error(`Nível de isolamento não suportado: ${isolamento}`);

  const client = await pool.connect();
  let conexaoQuebrada = false;
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${nivel}`);
    // Se outra transação segurar o lock por tempo demais, falhamos rápido (55P03)
    // em vez de empilhar requisições esperando. SET LOCAL vale só nesta transação.
    await client.query(`SET LOCAL lock_timeout = ${Number.parseInt(lockTimeoutMs, 10)}`);

    const resultado = await trabalho(client);

    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (errRollback) {
      // Conexão em estado desconhecido: descartamos em vez de devolver ao pool.
      conexaoQuebrada = true;
      logger.error('Falha no ROLLBACK; descartando conexão', { erro: serializarErro(errRollback) });
    }
    throw err;
  } finally {
    client.release(conexaoQuebrada);
  }
}
