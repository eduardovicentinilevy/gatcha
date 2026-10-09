/**
 * Ativa ou desativa o 2FA (código do app autenticador) de um usuário do painel.
 *   npm run admin:2fa -- email@gatcha.com.br              ativa (ou troca de celular)
 *   npm run admin:2fa -- email@gatcha.com.br --desativar  desativa (celular perdido)
 *
 * A chave aparece SÓ neste terminal (nunca em log ou arquivo): rode num computador
 * de confiança, com a pessoa do lado para cadastrar no celular dela. Ativar ou
 * desativar encerra as sessões abertas desse usuário.
 */
import { createInterface } from 'node:readline/promises';
import { z } from 'zod';
import { pool } from '../src/db/pool.js';
import * as repo from '../src/modules/auth/auth.repository.js';
import { loginConfigurado } from '../src/modules/auth/token.js';
import { cifrarSegredo, conferirCodigo, gerarSegredo, linkOtpauth, paraBase32 } from '../src/modules/auth/totp.js';

const args = process.argv.slice(2);
const desativar = args.includes('--desativar');
const entrada = z.email().safeParse(args.find((a) => !a.startsWith('--'))?.trim().toLowerCase());
if (!entrada.success) {
  console.error('Uso: npm run admin:2fa -- email@gatcha.com.br [--desativar]');
  process.exit(1);
}
const email = entrada.data;

try {
  if (!loginConfigurado()) throw new Error('Defina o JWT_SECRET antes: o 2FA usa a chave do servidor para guardar o segredo criptografado.');
  const usuario = await repo.buscarUsuarioPorEmail(pool, email);
  if (!usuario) throw new Error(`O usuário ${email} não existe. Crie antes com: npm run admin:criar -- ${email}`);

  if (desativar) {
    await repo.definirSegredo2fa(pool, { id: usuario.id, segredoCifrado: null });
    console.log(`2FA desativado para ${email}. As sessões abertas foram encerradas.`);
  } else {
    const segredo = gerarSegredo();
    const chave = paraBase32(segredo);
    console.log(`
1. No celular de ${email}, abra um app autenticador
   (Google Authenticator, Microsoft Authenticator, Authy...).
2. Toque em "+" e escolha "Inserir chave de configuração":
     Conta: Gatchá
     Chave: ${chave.match(/.{1,4}/g).join(' ')}
     Tipo:  baseado em tempo
   (ou abra no celular: ${linkOtpauth({ chave, email })})
`);
    const leitor = createInterface({ input: process.stdin, output: process.stdout });
    const codigo = (await leitor.question('3. Digite o código de 6 dígitos que apareceu no app: ')).replace(/\s/g, '');
    leitor.close();

    const passo = conferirCodigo(segredo, codigo);
    if (passo === null) throw new Error('O código não confere: nada foi alterado. Rode de novo e confira a chave digitada e o relógio do celular.');
    await repo.definirSegredo2fa(pool, { id: usuario.id, segredoCifrado: cifrarSegredo(segredo, usuario.id), ultimoPasso: passo });
    console.log(`\n2FA ativado para ${email}: o login agora pede o código do app. As sessões abertas foram encerradas.`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
