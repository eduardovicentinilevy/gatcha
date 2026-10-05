-- Trocar/redefinir a senha invalida os tokens já emitidos: o middleware recusa
-- tokens emitidos ANTES de senha_alterada_em.
ALTER TABLE usuarios_admin ADD COLUMN senha_alterada_em timestamptz NOT NULL DEFAULT now();
