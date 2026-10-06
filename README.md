# Gatchá API

API REST do Gatchá Cat Café: reservas do gatil, cardápio e galeria de adoção.
Node.js 22 + Express 5 + PostgreSQL, hospedada no Google Cloud Run.

> **Status:** reservas (com e-mail e cancelamento pelo link), cardápio, gatos, interesses de adoção, painel administrativo com login e site público prontos.
> Pendente: deploy, conteúdo real (fotos, cores, textos legais) e integração com o sistema do Gatchá.

## Site (front-end)

React 19 + Vite em `web/`, publicado no Firebase Hosting. Visual neo-brutalista suave (bordas grossas, sombras duras), tema claro/escuro, mobile-first a partir de 360px.

> **Não abra `web/index.html` direto no navegador** (`file://`) nem digite `vite` no terminal: use os scripts abaixo.

### Desenvolvimento

O site precisa da API (horários, reservas e avaliações vêm dela). Suba o banco e a API, depois o site:

```bash
npm run db:up && npm run migrate:dev   # Postgres local (Docker) e tabelas
npm run dev                            # API em http://localhost:8080
npm run web:dev                        # site em http://localhost:5173 (repassa /api para a 8080)
```

Enquanto `/api/cardapio` e `/api/gatos` não existem, o site usa os JSON de `web/public/dados-exemplo/` (mesmo formato da API) como cardápio e gatos de exemplo.

### Onde mexer

| O quê | Onde |
|---|---|
| Cores (claro/escuro), textos, preços, horários, regras, FAQ, avaliações, contatos | `web/src/config.js` (procure `[SUBSTITUIR]` e `[CONFIRMAR]`) |
| Cardápio e gatos de exemplo (até a API ter essas rotas) | `web/public/dados-exemplo/*.json` |
| Estilos | `web/src/estilo.css` (usa só as variáveis de cor do config) |
| Fluxo de reserva | `web/src/components/Reserva.jsx` |
| Transição entre páginas | `web/src/navegacao.js` + bloco "Transição entre páginas" em `estilo.css` |

- **Segurança:** o React escapa todo texto dinâmico; CSP estrita sem `unsafe-inline` em `firebase.json`; fontes servidas pelo próprio site; mapa do Google só carrega quando a pessoa pede (LGPD).
- **Acessibilidade:** contraste AA conferido nos dois temas, foco visível, navegação por teclado, foco movido a cada etapa da reserva, `prefers-reduced-motion` respeitado.
- **Deploy:** `npm run build && firebase deploy --only hosting`.

## Painel administrativo (`/admin`)

Abra `http://localhost:5173/admin` (ou clique em **Área da equipe** no rodapé do site) e entre com um usuário criado por `npm run admin:criar -- email@...`.
Em desenvolvimento, `npm run dev` gera o `JWT_SECRET` no seu `.env` se estiver vazio e aplica as migrações pendentes; em produção o segredo vem do Secret Manager.

| Aba | O que faz |
|---|---|
| Reservas | Lista por período e status, com contato; marca "Chegou" (compareceu) ou cancela (a vaga volta pra agenda) |
| Bloqueios | Fecha horários do gatil (evento, limpeza); avisa se já havia reservas no intervalo |
| Gatos | Cadastra, edita e apaga gatos; "adotado" sai do site e continua no painel |
| Cardápio | Cadastra, edita, tira do site ou apaga itens (preço, selos, foto) |
| Interessados | Quem clicou em "Quero conhecer"; marca como repassado à ONG |

- Segurança: token de 15 min **só na memória da aba** (recarregar = entrar de novo), todas as rotas `/api/admin/*` exigem login e ficam no log de acessos, página com `noindex`.
- Fotos: link `https://...` ou arquivo do próprio site, ex.: `/img/gatos/matcha.jpg` (coloque o arquivo em `web/public/img/gatos/`).
- Dados de exemplo no banco local: `npm run dev:popular` (cardápio e gatos de `web/public/dados-exemplo`; só preenche tabelas vazias).

## Cancelamento pelo e-mail

Toda reserva envia um e-mail com o link `SITE_URL/cancelar#CODIGO.TOKEN`. O token tem 192 bits e só o hash SHA-256 fica no banco. O `#` nunca chega ao servidor nem aos logs, e a página tira o token da barra de endereço. O cancelamento vale até `CANCELAMENTO_ATE_HORAS_ANTES` (1 h) antes do horário.

