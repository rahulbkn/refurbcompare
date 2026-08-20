// Mode A cron worker.
//
// On a schedule (`wrangler.cron.toml` -> [triggers] crons) this Worker asks the
// external Fastify backend to refresh its provider feeds, exactly like the
// backend's own scheduler would. It does not touch any database directly; it
// only forwards an admin request with the internal token.
//
//   POST {EXTERNAL_API_URL}/api/v1/admin/sync/:slug?mode=incremental&force=false
//   headers: X-Admin-Key: {API_INTERNAL_TOKEN}
//
// SYNC_PROVIDERS controls which providers are refreshed (default: cashify,
// budli, socialcommerce). In Mode B the backend runs in-process and this
// worker/cron is not used (the backend schedules itself).

declare global {
  interface CloudflareEnv {
    EXTERNAL_API_URL: string;
    API_INTERNAL_TOKEN?: string;
    SYNC_PROVIDERS?: string;
    SYNC_MODE?: string;
    CRON_AUTH_TOKEN?: string;
  }
}

const DEFAULT_PROVIDERS = ["cashify", "budli", "refit", "sahivalue", "mobilegoo"];

function isAuthorized(request: Request, env: CloudflareEnv): boolean {
  const secret = env.CRON_AUTH_TOKEN || env.API_INTERNAL_TOKEN || "";
  if (!secret) return false;
  const supplied = request.headers.get("x-cron-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!supplied) return false;
  try {
    const a = new TextEncoder().encode(secret);
    const b = new TextEncoder().encode(supplied);
    if (a.byteLength !== b.byteLength) return false;
    const cryptoObj = globalThis.crypto;
    const sa = new Uint8Array(a);
    const sb = new Uint8Array(b);
    const mx = Math.max(sa.length, sb.length);
    let diff = 0;
    for (let i = 0; i < mx; i++) {
      diff |= (sa[i % sa.length] ?? 0) ^ (sb[i % sb.length] ?? 0);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

function syncProviders(env: CloudflareEnv): string[] {
  const fromEnv = (env.SYNC_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_PROVIDERS;
}

async function triggerSync(env: CloudflareEnv): Promise<
  { provider: string; status: number }[]
> {
  if (!env.EXTERNAL_API_URL) {
    throw new Error("EXTERNAL_API_URL is not configured (Mode A cron).");
  }
  const base = env.EXTERNAL_API_URL.replace(/\/+$/, "");
  const mode = env.SYNC_MODE ?? "";
  const results: { provider: string; status: number }[] = [];

  for (const slug of syncProviders(env)) {
    const res = await fetch(
      `${base}/api/v1/admin/sync/${encodeURIComponent(slug)}?mode=${encodeURIComponent(mode)}&force=false`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": "refurbcompare-cron/1.0",
          ...(env.API_INTERNAL_TOKEN
            ? { "x-admin-key": env.API_INTERNAL_TOKEN }
            : {}),
        },
        body: JSON.stringify({ mode, force: "false" }),
      },
    );
    results.push({ provider: slug, status: res.status });
  }

  return results;
}

export default {
  /** Health check used by `wrangler dev` and uptime monitors. */
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/") {
      return Response.json({
        ok: true,
        worker: "refurbcompare-cron",
        mode: "external",
        configured: Boolean(env.EXTERNAL_API_URL),
      });
    }
    if (url.pathname === "/trigger") {
      if (!isAuthorized(request, env)) {
        return Response.json(
          { ok: false, error: "Unauthorized." },
          { status: 401 },
        );
      }
      try {
        const results = await triggerSync(env);
        return Response.json({ ok: true, results }, { status: 202 });
      } catch (err) {
        return Response.json(
          { ok: false, error: (err as Error).message },
          { status: 500 },
        );
      }
    }
    return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  },

  /** Cron entrypoint — refresh enabled provider feeds. */
  async scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          await triggerSync(env);
        } catch (err) {
          // Surface in `wrangler tail`; the schedule keeps running.
          console.error("[cron] sync failed:", err);
        }
      })(),
    );
    controller.noRetry();
  },
};