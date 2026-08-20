// OpenNext build configuration for the Cloudflare adapter.
//
// The frontend serves SSR-rendered pages and forwards API traffic to the
// external Fastify backend (Mode A). All dynamic data is fetched per request,
// so the default incremental cache (memory) is fine; an R2 bucket is wired up
// in wrangler.toml for when ISR/cache tags are enabled later.

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});