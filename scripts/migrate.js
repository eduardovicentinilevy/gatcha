import { config } from '../src/config/env.js';
import { migrar } from '../src/db/migrar.js';

// Em produção, as migrações rodam com o usuário DONO das tabelas (DATABASE_URL_MIGRACAO);
// a API usa um usuário que só lê e escreve dados (db/producao/papeis.sql).
try {
  const aplicadas = await migrar({ connectionString: config.db.urlMigracao, ssl: config.db.ssl, log: console.log });
  console.log(aplicadas.length ? `${aplicadas.length} migração(ões) aplicada(s).` : 'Banco já está atualizado.');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
