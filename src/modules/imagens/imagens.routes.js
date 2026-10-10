import express, { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { comTransacao } from '../../db/transacao.js';
import { AppError, naoEncontrado } from '../../lib/erros.js';
import { limiteFotos } from '../../middlewares/rate-limit.js';
import { validar } from '../../middlewares/validar.js';
import { buscarImagem, espacoUsado, inserirImagem } from './imagens.repository.js';
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

const espacoCheio = () =>
  new AppError(507, 'ESPACO_DE_FOTOS_CHEIO', 'O espaço de fotos está cheio. Fale com quem administra o sistema (fotos sem uso são apagadas todo dia).');

/**
 * Painel (já autenticado): POST /api/admin/imagens com o arquivo cru no corpo.
 * O limite por pessoa vem ANTES de ler o corpo: quem passou do limite nem envia os 8 MB.
 */
export const rotasDeEnvioDeImagens = Router();
rotasDeEnvioDeImagens.post(
  '/imagens',
  limiteFotos,
  express.raw({ type: TIPOS_ACEITOS, limit: MAX_BYTES_ENVIO }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      throw new AppError(415, 'TIPO_DE_CONTEUDO_NAO_SUPORTADO', 'Envie uma foto JPG, PNG ou WebP.');
    }
    // Checagem barata ANTES de processar: com o espaço cheio, nem gasta CPU reprocessando a foto.
    if ((await espacoUsado(pool)) >= config.imagens.maxBytesTotal) throw espacoCheio();
    const processada = await processarImagem(req.body);
    const imagem = await comTransacao((client) => inserirImagem(client, processada, config.imagens));
    if (!imagem) throw espacoCheio();
    res.status(201).json({ imagem: { ...imagem, url: urlDaImagem(imagem.id) } });
  },
);
