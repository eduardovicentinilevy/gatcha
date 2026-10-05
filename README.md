# Gatchá API

API REST do Gatchá Cat Café: reservas do gatil, cardápio e galeria de adoção.
Node.js 22 + Express 5 + PostgreSQL, hospedada no Google Cloud Run.

> **Status:** módulo de **Reservas** pronto (`GET /api/horarios`, `POST /api/reservas`) e **site público** em `web/public`.
> Próximos módulos: cancelamento por código, e-mail de confirmação, cardápio, adoção, auth JWT e painel admin.

## Site (front-end)

React 19 + Vite em `web/`, publicado no Firebase Hosting. Visual neo-brutalista suave (bordas grossas, sombras duras), tema claro/escuro, mobile-first a partir de 360px.

> **Não abra `web/index.html` direto no navegador** (`file://`) nem digite `vite` no terminal: use os scripts abaixo.

### Protótipo para validação com o cliente (sem backend)

```bash
npm run prototipo      # http://localhost:5173 — dados de /web/public/dados-exemplo, nenhuma reserva é real
```

- Os JSON de `web/public/dados-exemplo/` têm **o mesmo formato da API** (`/api/cardapio`, `/api/gatos`, `/api/horarios?data=`). Para usar a API real basta sair do modo protótipo (`npm run web:dev`): os componentes não mudam.
- O simulador (`web/src/prototipo.js`) aplica as regras da API: dias fechados, horários passados e vagas por célula de 15 min, descontando as reservas feitas na sessão.
- Para mandar um link ao cliente: `npm --prefix web run build:prototipo` e publique `web/dist` (ex.: `firebase hosting:channel:deploy prototipo`).

### Desenvolvimento com a API

```bash
npm run dev            # API em http://localhost:8080
npm run web:dev        # site em http://localhost:5173 (repassa /api para a 8080)
```

### Onde mexer

| O quê | Onde |
|---|---|
| Cores (claro/escuro), textos, preços, horários, regras, FAQ, avaliações, contatos | `web/src/config.js` (procure `[SUBSTITUIR]` e `[CONFIRMAR]`) |
| Dados de exemplo | `web/public/dados-exemplo/*.json` |
| Estilos | `web/src/estilo.css` (usa só as variáveis de cor do config) |
| Fluxo de reserva | `web/src/components/Reserva.jsx` |
| Transição entre páginas | `web/src/navegacao.js` + bloco "Transição entre páginas" em `estilo.css` |

- **Segurança:** o React escapa todo texto dinâmico; CSP estrita sem `unsafe-inline` em `firebase.json`; fontes servidas pelo próprio site; mapa do Google só carrega quando a pessoa pede (LGPD).
- **Acessibilidade:** contraste AA conferido nos dois temas, foco visível, navegação por teclado, foco movido a cada etapa da reserva, `prefers-reduced-motion` respeitado.
- **Deploy:** `npm run build && firebase deploy --only hosting`.

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

Pré-requisitos: **Node.js 22+** e um **PostgreSQL** (o jeito mais fácil é o Docker Desktop).

```bash
npm install          # instala API + site
npm run db:up        # sobe o Postgres do docker-compose.yml (pula se já tiver um Postgres)
npm run migrate:dev  # cria as tabelas (cria o .env na primeira vez)
npm run dev          # API em http://localhost:8080
npm run web:dev      # em outro terminal: site em http://localhost:5173
```

- O `.env` é criado automaticamente a partir do `.env.example` e **nunca vai para o Git**. Se o seu Postgres não for o do Docker, ajuste a `DATABASE_URL` nele.
- Se o banco estiver desligado ou sem tabelas, a API avisa no terminal logo ao subir, com o comando que resolve.

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
