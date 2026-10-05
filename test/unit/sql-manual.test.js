import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * db/manual/2_criar_tabelas.sql é a versão "pgAdmin" da migração 001 e marca a
 * 001 como aplicada. Se as duas divergirem, um banco criado pelo pgAdmin ficaria
 * marcado como migrado com um schema diferente. Este teste impede isso.
 */
test('script manual contém exatamente o schema da migração 001', () => {
  const ler = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const migracao = ler('db/migrations/001_schema_inicial.sql');
  const manual = ler('db/manual/2_criar_tabelas.sql');
  const schema = migracao.slice(migracao.indexOf('CREATE TABLE reservas')).trim();
  assert.ok(manual.includes(schema), 'atualize db/manual/2_criar_tabelas.sql junto com a migração 001');
  assert.match(manual, /INSERT INTO schema_migrations \(nome\) VALUES \('001_schema_inicial\.sql'\)/);
});
