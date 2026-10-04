/**
 * Roda antes de `npm run dev` e `npm run migrate:dev`.
 * Se não existir .env, cria a partir do .env.example (o .env nunca vai para o Git:
 * guarda senhas locais).
 */
import { copyFileSync, existsSync } from 'node:fs';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Arquivo .env criado a partir do .env.example.');
  console.log('Confira a DATABASE_URL nele se o seu Postgres não for o do docker-compose.yml.\n');
}
