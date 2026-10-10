import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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

// Em dev, /api é repassado para a API Express (npm run dev na raiz, porta 8080):
// mesma origem, igual à produção com o rewrite do Firebase Hosting.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), previaDeLink(env.VITE_SITE_URL)],
    server: {
      port: 5173,
      proxy: { '/api': 'http://localhost:8080' },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
