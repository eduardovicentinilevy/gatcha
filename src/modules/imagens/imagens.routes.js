import express, { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { AppError, naoEncontrado } from '../../lib/erros.js';
import { validar } from '../../middlewares/validar.js';
import { inserirImagem, buscarImagem } from './imagens.repository.js';
import { MAX_BYTES_ENVIO, processarImagem, TIPOS_ACEITOS, urlDaImagem } from './imagens.service.js';

/** Público: GET /api/imagens/<uuid>.webp */
export const rotasDeImagens = Router();
const arquivo = z.strictObject({
  arquivo: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/, 'Imagem inválida').transform((a) => a.slice(0, 36)),
});

rotasDeImagens.get('/imagens/:arquivo', validar({ params: arquivo }), async (req, res) => {
  const dados = await buscarImagem(pool, req.validado.params.arquivo);
  if (!dados) throw naoEncontrado('Imagem não encontrada.');
  res.set({
    'Content-Type': 'image/webp',
    // O conteúdo de um id nunca muda: o navegador e o CDN podem guardar para sempre.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'none'",
  });
  res.send(dados);
});

/** Painel (já autenticado): POST /api/admin/imagens com o arquivo cru no corpo. */
export const rotasDeEnvioDeImagens = Router();
rotasDeEnvioDeImagens.post(
  '/imagens',
  express.raw({ type: TIPOS_ACEITOS, limit: MAX_BYTES_ENVIO }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      throw new AppError(415, 'TIPO_DE_CONTEUDO_NAO_SUPORTADO', 'Envie uma foto JPG, PNG ou WebP.');
    }
    const imagem = await inserirImagem(pool, await processarImagem(req.body));
    res.status(201).json({ imagem: { ...imagem, url: urlDaImagem(imagem.id) } });
  },
);
