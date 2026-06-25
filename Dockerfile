# FreshOpsPlatform — production Docker image

FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# ---- Production stage ----
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Persistent data directory for the JSON state file in development
# mode, or as a fallback if no external database adapter is
# configured via DATABASE_ADAPTER / DATABASE_URL.
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/server.cjs"]