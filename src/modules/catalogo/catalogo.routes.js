import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { comTransacao } from '../../db/transacao.js';
import { AppError, conflito } from '../../lib/erros.js';
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

/**
 * Tetos do "Quero conhecer" que valem mesmo para quem troca de IP: um café recebe poucos
 * pedidos por dia, então folgados para uso real e baixos para spam encher o banco.
 */
const TETOS_INTERESSE = { porContatoDia: 3, geralPorHora: 60 };

// "Quero conhecer": a equipe repassa o contato à ONG. Resposta mínima (não ecoa dados pessoais).
rotasDoCatalogo.post('/interesses', limiteInteresse, validar({ body: criarInteresseBody }), async (req, res) => {
  const resultado = await comTransacao((client) => repo.inserirInteresse(client, req.validado.body, TETOS_INTERESSE));
  if (resultado === 'indisponivel') throw conflito('GATO_INDISPONIVEL', 'Esse gato não está mais disponível para adoção.');
  if (resultado === 'limite') {
    // Mesma mensagem nos dois tetos: não revela se um contato já mandou pedido.
    throw new AppError(429, 'MUITOS_PEDIDOS', 'Recebemos muitos pedidos agora. Tente de novo mais tarde ou fale com a equipe no café.');
  }
  res.status(201).json({ ok: true });
});
