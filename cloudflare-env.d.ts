// Shared Cloudflare Worker bindings for the RefurbCompare deployment.
//
// In wrangler, `[vars]` become plain strings and `wrangler secret put` values
// are injected at runtime. `CloudflareEnv` mirrors wrangler.toml /
// wrangler.cron.toml so worker code type-checks without casting process.env.
//
// Mode A server-only vars must NOT be marked to be shared to the client.

declare global {
  interface CloudflareEnv {
    // Frontend (Next.js app) — mostly mirrored into process.env by OpenNext.
    NEXT_PUBLIC_APP_URL: string;
    NEXT_PUBLIC_DEMO_MODE: string;
    FRONTEND_ORIGIN?: string;

    // Mode A — server-only. Configure via `wrangler secret put`.
    EXTERNAL_API_URL: string;
    API_INTERNAL_TOKEN?: string;
    API_MODE?: "external" | "hyperdrive";
    EXTERNAL_API_TIMEOUT_MS?: string;

    // Cron worker.
    SYNC_PROVIDERS?: string; // comma-separated provider slugs
    SYNC_MODE?: string; // "full" | "incremental" (default "incremental")

    // Surfaces provided by wrangler.
    ASSETS: Fetcher;
    WORKER_SELF_REFERENCE: Fetcher;
    NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
    HYPERDRIVE?: Hyperdrive;
  }
}

export {};