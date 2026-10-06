-- Fotos enviadas pelo painel (gatos e cardápio). Ficam no próprio Postgres: sem serviço
-- extra para configurar e sem perder arquivos quando o Cloud Run troca de instância.
-- Toda imagem é reprocessada pela API (WebP, no máximo 1600 px, sem metadados) antes de entrar aqui.
CREATE TABLE imagens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dados      bytea       NOT NULL,
  largura    smallint    NOT NULL,
  altura     smallint    NOT NULL,
  bytes      integer     NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT imagens_tamanho_valido CHECK (bytes BETWEEN 1 AND 3000000 AND octet_length(dados) = bytes),
  CONSTRAINT imagens_dimensoes      CHECK (largura BETWEEN 1 AND 4000 AND altura BETWEEN 1 AND 4000)
);
