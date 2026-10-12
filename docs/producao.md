# Gatchá: guia técnico e de publicação

Para quem vai publicar o site ou mexer por dentro do código. Para rodar no seu computador, o [README](../README.md) basta.

Node.js 22 + Express 5 + PostgreSQL (API, no Google Cloud Run) e React 19 + Vite (site, no Firebase Hosting).

> **Status:** site público (cardápio, gatil, adoção, visite), interesses de adoção e painel da equipe com login e envio de fotos prontos.
> **Sem reserva online:** por decisão do Gatchá, a reserva da área dos gatos continua no balcão (como há mais de 4 anos, para evitar atrasos). O site só informa preços, horários e regras. O código antigo de reservas está no histórico do Git.
> Pendente: deploy e conteúdo real (fotos, cores, textos legais).

## Site

- **Segurança:** o React escapa todo texto dinâmico; CSP estrita sem `unsafe-inline` em `firebase.json`; fontes servidas pelo próprio site; mapa do Google só carrega quando a pessoa pede (LGPD).
- **Acessibilidade:** contraste AA conferido nos dois temas, foco visível, navegação por teclado, `prefers-reduced-motion` respeitado.
- **Deploy:** `VITE_SITE_URL=https://<domínio do site> npm run build && firebase deploy --only hosting`. O `VITE_SITE_URL` coloca a imagem de prévia (`web/public/og.png`) e o endereço nas tags de compartilhamento: é o que aparece quando alguém manda o link no WhatsApp ou no Instagram. Sem ele, a prévia mostra só título e descrição.

## Painel

- Segurança: token de 15 min **só na memória da aba** (recarregar = entrar de novo), todas as rotas `/api/admin/*` exigem login e ficam no log de acessos, página com `noindex`.
- **Fotos (Gatos e Cardápio):** botão "Enviar foto" direto do celular ou computador (JPG, PNG ou WebP). O navegador reduz fotos grandes antes de enviar, e a API **reprocessa toda imagem**: WebP de no máximo 1600 px, orientação corrigida, **sem metadados** (o GPS da foto do celular não vai pro site) e recusa de arquivos disfarçados. As fotos ficam no Postgres (tabela `imagens`) e são servidas em `/api/imagens/<id>.webp` com cache longo. Fotos trocadas ou sem uso são apagadas pelo `npm run lgpd:expurgar` depois de 1 dia. Ainda dá pra colar um link `https://...`.

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
| Sessão com token de validade curta | JWT HS256, 15 min (`ADMIN_TOKEN_MINUTOS`); issuer/audience/algoritmo conferidos; usuário apagado ou senha trocada = sessão encerrada |
| 2FA (app autenticador) | Fora por enquanto (decisão do Gatchá). A versão anterior, com ativação pelo painel e QR code, está no histórico do Git (migração 009 apagou as colunas) |
| Limite de requisições | Login, "Quero conhecer" e envio de fotos contam **no banco** (valem para todas as instâncias; o IP é guardado só como HMAC com a `CHAVE_DADOS`). Login: só tentativas que falham contam. Teto geral das rotas públicas em memória. Bloqueio por e-mail: 5 falhas/15 min por e-mail+IP e 30 no total (quem erra de propósito de outro IP não tranca a equipe). "Quero conhecer" também tem tetos que **não dependem do IP**: 3 pedidos por contato em 24 h e 60 no total por hora |
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
- Em produção a API **não sobe** sem `TRUST_PROXY` definido (vazio ou `0` também não servem). Os jobs (migrações, expurgo) não precisam dele.
- Com o tráfego das primeiras requisições, cada instância confere o `X-Forwarded-For` e grava uma linha no log: **ERRO** se o valor parecer alto (IP forjável), aviso se parecer baixo, "confere" se estiver certo. Só contagens, nunca IPs. Procure por `TRUST_PROXY` no Cloud Logging depois do primeiro deploy.

**Acesso direto ao `*.run.app`:** com o Firebase na frente (`TRUST_PROXY=2`), o endereço do Cloud Run continua respondendo, e quem o chama direto consegue escolher o IP que a API vê. Por isso as proteções importantes **não dependem do IP**: o bloqueio de login por e-mail (global), os tetos do "Quero conhecer" por contato e por hora, o limite de fotos por pessoa. Os limites por IP são uma camada a mais. O log avisa quando aparece tráfego que pulou o Firebase.

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
- **Pedido de um titular** (confirme a identidade antes: o pedido deve vir do próprio e-mail/celular cadastrado):
  `npm run lgpd:exportar -- pessoa@email.com` (cópia dos dados) e `npm run lgpd:apagar -- pessoa@email.com` (eliminação).
- **Antes de publicar** preencha em `web/src/config.js` (`lgpd`): razão social, CNPJ e e-mail para pedidos dos titulares, e peça a revisão do texto a um advogado.

## Deploy (Cloud Run)

**Uma vez, antes do primeiro deploy:**
1. No banco de produção, crie os dois usuários com `db/producao/papeis.sql` (instruções no próprio arquivo).
2. No Secret Manager, guarde: `gatcha-database-url` (usuário `gatcha_app`, só lê e escreve), `gatcha-database-url-migracao` (usuário `gatcha_migracao`, dono das tabelas), `gatcha-jwt-secret` e `gatcha-chave-dados` (cada um gerado com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`, **diferentes** entre si).

```bash
gcloud run deploy gatcha-api --source . --region southamerica-east1 \
  --set-secrets DATABASE_URL=gatcha-database-url:latest,JWT_SECRET=gatcha-jwt-secret:latest,CHAVE_DADOS=gatcha-chave-dados:latest \
  --set-env-vars NODE_ENV=production,DB_SSL=true,TRUST_PROXY=2 \
  --max-instances 4 --concurrency 40
```

- **Migrações**: rodar `node scripts/migrate.js` como Cloud Run Job antes de liberar a nova revisão, nunca no boot, com `DATABASE_URL_MIGRACAO=gatcha-database-url-migracao:latest` além da `DATABASE_URL`. O job não precisa de `TRUST_PROXY` nem de `CHAVE_DADOS`.
- **Validação no boot**: em produção a API recusa subir sem `TRUST_PROXY` (ou com 0), sem `CHAVE_DADOS`, com `CORS_ORIGINS` inválido (ex.: `*`) ou com a senha de exemplo do banco; a mensagem diz o que corrigir.
- **LGPD**: agendar `node scripts/expurgar-dados.js` (Cloud Run Job + Cloud Scheduler, diário) para apagar os dados vencidos.
- **Conexões**: `max-instances × DB_POOL_MAX` deve caber no `max_connections` do Postgres gerenciado.

## Pendências de negócio

Dias e horários vieram do perfil do Gatchá (seg–sáb; área dos gatos 10h30–11h50 e 13h10–17h30); preços e regras também estão em `web/src/config.js`.
