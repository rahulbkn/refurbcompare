// Local equivalent of the Mode A cron worker (workers/cron-sync.ts).
//
// On deployment the scheduled handler runs inside Cloudflare; on this machine
// we cannot run workerd, so this script triggers the same admin sync endpoint
// against EXTERNAL_API_URL. Useful for developing the sync wiring or running a
// manual refresh against a local backend.
//
//   EXTERNAL_API_URL=http://127.0.0.1:4000 API_INTERNAL_TOKEN=dev-admin-key \
//     npx tsx scripts/cf-cron-run.ts [provider1,provider2]

const base = process.env.EXTERNAL_API_URL ?? "http://127.0.0.1:4000";
const token = process.env.API_INTERNAL_TOKEN ?? "";
const mode = process.env.SYNC_MODE ?? "MOCK";
const providers =
  (process.env.SYNC_PROVIDERS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  ?? ["cashify", "budli", "socialcommerce"];

async function main() {
  console.log(`[cron] syncing providers into ${base} (mode=${mode})`);
  for (const slug of providers) {
    const res = await fetch(
      `${base}/api/v1/admin/sync/${encodeURIComponent(slug)}?mode=${encodeURIComponent(mode)}&force=false`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": "refurbcompare-cron/1.0 (local runner)",
          ...(token ? { "x-admin-key": token } : {}),
        },
        body: JSON.stringify({ mode, force: "false" }),
      },
    );
    const text = await res.text();
    console.log(`[cron] ${slug} -> ${res.status} ${text.slice(0, 200)}`);
  }
  console.log("[cron] done");
}

main().catch((err) => {
  console.error("[cron] failed:", err);
  process.exitCode = 1;
});