/**
 * Limpeza diária do banco: log de acessos ao painel mais antigo que RETENCAO_ACESSOS_DIAS,
 * fotos que nenhum gato ou item usa mais e janelas vencidas dos limites de tentativas.
 *   npm run limpeza
 * Em produção: Cloud Run Job disparado pelo Cloud Scheduler (ver docs/producao.md).
 * Registra só QUANTIDADES.
 */
import { config } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';
import { apagarAcessosAntigos } from '../src/modules/auth/auth.repository.js';
import { apagarImagensOrfas } from '../src/modules/imagens/imagens.repository.js';
import { apagarLimitesVencidos } from '../src/middlewares/limite-postgres.js';

try {
  const apagados = {
    acessos: await apagarAcessosAntigos(pool, { dias: config.retencao.acessosDias, fuso: config.fuso }),
    imagens_sem_uso: await apagarImagensOrfas(pool),
    limites_vencidos: await apagarLimitesVencidos(pool),
  };
  console.log(JSON.stringify({ severity: 'INFO', message: 'Limpeza concluída', apagados }));
} catch (err) {
  console.error(JSON.stringify({ severity: 'ERROR', message: 'Falha na limpeza', erro: err.message }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
