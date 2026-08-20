# RefurbCompare

RefurbCompare is an independent refurbished-smartphone price **comparison +
referral** platform for India. It aggregates offers from third-party sellers,
normalises condition grades, and shows every in-stock price on one page so
visitors can pick the cheapest — or best-value — option. Purchases always
happen on the seller's own website.

> RefurbCompare never owns, sells, ships, services, refunds or warranties
> devices, and never handles payments. It only **compares** and **redirects**.

## Stack

A TypeScript **monorepo** (`npm workspaces`):

| Workspace              | Responsibility                                                    |
| ---------------------- | ----------------------------------------------------------------- |
| `packages/core`        | Framework-independent domain logic (normalization, matching, scoring, redirect safety, repository/queue contracts, services) |
| `packages/db`          | `Repository` implementations: Prisma/Postgres (canonical) + `node:sqlite` (dev), seed data, `SqliteRepository`, `PrismaRepository` |
| `services/ingestion`   | Provider connectors, sync pipeline (fetch→validate→normalize→match→upsert), BullMQ/redis + in-memory queue, worker, scheduler |
| `apps/api`             | Fastify HTTP server (thin handlers over core services), admin API, OpenAPI |
| `app/` `components/` `lib/` | Next.js 15 frontend (App Router) |

The frontend is a Server Components app on the same repo root; the API server
is the backend described in the spec and ships first.

- **PostgreSQL via Prisma** (canonical, production) — schema in
  `packages/db/prisma/schema.prisma`
- **node:sqlite driver** for the local dev sandbox (zero native deps) — DDL in
  `packages/db/src/sqlite/ddl.ts`
- **BullMQ/Redis** queue in production; an in-memory queue for dev
- Zod validation, Fastify 5, pino, Vitest

## Quick start (backend, local dev sandbox)

```bash
cp .env.example .env        # DATABASE_DRIVER=sqlite, QUEUE_DRIVER=memory (defaults)
npm install
npm run typecheck:api       # typechecks core + db + ingestion + api
npm run api:dev             # http://localhost:4000 (auto-seeds demo catalog)
```

The API auto-seeds 10 demo products + 5 providers + 50 listings on first boot
in dev mode. Open the interactive docs at `http://localhost:4000/docs`
(OpenAPI at `/openapi.json`).

`DATABASE_DRIVER=sqlite` uses the built-in `node:sqlite` driver and
`QUEUE_DRIVER=memory` runs the ingestion worker in-process, so no native
Prisma engines, Postgres or Redis are required. This is the only mode that
works inside the Android/Termux sandbox.

## Scripts

| Command                  | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `npm run api:dev`        | Fastify API dev server (tsx watch)                             |
| `npm run api:start`      | Run the built API (`node apps/api/dist/server.js`)             |
| `npm run worker:dev`     | Ingestion worker (tsx watch)                                   |
| `npm run scheduler:dev`  | Ingestion scheduler (60 s tick, mocked cadence in dev)         |
| `npm run typecheck:api`  | Typecheck core + db + ingestion + api                          |
| `npm test`               | Vitest (unit + repository + API integration)                   |
| `npm run db:generate:api`| `prisma generate` for `packages/db`                            |
| `npm run db:push:api`    | `prisma db push` for `packages/db` (Postgres)                  |
| `npm run db:seed:api`    | Prisma seed (Postgres)                                         |
| `npm run dev`            | Next.js frontend dev server (`http://localhost:3000`)          |
| `npm run e2e`            | Playwright (CI-runnable; browsers not installable on Termux)   |
| `npm run cf:build`       | `next build` + `opennextjs-cloudflare build` (OpenNext Worker) |
| `npm run cf:dev` / `cf:preview` | `opennextjs-cloudflare preview` (needs workerd; not on Termux) |
| `npm run cf:deploy`      | `opennextjs-cloudflare deploy` (needs rclone optional dep)     |
| `npm run cf:typecheck`   | Typecheck worker/cron code (`tsconfig.cloudflare.json`)        |
| `npm run cf:cron:run`    | Run the Mode A sync cron logic locally (no workerd)            |

## Demo mode

`DATA_MODE=demo` (default) labels all listings as demo data and the frontend
shows a persistent demo banner with `robots: noindex`. Providers ship
**disabled**; a provider only becomes live after a complete authorization
record is on file (see `PROVIDER_INTEGRATION.md`). The frontend runs with
`NEXT_PUBLIC_DEMO_MODE=true`, `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000` and
writes to `data/dev.db` (see `.env.example`).

## Business model & disclosure

- RefurbCompare is an independent comparison platform, not affiliated with any
  seller unless explicitly stated.
- Outbound links may be affiliate links; sellers may pay a commission at no
  extra cost to the visitor. This is disclosed near seller controls and in the
  footer.
- Redirects go through `/go/[listingId]`, which validates the destination
  against the seller's allowlisted domain (open-redirect protection) before
  appending `utm_source/utm_medium/utm_campaign/ref`.

See `PROVIDER_INTEGRATION.md` for the provider model, `DATABASE_SCHEMA.md` for
the data model, `DEPLOYMENT.md` for production (Docker Compose), and
`CLOUDFLARE_DEPLOYMENT.md` for the Cloudflare Workers deployment (Mode A:
Next.js on Workers + external Fastify API; the default), including the
`/api/proxy` forwarder, the `EXTERNAL_API_URL` secret, the cron sync worker,
and the not-yet-implemented Mode B (Hyperdrive) boundary in
`lib/cloudflare-db.ts`.
