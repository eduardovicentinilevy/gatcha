/**
 * Roda antes de `npm run dev` / `npm run build` (scripts "pre*").
 * Se as dependências do site não estiverem instaladas (ex.: clonou o repositório
 * e não rodou `npm install`), instala agora com o lockfile — em vez de falhar
 * com "'vite' não é reconhecido como um comando".
 */
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
if (existsSync(path.join(raiz, 'node_modules', 'vite', 'package.json'))) process.exit(0);

console.log('Dependências do site não encontradas. Instalando (só na primeira vez)...');
// shell: true para o Windows encontrar o npm.cmd
const r = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: raiz, stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
