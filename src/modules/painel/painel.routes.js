/**
 * Rotas do painel (/api/admin/*). Já chegam aqui autenticadas (exigirAdmin) e com log de acesso.
 * Cada handler é fino: valida (middleware), chama o repositório/serviço e responde.
 */
import { Router } from 'express';
import { config } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { conflito, naoEncontrado, requisicaoInvalida } from '../../lib/erros.js';
import { agoraNoFuso, somarDias } from '../../lib/tempo.js';
import { validar } from '../../middlewares/validar.js';
import * as repo from './painel.repository.js';
import { rotasDeEnvioDeImagens } from '../imagens/imagens.routes.js';
import * as s from './painel.schemas.js';

export const rotasDoPainelDados = Router();
const r = rotasDoPainelDados;
r.use(rotasDeEnvioDeImagens); // POST /api/admin/imagens (fotos de gatos e do cardápio)
const hoje = () => agoraNoFuso(config.gatil.fuso).data;

/** Violações de UNIQUE/FK do Postgres viram 409 com mensagem útil, em vez de 500. */
const tratar = (mensagens, handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    const mensagem = mensagens[err?.code];
    next(mensagem ? conflito(...mensagem) : err);
  }
};

// ---------------------------------------------------------------- reservas
r.get('/reservas', validar({ query: s.listarReservasQuery }), async (req, res) => {
  const de = req.validado.query.de ?? hoje();
  const ate = req.validado.query.ate ?? somarDias(de, 30);
  if (ate < de) throw requisicaoInvalida('PERIODO_INVALIDO', 'A data final precisa ser depois da inicial.');
  if (Date.parse(ate) - Date.parse(de) > 366 * 86_400_000) {
    throw requisicaoInvalida('PERIODO_INVALIDO', 'Escolha um período de até 1 ano.');
  }
  res.json({ de, ate, reservas: await repo.listarReservas(pool, { de, ate, status: req.validado.query.status }) });
});

// Transições permitidas: confirmada -> cancelada | compareceu; compareceu -> confirmada. Cancelada é definitiva
// (reativar poderia estourar a capacidade de um horário que já foi vendido de novo).
const ORIGENS = { cancelada: ['confirmada'], compareceu: ['confirmada'], confirmada: ['compareceu'] };
r.patch('/reservas/:codigo', validar({ params: s.codigoParams, body: s.alterarReservaBody }), async (req, res) => {
  const { codigo } = req.validado.params;
  const para = req.validado.body.status;
  const reserva = await repo.mudarStatusReserva(pool, { codigo, para, deStatus: ORIGENS[para] });
  if (reserva) return res.json({ reserva });
  if (!(await repo.existeReserva(pool, codigo))) throw naoEncontrado('Reserva não encontrada.');
  throw conflito('TRANSICAO_INVALIDA', 'Essa reserva não pode mudar para esse status.');
});

// ---------------------------------------------------------------- bloqueios
r.get('/bloqueios', validar({ query: s.listarBloqueiosQuery }), async (req, res) => {
  res.json({ bloqueios: await repo.listarBloqueios(pool, req.validado.query.de ?? hoje()) });
});

r.post('/bloqueios', validar({ body: s.criarBloqueioBody }), async (req, res) => {
  const b = req.validado.body;
  const bloqueio = await repo.criarBloqueio(pool, b);
  // Quem já tinha reserva nesse intervalo continua com ela: a equipe precisa avisar essas pessoas.
  const reservasAfetadas = await repo.contarReservasAtingidas(pool, b);
  res.status(201).json({ bloqueio, reservas_afetadas: reservasAfetadas });
});

r.delete('/bloqueios/:id', validar({ params: s.idParams }), async (req, res) => {
  if (!(await repo.apagarBloqueio(pool, req.validado.params.id))) throw naoEncontrado('Bloqueio não encontrado.');
  res.status(204).end();
});

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
r.delete(
  '/gatos/:id',
  validar({ params: s.idParams }),
  tratar({ 23503: ['GATO_COM_INTERESSADOS', 'Esse gato tem interessados registrados. Marque como adotado em vez de apagar.'] }, async (req, res) => {
    if (!(await repo.apagarGato(pool, req.validado.params.id))) throw naoEncontrado('Gato não encontrado.');
    res.status(204).end();
  }),
);

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

// ---------------------------------------------------------------- interesses
r.get('/interesses', validar({ query: s.listarInteressesQuery }), async (req, res) => {
  res.json({ interesses: await repo.listarInteresses(pool, req.validado.query.status) });
});
r.patch('/interesses/:id', validar({ params: s.idParams, body: s.alterarInteresseBody }), async (req, res) => {
  const interesse = await repo.mudarStatusInteresse(pool, req.validado.params.id, req.validado.body.status);
  if (!interesse) throw naoEncontrado('Interesse não encontrado.');
  res.json({ interesse });
});
