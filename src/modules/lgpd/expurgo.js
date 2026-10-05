/**
 * Retenção de dados pessoais (LGPD art. 15/16: eliminar quando acabar a finalidade).
 *  - reservas:          RETENCAO_RESERVAS_DIAS   após a DATA da visita (escopo: 90)
 *  - interesses_adocao: RETENCAO_INTERESSES_DIAS após o recebimento    [CONFIRMAR]
 *  - acessos_admin:     RETENCAO_ACESSOS_DIAS    após o acesso (segurança)
 * Contagem em dias de calendário, no fuso do café.
 */
import { config } from '../../config/env.js';

export async function expurgar(executor, { retencao = config.retencao, fuso = config.gatil.fuso } = {}) {
  const hoje = "(now() AT TIME ZONE $1)::date";
  const reservas = await executor.query(`DELETE FROM reservas WHERE data < ${hoje} - $2::int`, [fuso, retencao.reservasDias]);
  const interesses = await executor.query(
    `DELETE FROM interesses_adocao WHERE (criado_em AT TIME ZONE $1)::date < ${hoje} - $2::int`,
    [fuso, retencao.interessesDias],
  );
  const acessos = await executor.query(
    `DELETE FROM acessos_admin WHERE (criado_em AT TIME ZONE $1)::date < ${hoje} - $2::int`,
    [fuso, retencao.acessosDias],
  );
  return { reservas: reservas.rowCount, interesses: interesses.rowCount, acessos: acessos.rowCount };
}
