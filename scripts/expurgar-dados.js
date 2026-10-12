/**
 * Retenção LGPD: apaga interesses de adoção e log de acessos vencidos
 * (prazos em src/config/env.js: RETENCAO_*_DIAS). Rodar DIARIAMENTE, como Cloud
 * Run Job disparado pelo Cloud Scheduler (ver docs/producao.md, seção LGPD).
 * Aproveita para apagar fotos que nenhum gato ou item usa mais e as janelas
 * vencidas dos limites de taxa.
 * Registra só QUANTIDADES — nunca dados pessoais.
 */
import { pool } from '../src/db/pool.js';
import { expurgar } from '../src/modules/lgpd/expurgo.js';
import { apagarImagensOrfas } from '../src/modules/imagens/imagens.repository.js';
import { apagarLimitesVencidos } from '../src/middlewares/limite-postgres.js';

try {
  const apagados = {
    ...(await expurgar(pool)),
    imagens_sem_uso: await apagarImagensOrfas(pool),
    limites_vencidos: await apagarLimitesVencidos(pool),
  };
  console.log(JSON.stringify({ severity: 'INFO', message: 'Expurgo LGPD concluído', apagados }));
} catch (err) {
  console.error(JSON.stringify({ severity: 'ERROR', message: 'Falha no expurgo LGPD', erro: err.message }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
