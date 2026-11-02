import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { CONFIG } from './src/config.js';

const escaparAtributo = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Textos e cores do index.html vêm do src/config.js (fonte única): a descrição do site
 * acompanha a frase "primeiro cat café" e a barra do navegador acompanha a paleta.
 */
function textosDoConfig() {
  const valores = {
    GATCHA_DESCRICAO: CONFIG.textos.descricao,
    GATCHA_DESCRICAO_COMPARTILHAR: CONFIG.textos.descricaoCompartilhar,
    GATCHA_COR_CLARO: CONFIG.cores.claro.superficie,
    GATCHA_COR_ESCURO: CONFIG.cores.escuro.superficie,
  };
  return {
    name: 'gatcha-textos-do-config',
    transformIndexHtml: (html) =>
      html.replace(/%(GATCHA_[A-Z_]+)%/g, (marca, nome) => {
        if (!(nome in valores)) throw new Error(`index.html usa ${marca}, que o vite.config.js não conhece`);
        return escaparAtributo(valores[nome]);
      }),
  };
}

/**
 * Prévia de link (og:image/og:url) precisa de endereço ABSOLUTO. Com VITE_SITE_URL definido
 * (ex.: VITE_SITE_URL=https://gatcha.com.br npm run build), as tags entram no index.html;
 * sem ela, a prévia mostra só título e descrição.
 */
function previaDeLink(siteUrl) {
  if (!siteUrl) return null;
  const url = new URL(siteUrl);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`VITE_SITE_URL precisa ser só o endereço https do site (ex.: https://gatcha.com.br), recebi "${siteUrl}"`);
  }
  const base = url.origin;
  return {
    name: 'gatcha-previa-de-link',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { property: 'og:url', content: `${base}/` }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:image', content: `${base}/og.png` }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:image:alt', content: 'Gatchá, cat café de matchá na Galeria Metrópole' }, injectTo: 'head' },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), textosDoConfig(), previaDeLink(env.VITE_SITE_URL)],
    server: { port: 5173 },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
