# Gatchá API

API REST do Gatchá Cat Café: reservas do gatil, cardápio e galeria de adoção.
Node.js 22 + Express 5 + PostgreSQL, hospedada no Google Cloud Run.

> **Status:** módulo de **Reservas** pronto (`GET /api/horarios`, `POST /api/reservas`) e **site público** em `web/public`.
> Próximos módulos: cancelamento por código, e-mail de confirmação, cardápio, adoção, auth JWT e painel admin.

## Site (front-end)

HTML, CSS e JavaScript puro em `web/public/` — sem etapa de build, publicado no Firebase Hosting.
Identidade visual derivada do avatar: verde matchá `#6BA305`, traço branco do gato-tigela (`img/logo.svg`) e fundo tinta `#0D1117`.

- **Seções:** início, cardápio (filtro por categoria), gatil + reserva em 4 passos, adoção (formulário "Quero conhecer" em `<dialog>`) e visite; mais `/privacidade` (LGPD).
- **Reserva:** grade de vagas por duração e tamanho do grupo; em 409 recarrega a grade automaticamente; trava duplo envio.
- **Segurança:** todo conteúdo dinâmico entra via `textContent` (nunca `innerHTML`); CSP estrita sem `unsafe-inline` e demais cabeçalhos em `firebase.json`; `/api/**` reescrito para o Cloud Run (mesma origem, sem CORS; use `TRUST_PROXY=2`).
- **Prévia:** enquanto `/api/cardapio` e `/api/gatos` não existem, o site mostra itens ilustrativos com aviso visível (`js/dados-exemplo.js`).
- **Dev local:** `SERVIR_FRONTEND=true npm run dev` serve o site e a API juntos em `http://localhost:8080`.
- **Deploy:** `firebase deploy --only hosting`.

## Arquitetura

```
src/
├── server.js                 # entrada no Cloud Run: listen + graceful shutdown
├── app.js                    # cadeia de middlewares (testável sem listen)
├── config/env.js             # env validado com Zod (fail-fast)
├── db/
│   ├── pool.js               # pg.Pool único por instância
│   ├── transacao.js          # Unit of Work: BEGIN/COMMIT/ROLLBACK
│   └── migrar.js             # migrações SQL versionadas
├── lib/                      # erros, logger JSON, datas, gerador de código
├── middlewares/              # contexto/log, validação, rate limit, error handler
└── modules/reservas/
    ├── reservas.routes.js      # rota -> [rate limit] -> [validação] -> controller
    ├── reservas.controller.js  # adaptador HTTP fino
    ├── reservas.service.js     # regras de negócio + escopo transacional
    ├── reservas.repository.js  # único lugar com SQL (parametrizado)
    ├── reservas.schemas.js     # contratos de entrada (Zod, strict)
    └── disponibilidade.js      # domínio puro: cálculo de vagas
```

### Como a "Regra de Ouro" é garantida

Duas pessoas nunca ocupam a mesma última vaga. Dentro de uma transação:

1. `pg_advisory_xact_lock(<data>)` — requisições para o **mesmo dia** fazem fila; dias diferentes seguem em paralelo.
2. Lê a ocupação do dia (em `READ COMMITTED`, cada instrução enxerga o que foi commitado antes dela — inclusive a reserva de quem estava na frente da fila).
3. Calcula as vagas com a mesma função pura usada pelo `GET /horarios`.
4. `INSERT` + `COMMIT` (libera o lock).

O teste `REGRA DE OURO` dispara 20 requisições simultâneas contra um Postgres real. Sem o lock, ele detecta overbooking (6 reservas de 2 pessoas numa capacidade de 6); com o lock, entram exatamente 3.

## API

### `GET /api/horarios?data=AAAA-MM-DD`

```json
200 {
  "data": "2026-10-06", "aberto": true, "capacidade": 8,
  "horarios": [
    { "hora_inicio": "11:00", "vagas_15min": 8, "vagas_30min": 6 },
    { "hora_inicio": "18:45", "vagas_15min": 8, "vagas_30min": 0 }
  ]
}
```
Dia fechado: `aberto: false` e `horarios: []`. Horários que já começaram (hoje) são omitidos.

### `POST /api/reservas`

```json
{ "data": "2026-10-06", "hora_inicio": "14:30", "duracao_min": 30, "pessoas": 2,
  "nome": "Ana Júlia", "telefone": "(11) 91234-5678", "email": "ana@exemplo.com" }
```
```json
201 { "reserva": { "codigo": "GATCHA-7K3QXP", "data": "2026-10-06", "hora_inicio": "14:30",
                   "duracao_min": 30, "pessoas": 2, "nome": "Ana Júlia", "status": "confirmada",
                   "criado_em": "..." } }
```

### Erros (formato único)

```json
{ "erro": { "codigo": "VAGAS_INSUFICIENTES", "mensagem": "...", "detalhes": { "vagas_disponiveis": 1 }, "request_id": "..." } }
```

| HTTP | `codigo` | Quando |
|---|---|---|
| 400 | `DADOS_INVALIDOS` | Falha de schema (detalhes por campo em `detalhes.campos`) |
| 400 | `JSON_INVALIDO` | Corpo não é JSON válido |
| 400 | `DATA_FORA_DO_PERIODO` | Data no passado ou além de 14 dias |
| 400 | `DIA_FECHADO` / `HORARIO_FORA_DO_FUNCIONAMENTO` / `HORARIO_NO_PASSADO` | Regras da agenda |
| 409 | `VAGAS_INSUFICIENTES` | Não cabe mais gente no horário |
| 409 | `HORARIO_BLOQUEADO` | Equipe bloqueou o horário |
| 409 | `LIMITE_DE_RESERVAS_ATIVAS` | Contato já tem N reservas futuras |
| 413 | `CORPO_MUITO_GRANDE` | Corpo > 10 KB |
| 415 | `TIPO_DE_CONTEUDO_NAO_SUPORTADO` | Sem `Content-Type: application/json` |
| 429 | `MUITAS_REQUISICOES` | Rate limit (header `Retry-After`) |
| 503 | `SERVICO_OCUPADO` | Lock/statement timeout, deadlock (header `Retry-After`) |
| 500 | `ERRO_INTERNO` | Falha inesperada (detalhes só no log, via `request_id`) |

## Rodando localmente

```bash
cp .env.example .env          # ajuste DATABASE_URL
npm ci
npm run migrate:dev
npm run dev
```

Testes (unitários sempre; integração quando `TEST_DATABASE_URL` estiver definida):

```bash
TEST_DATABASE_URL=postgres://gatcha:senha@localhost:5432/gatcha_test npm test
```

## Deploy (Cloud Run)

```bash
gcloud run deploy gatcha-api --source . --region southamerica-east1 \
  --set-secrets DATABASE_URL=gatcha-database-url:latest \
  --set-env-vars NODE_ENV=production,DB_SSL=true \
  --max-instances 4 --concurrency 40
```

- **Migrações**: rodar `node scripts/migrate.js` como Cloud Run Job antes de liberar a nova revisão — nunca no boot.
- **LGPD**: agendar `node scripts/expurgar-dados.js` (Cloud Run Job + Cloud Scheduler, diário) para apagar reservas com mais de 90 dias.
- **Conexões**: `max-instances × DB_POOL_MAX` deve caber no `max_connections` do Postgres gerenciado.

## Pendências de negócio (valores provisórios em `.env.example`)

Capacidade do gatil, dias de funcionamento, janelas/último horário e limite de pessoas por reserva aguardam confirmação do Gatchá — todos são configuráveis por variável de ambiente, sem mudar código.
