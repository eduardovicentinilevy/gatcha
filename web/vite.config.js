import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em dev, /api é repassado para a API Express (npm run dev na raiz, porta 8080):
// mesma origem, igual à produção com o rewrite do Firebase Hosting.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
