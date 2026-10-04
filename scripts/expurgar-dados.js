/**
 * Retenção LGPD: apaga reservas com mais de 90 dias (contadas da data da visita).
 * Rodar diariamente como Cloud Run Job disparado pelo Cloud Scheduler:
 *   gcloud run jobs create gatcha-expurgo --image ... --command node --args scripts/expurgar-dados.js
 */
import { config } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

const DIAS_RETENCAO_RESERVAS = 90;

try {
  const { rowCount } = await pool.query(
    "DELETE FROM reservas WHERE data < (now() AT TIME ZONE $1)::date - $2::int",
    [config.gatil.fuso, DIAS_RETENCAO_RESERVAS],
  );
  console.log(JSON.stringify({ severity: 'INFO', message: 'Expurgo LGPD concluído', reservas_apagadas: rowCount }));
} catch (err) {
  console.error(JSON.stringify({ severity: 'ERROR', message: 'Falha no expurgo LGPD', erro: err.message }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
