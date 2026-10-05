/**
 * Avaliações do Google Maps via Places API (New) — o jeito oficial e permitido
 * de exibir avaliações do Google no site (copiar da página do Maps viola os termos).
 *
 * - A chave fica só no servidor; o navegador nunca a vê.
 * - Resultado em cache na memória da instância (padrão 6h): poucas chamadas pagas.
 * - Se o Google falhar, devolvemos o último resultado bom (se houver).
 * - Exibição segue as regras do Google: nome do autor com link, atribuição ao
 *   Google e texto sem alteração (o site só abrevia visualmente, com link).
 */
import { config } from '../../config/env.js';
import { logger, serializarErro } from '../../lib/logger.js';

const URL_PLACES = 'https://places.googleapis.com/v1/places/';
const CAMPOS = 'rating,userRatingCount,googleMapsUri,reviews';

const soHttps = (url) => (typeof url === 'string' && url.startsWith('https://') ? url : null);

/** Converte a resposta do Google para o formato público da nossa API. */
export function mapearResposta(lugar) {
  return {
    disponivel: true,
    fonte: 'google',
    nota_media: typeof lugar.rating === 'number' ? lugar.rating : null,
    total: Number.isInteger(lugar.userRatingCount) ? lugar.userRatingCount : null,
    link_maps: soHttps(lugar.googleMapsUri),
    avaliacoes: (lugar.reviews ?? [])
      .map((r) => ({
        autor: r.authorAttribution?.displayName ?? 'Cliente do Google',
        autor_url: soHttps(r.authorAttribution?.uri),
        nota: Number.isInteger(r.rating) ? r.rating : null,
        texto: (r.text?.text ?? r.originalText?.text ?? '').trim(),
        quando: r.relativePublishTimeDescription ?? null,
        publicado_em: r.publishTime ?? null,
        link: soHttps(r.googleMapsUri),
      }))
      .filter((r) => r.texto),
  };
}

// Depois de uma falha, espera este tempo antes de chamar o Google de novo
// (evita uma chamada paga + 5s de espera a cada visita durante uma pane).
const ESPERA_APOS_FALHA_MS = 15 * 60_000;
const INDISPONIVEL = Object.freeze({ disponivel: false, avaliacoes: [] });

let cache = null; // { dados, expiraEm, degradado }
let emAndamento = null; // evita várias chamadas simultâneas ao Google

/**
 * @param {{ agora?: number, buscar?: typeof fetch }} [deps] injetáveis nos testes
 * @returns {Promise<{ dados: object, degradado: boolean }>} degradado = resultado
 *          antigo ou indisponível (não deve ir para cache público de CDN)
 */
export async function obterAvaliacoesComEstado({ agora = Date.now(), buscar = fetch } = {}) {
  const { placesApiKey, placeId, cacheMs } = config.google;
  if (!placesApiKey || !placeId) return { dados: INDISPONIVEL, degradado: true };
  if (cache && cache.expiraEm > agora) return { dados: cache.dados, degradado: cache.degradado };

  emAndamento ??= (async () => {
    try {
      const resposta = await buscar(`${URL_PLACES}${encodeURIComponent(placeId)}?languageCode=pt-BR`, {
        headers: { 'X-Goog-Api-Key': placesApiKey, 'X-Goog-FieldMask': CAMPOS },
        signal: AbortSignal.timeout(5_000),
      });
      if (!resposta.ok) throw new Error(`Places API respondeu ${resposta.status}`);
      const dados = mapearResposta(await resposta.json());
      cache = { dados, expiraEm: agora + cacheMs, degradado: false };
      return { dados, degradado: false };
    } catch (err) {
      logger.warn('Falha ao buscar avaliações do Google', { erro: serializarErro(err) });
      // Melhor um resultado antigo do que nenhum; e não tenta de novo por um tempo.
      cache = { dados: cache?.dados ?? INDISPONIVEL, expiraEm: agora + ESPERA_APOS_FALHA_MS, degradado: true };
      return { dados: cache.dados, degradado: true };
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

/** Só os dados (para quem não precisa saber se estão degradados). */
export const obterAvaliacoes = async (deps) => (await obterAvaliacoesComEstado(deps)).dados;

/** Só para testes. */
export const limparCache = () => {
  cache = null;
};
