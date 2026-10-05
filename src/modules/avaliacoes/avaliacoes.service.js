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

let cache = null; // { dados, expiraEm }
let emAndamento = null; // evita várias chamadas simultâneas ao Google

/**
 * @param {{ agora?: number, buscar?: typeof fetch }} [deps] injetáveis nos testes
 */
export async function obterAvaliacoes({ agora = Date.now(), buscar = fetch } = {}) {
  const { placesApiKey, placeId, cacheMs } = config.google;
  if (!placesApiKey || !placeId) return { disponivel: false, avaliacoes: [] };
  if (cache && cache.expiraEm > agora) return cache.dados;

  emAndamento ??= (async () => {
    try {
      const resposta = await buscar(`${URL_PLACES}${encodeURIComponent(placeId)}?languageCode=pt-BR`, {
        headers: { 'X-Goog-Api-Key': placesApiKey, 'X-Goog-FieldMask': CAMPOS },
        signal: AbortSignal.timeout(5_000),
      });
      if (!resposta.ok) throw new Error(`Places API respondeu ${resposta.status}`);
      const dados = mapearResposta(await resposta.json());
      cache = { dados, expiraEm: Date.now() + cacheMs };
      return dados;
    } catch (err) {
      logger.warn('Falha ao buscar avaliações do Google', { erro: serializarErro(err) });
      if (cache) return cache.dados; // melhor um resultado antigo do que nenhum
      return { disponivel: false, avaliacoes: [] };
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

/** Só para testes. */
export const limparCache = () => {
  cache = null;
};
