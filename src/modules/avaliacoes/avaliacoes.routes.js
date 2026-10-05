import { Router } from 'express';
import { obterAvaliacoes } from './avaliacoes.service.js';

export const rotasDeAvaliacoes = Router();

// GET /api/avaliacoes — avaliações do Google Maps (ou { disponivel: false } se não configurado)
rotasDeAvaliacoes.get('/avaliacoes', async (_req, res) => {
  const dados = await obterAvaliacoes();
  // Conteúdo público e igual para todos: pode ficar em cache no navegador/CDN por 30 min.
  res.set('Cache-Control', 'public, max-age=1800').json(dados);
});
