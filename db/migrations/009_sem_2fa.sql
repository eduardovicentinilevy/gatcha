-- A verificação em duas etapas saiu do painel por enquanto (decisão do Gatchá).
-- Apaga os segredos guardados e volta o log de acessos aos eventos de antes.
-- O histórico do código fica no Git, caso o 2FA volte.
UPDATE acessos_admin SET evento = 'login_falha' WHERE evento = 'falha_2fa';
ALTER TABLE acessos_admin DROP CONSTRAINT acessos_admin_evento_valido;
ALTER TABLE acessos_admin ADD CONSTRAINT acessos_admin_evento_valido
  CHECK (evento IN ('login_ok', 'login_falha', 'acesso'));

ALTER TABLE usuarios_admin
  DROP COLUMN IF EXISTS totp_segredo,
  DROP COLUMN IF EXISTS totp_ultimo_passo,
  DROP COLUMN IF EXISTS totp_pendente,
  DROP COLUMN IF EXISTS totp_pendente_em;
