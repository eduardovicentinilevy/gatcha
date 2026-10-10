-- =============================================================================
-- Revisão do 2FA e dos tetos do formulário de adoção.
-- =============================================================================

-- Os códigos errados agora são contados por e-mail (índice acessos_admin_email_idx).
DROP INDEX IF EXISTS acessos_admin_falha_2fa_idx;

-- Ativação pelo próprio painel: o segredo novo fica "pendente" até a pessoa confirmar
-- com um código do app (e a senha). Também criptografado.
ALTER TABLE usuarios_admin
  ADD COLUMN totp_pendente    varchar(200),
  ADD COLUMN totp_pendente_em timestamptz,
  ADD CONSTRAINT usuarios_admin_totp_pendente_formato
    CHECK (totp_pendente IS NULL OR totp_pendente ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$');

-- Teto de pedidos "Quero conhecer" por contato, que não depende do IP.
CREATE INDEX interesses_adocao_contato_idx ON interesses_adocao (contato, criado_em DESC);
