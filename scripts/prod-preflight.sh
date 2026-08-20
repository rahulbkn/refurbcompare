#!/usr/bin/env bash
# Local end-to-end preflight for the production deployment topology.
# Uses a temp SQLite DB (PostgreSQL is only verifiable on CI/deployed infra
# since Prisma engines and PG cannot run on Termux).
set -uo pipefail

TMPD="$(mktemp -d "$HOME/.cache/opencode/tmp/refurb-preflight.XXXXXX")"
DB="$TMPD/preflight.db"
LOG1="$TMPD/demo.log"
LOG2="$TMPD/live.log"

cleanup() {
  pkill -f "apps/api/src/server.ts" 2>/dev/null || true
  rm -rf "$TMPD"
}
trap cleanup EXIT

export DATABASE_DRIVER=sqlite DATABASE_URL="file:$DB" QUEUE_DRIVER=memory \
  NODE_ENV=test ADMIN_API_KEY=preflight-key PORT=4020 HOST=127.0.0.1 \
  RATE_LIMIT_MAX=1000 SYNC_MOCK_PROVIDER=true

echo "== phase 1: demo seed =="
DATA_MODE=demo npx tsx apps/api/src/server.ts >"$LOG1" 2>&1 &
PID1=$!
for i in $(seq 1 40); do
  curl -sf http://127.0.0.1:4020/healthz >/dev/null 2>&1 && break
  sleep 0.5
done
echo "demo health: $(curl -s http://127.0.0.1:4020/healthz)"
echo "demo products: $(curl -s 'http://127.0.0.1:4020/api/v1/products?pageSize=5' | head -c 120)"
kill "$PID1" 2>/dev/null || true
sleep 1

echo "== phase 2: same db, live mode =="
DATA_MODE=live npx tsx apps/api/src/server.ts >"$LOG2" 2>&1 &
PID2=$!
for i in $(seq 1 40); do
  curl -sf http://127.0.0.1:4020/healthz >/dev/null 2>&1 && break
  sleep 0.5
  if ! kill -0 "$PID2" 2>/dev/null; then echo "server exited early: $(tail -3 "$LOG2")"; exit 1; fi
done
echo "live health: $(curl -s http://127.0.0.1:4020/healthz)"
echo "live products: $(curl -s 'http://127.0.0.1:4020/api/v1/products?pageSize=5' | head -c 120)"
echo "live cashify offers: $(curl -s 'http://127.0.0.1:4020/api/v1/products/apple-iphone-13-128gb/listings' | head -c 120)"

echo "== phase 3: smoke test =="
SMOKE_BASE_URL=http://127.0.0.1:4020 npx tsx scripts/production-smoke-test.ts
SMOKE_RC=$?
kill "$PID2" 2>/dev/null || true
exit $SMOKE_RC