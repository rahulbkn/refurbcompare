# syntax=docker/dockerfile:1
# RefurbCompare — monorepo runtime image for the API, ingestion worker and scheduler.
# Production configuration is selected at runtime via environment variables
# (DATABASE_DRIVER=prisma, QUEUE_DRIVER=bullmq, DATA_MODE=live by default).

FROM node:22-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install node_modules first for better layer caching.
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY services/ingestion/package.json services/ingestion/package.json
RUN npm ci --no-audit --no-fund

# Prisma client generation (prod Postgres schema).
COPY packages/db/prisma packages/db/prisma
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

COPY packages/core packages/core
COPY packages/db packages/db
COPY services/ingestion services/ingestion
COPY apps/api apps/api
RUN npm run build -w @refurbcompare/core \
 && npm run build -w @refurbcompare/db \
 && npm run build -w @refurbcompare/ingestion \
 && npm run build -w @refurbcompare/api

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/services ./services
COPY --from=build /app/tsconfig.base.json ./

# Default: the API server. Compose overrides the command for worker/scheduler.
CMD ["node", "apps/api/dist/server.js"]