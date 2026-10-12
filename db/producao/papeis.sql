-- =============================================================================
-- PRODUÇÃO: usuários do banco com o MENOR privilégio necessário.
--
--   gatcha_migracao  dono das tabelas. Só o `npm run migrate` usa (DATABASE_URL_MIGRACAO).
--   gatcha_app       a API e a limpeza diária. Só lê e escreve dados (DATABASE_URL):
--                    não cria, altera nem apaga tabelas.
--
-- Rode UMA vez, conectado ao banco do Gatchá com o usuário administrador do provedor
-- (Neon, Supabase, Cloud SQL...). Pode rodar de novo sem problema.
-- Depois, defina as senhas (fortes e diferentes) no psql, sem gravá-las em arquivo:
--   \password gatcha_migracao
--   \password gatcha_app
-- e guarde as duas URLs no Secret Manager.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gatcha_migracao') THEN CREATE ROLE gatcha_migracao LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gatcha_app') THEN CREATE ROLE gatcha_app LOGIN; END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO gatcha_migracao, gatcha_app', current_database());
END $$;

-- Quem roda este script precisa poder agir como gatcha_migracao para passar as tabelas a ele.
GRANT gatcha_migracao TO CURRENT_USER;

-- Só o dono das tabelas cria objetos no schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO gatcha_migracao;
GRANT USAGE ON SCHEMA public TO gatcha_app;

-- Tabelas já criadas por outro usuário passam para o gatcha_migracao.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner <> 'gatcha_migracao' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO gatcha_migracao', t.tablename);
  END LOOP;
END $$;

-- A API lê e escreve dados nas tabelas de hoje e nas que as próximas migrações criarem.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gatcha_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gatcha_app;
ALTER DEFAULT PRIVILEGES FOR ROLE gatcha_migracao IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gatcha_app;
ALTER DEFAULT PRIVILEGES FOR ROLE gatcha_migracao IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gatcha_app;

-- ...menos o controle das migrações, que é só do dono (o npm run migrate também garante isso).
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN REVOKE ALL ON public.schema_migrations FROM gatcha_app; END IF;
END $$;
