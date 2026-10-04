/**
 * Cliente da API Gatchá. Mesma origem (o Firebase Hosting reescreve /api para o
 * Cloud Run; em dev, o proxy do Vite faz o mesmo), então não há CORS.
 */
import { CONFIG } from './config.js';

export class ErroApi extends Error {
  constructor(status, codigo, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  /** { nome: 'mensagem', ... } a partir de detalhes.campos da API ("body.nome" -> "nome"). */
  get errosDeCampo() {
    const erros = {};
    for (const { campo, mensagem } of this.detalhes?.campos ?? []) {
      const nome = campo.split('.').slice(1).join('.') || campo;
      erros[nome] ??= mensagem;
    }
    return erros;
  }
}

const MENSAGENS_PADRAO = {
  0: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
  429: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.',
  500: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
  503: 'O sistema está ocupado agora. Tente de novo em alguns segundos.',
};

async function requisitar(metodo, caminho, corpo, sinalExterno) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), CONFIG.timeoutMs);
  sinalExterno?.addEventListener('abort', () => controle.abort());
  let resposta;
  try {
    resposta = await fetch(CONFIG.apiBase + caminho, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (erro) {
    if (sinalExterno?.aborted) throw erro; // cancelado pelo componente: não é erro de rede
    throw new ErroApi(0, 'SEM_CONEXAO', MENSAGENS_PADRAO[0]);
  } finally {
    clearTimeout(timer);
  }

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = dados?.erro ?? {};
    const mensagem = erro.mensagem ?? MENSAGENS_PADRAO[resposta.status] ?? MENSAGENS_PADRAO[500];
    throw new ErroApi(resposta.status, erro.codigo ?? 'ERRO_HTTP', mensagem, erro.detalhes);
  }
  return dados;
}

export const api = {
  horarios: (data, sinal) => requisitar('GET', `/horarios?data=${encodeURIComponent(data)}`, undefined, sinal),
  criarReserva: (dados) => requisitar('POST', '/reservas', dados),
  cardapio: (sinal) => requisitar('GET', '/cardapio', undefined, sinal),
  gatos: (sinal) => requisitar('GET', '/gatos', undefined, sinal),
  registrarInteresse: (dados) => requisitar('POST', '/interesses', dados),
};
