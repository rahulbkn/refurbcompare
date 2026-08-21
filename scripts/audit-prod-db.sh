#!/usr/bin/env bash
# Read-only production DB audit. Uses RENDER_DATABASE_URL from environment.
# Exits non-zero if any invariant fails. Never prints secrets.
set -euo pipefail

if [ -z "${RENDER_DATABASE_URL:-}" ]; then
  echo "ERROR: RENDER_DATABASE_URL is not set."
  exit 2
fi

PSQL="psql \"$RENDER_DATABASE_URL\" -t -A -q"

echo "============================================"
echo "  RefurbMeter Production DB Audit"
echo "  $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "============================================"
echo ""

FAIL=0

run() {
  local label="$1" query="$2"
  local result
  result=$(psql "$RENDER_DATABASE_URL" -t -A -q -c "$query" 2>&1) || {
    echo "  QUERY ERROR: $label"
    echo "  $result"
    FAIL=1
    return
  }
  echo "  $label: $result"
}

# 1. Total Product count
echo "--- 1. Products ---"
run "Total" "SELECT count(*) FROM \"Product\";"

# 2. Total Listing count
echo ""
echo "--- 2. Listings ---"
run "Total" "SELECT count(*) FROM \"Listing\";"
run "In-stock" "SELECT count(*) FROM \"Listing\" WHERE \"stockStatus\" = 'IN_STOCK' AND \"archivedAt\" IS NULL;"

