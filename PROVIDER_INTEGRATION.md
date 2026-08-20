# Provider integration

RefurbCompare gets offers from **provider connectors**, never by unrestricted
scraping. Every connector ships **disabled** and only becomes live once (a) the
seat runs in a sandbox data mode (`DATA_MODE=demo|mock` → `mode=MOCK`) or (b) a
complete authorization record is on file for live data.

## The connector contract

`services/ingestion/src/providers/types.ts` defines `ProviderConnector`:

```ts
type ProviderConnector = {
  slug: string;
  name: string;
  website: string;
  integrationType: 'API' | 'FEED' | 'AUTHORIZED_CRAWL' | 'MANUAL_IMPORT';
  defaultMode: ProviderMode;
  defaultEnabled: boolean;
  disabledReason: string | null;
  trustScore: number;
  getSystemConfig(): SystemProviderConfig;
  validateConfiguration(config): Promise<ProviderValidation>;
  isEnabled(config): boolean;
  healthCheck(config): Promise<HealthCheckResult>;
  fetchProducts({ config, dataMode, nextOffset }): Promise<ConnectorFetchResult>;
};
```

`BaseConnector` (`providers/base.ts`) provides the mock/demo fetch path used in
sandbox mode; real connectors override it to reach the vendor API/feed.

## Registered connectors

Registered in `services/ingestion/src/providers/registry.ts`:

| Connector    | Type             | Trust | Notes                                        |
| ------------ | ---------------- | ----- | -------------------------------------------- |
| `cashify`    | AUTHORIZED_CRAWL | 82    | Live crawler — public sitemap + ProductGroup JSON-LD (`providers/cashify.ts`) |
| `budli`      | FEED             | 70    | Stub — needs authorized feed                 |
| `refit`      | AUTHORIZED_CRAWL | 66    | Stub — needs written permission              |
| `sahivalue`  | API              | 62    | Stub — needs authorized API                  |
| `mobilegoo`  | MANUAL_IMPORT    | 58    | Stub — needs approved import file            |

`buildSystemConfig` (`config.ts`) merges the persisted `Provider` row +
`ProviderAuthorization` into the connector's defaults, so connectors can gate
themselves on `enabled` + `auth.approved`. Connector `liveFetch` must be
implemented per approved vendor integration; only `cashify` has one so far.

### Cashify crawler (reference implementation)

`services/ingestion/src/providers/cashify.ts` is an authorized, robots.txt-
compliant crawler (robots.txt `Allow: /`, only `/api/*` + a few test paths are
disallowed — the crawl never touches those):

- **Discovery** — the refurbished sitemap index
  (`https://smp.cashify.in/uzi1/cashify/refurbished.xml`) forwards to
  per-type sitemaps; the connector collects `/buy-refurbished-mobile-phones/renewed-*`
  product URLs only (cached per process, preferred models first).
- **Parse** — each product page embeds a schema.org `ProductGroup` JSON-LD block
  whose `hasVariant[]` holds live SKUs + INR prices; every SKU becomes a
  `ProviderProduct` (title carries `${storage} GB` + color so `matchProducts`
  wins on brand+model+storage).
- **Throttle** — waits `60000 / maxRequestsPerMinute` ms between requests
  (default 2s at the 30/min authorization cap).
- **Tuning envs** — `CASHIFY_PREFERRED_MODELS` (comma list, default
  `iphone-13,iphone-12,iphone-14,galaxy-s22,galaxy-s23,pixel-7,pixel-8`),
  `CASHIFY_PRODUCTS_PER_PAGE` (default 1 product page per sync page),
  `CASHIFY_MAX_PRODUCTS` (optional cap for the whole run).
- The parser is exported (`parseCashifyProductPage`) and covered by
  `tests/cashify-crawler.test.ts` against a saved fixture.

## Sync flow

Pipeline (`services/ingestion/src/pipeline.ts`, `runProviderSync`):

1. `FETCH` — `fetchProducts()` with page offset (MAX_PAGES = 5).
2. `VALIDATE` — `validateConfiguration` (authorization completeness).
3. `NORMALIZE` — condition grading, storage/RAM parsing, brand/model
   canonicalization (`packages/core`).
4. `MATCH` — `matchProducts` against canonical products (confidence ≥ 0.45).
5. `UPSERT` — `upsertListing` keyed on `(providerId, sourceProductId)`;
   records `PriceHistoryPoint` on price change; item errors land in
   `SyncError`, run status in `SyncJob` (SUCCESS/PARTIAL/FAILED).

Drivers:
- **Worker** — `npm run worker:dev` (BullMQ in production, in-memory in dev).
- **Scheduler** — `npm run scheduler:dev` (60 s tick; provider sync, health
  checks, stale-listing cleanup, price-alert checks).
- **Admin API** — `POST /api/v1/admin/sync/:slug`, `POST /api/v1/admin/providers/:id/authorize`, `PATCH /api/v1/admin/providers/:id`.

Nothing is ever fetched synchronously during a page request.

## Onboarding a real seller

1. Get an **authorized** product feed or API (or written permission to use
   their listing data). RefurbCompare never scrapes without permission.
2. Implement the connector's `liveFetch` (start from `providers/base.ts`),
   registering it in `providers/registry.ts`.
3. Store secrets in a secret manager (never in git), read via env; the API key
   is referenced by `credentials.apiKeyRef` and never leaves the server.
4. Record the full authorization checklist via the admin authorize endpoint
   (approval, permitted domains/paths/fields, rate limits, ToS/robots/copyright
   review, contact record, source attribution). Approval auto-enables the
   provider and, for `API`/`FEED`/`AUTHORIZED_CRAWL` integrations, flips the
   provider `mode` to the authorization type so `liveFetch` runs (a provider
   that stays `MANUAL_IMPORT` is enabled in `MANUAL_IMPORT` mode).
5. Run `POST /api/v1/admin/sync/:slug` and watch `/api/v1/admin/health`.

Local real-data run (cashify):

1. Create the DB with a demo-mode boot once so the canonical catalog is seeded,
   then boot the API with `DATA_MODE=live` against that same database
   (`npm run api:start` with `DATA_MODE=live DATABASE_DIALECT=sqlite ...`).
2. `POST /api/v1/admin/providers/provider_cashify/authorize` with a complete
   record (permittedDomains `www.cashify.in,cashify.in`, permittedPaths for the
   product/sitemap/robots paths, maxRequestsPerMinute 30, `termsReviewedAt` +
   `robotsReviewedAt` set, copyright/contact/attribution true). This enables the
   provider in `API` mode.
3. `POST /api/v1/admin/sync/cashify {"mode":"API"}` — the crawler pulls
   sitemap-discovered product pages, the pipeline matches SKUs to the catalog
   and upserts real listings (verified: 412 SKUs added from 5 product pages).
4. Verify `/api/v1/products/:slug/listings` shows real Cashify URLs and
   `/go/:listingId` 302-redirects to them with `utm_source`; disabled providers
   keep returning the 403 JSON envelope.

## Redirects & affiliate attribution

Outbound links go through `/go/[listingId]`, which:

- looks up the listing + provider (archived offers 410, out-of-stock 422,
  disabled provider 403);
- verifies the destination host against the provider's **approved domains**
  from the authorization record (open-redirect protection in
  `packages/core/src/redirect/`);
- appends sanitized `utm_source/utm_medium/utm_campaign/ref`;
- records a `Click` (fire-and-forget).

Providers without an authorization record redirect only to their own `website`
host. Sellers that haven't agreed to affiliate attribution keep
`sourceAttributionRequired=false` semantics and no commission is claimed.
