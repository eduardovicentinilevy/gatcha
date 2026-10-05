import { Router } from 'express';
import { obterAvaliacoesComEstado } from './avaliacoes.service.js';

export const rotasDeAvaliacoes = Router();

// GET /api/avaliacoes — avaliações do Google Maps (ou { disponivel: false } se não configurado)
rotasDeAvaliacoes.get('/avaliacoes', async (_req, res) => {
  const { dados, degradado } = await obterAvaliacoesComEstado();
  // Resultado bom: público, pode ficar 30 min no navegador/CDN.
  // Resultado antigo/indisponível: não guardar, para o site se recuperar sozinho quando o Google voltar.
  res.set('Cache-Control', degradado ? 'no-store' : 'public, max-age=1800').json(dados);
});
