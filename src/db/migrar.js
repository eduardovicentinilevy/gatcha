/**
 * Executor de migrações SQL versionadas (db/migrations/NNN_nome.sql).
 *
 * - Cada arquivo roda numa transação própria: ou aplica inteiro, ou nada.
 * - Um advisory lock impede que dois processos migrem ao mesmo tempo
 *   (ex.: dois deploys simultâneos).
 * - Rode como etapa de deploy (Cloud Run Job / GitHub Actions), NUNCA no boot
 *   da API: com várias instâncias subindo juntas isso viraria uma corrida.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DIRETORIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');
const LOCK_MIGRACOES = 7300;

/**
 * @param {{ connectionString: string, ssl: boolean, log?: (msg: string) => void }} opcoes
 * @returns {Promise<string[]>} nomes das migrações aplicadas nesta execução
 */
export async function migrar({ connectionString, ssl, log = () => {} }) {
  const client = new pg.Client({ connectionString, ssl: ssl ? { rejectUnauthorized: true } : false });
  await client.connect();
  const aplicadasAgora = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_MIGRACOES]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nome        text PRIMARY KEY,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )`);

    const { rows } = await client.query('SELECT nome FROM schema_migrations');
    const jaAplicadas = new Set(rows.map((r) => r.nome));
    const arquivos = (await readdir(DIRETORIO)).filter((f) => /^\d{3}_[\w-]+\.sql$/.test(f)).sort();

    for (const arquivo of arquivos) {
      if (jaAplicadas.has(arquivo)) continue;
      const sql = await readFile(path.join(DIRETORIO, arquivo), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [arquivo]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falha na migração ${arquivo}: ${err.message}`, { cause: err });
      }
      aplicadasAgora.push(arquivo);
      log(`Migração aplicada: ${arquivo}`);
    }
    return aplicadasAgora;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_MIGRACOES]).catch(() => {});
    await client.end();
  }
}
