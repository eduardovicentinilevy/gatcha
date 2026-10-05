-- =============================================================================
-- Log de acessos ao painel administrativo (exigido pelo escopo) + base do
-- bloqueio de tentativas de login por e-mail.
-- Guarda QUEM, QUANDO, O QUÊ e DE ONDE (IP) — nunca senhas, tokens ou corpo de
-- requisição. É dado pessoal da EQUIPE, tratado por segurança (LGPD art. 7º IX/
-- art. 6º VII) e apagado após RETENCAO_ACESSOS_DIAS (scripts/expurgar-dados.js).
-- =============================================================================
CREATE TABLE acessos_admin (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- SET NULL: apagar um usuário não apaga o histórico de segurança.
  usuario_id  bigint REFERENCES usuarios_admin (id) ON DELETE SET NULL,
  email       varchar(254) NOT NULL,
  evento      varchar(12)  NOT NULL,
  metodo      varchar(7),
  rota        varchar(200),
  status      smallint,
  ip          varchar(45),
  criado_em   timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT acessos_admin_evento_valido CHECK (evento IN ('login_ok', 'login_falha', 'acesso'))
);

-- Contagem de falhas recentes por e-mail (bloqueio de força bruta) e expurgo por data.
CREATE INDEX acessos_admin_email_idx    ON acessos_admin (email, evento, criado_em DESC);
CREATE INDEX acessos_admin_criado_em_idx ON acessos_admin (criado_em);
