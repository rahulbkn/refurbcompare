# Database schema

RefurbMeter keeps **one canonical Prisma schema** and mirrors it for the
dev sandbox:

| Artifact                                   | Driver      | Used where              |
| ------------------------------------------ | ----------- | ----------------------- |
| `packages/db/prisma/schema.prisma`         | PostgreSQL  | **canonical**, production (via `PrismaRepository`) |
| `packages/db/src/sqlite/ddl.ts` (`SQLITE_DDL`) | node:sqlite | Android/Termux dev sandbox (via `SqliteRepository`) |

Both implement the same `Repository` contract in
`packages/core/src/db/repository.ts`. The API and ingestion services depend
only on that interface; the driver is selected by `DATABASE_DRIVER` through
`packages/db/src/factory.ts`.

## Entities

- **Provider** — third-party partner + integration wiring (`slug`, `website`,
  `mode` MOCK/API/FEED/AUTHORIZED_CRAWL/MANUAL_IMPORT/DISABLED, `trustScore`,
  `active`, `status`, `disabledReason`, `defaultEnabled`, `lastSyncAt`).
- **ProviderAuthorization** — the authorization checklist that gates live
  traffic (`approved`, permitted domains/paths/fields, `maxRequestsPerMinute`,
  ToS/robots/copyright/contact-review timestamps, `sourceAttributionRequired`,
  `expiresAt`).
- **Product** — canonical catalogue (brand, model, modelNumber, storage, RAM,
  colour, network, slug, images, JSON `specifications`, `matchingConfidence`,
  `matchingMethod`). One row per unique phone + capacity.
- **Listing** — a provider's offer for a product: price, original price,
  discount, normalized condition + source condition + condition score, warranty,
  returns, battery health, stock status, seller rating. Unique on
  `(providerId, sourceProductId)`.
- **PriceHistoryPoint** — sampled best price per product over time.
- **PriceAlert** — user price-drop alerts (email, target price, ACTIVE/TRIGGERED).
- **Click** — referral click log (listing, device type, hashed user agent).
- **SyncJob / SyncError** — audit of provider sync runs and item-level failures.
- **SearchQueryRecord** — search intent (query + result count, no PII).
- **AdminUser / AuditLogEntry** — admin identity + audit trail.

## Conventions

- Money is stored as `Int` **whole INR rupees** everywhere (never floats).
- Primary keys are deterministic where possible (`stableId('prod'|'provider'|'listing', key)`);
  Click/Alert/Audit/Sync rows use `crypto.randomUUID()`.
- Dates are ISO-8601 strings in SQLite and `DateTime` in Prisma.
- Booleans are native on Postgres/Prisma and `INTEGER 0/1` in `SQLITE_DDL`.
- On Android/Termux the Prisma native engines cannot run, so the sandbox uses
  the built-in `node:sqlite` driver behind the same `Repository` interface. The
  Postgres schema still ships verbatim for real deployments.
- The generated Prisma client lives at `packages/db/generated/client`
  (`engineType = "client"`); `packages/db`'s build copies it into `dist/`.

## Local dev bootstrap

The API auto-seeds demo data on first boot in dev mode (see
`apps/api/src/bootstrap.ts`). To seed explicitly:

```bash
npm run bootstrap:dev   # legacy frontend bootstrap
# or for the backend (db package):
node --import tsx packages/db/prisma/seed.ts
```

Demo fixtures live in `packages/db/src/seed-data.ts` (10 canonical products,
5 providers, deterministic listings built by `buildDemoProviderProducts`).
