/**
 * Cliente do painel. O token (JWT de curta duração) fica SÓ na memória desta aba:
 * nada em localStorage/cookie. Recarregar a página ou fechar a aba = entrar de novo.
 * Se a API responder 401 (token expirou ou a senha foi trocada), avisa o painel.
 */
import { CONFIG } from '../config.js';
import { ErroApi, requisitar } from '../api.js';

let token = null;
let aoExpirar = () => {};
export const definirAoExpirar = (fn) => {
  aoExpirar = fn;
};

export async function entrar(email, senha) {
  const resposta = await requisitar(`${CONFIG.apiBase}/auth/login`, { metodo: 'POST', corpo: { email, senha } });
  token = resposta.token;
  return resposta.usuario;
}

export function sair() {
  token = null;
}

export async function admin(metodo, rota, corpo) {
  try {
    return await requisitar(`${CONFIG.apiBase}/admin${rota}`, { metodo, corpo, cabecalhos: { Authorization: `Bearer ${token}` } });
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 401) {
      token = null;
      aoExpirar();
    }
    throw erro;
  }
}
