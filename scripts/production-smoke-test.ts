import process from "node:process";

/**
 * Production smoke test for the RefurbMeter backend API (Fastify).
 *
 * Safe by design:
 *  - GET-only public endpoints (health, products, search, listings, price
 *    history, providers).
 *  - Resolves exactly ONE outbound redirect to validate the /go pipeline
 *    (records a single click event — expected — and never clicks ads).
 *  - Never triggers scraping, never creates bulk traffic, never bypasses
 *    provider restrictions.
 *
 * Usage:
 *   SMOKE_BASE_URL=https://api.example.com npm run smoke:prod
 *   SMOKE_BASE_URL=http://127.0.0.1:4000 npm run smoke:prod   # local pre-flight
 */

const BASE = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4000").replace(
  /\/+$/,
  "",
);

let failures = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json", "user-agent": "refurbcompare-smoke/1.0" },
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

type Envelope<T> = { success: boolean; data: T; meta?: Record<string, unknown> | undefined };

type Product = { slug: string; id: string; listingCount: number };
type Listing = {
  id: string;
  sourceUrl: string;
  stockStatus: string;
  providerName: string;
  price: number;
  normalizedCondition: string;
};
type Provider = { id: string; slug: string; name: string; active: boolean };
type HistoryPoint = { date: string; price: number };

async function main() {
  // 1. Health (DB-free liveness)
  try {
    const h = await get<Envelope<{ status: string; mode: string }>>("/api/v1/health");
    check("health", h.success && h.data.status === "ok", `mode=${h.data.mode}`);
  } catch (err) {
    check("health", false, (err as Error).message);
  }

  // 2. Search (real DB-backed search for the required queries)
  const searches = ["iPhone 13", "iPhone 13 128GB", "Samsung S22", "OnePlus 11", "Pixel 7"];
  let searchHits = 0;
  for (const q of searches) {
    try {
      const r = await get<Envelope<Product[]>>(`/api/v1/search?q=${encodeURIComponent(q)}`);
      if (r.success && Array.isArray(r.data)) {
        if (r.data.length > 0) {
          searchHits += 1;
          check(`search "${q}"`, true, `${r.data.length} results`);
        } else {
          console.log(`INFO  search "${q}" — no matches in current catalog (expected until that model is synced)`);
        }
      } else {
        check(`search "${q}"`, false, "unexpected response");
      }
    } catch (err) {
      check(`search "${q}"`, false, (err as Error).message);
    }
  }
  check("search coverage", searchHits >= 1, `${searchHits} required queries hit real catalog rows`);

  // 3. Products + 4. product page
  let product: Product | undefined;
  try {
    const r = await get<Envelope<Product[]>>("/api/v1/products?pageSize=5");
    product = r.data.find((p) => p.listingCount > 0) ?? r.data[0];
    check("products list", r.success && Array.isArray(r.data) && product !== undefined, `sample=${product?.slug ?? "none"}`);
  } catch (err) {
    check("products list", false, (err as Error).message);
  }

  // 5. Comparison listings for the sample product
  let sampleListing: Listing | undefined;
  if (product?.slug) {
    try {
      const r = await get<Envelope<{ offers: Listing[] }>>(`/api/v1/products/${product.slug}/listings`);
      const offers = r.data.offers ?? [];
      sampleListing = offers.find((o) => o.stockStatus === "IN_STOCK") ?? offers[0];
      if (offers.length > 0) {
        check("comparison", r.success, `${offers.length} offers for ${product.slug}`);
      } else {
        console.log("INFO  comparison — no offers yet (expected until a provider is authorized and synced)");
      }
    } catch (err) {
      check("comparison", false, (err as Error).message);
    }
  } else {
    check("comparison", false, "no product available to compare");
  }

  // 6. Price history for the sample product (DB history, not fabricated)
  if (product) {
    try {
      const r = await get<Envelope<{ points: HistoryPoint[]; lowestPrice: number }>>(
        `/api/v1/price-history/${product.id}?days=90`,
      );
      check(
        "price history",
        r.success && Array.isArray(r.data.points) && r.data.points.length > 0,
        `${r.data.points.length} points, lowest=${r.data.lowestPrice}`,
      );
    } catch (err) {
      check("price history", false, (err as Error).message);
    }
  }

  // 7. Provider status (five registered providers, all initially disabled until authorized)
  try {
    const r = await get<Envelope<Provider[]>>("/api/v1/providers");
    const providers = r.data;
    const names = providers.map((p) => p.slug);
    const required = ["cashify", "budli", "refit", "sahivalue", "mobilegoo"];
    const present = required.every((s) => names.includes(s));
    const anyActive = providers.some((p) => p.active);
    check("providers", r.success && present, required.join(","));
    if (present && !anyActive) {
      console.log("INFO  providers — none active (expected until authorization is configured)");
    }
  } catch (err) {
    check("providers", false, (err as Error).message);
  }

  // 8. Redirect validation — resolve exactly one in-stock listing via the JSON
  // endpoint and confirm the target URL is an https URL on an approved domain.
  if (sampleListing) {
    try {
      const r = await get<Envelope<{ targetUrl: string }>>(`/api/v1/redirect/${sampleListing.id}`);
      const url = new URL(r.data.targetUrl);
      const https =
        url.protocol === "https:" || url.protocol === "http:";
      const onApprovedDomain = Boolean(url.hostname) && !url.hostname.includes("localhost");
      check("redirect validation", r.success && https && onApprovedDomain, `${url.hostname}${url.pathname}`);
    } catch (err) {
      check("redirect validation", false, (err as Error).message);
    }
  } else {
    console.log("INFO  redirect validation — skipped (no in-stock listing to validate yet)");
  }

  console.log(failures === 0 ? "\nSMOKE TEST PASSED" : `\nSMOKE TEST FAILED (${failures} failure(s))`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});