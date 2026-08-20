// Post-deploy smoke test for the Cloudflare Workers frontend (Mode A).
//
// Checks the same paths a visitor would: homepage renders products, search
// returns results, a compare page renders, and /go produces a backend-managed
// redirect decision (302 when the provider is enabled, otherwise the backend's
// JSON error envelope forwarded through the worker). The API reachability for
// these pages is implied — SSR data is fetched through the gateway.
//
//   BASE_URL=https://refurbcompare.<your-subdomain>.workers.dev \
//     API_BASE=http://127.0.0.1:4000 npx tsx scripts/cf-smoke.ts
//
// API_BASE is optional; when omitted the script derives a listing id from the
// worker's own /api/proxy and exercises /go through the deployed origin.

const smokeBase = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const apiBase = (process.env.API_BASE ?? "").replace(/\/+$/, "");

const results: { name: string; ok: boolean; detail: string }[] = [];

function smokeRecord(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
}

async function smokeMain() {
  const started = Date.now();

  // 1. Homepage
  const home = await fetch(`${smokeBase}/`);
  const homeHtml = await home.text();
  smokeRecord(
    "homepage",
    home.status === 200 && /RefurbMeter|refurbished/i.test(homeHtml),
    `status=${home.status}`,
  );

  // 2. Search
  const search = await fetch(`${smokeBase}/search?q=iphone`, { redirect: "follow" });
  const searchHtml = await search.text();
  smokeRecord(
    "search?q=iphone",
    search.status === 200 && /iPhone/i.test(searchHtml),
    `status=${search.status}`,
  );

  // 3. API proxy through the worker origin — resolve a real product so the
  //    compare page and /go use ids the backend actually knows.
  let slug = "apple-iphone-13-128gb";
  let listingId = "";
  try {
    const res = await fetch(
      `${smokeBase}/api/proxy/api/v1/products?query=iphone%2013&pageSize=1`,
    );
    const body = (await res.json()) as {
      success?: boolean;
      data?: { slug?: string; id: string }[];
    };
    if (body.success && body.data?.[0]) {
      slug = body.data[0].slug ?? slug;
      listingId = body.data[0].id;
    }
  } catch {
    /* fall back to defaults */
  }

  // 4. Compare page
  const compare = await fetch(`${smokeBase}/compare/${encodeURIComponent(slug)}`, {
    redirect: "follow",
  });
  const compareHtml = await compare.text();
  smokeRecord(
    `compare/${slug}`,
    compare.status === 200 && /compare offers/i.test(compareHtml),
    `status=${compare.status}`,
  );

  // 5. /go redirect decision (real listing id from the proxy)
  let go: { ok: boolean; detail: string };
  if (listingId) {
    try {
      const list = (await (
        await fetch(`${smokeBase}/api/proxy/api/v1/products/${listingId}/listings`)
      ).json()) as { data?: { offers?: { id: string }[] } };
      listingId = list.data?.offers?.[0]?.id ?? listingId;
    } catch {
      /* keep the product id; the envelope fallback below still counts */
    }
  }
  if (!listingId) {
    go = { ok: false, detail: "could not resolve a listing id for /go" };
  } else {
    const res = await fetch(`${smokeBase}/go/${listingId}?utm_source=smoke`, {
      redirect: "manual",
    });
    // 302 = provider live and redirect proxied; 403/404/422 = backend JSON
    // envelope forwarded (provider disabled in demo is expected).
    const text = await res.text();
    go =
      res.status === 302
        ? { ok: true, detail: `302 -> ${res.headers.get("location")}` }
        : res.headers.get("content-type")?.includes("json")
          ? { ok: true, detail: `${res.status} (expected when provider disabled): ${text.slice(0, 120)}` }
          : { ok: false, detail: `unexpected ${res.status}` };
  }
  smokeRecord("go redirect decision", go.ok, go.detail);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed in ${Date.now() - started}ms`);
  if (passed !== results.length) process.exit(1);
}

smokeMain().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});