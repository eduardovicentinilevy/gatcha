/**
 * Atende pedidos de titulares (LGPD art. 18) por e-mail ou telefone.
 *   npm run lgpd:exportar -- pessoa@email.com    -> mostra tudo que temos (JSON)
 *   npm run lgpd:apagar   -- pessoa@email.com    -> elimina os interesses de adoção
 * O site só guarda dados pessoais de quem pediu para conhecer um gato (as reservas são no balcão).
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

const filtro = 'lower(contato) = $1 OR ($2 <> \'\' AND regexp_replace(contato, \'\\D\', \'\', \'g\') = $2)';
const nada = () => console.error('Nada encontrado para esse contato (confira se o e-mail/telefone é o mesmo do cadastro).');

try {
  if (acao === 'exportar') {
    const interesses = await pool.query(`SELECT gato_id, nome, contato, mensagem, status, criado_em FROM interesses_adocao WHERE ${filtro} ORDER BY criado_em`, [contato, soDigitos]);
    console.log(JSON.stringify({ interesses_adocao: interesses.rows }, null, 2));
    if (!interesses.rowCount) nada();
  } else {
    const i = await pool.query(`DELETE FROM interesses_adocao WHERE ${filtro}`, [contato, soDigitos]);
    console.log(`Eliminados: ${i.rowCount} interesse(s) de adoção.`);
    if (!i.rowCount) nada();
  }
} catch (err) {
  console.error('Falha:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
