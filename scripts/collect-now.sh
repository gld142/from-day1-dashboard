#!/usr/bin/env bash
# Lance la collecte à la main contre le serveur local (par défaut http://localhost:3004),
# comme Vercel Cron le fera chaque nuit. Affiche le résumé, jamais le secret.
# Usage : bash scripts/collect-now.sh [url-de-base]
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=${1:-http://localhost:3004}
SECRET=$(grep -E '^CRON_SECRET=' .env.local | tail -1 | cut -d= -f2-)
[ -n "$SECRET" ] || { echo "✗ CRON_SECRET absent : lancer scripts/setup-cron-secret.sh"; exit 1; }
curl -sS -m 320 -H "Authorization: Bearer $SECRET" -w "\nHTTP %{http_code} en %{time_total}s\n" "$BASE/api/cron/collect"
