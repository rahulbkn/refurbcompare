# Database migrations

RefurbMeter's production mapping is generated from
`packages/db/prisma/schema.prisma` (PostgreSQL). The embedded Prisma migration
engine cannot run on Termux/Android (unsupported native binaries), so tracked
migrations are produced on a Linux laptop or CI — never by hand.

## Generating the initial migration (run on Linux CI/laptop)

```bash
DATABASE_URL="postgresql://refurbcompare:CHANGE_ME@localhost:5432/refurbcompare" \
  npm run db:migrate:init --workspace @refurbcompare/db
```

This creates `packages/db/prisma/migrations/0001_init/migration.sql` plus the
tracked `migration_lock.toml` (provider `postgresql`). Commit both.

> The SQL in that directory is the single source of truth for production schema
> changes — never hand-edit tables without a paired migration.

## Applying

```bash
DATABASE_URL="postgresql://..." npm run db:migrate:deploy
```

`prisma migrate deploy` applies pending migrations in order and is idempotent —
safe for CI/CD and Render preDeploy hooks.

## Schema drift safety

- `packages/db/prisma/schema.prisma` is the model of record for Postgres.
- `packages/db/src/sqlite/ddl.ts` is the local `node:sqlite` DDL and is kept in
  sync manually; local dev never depends on migrations.
- After any schema change, regenerate the generated client:
  `npm run db:generate --workspace @refurbcompare/db`.