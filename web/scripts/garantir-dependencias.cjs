/**
 * Roda antes de `npm run dev` e `build` (scripts "pre*").
 * Confere se TODAS as dependências do package.json estão instaladas. Se faltar
 * alguma (repositório recém-clonado, ou `git pull` trouxe uma dependência nova),
 * instala agora com o lockfile, em vez de o Vite falhar com
 * "Failed to resolve import" ou "'vite' não é reconhecido".
 */
const { existsSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const nomes = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const faltando = nomes.filter((n) => !existsSync(path.join(raiz, 'node_modules', n, 'package.json')));
if (faltando.length === 0) process.exit(0);

console.log(`Instalando dependências do site que faltam (${faltando.join(', ')})...`);
// shell: true para o Windows encontrar o npm.cmd
// install (não ci): só acrescenta o que falta, sem apagar node_modules (no Windows, apagar
// falha com EPERM se o Vite estiver aberto usando os arquivos).
const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: raiz, stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
