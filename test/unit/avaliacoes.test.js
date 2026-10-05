import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAmbienteDeTeste } from '../helpers/ambiente.js';

configurarAmbienteDeTeste({ GOOGLE_PLACES_API_KEY: 'chave-teste', GOOGLE_PLACE_ID: 'ChIJteste123', AVALIACOES_CACHE_HORAS: '6' });
const { mapearResposta, obterAvaliacoes, obterAvaliacoesComEstado, limparCache } = await import('../../src/modules/avaliacoes/avaliacoes.service.js');

const RESPOSTA_GOOGLE = {
  rating: 4.8,
  userRatingCount: 312,
  googleMapsUri: 'https://maps.google.com/?cid=1',
  reviews: [
    {
      rating: 5,
      text: { text: 'Matchá ótimo e gatos fofos!' },
      relativePublishTimeDescription: 'há 2 semanas',
      publishTime: '2026-09-20T10:00:00Z',
      authorAttribution: { displayName: 'Ana S.', uri: 'https://www.google.com/maps/contrib/1' },
      googleMapsUri: 'https://www.google.com/maps/reviews/1',
    },
    { rating: 4, text: { text: '' }, authorAttribution: { displayName: 'Sem texto' } }, // descartada
    { rating: 5, text: { text: 'Lindo' }, authorAttribution: { displayName: 'X', uri: 'javascript:alert(1)' } },
  ],
};

const fetchFalso = (respostas) => {
  const chamadas = [];
  const fn = async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    const r = respostas.shift();
    if (r instanceof Error) throw r;
    return { ok: r.status === 200, status: r.status, json: async () => r.corpo };
  };
  fn.chamadas = chamadas;
  return fn;
};

test('mapeia a resposta do Google, descarta avaliação sem texto e URLs que não são https', () => {
  const r = mapearResposta(RESPOSTA_GOOGLE);
  assert.equal(r.nota_media, 4.8);
  assert.equal(r.total, 312);
  assert.equal(r.avaliacoes.length, 2);
  assert.deepEqual(r.avaliacoes[0], {
    autor: 'Ana S.', autor_url: 'https://www.google.com/maps/contrib/1', nota: 5, texto: 'Matchá ótimo e gatos fofos!',
    quando: 'há 2 semanas', publicado_em: '2026-09-20T10:00:00Z', link: 'https://www.google.com/maps/reviews/1',
  });
  assert.equal(r.avaliacoes[1].autor_url, null);
});

test('chama a Places API com a chave no header (não na URL) e usa cache', async () => {
  limparCache();
  const buscar = fetchFalso([{ status: 200, corpo: RESPOSTA_GOOGLE }]);
  const a = await obterAvaliacoes({ buscar, agora: 0 });
  const b = await obterAvaliacoes({ buscar, agora: 1000 });
  assert.equal(a.disponivel, true);
  assert.equal(b, a);
  assert.equal(buscar.chamadas.length, 1, 'segunda leitura vem do cache');
  assert.ok(!buscar.chamadas[0].url.includes('chave-teste'));
  assert.equal(buscar.chamadas[0].opcoes.headers['X-Goog-Api-Key'], 'chave-teste');
  assert.match(buscar.chamadas[0].url, /places\/ChIJteste123\?languageCode=pt-BR$/);
});

test('se o Google falhar depois do cache expirar, devolve o último resultado bom', async () => {
  limparCache();
  await obterAvaliacoes({ buscar: fetchFalso([{ status: 200, corpo: RESPOSTA_GOOGLE }]) });
  const r = await obterAvaliacoes({ buscar: fetchFalso([new Error('rede')]), agora: Date.now() + 7 * 3_600_000 });
  assert.equal(r.disponivel, true);
  assert.equal(r.total, 312);
});

test('sem cache e com erro do Google: disponivel=false (site usa as avaliações de exemplo)', async () => {
  limparCache();
  const r = await obterAvaliacoes({ buscar: fetchFalso([{ status: 403, corpo: {} }]) });
  assert.deepEqual(r, { disponivel: false, avaliacoes: [] });
});

test('falha do Google também entra em cache (sem chamada paga a cada visita) e é marcada como degradada', async () => {
  limparCache();
  const buscar = fetchFalso([{ status: 500, corpo: {} }, { status: 200, corpo: RESPOSTA_GOOGLE }]);
  const t0 = 1_000_000;
  const a = await obterAvaliacoesComEstado({ buscar, agora: t0 });
  const b = await obterAvaliacoesComEstado({ buscar, agora: t0 + 60_000 }); // 1 min depois
  assert.equal(buscar.chamadas.length, 1, 'não chama o Google de novo logo após a falha');
  assert.deepEqual([a.degradado, b.degradado, b.dados.disponivel], [true, true, false]);
  const c = await obterAvaliacoesComEstado({ buscar, agora: t0 + 16 * 60_000 }); // passou a espera
  assert.equal(buscar.chamadas.length, 2);
  assert.deepEqual([c.degradado, c.dados.disponivel], [false, true]);
});
