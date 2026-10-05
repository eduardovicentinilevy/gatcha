/**
 * Cria (ou redefine a senha de) um usuário do painel.
 *   npm run admin:criar -- email@gatcha.com.br
 *   npm run admin:criar -- email@gatcha.com.br --redefinir
 *
 * A senha é digitada no terminal SEM aparecer na tela e nunca vai para histórico,
 * arquivo ou log. No Git Bash do Windows o terminal não é "TTY" para o Node: rode
 * com `winpty npm run admin:criar -- ...` (aí a senha também fica oculta). Sem TTY
 * o script ainda funciona, lendo a senha da entrada padrão (ela fica visível).
 */
import { z } from 'zod';
import { pool } from '../src/db/pool.js';
import * as repo from '../src/modules/auth/auth.repository.js';
import { gerarHash, validarSenha } from '../src/modules/auth/senha.js';

// Sem TTY (entrada por pipe/arquivo): lê linha a linha de UM leitor compartilhado
// (ler com stdin.once('data') perderia linhas que chegam juntas).
let linhas;
const proximaLinha = async () => {
  linhas ??= (await import('node:readline')).createInterface({ input: process.stdin })[Symbol.asyncIterator]();
  const { value, done } = await linhas.next();
  if (done) throw new Error('Entrada encerrada antes de terminar.');
  return value.replace(/\r$/, '');
};

async function perguntarOculto(texto) {
  const { stdin, stdout } = process;
  stdout.write(texto);
  if (!stdin.isTTY) {
    const linha = await proximaLinha();
    stdout.write('\n');
    return linha;
  }
  return new Promise((resolve) => {
    let digitado = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const aoTeclar = (tecla) => {
      for (const c of tecla) {
        if (c === '\u0003') { stdin.setRawMode(false); stdout.write('\n'); process.exit(130); } // Ctrl+C
        else if (c === '\r' || c === '\n') {
          stdin.setRawMode(false); stdin.pause(); stdin.off('data', aoTeclar); stdout.write('\n'); return resolve(digitado);
        } else if (c === '\u007f' || c === '\b') digitado = digitado.slice(0, -1);
        else digitado += c;
      }
    };
    stdin.on('data', aoTeclar);
  });
}

const args = process.argv.slice(2);
const redefinir = args.includes('--redefinir');
const entrada = z.email().safeParse(args.find((a) => !a.startsWith('--'))?.trim().toLowerCase());
if (!entrada.success) {
  console.error('Uso: npm run admin:criar -- email@gatcha.com.br [--redefinir]');
  process.exit(1);
}
const email = entrada.data;

try {
  const existe = await repo.buscarUsuarioPorEmail(pool, email);
  if (existe && !redefinir) throw new Error(`O usuário ${email} já existe. Use --redefinir para trocar a senha.`);
  if (!existe && redefinir) throw new Error(`O usuário ${email} não existe.`);

  const senha = await perguntarOculto('Senha (mín. 12 caracteres): ');
  const problema = validarSenha(senha, { email });
  if (problema) throw new Error(problema);
  if (senha !== (await perguntarOculto('Repita a senha: '))) throw new Error('As senhas não conferem.');

  const senhaHash = await gerarHash(senha);
  if (existe) await repo.atualizarSenha(pool, { email, senhaHash });
  else await repo.criarUsuario(pool, { email, senhaHash });
  console.log(existe ? `Senha de ${email} redefinida.` : `Usuário ${email} criado.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
