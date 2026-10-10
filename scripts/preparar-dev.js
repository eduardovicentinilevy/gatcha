/**
 * Roda antes de `npm run dev`, `migrate:dev`, `admin:criar` etc.
 * - Se não existir .env, cria a partir do .env.example (o .env nunca vai para o Git:
 *   guarda senhas locais).
 * - Se o JWT_SECRET ou a CHAVE_DADOS estiverem vazios, gera aleatórios no .env LOCAL, para
 *   o painel funcionar sem configuração. Em produção os segredos vêm do Secret Manager.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Arquivo .env criado a partir do .env.example.');
  console.log('Confira a DATABASE_URL nele se o seu Postgres não for o do docker-compose.yml.\n');
}

/**
 * Segredo presente mas vazio (ou ausente) no .env LOCAL: gera um aleatório. Em produção
 * os segredos vêm do Secret Manager; este script só roda no computador de quem desenvolve.
 */
function garantirSegredo(nome, aviso) {
  const conteudo = readFileSync('.env', 'utf8');
  const vazio = new RegExp(`^${nome}=[ \\t]*(#.*)?$`, 'm');
  const ausente = !new RegExp(`^${nome}=`, 'm').test(conteudo);
  if (!vazio.test(conteudo) && !ausente) return;
  const segredo = randomBytes(48).toString('base64url');
  const novo = ausente ? `${conteudo.replace(/\n?$/, '\n')}${nome}=${segredo}\n` : conteudo.replace(vazio, `${nome}=${segredo}`);
  writeFileSync('.env', novo);
  console.log(`${nome} gerado no .env (${aviso}).\n`);
}

garantirSegredo('JWT_SECRET', 'login do painel ativado neste computador');
garantirSegredo('CHAVE_DADOS', 'protege o 2FA e os limites neste computador');

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
