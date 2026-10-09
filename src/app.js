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
import { logger } from './lib/logger.js';
import { contextoDaRequisicao } from './middlewares/contexto.js';
import { criarVerificadorDeProxy } from './middlewares/proxy.js';
import { limitePublico } from './middlewares/rate-limit.js';
import { rotaNaoEncontrada, tratadorDeErros } from './middlewares/erros.js';
import { rotasDoCatalogo } from './modules/catalogo/catalogo.routes.js';
import { rotasDeImagens } from './modules/imagens/imagens.routes.js';
import { rotasDeAuth } from './modules/auth/auth.routes.js';
import { rotasDoPainel } from './modules/auth/admin.routes.js';

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
  // Só em produção: em desenvolvimento não há proxy na frente e o aviso seria ruído.
  if (config.isProducao) app.use(criarVerificadorDeProxy({ saltos: config.http.trustProxy, logger }));
  app.use(
    helmet({
      // Igual à CSP do firebase.json: o site só incorpora o mapa do Google (carregado sob demanda).
      contentSecurityPolicy: {
        directives: { 'frame-src': ['https://www.google.com'], 'img-src': ["'self'", 'data:', 'https:'] },
      },
    }),
  ); // headers de segurança + remove X-Powered-By

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
    res.set('Cache-Control', 'no-store'); // dados pessoais e do painel não ficam em cache
    next();
  });
  app.use(express.json({ limit: '10kb', strict: true }));

  app.use('/api', rotasDoCatalogo);
  app.use('/api', rotasDeImagens);
  app.use('/api', rotasDeAuth);
  app.use('/api', rotasDoPainel);

  if (config.http.servirFrontend) {
    // Serve o build do React (cd web && npm run build). SPA: rotas que não são
    // arquivo nem /api caem no index.html (ex.: /privacidade).
    const pasta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/dist');
    app.use(express.static(pasta));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || path.extname(req.path)) return next();
      res.sendFile(path.join(pasta, 'index.html'), (err) => err && next());
    });
  }

  app.use(rotaNaoEncontrada);
  app.use(tratadorDeErros);
  return app;
}
