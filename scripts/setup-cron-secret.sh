#!/usr/bin/env bash
# Crée CRON_SECRET dans .env.local (secret de la collecte de la nuit), sans l'afficher.
# En ligne : mettre la MÊME valeur dans les variables d'environnement du projet
# Vercel (Vercel l'envoie alors à /api/cron/collect dans l'en-tête Authorization).
set -euo pipefail
cd "$(dirname "$0")/.."
if grep -qE '^CRON_SECRET=.+' .env.local 2>/dev/null; then
  echo "✓ CRON_SECRET déjà présent dans .env.local (inchangé)"
  exit 0
fi
printf '\nCRON_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
echo "✓ CRON_SECRET ajouté à .env.local (non affiché)"
