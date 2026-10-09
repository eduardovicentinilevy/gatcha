/**
 * Cliente de dados do site: fala com a API na mesma origem (o Firebase Hosting
 * reescreve /api para o Cloud Run e, em dev, o proxy do Vite faz o mesmo).
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
  0: 'Sem conexão com o servidor. Confere a internet e tenta de novo?',
  429: 'Muitas tentativas seguidas. Respira, espera uns minutinhos e tenta de novo.',
  500: 'Deu ruim do nosso lado. Tenta de novo em instantes?',
  503: 'O sistema tá ocupado agora. Tenta de novo em alguns segundos.',
};

export async function requisitar(url, { metodo = 'GET', corpo, sinal, cabecalhos } = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), CONFIG.timeoutMs);
  sinal?.addEventListener('abort', () => controle.abort());
  let resposta;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: { Accept: 'application/json', ...(corpo && { 'Content-Type': 'application/json' }), ...cabecalhos },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (erro) {
    if (sinal?.aborted) throw erro; // cancelado pelo componente: não é erro de rede
    throw new ErroApi(0, 'SEM_CONEXAO', MENSAGENS_PADRAO[0]);
  } finally {
    clearTimeout(timer);
  }

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = dados?.erro ?? {};
    // Sem o JSON de erro da API = a API nem respondeu (em dev, o proxy do Vite devolve 500 vazio).
    const semApi = !dados?.erro && resposta.status >= 500;
    const mensagem =
      erro.mensagem ??
      (semApi && import.meta.env.DEV ? 'A API não respondeu. Confira se o npm run dev está rodando e sem erros no terminal.' : null) ??
      MENSAGENS_PADRAO[resposta.status] ??
      MENSAGENS_PADRAO[500];
    throw new ErroApi(resposta.status, erro.codigo ?? 'ERRO_HTTP', mensagem, erro.detalhes);
  }
  return dados;
}

const doExemplo = (arquivo) => requisitar(`${CONFIG.dadosExemploBase}/${arquivo}`);

/**
 * Cardápio e gatos são lidos por mais de um componente (ex.: carrossel do topo e
 * seção própria): uma única requisição por carregamento da página.
 * Enquanto /api/cardapio e /api/gatos não existirem no backend, caem nos JSON de
 * exemplo e avisam o visitante (`exemplo: true`).
 */
function carregadorComCache(rota, arquivo, chave) {
  let promessa;
  return () => {
    promessa ??= (async () => {
      try {
        return { lista: (await requisitar(CONFIG.apiBase + rota))[chave], exemplo: false };
      } catch {
        return { lista: (await doExemplo(arquivo))[chave], exemplo: true };
      }
    })().catch((erro) => {
      promessa = undefined; // falhou de vez (ex.: sem internet): a próxima chamada tenta de novo
      throw erro;
    });
    return promessa;
  };
}

export const carregarCardapio = carregadorComCache('/cardapio', 'cardapio.json', 'itens');
export const carregarGatos = carregadorComCache('/gatos', 'gatos.json', 'gatos');

export const api = {
  registrarInteresse: (dados) => requisitar(`${CONFIG.apiBase}/interesses`, { metodo: 'POST', corpo: dados }),
};
