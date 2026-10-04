import { config } from '../src/config/env.js';
import { migrar } from '../src/db/migrar.js';

try {
  const aplicadas = await migrar({ connectionString: config.db.url, ssl: config.db.ssl, log: console.log });
  console.log(aplicadas.length ? `${aplicadas.length} migração(ões) aplicada(s).` : 'Banco já está atualizado.');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
