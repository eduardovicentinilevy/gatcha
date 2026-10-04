/**
 * Composição da aplicação Express (sem chamar listen): permite subir a mesma
 * app em testes de integração numa porta efêmera.
 *
 * Ordem da cadeia de middlewares (importa!):
 *   contexto -> helmet -> CORS -> rate limit -> parser JSON -> rotas -> 404 -> error handler
 * O rate limit vem ANTES do parser para não gastar CPU com corpo de quem já foi barrado.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { z } from 'zod';
import { config } from './config/env.js';
import { contextoDaRequisicao } from './middlewares/contexto.js';
import { limitePublico } from './middlewares/rate-limit.js';
import { rotaNaoEncontrada, tratadorDeErros } from './middlewares/erros.js';
import { rotasDeReservas } from './modules/reservas/reservas.routes.js';

// Mensagens padrão do Zod em português (as mensagens dos nossos schemas já são customizadas).
z.config(z.locales.pt());

export function criarApp() {
  const app = express();

  app.set('trust proxy', config.http.trustProxy);
  // Parser "simple" (node:querystring): sem objetos aninhados em query (?a[b]=c),
  // reduzindo superfície de prototype pollution / HTTP parameter pollution.
  app.set('query parser', 'simple');
  // Escapa <, > e & dentro das strings JSON das respostas (defesa extra contra XSS).
  app.set('json escape', true);

  app.use(contextoDaRequisicao);
  app.use(helmet()); // headers de segurança + remove X-Powered-By

  if (config.http.corsOrigins.length > 0) {
    app.use(
      '/api',
      cors({
        origin: config.http.corsOrigins, // allowlist explícita, nunca "*"
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600,
      }),
    );
  }

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api', limitePublico);
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); // vagas mudam a todo instante; dados pessoais não ficam em cache
    next();
  });
  app.use(express.json({ limit: '10kb', strict: true }));

  app.use('/api', rotasDeReservas);

  if (config.http.servirFrontend) {
    const pasta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/public');
    app.use(express.static(pasta, { extensions: ['html'], index: 'index.html' }));
  }

  app.use(rotaNaoEncontrada);
  app.use(tratadorDeErros);
  return app;
}
