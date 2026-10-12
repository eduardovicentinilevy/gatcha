import { Router } from 'express';
import { pool } from '../../db/pool.js';
import * as repo from './catalogo.repository.js';

/** Vitrine: o site só lê. Nenhum dado de visitante é recebido ou guardado. */
export const rotasDoCatalogo = Router();

rotasDoCatalogo.get('/cardapio', async (_req, res) => {
  res.json({ itens: await repo.listarCardapio(pool) });
});

rotasDoCatalogo.get('/gatos', async (_req, res) => {
  res.json({ gatos: await repo.listarGatosPublicos(pool) });
});
