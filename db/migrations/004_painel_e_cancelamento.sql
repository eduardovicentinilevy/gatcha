-- Painel administrativo e cancelamento pelo link do e-mail.

-- Cancelamento: o link do e-mail leva um token aleatório; só o HASH (SHA-256) fica no banco,
-- então um vazamento do banco não permite cancelar reservas de ninguém.
ALTER TABLE reservas
  ADD COLUMN token_cancelamento_hash char(64),
  ADD COLUMN cancelada_em            timestamptz,
  ADD CONSTRAINT reservas_token_hash_formato CHECK (token_cancelamento_hash IS NULL OR token_cancelamento_hash ~ '^[0-9a-f]{64}$');

-- Cardápio: selos (mais pedido, vegano, novo) e foto, como o site já exibe.
ALTER TABLE itens_cardapio
  ADD COLUMN selos    text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN foto_url varchar(500),
  ADD CONSTRAINT itens_cardapio_selos_validos CHECK (selos <@ ARRAY['mais_pedido', 'vegano', 'novo']::text[]),
  ADD CONSTRAINT itens_cardapio_foto_valida   CHECK (foto_url IS NULL OR foto_url ~ '^(https://|/[^/])');

-- Fotos podem ser link https ou arquivo do próprio site (ex.: /img/gatos/matcha.jpg).
ALTER TABLE gatos DROP CONSTRAINT gatos_foto_https;
ALTER TABLE gatos ADD CONSTRAINT gatos_foto_valida CHECK (foto_url IS NULL OR foto_url ~ '^(https://|/[^/])');

-- Interessados em adoção: a equipe marca o que já foi repassado à ONG.
ALTER TABLE interesses_adocao
  ADD COLUMN status varchar(12) NOT NULL DEFAULT 'novo',
  ADD CONSTRAINT interesses_adocao_status_valido CHECK (status IN ('novo', 'repassado'));
