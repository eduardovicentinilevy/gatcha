/**
 * Cliente de dados do site.
 *
 * - Modo normal: fala com a API (mesma origem; o Firebase Hosting reescreve /api
 *   para o Cloud Run e, em dev, o proxy do Vite faz o mesmo).
 * - Modo protótipo (CONFIG.modoPrototipo): lê os JSON de /dados-exemplo, que têm
 *   o MESMO formato da API, e simula reservas e interesses em memória. Para ligar
 *   a API real, basta desligar o modo protótipo; os componentes não mudam.
 */
import { CONFIG } from './config.js';
import * as prototipo from './prototipo.js';

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

export async function requisitar(url, { metodo = 'GET', corpo, sinal } = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), CONFIG.timeoutMs);
  sinal?.addEventListener('abort', () => controle.abort());
  let resposta;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
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
    const mensagem = erro.mensagem ?? MENSAGENS_PADRAO[resposta.status] ?? MENSAGENS_PADRAO[500];
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
      if (CONFIG.modoPrototipo) return { lista: (await doExemplo(arquivo))[chave], exemplo: true };
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

/**
 * Avaliações do Google Maps (via backend, que guarda a chave da Places API).
 * No protótipo, ou se a API não estiver configurada, devolve { disponivel: false }
 * e o site mostra as avaliações de exemplo do config.
 */
export async function carregarAvaliacoes(sinal) {
  if (CONFIG.modoPrototipo) return { disponivel: false, avaliacoes: [] };
  try {
    return await requisitar(`${CONFIG.apiBase}/avaliacoes`, { sinal });
  } catch {
    return { disponivel: false, avaliacoes: [] };
  }
}

export const api = {
  horarios: (data, sinal) =>
    CONFIG.modoPrototipo
      ? prototipo.horarios(data)
      : requisitar(`${CONFIG.apiBase}/horarios?data=${encodeURIComponent(data)}`, { sinal }),
  criarReserva: (dados) =>
    CONFIG.modoPrototipo ? prototipo.criarReserva(dados) : requisitar(`${CONFIG.apiBase}/reservas`, { metodo: 'POST', corpo: dados }),
  registrarInteresse: (dados) =>
    CONFIG.modoPrototipo ? prototipo.registrarInteresse(dados) : requisitar(`${CONFIG.apiBase}/interesses`, { metodo: 'POST', corpo: dados }),
};
