/**
 * Retenção de dados pessoais (LGPD art. 15/16: eliminar quando acabar a finalidade).
 *  - interesses_adocao: RETENCAO_INTERESSES_DIAS após o recebimento    [CONFIRMAR]
 *  - acessos_admin:     RETENCAO_ACESSOS_DIAS    após o acesso (segurança)
 * Contagem em dias de calendário, no fuso do café. (Reservas são feitas no balcão: o site não guarda nenhuma.)
 */
import { config } from '../../config/env.js';

export async function expurgar(executor, { retencao = config.retencao, fuso = config.fuso } = {}) {
  const hoje = "(now() AT TIME ZONE $1)::date";
  const interesses = await executor.query(
    `DELETE FROM interesses_adocao WHERE (criado_em AT TIME ZONE $1)::date < ${hoje} - $2::int`,
    [fuso, retencao.interessesDias],
  );
  const acessos = await executor.query(
    `DELETE FROM acessos_admin WHERE (criado_em AT TIME ZONE $1)::date < ${hoje} - $2::int`,
    [fuso, retencao.acessosDias],
  );
  return { interesses: interesses.rowCount, acessos: acessos.rowCount };
}