# 4. Listings grouped by provider
echo ""
echo "--- 4. Listings by provider ---"
psql "$RENDER_DATABASE_URL" -t -A -q -c "
  SELECT p.\"name\" || ' (' || p.\"slug\" || '): ' || count(l.*) || ' total, '
         || count(*) FILTER (WHERE l.\"stockStatus\" = 'IN_STOCK' AND l.\"archivedAt\" IS NULL) || ' live'
  FROM \"Listing\" l
  JOIN \"Provider\" p ON p.\"id\" = l.\"providerId\"
  GROUP BY p.\"name\", p.\"slug\"
  ORDER BY count(l.*) DESC;
" 2>&1 | while IFS= read -r line; do echo "  $line"; done

# 5. Products with imageUrl
echo ""
echo "--- 5. Product images ---"
run "Products with imageUrl" "SELECT count(*) FROM \"Product\" WHERE \"imageUrl\" IS NOT NULL AND \"imageUrl\" != '';"
run "Products without imageUrl" "SELECT count(*) FROM \"Product\" WHERE \"imageUrl\" IS NULL OR \"imageUrl\" = '';"
echo "  Image coverage by provider of listings:"
psql "$RENDER_DATABASE_URL" -t -A -q -c "
  SELECT '    ' || p.\"name\" || ': products=' || count(DISTINCT pr.id)
         || ', with_image=' || count(DISTINCT pr.id) FILTER (WHERE pr.\"imageUrl\" IS NOT NULL AND pr.\"imageUrl\" != '')
         || ', listings=' || count(l.id)
  FROM \"Product\" pr
  JOIN \"Listing\" l ON l.\"productId\" = pr.id AND l.\"archivedAt\" IS NULL
  JOIN \"Provider\" p ON p.id = l.\"providerId\"
  GROUP BY p.\"name\" ORDER BY p.\"name\";
" 2>&1
echo "  Sample image hosts:"
psql "$RENDER_DATABASE_URL" -t -A -q -c "
  SELECT '    ' || host || ': ' || n FROM (
    SELECT split_part(substring(\"imageUrl\" from 9), '/', 1) AS host, count(*) AS n
    FROM \"Product\" WHERE \"imageUrl\" IS NOT NULL AND \"imageUrl\" != ''
    GROUP BY 1 ORDER BY n DESC LIMIT 5
  ) t;
" 2>&1

# 6. Products with at least one live listing
echo ""
echo "--- 6. Product listing coverage ---"
run "Products with >=1 live listing" "
  SELECT count(DISTINCT pr.\"id\")
  FROM \"Product\" pr
  JOIN \"Listing\" l ON l.\"productId\" = pr.\"id\"
  WHERE l.\"stockStatus\" = 'IN_STOCK' AND l.\"archivedAt\" IS NULL;
"
run "Products with ZERO live listings" "
  SELECT count(*)
  FROM \"Product\" pr
  WHERE NOT EXISTS (
    SELECT 1 FROM \"Listing\" l
    WHERE l.\"productId\" = pr.\"id\"
      AND l.\"stockStatus\" = 'IN_STOCK'
      AND l.\"archivedAt\" IS NULL
  );
"

# 7. Duplicate canonical slugs
echo ""
echo "--- 7. Duplicate slugs ---"
run "Duplicate slug count" "
  SELECT count(*) FROM (
    SELECT \"slug\" FROM \"Product\" GROUP BY \"slug\" HAVING count(*) > 1
  ) d;
"

# 8. Duplicate provider+sourceProductId
echo ""
echo "--- 8. Duplicate listing identities ---"
run "Duplicate (providerId, sourceProductId)" "
  SELECT count(*) FROM (
    SELECT \"providerId\", \"sourceProductId\"
    FROM \"Listing\"
    GROUP BY \"providerId\", \"sourceProductId\"
    HAVING count(*) > 1
  ) d;
"

# 9. Products created during latest sync (matchMethod or matchingMethod derived)
echo ""
echo "--- 9. Derived products (pipeline-created) ---"
run "Products with matchingMethod != 'EXACT_MODEL_NUMBER' (derived)" "
  SELECT count(*) FROM \"Product\"
  WHERE \"matchingMethod\" NOT IN ('EXACT_MODEL_NUMBER');
"
psql "$RENDER_DATABASE_URL" -t -A -q -c "
  SELECT '  ' || \"matchingMethod\" || ': ' || count(*)
  FROM \"Product\"
  GROUP BY \"matchingMethod\"
  ORDER BY count(*) DESC;
" 2>&1 | while IFS= read -r line; do echo "  $line"; done

# 10. PriceHistory
echo ""
echo "--- 10. PriceHistory ---"
run "Total points" "SELECT count(*) FROM \"PriceHistoryPoint\";"
psql "$RENDER_DATABASE_URL" -t -A -q -c "
  SELECT '  ' || p.\"name\" || ': ' || count(ph.*)
  FROM \"PriceHistoryPoint\" ph
  JOIN \"Listing\" l ON l.\"id\" = ph.\"listingId\"
  JOIN \"Provider\" p ON p.\"id\" = l.\"providerId\"
  GROUP BY p.\"name\"
  ORDER BY count(ph.*) DESC;
" 2>&1 | while IFS= read -r line; do echo "  $line"; done

# 11. Demo/test rows
echo ""
echo "--- 11. Demo/test rows in live DB ---"
run "Products with demo source listings" "
  SELECT count(DISTINCT l.\"productId\")
  FROM \"Listing\" l
  WHERE l.\"sourceProductId\" LIKE 'demo-%';
"
run "Listings with demo sourceProductId" "
  SELECT count(*) FROM \"Listing\" WHERE \"sourceProductId\" LIKE 'demo-%';
"
run "Products with zero non-demo listings" "
  SELECT count(*)
  FROM \"Product\" pr
  WHERE NOT EXISTS (
    SELECT 1 FROM \"Listing\" l
    WHERE l.\"productId\" = pr.\"id\"
      AND l.\"sourceProductId\" NOT LIKE 'demo-%'
  );
"

# 12. Provider status
echo ""
echo "--- 12. Provider status ---"
psql "$RENDER_DATABASE_URL" -t -A -q -c "
  SELECT '  ' || \"name\" || ' (' || \"slug\" || '): active=' || \"active\"
         || ', isDemo=' || \"isDemo\"
         || ', lastSync=' || coalesce(to_char(\"lastSyncAt\", 'YYYY-MM-DD HH24:MI'), 'null')
  FROM \"Provider\"
  ORDER BY \"name\";
" 2>&1 | while IFS= read -r line; do echo "  $line"; done

# 13. Variant separation check
echo ""
echo "--- 13. Variant analysis ---"
psql "$RENDER_DATABASE_URL" -t -A -q -c "
  SELECT '  ' || coalesce(\"variant\", '<null>') || ': ' || count(*)
  FROM \"Product\"
  GROUP BY \"variant\"
  ORDER BY count(*) DESC;
" 2>&1 | while IFS= read -r line; do echo "  $line"; done

# 14. Summary
echo ""
echo "--- 14. Summary ---"
run "Total live listings" "
  SELECT count(*) FROM \"Listing\"
  WHERE \"stockStatus\" = 'IN_STOCK' AND \"archivedAt\" IS NULL;
"
run "Products with live offers" "
  SELECT count(DISTINCT \"productId\") FROM \"Listing\"
  WHERE \"stockStatus\" = 'IN_STOCK' AND \"archivedAt\" IS NULL;
"
run "Products with imageUrl" "
  SELECT count(*) FROM \"Product\" WHERE \"imageUrl\" IS NOT NULL AND \"imageUrl\" != '';
"

echo ""
echo "============================================"
if [ "$FAIL" -ne 0 ]; then
  echo "  AUDIT FAILED — one or more queries errored"
  exit 1
else
  echo "  AUDIT COMPLETE"
  exit 0
fi
