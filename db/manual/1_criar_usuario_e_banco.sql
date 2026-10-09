-- PASSO 1 — rodar conectado ao banco "postgres" como usuário postgres (pgAdmin > Query Tool).
-- Cria o usuário da aplicação e o banco do Gatchá.
-- A senha precisa ser a mesma da DATABASE_URL do .env. SÓ PARA DESENVOLVIMENTO:
-- em produção, use db/producao/papeis.sql (usuários com o menor privilégio e senhas fortes).

CREATE USER gatcha WITH PASSWORD 'gatcha_dev';

CREATE DATABASE gatcha OWNER gatcha;
