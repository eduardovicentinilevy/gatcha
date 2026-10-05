/**
 * Descobre o Place ID do Gatchá no Google (rodar uma vez):
 *   npm run places:id -- "Gatchá Galeria Metrópole São Paulo"
 * Copie o id certo para GOOGLE_PLACE_ID no .env.
 */
import { config } from '../src/config/env.js';

const busca = process.argv.slice(2).join(' ') || 'Gatchá cat café Galeria Metrópole São Paulo';
if (!config.google.placesApiKey) {
  console.error('Defina GOOGLE_PLACES_API_KEY no .env antes.');
  process.exit(1);
}
const resposta = await fetch('https://places.googleapis.com/v1/places:searchText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': config.google.placesApiKey,
    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
  },
  body: JSON.stringify({ textQuery: busca, languageCode: 'pt-BR' }),
});
const dados = await resposta.json();
if (!resposta.ok) {
  console.error('Erro do Google:', dados.error?.message ?? resposta.status);
  process.exit(1);
}
for (const p of dados.places ?? []) console.log(`${p.id}  ←  ${p.displayName?.text} — ${p.formattedAddress}`);
if (!dados.places?.length) console.log('Nenhum lugar encontrado. Tente outro texto de busca.');
