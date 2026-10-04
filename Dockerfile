# Imagem para Google Cloud Run.
# Multi-stage: dependências instaladas numa etapa, imagem final só com runtime.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY db ./db
COPY scripts ./scripts

# Nunca rodar como root dentro do container.
USER node

# O Cloud Run injeta PORT (padrão 8080).
EXPOSE 8080
CMD ["node", "src/server.js"]
