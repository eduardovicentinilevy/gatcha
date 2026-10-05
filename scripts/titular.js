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
let soDigitos = contato.replace(/\D/g, '');
// Telefones são guardados sem DDI (10 ou 11 dígitos): "+55 (11) 99999-9999" -> 11999999999.
if (soDigitos.length >= 12 && soDigitos.startsWith('55')) soDigitos = soDigitos.slice(2);
if (contato.includes('@')) soDigitos = ''; // e-mail: não tenta casar telefone
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
    if (!reservas.rowCount && !interesses.rowCount) console.error('Nada encontrado para esse contato (confira se o e-mail/telefone é o mesmo do cadastro).');
  } else {
    // As duas eliminações valem juntas ou nenhuma (não deixa o pedido pela metade).
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(`DELETE FROM reservas WHERE ${filtroReservas}`, [contato, soDigitos]);
      const i = await client.query(`DELETE FROM interesses_adocao WHERE ${filtroInteresses}`, [contato, soDigitos]);
      await client.query('COMMIT');
      console.log(`Eliminados: ${r.rowCount} reserva(s) e ${i.rowCount} interesse(s) de adoção.`);
      if (!r.rowCount && !i.rowCount) console.error('Nada encontrado para esse contato (confira se o e-mail/telefone é o mesmo do cadastro).');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
} catch (err) {
  console.error('Falha:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
