/**
 * Política de senha + bcrypt.
 *
 * - bcrypt custo 12 (~250 ms): lento de propósito contra força bruta offline.
 * - bcrypt só considera os primeiros 72 BYTES da senha: senhas maiores são
 *   recusadas (em vez de truncadas em silêncio).
 * - Nunca registrar a senha em log, resposta ou mensagem de erro.
 */
import bcrypt from 'bcryptjs';
import { AppError } from '../../lib/erros.js';

export const CUSTO_BCRYPT = 12;
export const MIN_CARACTERES = 12;
const MAX_BYTES = 72;

// Senhas mais comuns em listas de vazamento (a checagem completa seria uma lista grande;
// aqui cobrimos o óbvio + as regras de comprimento e variedade abaixo).
const COMUNS = new Set([
  '123456789012', 'password1234', 'senha1234567', 'senha12345678', 'qwerty123456', 'abcdefghijkl',
  'gatcha123456', 'gatchagatcha', 'matcha123456', 'mudar123456', 'admin1234567', 'administrador',
  'brasil123456', 'saopaulo1234', 'iloveyou1234', '111111111111', '000000000000', 'abc123abc123',
]);

/** @returns {string | null} mensagem do problema, ou null se a senha é aceitável */
export function validarSenha(senha, { email = '' } = {}) {
  if (typeof senha !== 'string') return 'Informe a senha.';
  if (senha.length < MIN_CARACTERES) return `A senha precisa ter ao menos ${MIN_CARACTERES} caracteres.`;
  if (Buffer.byteLength(senha, 'utf8') > MAX_BYTES) return `A senha pode ter no máximo ${MAX_BYTES} bytes (cerca de ${MAX_BYTES} caracteres).`;
  if (new Set(senha).size < 5) return 'A senha é repetitiva demais. Misture mais caracteres.';
  const minuscula = senha.toLowerCase();
  if (COMUNS.has(minuscula)) return 'Essa senha é muito comum. Escolha outra.';
  const parteEmail = email.split('@')[0].toLowerCase();
  if (parteEmail.length >= 4 && minuscula.includes(parteEmail)) return 'A senha não pode conter o seu e-mail.';
  return null;
}

export const gerarHash = (senha) => bcrypt.hash(senha, CUSTO_BCRYPT);

export const conferirSenha = (senha, hash) => bcrypt.compare(senha, hash);

// Hash falso para gastar o MESMO tempo quando o e-mail não existe: sem isso, a
// resposta mais rápida revelaria quais e-mails são cadastrados.
let hashFalso;
export async function gastarTempoDeConferencia(senha) {
  hashFalso ??= await bcrypt.hash('hash-falso-para-igualar-o-tempo', CUSTO_BCRYPT);
  await bcrypt.compare(senha, hashFalso);
}

// bcryptjs é JavaScript puro: cada conferência gasta CPU da instância toda. Limita
// quantas rodam ao mesmo tempo (e quantas esperam) para um fluxo de logins não
// travar o resto da API; passou da fila, responde 503 em vez de acumular.
const MAX_CONCORRENTES = 2;
const MAX_NA_FILA = 20;
let ativos = 0;
const fila = [];

export async function comLimiteDeConferencias(trabalho) {
  if (ativos < MAX_CONCORRENTES) ativos++;
  else {
    if (fila.length >= MAX_NA_FILA) throw new AppError(503, 'SERVICO_OCUPADO', 'O login está muito ocupado. Tente de novo em instantes.');
    await new Promise((liberar) => fila.push(liberar)); // a vaga é repassada por quem terminou
  }
  try {
    return await trabalho();
  } finally {
    const proximo = fila.shift();
    if (proximo) proximo();
    else ativos--;
  }
}
