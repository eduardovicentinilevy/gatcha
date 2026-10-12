/**
 * Logger estruturado em JSON, uma linha por evento, no stdout/stderr.
 * O Cloud Logging interpreta automaticamente os campos "severity" e "message".
 *
 * Privacidade: nunca registre corpo de requisição, nome, e-mail, telefone ou IP aqui.
 * O Cloud Run já mantém o request log da plataforma com retenção própria.
 */
import { config } from '../config/env.js';

const NIVEIS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const SEVERIDADE = { debug: 'DEBUG', info: 'INFO', warn: 'WARNING', error: 'ERROR' };
const limiar = NIVEIS[config.logLevel];

function escrever(nivel, mensagem, campos = {}) {
  if (NIVEIS[nivel] < limiar) return;
  const linha = JSON.stringify({ severity: SEVERIDADE[nivel], message: mensagem, time: new Date().toISOString(), ...campos });
  (NIVEIS[nivel] >= NIVEIS.warn ? process.stderr : process.stdout).write(linha + '\n');
}

/** Serializa um erro sem perder stack/código, para análise no Error Reporting. */
export function serializarErro(err) {
  if (!(err instanceof Error)) return { valor: String(err) };
  return { nome: err.name, mensagem: err.message, codigo: err.code, stack_trace: err.stack };
}

export const logger = {
  debug: (msg, campos) => escrever('debug', msg, campos),
  info: (msg, campos) => escrever('info', msg, campos),
  warn: (msg, campos) => escrever('warn', msg, campos),
  error: (msg, campos) => escrever('error', msg, campos),
};
