/**
 * SÓ PARA DESENVOLVIMENTO: apaga TODAS as reservas do banco LOCAL (as de teste), para
 * liberar o limite de reservas ativas por contato (RESERVA_MAX_ATIVAS_POR_CONTATO).
 *   npm run dev:limpar-reservas
 * Recusa rodar em produção ou em banco que não seja da própria máquina.
 * Para apagar os dados de UMA pessoa de verdade (LGPD), use `npm run lgpd:apagar`.
 */
import { config } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

try {
  const host = new URL(config.db.url).hostname;
  if (config.isProducao || !HOSTS_LOCAIS.has(host)) {
    console.error('Recusado: este script só roda em desenvolvimento, com o banco na sua máquina.');
    process.exitCode = 1;
  } else {
    const { rowCount } = await pool.query('DELETE FROM reservas');
    console.log(`Reservas de teste apagadas: ${rowCount}. O limite por contato foi liberado.`);
  }
} catch (err) {
  console.error('Falha:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
