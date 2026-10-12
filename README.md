# Gatchá 🍵🐾

Este é o site do Gatchá, o cat café de matchá da Galeria Metrópole, junto com o painel onde a equipe cuida dos gatos e do cardápio.

O site é só uma **vitrine**: mostra o cardápio, o gatil e os gatos do Abrigo São Gabriel, mas não recebe reservas, pedidos de adoção nem dados de ninguém.

Aqui está tudo o que você precisa para rodar o projeto no seu computador. Vai publicar na internet ou quer entender como ele funciona por dentro? Isso fica em [docs/producao.md](docs/producao.md).

## Antes de começar

Você vai precisar de:

- **Node.js 22 ou mais novo.** Para conferir, rode `node -v` no terminal.
- **Docker Desktop aberto.** É ele que roda o banco de dados. Já tem um PostgreSQL instalado? Também serve, veja [Usando outro Postgres](#usando-outro-postgres).
- **No Windows, o Git Bash** para digitar os comandos.

## Primeira vez (uns 5 minutos)

**1. Instale as dependências** do site e da API:

```bash
npm install
```

**2. Ligue o banco de dados** (o Docker Desktop precisa estar aberto):

```bash
npm run db:up
```

**3. Suba a API.** Na primeira vez ela cria sozinha o arquivo `.env`, gera as chaves secretas e monta as tabelas do banco:

```bash
npm run dev
```

Quando aparecer `API Gatchá no ar`, deu certo. Deixe esse terminal aberto e abra outro para os próximos passos.

**4. Crie o seu usuário do painel:**

```bash
winpty npm run admin:criar -- seu-email@gatcha.com.br
```

A senha não aparece enquanto você digita, e é assim mesmo. Ela precisa ter pelo menos 12 caracteres. No Mac ou no Linux, rode o mesmo comando sem o `winpty`.

**5. Coloque o cardápio e os gatos de exemplo** no banco, para o site não abrir vazio:

```bash
npm run dev:popular
```

**6. Suba o site:**

```bash
npm run web:dev
```

Pronto! Agora é só abrir no navegador:

- **Site:** http://localhost:5173
- **Painel da equipe:** http://localhost:5173/admin (ou clique em "Área da equipe", no rodapé do site)

## No dia a dia

Com o Docker Desktop aberto, use dois terminais:

```bash
npm run db:up      # liga o banco (se já estiver ligado, não faz nada)
npm run dev        # terminal 1: a API
npm run web:dev    # terminal 2: o site
```

Para desligar, aperte `Ctrl+C` nos dois terminais. Os dados ficam guardados no banco para a próxima vez.

Mexeu em algum arquivo? O site se atualiza sozinho no navegador e a API reinicia sozinha.

## O que dá para fazer no painel

| Aba | Para quê |
|---|---|
| **Gatos** | Cadastrar, editar e apagar gatos, com foto tirada direto do celular. Gato adotado sai do site, mas continua no painel. |
| **Cardápio** | Itens, preços, selos (vegano, novo, mais pedido) e fotos. "Tirar do site" esconde o item sem apagar. |

O login dura 15 minutos e não fica salvo no navegador. Se você recarregar a página, é só entrar de novo. Isso é de propósito, por segurança.

## Quer mudar alguma coisa?

| O quê | Onde |
|---|---|
| Textos, preços, horários, regras do gatil, perguntas frequentes, contatos e cores | `web/src/config.js`. Procure por `[SUBSTITUIR]` e `[CONFIRMAR]`: são os pontos que ainda esperam o conteúdo de verdade. |
| Visual do site | `web/src/estilo.css` |
| Cardápio e gatos de exemplo | `web/public/dados-exemplo/` |
| Imagem que aparece quando alguém compartilha o link | `web/public/og.png` |

## Testes

Os testes usam um banco **separado**, porque apagam os dados a cada rodada. Crie esse banco uma vez:

```bash
docker compose exec postgres createdb -U gatcha gatcha_test
```

E rode os testes sempre que quiser:

```bash
TEST_DATABASE_URL=postgres://gatcha:gatcha_dev@localhost:5433/gatcha_test npm test
```

Só `npm test`, sem o banco de testes, roda apenas a parte que não precisa de banco.

## Deu algum problema?

- **Apareceu "Banco inacessível" ao subir a API.** O banco não está ligado. Abra o Docker Desktop e rode `npm run db:up`.
- **A página abre em branco.** Não abra o `web/index.html` direto no navegador nem rode `vite` sozinho. Use `npm run web:dev` e acesse http://localhost:5173.
- **O site mostra "Galeria ilustrativa".** O site não conseguiu falar com a API e está usando os dados de exemplo. Confira se o `npm run dev` está rodando.
- **Apareceu `EADDRINUSE` ao subir a API.** Já tem uma API rodando em outro terminal. Feche o terminal antigo com `Ctrl+C` e tente de novo.
- **Esqueceu a senha do painel?** Crie uma nova com `winpty npm run admin:criar -- seu-email@gatcha.com.br --redefinir`.
- **Errou a senha muitas vezes e o login travou?** Espere 15 minutos e tente de novo.

### Usando outro Postgres

Sem Docker, crie um banco vazio no seu PostgreSQL e troque a `DATABASE_URL` no arquivo `.env` pelo endereço dele. Depois siga do passo 3 em diante.

O `.env` guarda senhas e chaves do seu computador e **nunca vai para o Git**. Não compartilhe esse arquivo.
