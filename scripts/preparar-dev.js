/**
 * Roda antes de `npm run dev`, `migrate:dev`, `admin:criar` etc.
 * - Se não existir .env, cria a partir do .env.example (o .env nunca vai para o Git:
 *   guarda senhas locais).
 * - Se o JWT_SECRET estiver vazio, gera um aleatório no .env LOCAL, para o login do
 *   painel funcionar sem configuração. Em produção o segredo vem do Secret Manager.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Arquivo .env criado a partir do .env.example.');
  console.log('Confira a DATABASE_URL nele se o seu Postgres não for o do docker-compose.yml.\n');
}

const conteudo = readFileSync('.env', 'utf8');
const linha = /^JWT_SECRET=[ \t]*(#.*)?$/m; // presente mas vazia
const ausente = !/^JWT_SECRET=/m.test(conteudo);
if (linha.test(conteudo) || ausente) {
  const segredo = randomBytes(48).toString('base64url');
  const novo = ausente ? `${conteudo.replace(/\n?$/, '\n')}JWT_SECRET=${segredo}\n` : conteudo.replace(linha, `JWT_SECRET=${segredo}`);
  writeFileSync('.env', novo);
  console.log('JWT_SECRET gerado no .env (login do painel ativado neste computador).\n');
}

// `--migrar` (usado pelo npm run dev): aplica migrações pendentes no banco local.
// Se o banco estiver fora do ar, só avisa: a API sobe e explica o problema no log.
if (process.argv.includes('--migrar')) {
  process.loadEnvFile('.env');
  const { migrar } = await import('../src/db/migrar.js');
  try {
    const aplicadas = await migrar({
      connectionString: process.env.DATABASE_URL,
      ssl: ['true', '1'].includes(process.env.DB_SSL ?? 'false'),
    });
    if (aplicadas.length) console.log(`Migrações aplicadas: ${aplicadas.join(', ')}\n`);
  } catch (err) {
    console.warn(`Aviso: não deu pra aplicar as migrações (${err.message}). O banco está no ar? Veja a DATABASE_URL no .env.\n`);
  }
}
