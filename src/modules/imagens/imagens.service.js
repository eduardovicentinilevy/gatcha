/**
 * Fotos enviadas pelo painel. A imagem original NUNCA é guardada nem servida: a API
 * decodifica e gera um WebP novo. Isso:
 *  - descarta metadados (EXIF com localização GPS do celular, nome do aparelho...);
 *  - neutraliza arquivos disfarçados (um "JPG" que é HTML/SVG/script não decodifica);
 *  - corrige a rotação do celular e limita o tamanho (site leve no 4G).
 */
import sharp from 'sharp';
import { requisicaoInvalida } from '../../lib/erros.js';

sharp.cache(false);
sharp.concurrency(1); // Cloud Run com pouca CPU: uma imagem por vez por instância

export const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES_ENVIO = 8 * 1024 * 1024;
const MAX_LADO = 1600;
const MAX_PIXELS_ENTRADA = 40_000_000; // ~ 8000 x 5000: barra "bombas" de descompressão
const FORMATOS = new Set(['jpeg', 'png', 'webp']);

const invalida = () => requisicaoInvalida('IMAGEM_INVALIDA', 'Não deu pra ler essa imagem. Envie uma foto JPG, PNG ou WebP.');

/** @param {Buffer} entrada  @returns {Promise<{ dados: Buffer, largura: number, altura: number }>} */
export async function processarImagem(entrada) {
  if (!Buffer.isBuffer(entrada) || entrada.length === 0) throw invalida();
  let meta;
  try {
    meta = await sharp(entrada, { limitInputPixels: MAX_PIXELS_ENTRADA }).metadata();
  } catch {
    throw invalida();
  }
  // O formato vem do CONTEÚDO do arquivo, não do nome nem do Content-Type informado.
  if (!FORMATOS.has(meta.format)) throw invalida();

  try {
    const { data, info } = await sharp(entrada, { limitInputPixels: MAX_PIXELS_ENTRADA, failOn: 'error' })
      .rotate() // aplica a orientação do EXIF antes de descartá-lo
      .resize({ width: MAX_LADO, height: MAX_LADO, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer({ resolveWithObject: true }); // sem .keepMetadata(): sai sem EXIF/ICC/XMP
    return { dados: data, largura: info.width, altura: info.height };
  } catch {
    throw invalida();
  }
}

export const urlDaImagem = (id) => `/api/imagens/${id}.webp`;