- **Desenvolvimento:** `EMAIL_TRANSPORTE=log` mostra o e-mail (com o link) no terminal da API.
- **Produção:** `EMAIL_TRANSPORTE=smtp` e `EMAIL_SMTP_URL` no Secret Manager (qualquer SMTP: Brevo, SES, Google Workspace...). Com `log` em produção, a API não sobe, porque o link é uma credencial. Ajuste `SITE_URL` e `EMAIL_REMETENTE` (de preferência com SPF/DKIM no domínio).

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
    { "hora_inicio": "10:30", "vagas_15min": 8, "vagas_30min": 6 },
    { "hora_inicio": "17:15", "vagas_15min": 8, "vagas_30min": 0 }
  ]
}
```
Dia fechado: `aberto: false` e `horarios: []`. Horários que já começaram (hoje) são omitidos.

**Horários do Gatchá** (perfil oficial): café de segunda a sábado, 10h às 18h30; **área dos gatos** 10h30 às 11h50 e 13h10 às 17h30.
Na API: `GATIL_DIAS=1,2,3,4,5,6` e `GATIL_JANELAS=10:30-11:50,13:10-17:30`. A agenda trabalha em células de 15 min e
arredonda as janelas **para dentro** (10:30-11:45 e 13:15-17:30): nunca se vende um minuto fora do horário real, e nenhuma sessão atravessa a pausa
dos gatos. No site, os mesmos horários ficam em `web/src/config.js` (rodapé, "Visite", gatil, FAQ, selo "Aberto agora"): se mudar um, mude o outro.

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

## Segurança e LGPD

| Item do escopo | Como está |
|---|---|
| Validação de todos os campos no backend | Zod com objetos `strict` em todas as rotas (campos extras são recusados) |
| Senha com bcrypt | `usuarios_admin.senha_hash` só aceita hash bcrypt (custo 12); política de senha: 12+ caracteres, sem senhas comuns |
| Sessão com token de validade curta | JWT HS256, 15 min (`ADMIN_TOKEN_MINUTOS`); issuer/audience/algoritmo conferidos; usuário apagado ou senha trocada = sessão encerrada |
| Limite de requisições nas rotas públicas | Por IP (reservas, geral e login) + bloqueio no banco, válido em todas as instâncias: 5 falhas/15 min por e-mail+IP e 30 no total por e-mail (quem erra de propósito de outro IP não tranca a equipe) |
| HTTPS | Firebase Hosting / Cloud Run + HSTS (helmet) |
| Log de acessos ao painel | Tabela `acessos_admin`: quem, quando, método, rota, status e IP. Nunca senha, token ou corpo |
| Só nome e contato coletados + aviso | Página `/privacidade` (controlador, bases legais, compartilhamento, prazos, direitos) |
| Reservas > 90 dias apagadas | `npm run lgpd:expurgar` (também apaga interesses de adoção e acessos vencidos) |

### Atenção em produção: `TRUST_PROXY`

O limite de tentativas e o log de acessos usam o IP do visitante, lido do `X-Forwarded-For`. O valor **precisa bater com os intermediários reais**:
`TRUST_PROXY=1` com o Cloud Run direto, `TRUST_PROXY=2` com o Firebase Hosting na frente. Valor menor que o real faz todos os usuários parecerem um só IP (e o login bloqueia todo mundo); valor maior deixa o cliente forjar o próprio IP. Confira no primeiro deploy olhando o IP gravado em `acessos_admin`.

### Painel: primeiro acesso

```bash
npm run migrate:dev                       # cria a tabela acessos_admin (migração 002)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # gera o JWT_SECRET
# cole no .env: JWT_SECRET=...
winpty npm run admin:criar -- dona@gatcha.com.br     # Git Bash/Windows; no Linux/Mac: sem winpty
```

A senha é digitada sem aparecer na tela. Para trocar uma senha: `... admin:criar -- email --redefinir`.
Login: `POST /api/auth/login` → `{ token, expira_em, usuario }`; depois `Authorization: Bearer <token>` nas rotas `/api/admin/*`.
Em produção, `JWT_SECRET` vem do Secret Manager; sem ele o login fica desativado (503).

### LGPD: rotina

- **Expurgo diário** (Cloud Run Job + Cloud Scheduler):
  ```bash
  gcloud run jobs create gatcha-expurgo --image IMAGEM --region southamerica-east1 \
    --command node --args scripts/expurgar-dados.js --set-secrets DATABASE_URL=gatcha-database-url:latest --set-env-vars DB_SSL=true
  gcloud scheduler jobs create http gatcha-expurgo-diario --schedule "30 3 * * *" --time-zone America/Sao_Paulo \
    --uri "https://run.googleapis.com/v2/projects/PROJETO/locations/southamerica-east1/jobs/gatcha-expurgo:run" --http-method POST \
    --oauth-service-account-email CONTA@PROJETO.iam.gserviceaccount.com
  ```
- **Testes locais bateram no limite de reservas por contato?** (`409 LIMITE_DE_RESERVAS_ATIVAS`: por padrão, 3 reservas ativas por e-mail/celular.)
  Apague as reservas de teste do banco local com `npm run dev:limpar-reservas` (recusa rodar em produção ou em banco que não seja da sua máquina).
- **Pedido de um titular** (confirme a identidade antes: o pedido deve vir do próprio e-mail/celular cadastrado):
  `npm run lgpd:exportar -- pessoa@email.com` (cópia dos dados) e `npm run lgpd:apagar -- pessoa@email.com` (eliminação).
- **Antes de publicar** preencha em `web/src/config.js` (`lgpd`): razão social, CNPJ e e-mail para pedidos dos titulares, e peça a revisão do texto a um advogado.

## Avaliações do Google Maps

`GET /api/avaliacoes` busca nota, total e até 5 avaliações na **Places API (New)** do Google. A chave fica só no servidor e o resultado fica em cache por `AVALIACOES_CACHE_HORAS` (padrão 6h). Sem chave (ou no protótipo), o site mostra as avaliações de exemplo de `web/src/config.js`.

1. No [Google Cloud Console](https://console.cloud.google.com/): crie/escolha um projeto, ative o faturamento e ative a **Places API (New)**.
2. Em *APIs e serviços → Credenciais*, crie uma **chave de API** e restrinja-a à *Places API (New)*.
3. No `.env`: `GOOGLE_PLACES_API_KEY=...`, depois rode `npm run places:id -- "Gatchá Galeria Metrópole São Paulo"` e copie o id para `GOOGLE_PLACE_ID`.
4. Em produção, guarde a chave no Secret Manager (`--set-secrets GOOGLE_PLACES_API_KEY=...`).

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

Dias e horários vieram do perfil do Gatchá (seg–sáb; área dos gatos 10h30–11h50 e 13h10–17h30) e ainda valem uma confirmação na ligação.
Capacidade do gatil e limite de pessoas por reserva seguem provisórios — todos são configuráveis por variável de ambiente, sem mudar código.
