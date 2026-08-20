# Deployment

RefurbCompare runs a Fastify **API**, an ingestion **worker** and a
**scheduler**, with the Next.js frontend optional on top. Storage and queue
drivers are selected by env; in production you run the full Docker Compose
stack.

## Quick start: `docker compose up`

```bash
# 1. Run Postgres + Redis + API + worker + scheduler
DATA_MODE=live ADMIN_API_KEY="$(openssl rand -hex 16)" docker compose up -d --build
# 2. First time only: push schema + seed catalogue
docker compose --profile migrate run migrate
# 3. API is at http://localhost:4000, docs at /docs
```

Compose services share one image (`Dockerfile`) with different entry commands;
the `migrate` profile runs `prisma db push` + seed against Postgres.

## Manual production (no Docker)

1. Provision PostgreSQL + Redis and set env (see table below).
2. Generate and apply migrations **from a Prisma-capable host** (CI/Docker —
   the Prisma CLI engine has no Android/ARM64 build, so it cannot run on
   Termux). The migration folder (`packages/db/prisma/migrations`) is not
   recorded yet, so generate it once on CI first:

   ```bash
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/refurbcompare?schema=public" \
     npm run db:migrate:init -w @refurbcompare/db   # generates packages/db/prisma/migrations (commit it)
   ```

   **Production deployment migration command (exact):**

   ```bash
   npm run db:migrate:deploy   # runs `prisma migrate deploy` — safe, non-interactive,
                               # applies only pending migrations; NEVER use db:push in prod
   ```

   Verify applied state any time with `npm run db:migrate:status`.
3. Apply the schema and seed the catalogue:
   ```bash
   npm run db:generate:api
   npm run db:seed:api
   ```
4. Build and run the API (Render or any Node host):
   ```bash
   npm run build -w @refurbcompare/core
   npm run build -w @refurbcompare/db
   npm run build -w @refurbcompare/ingestion
   npm run build -w @refurbcompare/api
   npm run api:start        # production API server, reads PORT + DATABASE_URL
   ```
   The API listens on `PORT` (Render provides it) and never starts a scraper
   during boot; ingestion only runs from the worker/scheduler processes.

Production configuration **fails fast**: with `NODE_ENV=production` the API
refuses to start (CONFIG_ERROR) unless `DATA_MODE=live`, the driver is
`prisma`, `DATABASE_URL` is a `postgresql://` string, `SYNC_MOCK_PROVIDER` is
false, and `ADMIN_API_KEY`/`ADMIN_SECRET` is a real secret. There is no silent
fallback to SQLite or mock data.

## Environment variables

| Variable            | Default                     | Purpose                                        |
| ------------------- | --------------------------- | ---------------------------------------------- |
| `DATA_MODE`         | `demo`                      | `demo`/`mock` sandbox, `live` production       |
| `PORT` / `HOST`     | `4000` / `0.0.0.0`          | API bind address                               |
| `DATABASE_DRIVER`   | `sqlite` (dev)              | `sqlite` or `prisma`                           |
| `DATABASE_URL`      | `file:./data/dev.db`        | `file:` path (sqlite) or `postgresql://` (prisma) |
| `QUEUE_DRIVER`      | `memory` (dev)              | `memory` or `bullmq`                           |
| `REDIS_URL`         | `redis://127.0.0.1:6379`    | BullMQ broker (prod)                           |
| `ADMIN_API_KEY`     | `dev-admin-key`             | `X-Admin-Key` header for `/api/v1/admin/*`     |
| `CORS_ORIGINS`      | `''` (allow all in dev)     | Comma-separated allowed origins                |
| `RATE_LIMIT_MAX`    | `60`                        | Requests/minute per IP                         |
| `LOG_LEVEL`         | `info`                      | pino level                                     |
| `SYNC_MOCK_PROVIDER`| `false`                     | Load demo feed during sync                     |
| `API_CRON_SYNC`     | `false`                     | Cron-based sync toggle                         |

Production gating is explicit at startup: the API logs
`PRODUCTION MODE: driver=… queue=… dataMode=live` only when `prisma` +
`bullmq` + `live` are all set; anything else logs
`DEV FALLBACK MODE: sqlite + in-memory queue`.

## Render (managed API + PostgreSQL)

`render.yaml` (repo root) defines the production shape:

```
Render blueprints
  ├─ PostgreSQL (managed, `refurbcompare-db`)
  └─ Web Service (Fastify API)
       └─ start command: npm run api:start
          build:         npm ci && npm run build
          listens on:    $PORT (Render injects it — never hardcode a local port)
```

Production environment variables (set in the Render dashboard / `DATABASE_URL`
from the managed Postgres): `DATABASE_DRIVER=prisma`, `DATABASE_URL`,
`DATA_MODE=live`, `NODE_ENV=production`, `ADMIN_SECRET` (random), `QUEUE_DRIVER`.
Before first boot run `npm run db:migrate:deploy` against the production
Postgres (Render Shell or CI), then `npm run db:seed:api` on an empty catalogue.

## Deployment secrets & rotation

- All secrets live in platform secret managers (Render env / GitHub Secrets /
  `wrangler secret put`) — never in git.
- Rotate stale Cloudflare API tokens and GitHub tokens before a first deploy,
  and generate fresh deploy tokens with the minimum scopes:
  - `CLOUDFLARE_API_TOKEN`: Workers Scripts:Edit, Workers Routes:Edit,
    Account Settings:Read, Workers R2 Storage:Edit.
  - `CLOUDFLARE_ACCOUNT_ID`: 32-hex account id.
  - `EXTERNAL_API_URL` / `API_INTERNAL_TOKEN`: Mode A backend pair — the token
    must equal the backend's `ADMIN_API_KEY`/`ADMIN_SECRET`.
- Never echo secrets into CI logs; the workflow only prints the deployed URL.

## Production smoke test

`npm run smoke:prod` runs `scripts/production-smoke-test.ts` against a live
deployment (set `SMOKE_BASE_URL`): health, search, product, comparison, price
history, provider status and redirect validation. It never clicks ads,
creates fake traffic, or triggers scraping.

## Robots & SEO

In demo mode every page sets `robots: noindex, nofollow`. Set
`DATA_MODE=live` for indexed production; add `robots.txt`/`sitemap.xml` under
`app/` when going live.

## Testing

- `npm run typecheck:api` — typecheck all backend workspaces.
- `npm test` — Vitest: unit (normalization/matching/scoring/redirect/queue),
  repository (SqliteRepository), and full API integration via `app.inject`.
- `npm run e2e` — Playwright. Browsers are **not** installable on
  Android/Termux; run on CI after `npx playwright install`.

## Android/Termux sandbox notes

- `prisma generate` works only with `engineType="client"`; `db push`/query
  engines fail (`E_CANNOT_RESOLVE_VERSION` / `P2038`), hence the
  `node:sqlite` driver path for local dev.
- npm blocks postinstall scripts; if installs fail, approve explicitly:
  `npm install-scripts approve <package>`.
- `/tmp` is unreliable in Termux; keep temp work inside the project tree or
  `~/.cache/opencode/tmp`.
- Postgres/Redis cannot run here; production paths are verified by typecheck +
  Docker/CI only.
