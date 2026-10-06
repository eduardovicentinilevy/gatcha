import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { conflito } from '../../lib/erros.js';
import { limiteInteresse } from '../../middlewares/rate-limit.js';
import { validar } from '../../middlewares/validar.js';
import * as repo from './catalogo.repository.js';
import { criarInteresseBody } from './catalogo.schemas.js';

export const rotasDoCatalogo = Router();

rotasDoCatalogo.get('/cardapio', async (_req, res) => {
  res.json({ itens: await repo.listarCardapio(pool) });
});

rotasDoCatalogo.get('/gatos', async (_req, res) => {
  res.json({ gatos: await repo.listarGatosPublicos(pool) });
});

// "Quero conhecer": a equipe repassa o contato à ONG. Resposta mínima (não ecoa dados pessoais).
rotasDoCatalogo.post('/interesses', limiteInteresse, validar({ body: criarInteresseBody }), async (req, res) => {
  const criado = await repo.inserirInteresse(pool, req.validado.body);
  if (!criado) throw conflito('GATO_INDISPONIVEL', 'Esse gato não está mais disponível para adoção.');
  res.status(201).json({ ok: true });
});
