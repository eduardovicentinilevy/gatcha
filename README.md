# Gatchá 🍵🐾

Este é o site do Gatchá, o cat café de matchá da Galeria Metrópole.

O site é uma **vitrine**: apresenta o gatil (regras, preços e horários da área dos gatos), o Instagram e o caminho até o café. Ele não tem cardápio, painel nem banco de dados, e não recebe reservas nem dados de ninguém. O cardápio é impresso e fica no café.

Aqui está tudo o que você precisa para rodar o site no seu computador. Vai publicar na internet? Isso fica em [docs/producao.md](docs/producao.md).

## Antes de começar

Você só precisa do **Node.js 22 ou mais novo**. Para conferir, rode `node -v` no terminal.

## Rodando o site

**1. Instale as dependências** (só na primeira vez):

```bash
npm install
```

**2. Suba o site:**

```bash
npm run dev
```

Pronto! Abra http://localhost:5173 no navegador.

Mexeu em algum arquivo? O site se atualiza sozinho no navegador. Para desligar, aperte `Ctrl+C` no terminal.

## Quer mudar alguma coisa?

| O quê | Onde |
|---|---|
| Textos, preços do gatil, horários, regras, perguntas frequentes, contatos e cores | `web/src/config.js`. Procure por `[SUBSTITUIR]` e `[CONFIRMAR]`: são os pontos que ainda esperam o conteúdo de verdade. |
| Fotos do "Siga a gente" | `web/public/img/instagram/`, e depois aponte para elas em `feedInstagram`, no `web/src/config.js` |
| Visual do site | `web/src/estilo.css` |
| Imagem que aparece quando alguém compartilha o link | `web/public/og.png` |

## Conferindo antes de publicar

```bash
npm run build     # gera a versão final em web/dist
npm run preview   # abre essa versão em http://localhost:4173
```

## Deu algum problema?

- **A página abre em branco.** Não abra o `web/index.html` direto no navegador. Use `npm run dev` e acesse http://localhost:5173.
- **Apareceu "'vite' não é reconhecido" ou "Failed to resolve import".** Rode `npm install` de novo.
- **A porta 5173 já está em uso.** Já tem um site rodando em outro terminal. Feche o terminal antigo com `Ctrl+C` e tente de novo.
