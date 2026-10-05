/**
 * Atende pedidos de titulares (LGPD art. 18) por e-mail ou telefone.
 *   npm run lgpd:exportar -- pessoa@email.com    -> mostra tudo que temos (JSON)
 *   npm run lgpd:apagar   -- pessoa@email.com    -> elimina reservas e interesses
 * Aceita e-mail ou telefone (só dígitos). Confirme a identidade da pessoa ANTES
 * (ex.: o pedido tem que partir do próprio e-mail cadastrado). Não registra dados
 * pessoais no log: só a quantidade apagada.
 */
import { pool } from '../src/db/pool.js';

const [acao, bruto] = process.argv.slice(2);
const contato = (bruto ?? '').trim().toLowerCase();
const soDigitos = contato.replace(/\D/g, '');
if (!['exportar', 'apagar'].includes(acao) || contato.length < 5) {
  console.error('Uso: node scripts/titular.js <exportar|apagar> <e-mail ou telefone>');
  process.exit(1);
}

try {
  const filtroReservas = 'email = $1 OR ($2 <> \'\' AND telefone = $2)';
  const filtroInteresses = 'lower(contato) = $1 OR ($2 <> \'\' AND regexp_replace(contato, \'\\D\', \'\', \'g\') = $2)';
  if (acao === 'exportar') {
    const reservas = await pool.query(`SELECT codigo, data, hora_inicio, duracao_min, pessoas, nome, telefone, email, status, criado_em FROM reservas WHERE ${filtroReservas} ORDER BY data`, [contato, soDigitos]);
    const interesses = await pool.query(`SELECT gato_id, nome, contato, mensagem, criado_em FROM interesses_adocao WHERE ${filtroInteresses} ORDER BY criado_em`, [contato, soDigitos]);
    console.log(JSON.stringify({ reservas: reservas.rows, interesses_adocao: interesses.rows }, null, 2));
  } else {
    const r = await pool.query(`DELETE FROM reservas WHERE ${filtroReservas}`, [contato, soDigitos]);
    const i = await pool.query(`DELETE FROM interesses_adocao WHERE ${filtroInteresses}`, [contato, soDigitos]);
    console.log(`Eliminados: ${r.rowCount} reserva(s) e ${i.rowCount} interesse(s) de adoção.`);
  }
} catch (err) {
  console.error('Falha:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
