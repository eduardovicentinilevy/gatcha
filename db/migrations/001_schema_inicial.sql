-- =============================================================================
-- Gatchá — schema inicial (v1)
-- Regras de integridade ficam TAMBÉM no banco (CHECK/FK/UNIQUE/NOT NULL):
-- a API valida antes, mas o banco é a última linha de defesa contra dados
-- inválidos vindos de bug, script manual ou acesso indevido.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- reservas
-- -----------------------------------------------------------------------------
CREATE TABLE reservas (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo       varchar(20)  NOT NULL,
  data         date         NOT NULL,
  hora_inicio  time(0)      NOT NULL,
  duracao_min  smallint     NOT NULL,
  pessoas      smallint     NOT NULL,
  nome         varchar(100) NOT NULL,
  telefone     varchar(11)  NOT NULL,
  email        varchar(254) NOT NULL,
  status       varchar(12)  NOT NULL DEFAULT 'confirmada',
  criado_em    timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT reservas_codigo_key       UNIQUE (codigo),
  CONSTRAINT reservas_codigo_formato   CHECK (codigo ~ '^GATCHA-[0-9A-Z]{4,12}$'),
  CONSTRAINT reservas_duracao_valida   CHECK (duracao_min IN (15, 30)),
  CONSTRAINT reservas_pessoas_valida   CHECK (pessoas BETWEEN 1 AND 50),
  CONSTRAINT reservas_grade_15min      CHECK (EXTRACT(MINUTE FROM hora_inicio)::int % 15 = 0
                                              AND EXTRACT(SECOND FROM hora_inicio) = 0),
  CONSTRAINT reservas_nome_valido      CHECK (char_length(btrim(nome)) >= 2),
  CONSTRAINT reservas_telefone_digitos CHECK (telefone ~ '^[0-9]{10,11}$'),
  CONSTRAINT reservas_email_minusculo  CHECK (email = lower(email) AND position('@' IN email) > 1),
  CONSTRAINT reservas_status_valido    CHECK (status IN ('confirmada', 'cancelada', 'compareceu'))
);

-- Consulta quente: ocupação do dia (GET /horarios e dentro da transação do POST).
-- Parcial (ignora canceladas) e com INCLUDE: index-only scan na maioria dos casos.
CREATE INDEX reservas_agenda_idx
  ON reservas (data, hora_inicio) INCLUDE (duracao_min, pessoas)
  WHERE status <> 'cancelada';

-- Limite de reservas ativas por contato (anti-açambarcamento de vagas).
CREATE INDEX reservas_email_ativas_idx    ON reservas (email, data)    WHERE status = 'confirmada';
CREATE INDEX reservas_telefone_ativas_idx ON reservas (telefone, data) WHERE status = 'confirmada';

-- Expurgo LGPD (reservas com mais de 90 dias) e listagem do painel por data.
CREATE INDEX reservas_data_idx ON reservas (data);

-- -----------------------------------------------------------------------------
-- bloqueios (equipe fecha horários: evento, limpeza, manutenção...)
-- Intervalo semiaberto [hora_inicio, hora_fim). hora_fim aceita 24:00 (fim do dia).
-- -----------------------------------------------------------------------------
CREATE TABLE bloqueios (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data         date         NOT NULL,
  hora_inicio  time(0)      NOT NULL,
  hora_fim     time(0)      NOT NULL,
  motivo       varchar(200),

  CONSTRAINT bloqueios_intervalo_valido CHECK (hora_fim > hora_inicio)
);

CREATE INDEX bloqueios_data_idx ON bloqueios (data);

-- -----------------------------------------------------------------------------
-- gatos (galeria de adoção)
-- -----------------------------------------------------------------------------
CREATE TABLE gatos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome           varchar(60)  NOT NULL,
  idade_meses    smallint,
  sexo           varchar(5)   NOT NULL,
  personalidade  varchar(500),
  foto_url       varchar(500),
  status         varchar(12)  NOT NULL DEFAULT 'disponivel',

  CONSTRAINT gatos_idade_valida  CHECK (idade_meses IS NULL OR idade_meses BETWEEN 0 AND 360),
  CONSTRAINT gatos_sexo_valido   CHECK (sexo IN ('macho', 'femea')),
  CONSTRAINT gatos_foto_https    CHECK (foto_url IS NULL OR foto_url ~ '^https://'),
  CONSTRAINT gatos_status_valido CHECK (status IN ('disponivel', 'em_processo', 'adotado'))
);

CREATE INDEX gatos_status_idx ON gatos (status);

-- -----------------------------------------------------------------------------
-- interesses_adocao (formulário "Quero conhecer", repassado à ONG)
-- RESTRICT: não se apaga um gato com interessados pendentes; marca-se como adotado.
-- -----------------------------------------------------------------------------
CREATE TABLE interesses_adocao (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gato_id    bigint        NOT NULL REFERENCES gatos (id) ON DELETE RESTRICT,
  nome       varchar(100)  NOT NULL,
  contato    varchar(254)  NOT NULL,
  mensagem   varchar(1000),
  criado_em  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX interesses_adocao_gato_idx      ON interesses_adocao (gato_id);
CREATE INDEX interesses_adocao_criado_em_idx ON interesses_adocao (criado_em);

-- -----------------------------------------------------------------------------
-- itens_cardapio (preço em centavos: nunca float para dinheiro)
-- -----------------------------------------------------------------------------
CREATE TABLE itens_cardapio (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  categoria       varchar(40)  NOT NULL,
  nome            varchar(100) NOT NULL,
  descricao       varchar(500),
  preco_centavos  integer      NOT NULL,
  ativo           boolean      NOT NULL DEFAULT true,

  CONSTRAINT itens_cardapio_preco_valido   CHECK (preco_centavos BETWEEN 0 AND 10000000),
  CONSTRAINT itens_cardapio_nome_categoria UNIQUE (categoria, nome)
);

CREATE INDEX itens_cardapio_ativos_idx ON itens_cardapio (categoria, nome) WHERE ativo;

-- -----------------------------------------------------------------------------
-- usuarios_admin (painel da equipe). Só o hash bcrypt é armazenado.
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios_admin (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       varchar(254) NOT NULL,
  senha_hash  varchar(100) NOT NULL,
  criado_em   timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT usuarios_admin_email_key      UNIQUE (email),
  CONSTRAINT usuarios_admin_email_minusculo CHECK (email = lower(email)),
  CONSTRAINT usuarios_admin_hash_bcrypt    CHECK (senha_hash ~ '^\$2[aby]\$[0-9]{2}\$.{53}$')
);
