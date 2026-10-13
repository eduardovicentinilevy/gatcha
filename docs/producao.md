# Gatchá: guia técnico e de publicação

Para quem vai publicar o site ou mexer por dentro do código. Para rodar no seu computador, o [README](../README.md) basta.

React 19 + Vite, publicado como site estático no Firebase Hosting. Não há servidor nem banco de dados.

> **Status:** vitrine pronta (início, gatil, Instagram, visite, rodapé e atendimento com perguntas frequentes).
> **Sem cardápio, painel nem adoção online:** por decisão do Gatchá, o cardápio é impresso e fica no café, e não há área da equipe. A antiga API (Express + PostgreSQL), o painel, o cardápio e a seção de gatos para adoção estão no histórico do Git.
> **Sem reserva online:** a reserva da área dos gatos continua no balcão (como há mais de 4 anos, para evitar atrasos). O site só informa preços, horários e regras.
> Pendente: deploy e conteúdo real (fotos do Instagram, cores oficiais, WhatsApp e e-mail).

## Onde fica cada coisa

| Pasta ou arquivo | O que tem |
|---|---|
| `web/src/config.js` | Fonte única de textos, horários, preços do gatil, regras, FAQ, contatos e cores |
| `web/src/components/` | Uma seção do site por arquivo (`Hero`, `Gatil`, `SigaAGente`, `Visite`, `Rodape`…) |
| `web/src/estilo.css` | Todo o visual, mobile-first |
| `web/public/` | Ícones, imagem de prévia (`og.png`) e fotos |
| `firebase.json` | Hospedagem, cabeçalhos de segurança e cache |

## Segurança e acessibilidade

- **Sem dados:** o site não tem formulários, login, cookies próprios nem chamadas para servidor.
- **CSP estrita** sem `unsafe-inline` em `firebase.json`, além de HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e `frame-ancestors 'none'`.
- **Fontes servidas pelo próprio site** (sem Google Fonts) e **mapa do Google só carrega quando a pessoa pede**.
- **Acessibilidade:** contraste AA conferido nos dois temas, foco visível, navegação por teclado e `prefers-reduced-motion` respeitado (as animações param).
- **CI** (GitHub Actions): build do site, `npm audit` e varredura de segredos (gitleaks) em todo o histórico.

## Publicar (Firebase Hosting)

Uma vez: instale o Firebase CLI (`npm install -g firebase-tools`), entre com `firebase login` e ligue a pasta ao projeto com `firebase use --add`.

Para cada publicação:

```bash
VITE_SITE_URL=https://<domínio do site> npm run build
firebase deploy --only hosting
```

O `VITE_SITE_URL` coloca a imagem de prévia (`web/public/og.png`) e o endereço nas tags de compartilhamento: é o que aparece quando alguém manda o link no WhatsApp ou no Instagram. Sem ele, a prévia mostra só título e descrição.

## Pendências de negócio

Dias e horários vieram do perfil do Gatchá (seg–sáb; área dos gatos 10h30–11h50 e 13h10–17h30). Preços e regras do gatil também estão em `web/src/config.js`, marcados com `[CONFIRMAR]` onde dependem do Gatchá.
