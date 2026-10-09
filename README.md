# Gatchá API

API REST do Gatchá Cat Café: cardápio, galeria de adoção e painel da equipe.
Node.js 22 + Express 5 + PostgreSQL, hospedada no Google Cloud Run.

> **Status:** site público (cardápio, gatil, adoção, visite), interesses de adoção e painel da equipe com login e envio de fotos prontos.
> **Sem reserva online:** por decisão do Gatchá, a reserva da área dos gatos continua no balcão (como há mais de 4 anos, para evitar atrasos). O site só informa preços, horários e regras. O código antigo de reservas está no histórico do Git.
> Pendente: deploy e conteúdo real (fotos, cores, textos legais).

## Site (front-end)

React 19 + Vite em `web/`, publicado no Firebase Hosting. Visual neo-brutalista suave (bordas grossas, sombras duras), tema claro/escuro, mobile-first a partir de 360px.

> **Não abra `web/index.html` direto no navegador** (`file://`) nem digite `vite` no terminal: use os scripts abaixo.

### Desenvolvimento

O site precisa da API (cardápio e gatos vêm dela). Suba o banco e a API, depois o site:

```bash
npm run db:up && npm run migrate:dev   # Postgres local (Docker) e tabelas
npm run dev                            # API em http://localhost:8080
npm run web:dev                        # site em http://localhost:5173 (repassa /api para a 8080)
```

Se a API não responder, o site usa os JSON de `web/public/dados-exemplo/` (mesmo formato da API) como cardápio e gatos de exemplo.

### Onde mexer

| O quê | Onde |
|---|---|
| Cores (claro/escuro), textos, preços, horários, regras, FAQ, contatos | `web/src/config.js` (procure `[SUBSTITUIR]` e `[CONFIRMAR]`) |
| Cardápio e gatos de exemplo (reserva de quando a API não responde; `npm run dev:popular` copia para o banco local) | `web/public/dados-exemplo/*.json` |
| Estilos | `web/src/estilo.css` (usa só as variáveis de cor do config) |
| Seção do gatil (preços, horários, regras, aviso de reserva no balcão) | `web/src/components/Gatil.jsx` + `gatil` em `config.js` |
| Transição entre páginas | `web/src/navegacao.js` + bloco "Transição entre páginas" em `estilo.css` |

- **Segurança:** o React escapa todo texto dinâmico; CSP estrita sem `unsafe-inline` em `firebase.json`; fontes servidas pelo próprio site; mapa do Google só carrega quando a pessoa pede (LGPD).
- **Acessibilidade:** contraste AA conferido nos dois temas, foco visível, navegação por teclado, `prefers-reduced-motion` respeitado.
- **Deploy:** `npm run build && firebase deploy --only hosting`.

## Painel administrativo (`/admin`)

Abra `http://localhost:5173/admin` (ou clique em **Área da equipe** no rodapé do site) e entre com um usuário criado por `npm run admin:criar -- email@...`.
Em desenvolvimento, `npm run dev` gera o `JWT_SECRET` no seu `.env` se estiver vazio e aplica as migrações pendentes; em produção o segredo vem do Secret Manager.

| Aba | O que faz |
|---|---|
| Gatos | Cadastra, edita e apaga gatos; "adotado" sai do site e continua no painel |
| Cardápio | Cadastra, edita, tira do site ou apaga itens (preço, selos, foto) |
| Interessados | Quem clicou em "Quero conhecer"; marca como repassado à ONG |

- Segurança: token de 15 min **só na memória da aba** (recarregar = entrar de novo), todas as rotas `/api/admin/*` exigem login e ficam no log de acessos, página com `noindex`.
- **Fotos (Gatos e Cardápio):** botão "Enviar foto" direto do celular ou computador (JPG, PNG ou WebP). O navegador reduz fotos grandes antes de enviar, e a API **reprocessa toda imagem**: WebP de no máximo 1600 px, orientação corrigida, **sem metadados** (o GPS da foto do celular não vai pro site) e recusa de arquivos disfarçados. As fotos ficam no Postgres (tabela `imagens`) e são servidas em `/api/imagens/<id>.webp` com cache longo. Fotos trocadas ou sem uso são apagadas pelo `npm run lgpd:expurgar` depois de 1 dia. Ainda dá pra colar um link `https://...`.
- Dados de exemplo no banco local: `npm run dev:popular` (cardápio e gatos de `web/public/dados-exemplo`; só preenche tabelas vazias).

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
├── lib/                      # erros, logger JSON, datas, validações comuns
├── middlewares/              # contexto/log, validação, rate limit, error handler
└── modules/
    ├── catalogo/             # público: GET /cardapio, GET /gatos, POST /interesses
    ├── imagens/              # fotos do painel (reprocessadas) e GET /imagens/<id>.webp
    ├── painel/               # /api/admin/*: gatos, cardápio, interessados
    ├── auth/                 # login do painel (bcrypt + JWT), log de acessos
    └── lgpd/                 # expurgo dos dados vencidos
