/**
 * Desativa o 2FA de um usuário do painel (celular perdido ou trocado, sem acesso ao app).
 *   npm run admin:2fa -- email@gatcha.com.br --desativar
 *
 * Para ATIVAR, a própria pessoa entra no painel > "Minha conta": o servidor gera e
 * guarda o segredo com a chave dele (nada de segredo passando por este computador).
 * Desativar encerra as sessões abertas desse usuário.
 */
import { z } from 'zod';
import { pool } from '../src/db/pool.js';
import * as repo from '../src/modules/auth/auth.repository.js';

const args = process.argv.slice(2);
const entrada = z.email().safeParse(args.find((a) => !a.startsWith('--'))?.trim().toLowerCase());
if (!entrada.success || !args.includes('--desativar')) {
  console.error('Uso: npm run admin:2fa -- email@gatcha.com.br --desativar');
  console.error('Para ativar, a pessoa entra no painel e usa "Minha conta" > "Verificação em duas etapas".');
  process.exit(1);
}
const email = entrada.data;

try {
  const usuario = await repo.buscarUsuarioPorEmail(pool, email);
  if (!usuario) throw new Error(`O usuário ${email} não existe.`);
  if (!usuario.totp_segredo) {
    console.log(`${email} não tem 2FA ativo: nada a fazer.`);
  } else {
    await repo.definirSegredo2fa(pool, { id: usuario.id, segredoCifrado: null });
    console.log(`2FA desativado para ${email}. As sessões abertas foram encerradas; a pessoa pode ativar de novo pelo painel.`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
