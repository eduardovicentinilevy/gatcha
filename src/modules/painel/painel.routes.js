/**
 * Rotas do painel (/api/admin/*). Já chegam aqui autenticadas (exigirAdmin) e com log de acesso.
 * Cada handler é fino: valida (middleware), chama o repositório/serviço e responde.
 */
import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { conflito, naoEncontrado } from '../../lib/erros.js';
import { validar } from '../../middlewares/validar.js';
import * as repo from './painel.repository.js';
import { rotasDeEnvioDeImagens } from '../imagens/imagens.routes.js';
import * as s from './painel.schemas.js';

export const rotasDoPainelDados = Router();
const r = rotasDoPainelDados;
r.use(rotasDeEnvioDeImagens); // POST /api/admin/imagens (fotos de gatos e do cardápio)

/** Violações de UNIQUE/FK do Postgres viram 409 com mensagem útil, em vez de 500. */
const tratar = (mensagens, handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    const mensagem = mensagens[err?.code];
    next(mensagem ? conflito(...mensagem) : err);
  }
};

// ---------------------------------------------------------------- gatos
r.get('/gatos', async (_req, res) => res.json({ gatos: await repo.listarGatos(pool) }));
r.post('/gatos', validar({ body: s.criarGatoBody }), async (req, res) => {
  res.status(201).json({ gato: await repo.criarGato(pool, req.validado.body) });
});
r.patch('/gatos/:id', validar({ params: s.idParams, body: s.alterarGatoBody }), async (req, res) => {
  const gato = await repo.alterarGato(pool, req.validado.params.id, req.validado.body);
  if (!gato) throw naoEncontrado('Gato não encontrado.');
  res.json({ gato });
});
r.delete('/gatos/:id', validar({ params: s.idParams }), async (req, res) => {
  if (!(await repo.apagarGato(pool, req.validado.params.id))) throw naoEncontrado('Gato não encontrado.');
  res.status(204).end();
});

// ---------------------------------------------------------------- cardápio
const ITEM_DUPLICADO = { 23505: ['ITEM_DUPLICADO', 'Já existe um item com esse nome nessa categoria.'] };
r.get('/cardapio', async (_req, res) => res.json({ itens: await repo.listarItens(pool) }));
r.post('/cardapio', validar({ body: s.criarItemBody }), tratar(ITEM_DUPLICADO, async (req, res) => {
  res.status(201).json({ item: await repo.criarItem(pool, req.validado.body) });
}));
r.patch('/cardapio/:id', validar({ params: s.idParams, body: s.alterarItemBody }), tratar(ITEM_DUPLICADO, async (req, res) => {
  const item = await repo.alterarItem(pool, req.validado.params.id, req.validado.body);
  if (!item) throw naoEncontrado('Item não encontrado.');
  res.json({ item });
}));
r.delete('/cardapio/:id', validar({ params: s.idParams }), async (req, res) => {
  if (!(await repo.apagarItem(pool, req.validado.params.id))) throw naoEncontrado('Item não encontrado.');
  res.status(204).end();
});