```

## API

### Rotas

| Rota | O que faz |
|---|---|
| `GET /api/cardapio` | Itens ativos do cardápio |
| `GET /api/gatos` | Gatos para adoção (adotados saem) |
| `POST /api/interesses` | "Quero conhecer" um gato (`gato_id`, `nome`, `contato`, `mensagem?`) |
| `GET /api/imagens/<id>.webp` | Fotos enviadas pelo painel |
| `POST /api/auth/login` | Login do painel |
| `/api/admin/*` | Painel (exige login): gatos, cardápio, interessados, envio de fotos |

**Horários do Gatchá** (perfil oficial): café de segunda a sábado, 10h às 18h30; **área dos gatos** 10h30 às 11h50 e 13h10 às 17h30. Ficam em `web/src/config.js` (rodapé, "Visite", gatil, FAQ, selo "Aberto agora").

### Erros (formato único)

```json
{ "erro": { "codigo": "GATO_INDISPONIVEL", "mensagem": "...", "request_id": "..." } }
```

| HTTP | `codigo` | Quando |
|---|---|---|
| 400 | `DADOS_INVALIDOS` | Falha de schema (detalhes por campo em `detalhes.campos`) |
| 400 | `JSON_INVALIDO` | Corpo não é JSON válido |
| 401 | `NAO_AUTENTICADO` | Rota do painel sem login válido |
| 409 | `GATO_INDISPONIVEL` | Interesse num gato já adotado |
| 409 | `ITEM_DUPLICADO` / `GATO_COM_INTERESSADOS` | Conflitos do painel |
| 413 | `CORPO_MUITO_GRANDE` | Corpo > 10 KB |
| 415 | `TIPO_DE_CONTEUDO_NAO_SUPORTADO` | Sem `Content-Type: application/json` |
| 429 | `MUITAS_REQUISICOES` | Rate limit (header `Retry-After`) |
| 503 | `SERVICO_OCUPADO` / `BANCO_INDISPONIVEL` | Banco ocupado ou fora do ar (header `Retry-After`) |
| 500 | `ERRO_INTERNO` | Falha inesperada (detalhes só no log, via `request_id`) |

## Segurança e LGPD

| Item do escopo | Como está |
|---|---|
| Validação de todos os campos no backend | Zod com objetos `strict` em todas as rotas (campos extras são recusados) |
| Senha com bcrypt | `usuarios_admin.senha_hash` só aceita hash bcrypt (custo 12); política de senha: 12+ caracteres, sem senhas comuns |
| Sessão com token de validade curta | JWT HS256, 15 min (`ADMIN_TOKEN_MINUTOS`); issuer/audience/algoritmo conferidos; usuário apagado, senha trocada ou 2FA ativado/desativado = sessão encerrada |
| 2FA (app autenticador) | Opcional por pessoa (`npm run admin:2fa`). Código de 6 dígitos (TOTP), sem reuso; segredo criptografado no banco; código errado conta no bloqueio e tem limite diário próprio (10) |
| Limite de requisições | Login, "Quero conhecer" e envio de fotos contam **no banco** (valem para todas as instâncias; o IP é guardado só como HMAC). Teto geral das rotas públicas em memória. Além disso, bloqueio por e-mail: 5 falhas/15 min por e-mail+IP e 30 no total (quem erra de propósito de outro IP não tranca a equipe) |
| Fotos | Reprocessadas (WebP novo, sem EXIF/GPS), até 8 MB por envio, 60 envios/15 min por pessoa e teto total de espaço (`IMAGENS_MAX_MB`, padrão 300) |
| Banco com menor privilégio | Em produção a API usa um usuário que só lê e escreve dados (`db/producao/papeis.sql`); só as migrações usam o dono das tabelas. A API avisa no boot se estiver com poder demais e recusa a senha de exemplo |
| Dependências e segredos | CI roda `npm audit` (API e site) e varre o histórico do Git atrás de segredos (gitleaks). Dependabot abre PRs semanais agrupados |
| HTTPS | Firebase Hosting / Cloud Run + HSTS (helmet) |
| Log de acessos ao painel | Tabela `acessos_admin`: quem, quando, método, rota, status e IP. Nunca senha, token ou corpo |
| Só nome e contato coletados + aviso | Página `/privacidade` (controlador, bases legais, compartilhamento, prazos, direitos). O site não guarda reservas: elas são no balcão |
| Dados vencidos apagados | `npm run lgpd:expurgar` (interesses de adoção e acessos ao painel vencidos, fotos sem uso) |

### Atenção em produção: `TRUST_PROXY`

O limite de tentativas e o log de acessos usam o IP do visitante, lido do `X-Forwarded-For`. O valor **precisa bater com os intermediários reais**:
`TRUST_PROXY=1` com o Cloud Run direto, `TRUST_PROXY=2` com o Firebase Hosting na frente. Valor menor que o real faz todos os usuários parecerem um só IP (e o login bloqueia todo mundo); valor maior deixa o cliente forjar o próprio IP.

Para não errar sem perceber:
- Em produção a API **não sobe** sem `TRUST_PROXY` definido.
- Com tráfego real, ela confere o `X-Forwarded-For`: se o valor estiver **alto** (IP forjável), grava um **ERRO** no log; se parecer **baixo**, um aviso. Só as contagens, nunca IPs. Procure por `TRUST_PROXY` no Cloud Logging depois do primeiro deploy.

### Painel: primeiro acesso

```bash
npm run migrate:dev                       # cria a tabela acessos_admin (migração 002)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # gera o JWT_SECRET
# cole no .env: JWT_SECRET=...
winpty npm run admin:criar -- dona@gatcha.com.br     # Git Bash/Windows; no Linux/Mac: sem winpty
```

A senha é digitada sem aparecer na tela. Para trocar uma senha: `... admin:criar -- email --redefinir`.

**2FA (recomendado para cada pessoa da equipe):** com a pessoa do lado e o celular dela na mão,

```bash
npm run admin:2fa -- dona@gatcha.com.br               # mostra a chave para cadastrar no app e pede um código para confirmar
npm run admin:2fa -- dona@gatcha.com.br --desativar   # celular perdido ou trocado (depois, ative de novo)
```

Depois de ativado, o login pede o código de 6 dígitos do app (Google Authenticator, Microsoft Authenticator, Authy...).
O segredo fica criptografado com uma chave derivada do `JWT_SECRET`: **se trocar o `JWT_SECRET`, reative o 2FA de quem tinha** (o login avisa com erro claro em vez de deixar entrar).
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
- **Pedido de um titular** (confirme a identidade antes: o pedido deve vir do próprio e-mail/celular cadastrado):
  `npm run lgpd:exportar -- pessoa@email.com` (cópia dos dados) e `npm run lgpd:apagar -- pessoa@email.com` (eliminação).
- **Antes de publicar** preencha em `web/src/config.js` (`lgpd`): razão social, CNPJ e e-mail para pedidos dos titulares, e peça a revisão do texto a um advogado.

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

**Uma vez, no banco de produção:** crie os dois usuários com `db/producao/papeis.sql` (instruções no próprio arquivo) e guarde as duas URLs no Secret Manager:
`gatcha-database-url` (usuário `gatcha_app`, só lê e escreve) e `gatcha-database-url-migracao` (usuário `gatcha_migracao`, dono das tabelas).

```bash
gcloud run deploy gatcha-api --source . --region southamerica-east1 \
  --set-secrets DATABASE_URL=gatcha-database-url:latest,JWT_SECRET=gatcha-jwt-secret:latest \
  --set-env-vars NODE_ENV=production,DB_SSL=true,TRUST_PROXY=2 \
  --max-instances 4 --concurrency 40
```

- **Migrações**: rodar `node scripts/migrate.js` como Cloud Run Job antes de liberar a nova revisão, nunca no boot, com `DATABASE_URL_MIGRACAO=gatcha-database-url-migracao:latest` além da `DATABASE_URL`.
- **Validação no boot**: em produção a API recusa subir sem `TRUST_PROXY`, com `CORS_ORIGINS` inválido (ex.: `*`) ou com a senha de exemplo do banco; a mensagem diz o que corrigir.
- **LGPD**: agendar `node scripts/expurgar-dados.js` (Cloud Run Job + Cloud Scheduler, diário) para apagar os dados vencidos.
- **Conexões**: `max-instances × DB_POOL_MAX` deve caber no `max_connections` do Postgres gerenciado.

## Pendências de negócio

Dias e horários vieram do perfil do Gatchá (seg–sáb; área dos gatos 10h30–11h50 e 13h10–17h30); preços e regras também estão em `web/src/config.js`.
