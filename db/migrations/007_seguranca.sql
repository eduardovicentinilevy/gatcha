-- =============================================================================
-- Endurecimento de segurança.
-- =============================================================================

-- Limites de taxa compartilhados entre as instâncias do Cloud Run (login,
-- "Quero conhecer" e envio de fotos). A chave é um HMAC do limitador + IP (ou
-- usuário): o IP em si não fica gravado. Linhas vencidas saem no expurgo diário.
CREATE TABLE limites_taxa (
  chave     varchar(64) PRIMARY KEY,
  contagem  integer     NOT NULL,
  expira_em timestamptz NOT NULL,

  CONSTRAINT limites_taxa_contagem_valida CHECK (contagem >= 0)
);
CREATE INDEX limites_taxa_expira_em_idx ON limites_taxa (expira_em);

-- 2FA (TOTP) opcional por usuário do painel, ativado por `npm run admin:2fa`.
-- O segredo fica CRIPTOGRAFADO pela API (AES-256-GCM); o banco sozinho não o revela.
-- totp_ultimo_passo impede reusar um código já aceito.
ALTER TABLE usuarios_admin
  ADD COLUMN totp_segredo      varchar(200),
  ADD COLUMN totp_ultimo_passo bigint,
  ADD CONSTRAINT usuarios_admin_totp_formato
    CHECK (totp_segredo IS NULL OR totp_segredo ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$');

-- Código do 2FA errado: evento próprio, contado num limite diário mais rígido.
ALTER TABLE acessos_admin DROP CONSTRAINT acessos_admin_evento_valido;
ALTER TABLE acessos_admin ADD CONSTRAINT acessos_admin_evento_valido
  CHECK (evento IN ('login_ok', 'login_falha', 'falha_2fa', 'acesso'));
CREATE INDEX acessos_admin_falha_2fa_idx ON acessos_admin (usuario_id, criado_em DESC) WHERE evento = 'falha_2fa';
