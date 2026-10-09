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

/** `codigo`: só para quem tem 2FA (a API responde CODIGO_2FA_NECESSARIO quando falta). */
export async function entrar(email, senha, codigo) {
  const corpo = { email, senha, ...(codigo && { codigo }) };
  const resposta = await requisitar(`${CONFIG.apiBase}/auth/login`, { metodo: 'POST', corpo });
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

/** Envia uma foto (o servidor reprocessa e devolve { url, largura, altura }). */
export async function enviarImagem(arquivo) {
  let resposta;
  try {
    resposta = await fetch(`${CONFIG.apiBase}/admin/imagens`, {
      method: 'POST',
      headers: { 'Content-Type': arquivo.type, Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: arquivo,
      credentials: 'same-origin',
    });
  } catch {
    throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o servidor. Confere a internet e tenta de novo.');
  }
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 401) {
      token = null;
      aoExpirar();
    }
    const mensagem = resposta.status === 413 ? 'Foto grande demais.' : (dados?.erro?.mensagem ?? 'Não deu pra enviar a foto.');
    throw new ErroApi(resposta.status, dados?.erro?.codigo ?? 'ERRO_HTTP', mensagem);
  }
  return dados.imagem;
}
