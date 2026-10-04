/**
 * Connection pool único por instância do Cloud Run.
 *
 * Por que pool: abrir conexão TLS com o Postgres custa dezenas de ms; o pool
 * reaproveita conexões entre requisições. O tamanho é pequeno de propósito —
 * escalamos horizontalmente (mais instâncias), não verticalmente.
 */
import pg from 'pg';
import { config } from '../config/env.js';
import { logger, serializarErro } from '../lib/logger.js';

// DATE (oid 1082) volta como string "AAAA-MM-DD" em vez de Date JS, evitando
// que 2026-10-05 vire 2026-10-04T21:00 por conversão de fuso.
pg.types.setTypeParser(pg.types.builtins.DATE, (valor) => valor);

export const pool = new pg.Pool({
  connectionString: config.db.url,
  max: config.db.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Corta queries presas no servidor: protege o pool de ficar esgotado.
  statement_timeout: config.db.statementTimeoutMs,
  application_name: 'gatcha-api',
  // Postgres gerenciado (Neon/Supabase/Cloud SQL) exige TLS; validamos o certificado.
  ssl: config.db.ssl ? { rejectUnauthorized: true } : false,
});

// Erro numa conexão OCIOSA (ex.: banco reiniciou). Sem este handler o processo cai.
pool.on('error', (err) => logger.error('Erro em conexão ociosa do pool', { erro: serializarErro(err) }));

/** Atalho para consultas fora de transação. Sempre parametrizadas ($1, $2...). */
export const query = (texto, parametros) => pool.query(texto, parametros);
