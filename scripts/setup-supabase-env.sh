#!/usr/bin/env bash
# Remplit .env.local avec la clé secrète Supabase et l'accès direct à la base
# (projet day1-pro), puis vérifie les deux. Les valeurs tapées ne s'affichent
# pas, ne passent jamais en argument de commande et ne sont pas écrites ailleurs
# que dans .env.local (ignoré par git).
#
# Usage : bash scripts/setup-supabase-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

REF="tzjgcyqlxbczeoeqgolh"
POOLER="aws-1-eu-west-3.pooler.supabase.com" # session pooler du projet, région Paris
ENV_FILE=".env.local"

[ -f "$ENV_FILE" ] || { echo "✗ $ENV_FILE introuvable dans $(pwd)"; exit 1; }

echo
echo "1/2 — Colle la clé secrète Supabase (elle commence par sb_secret_), puis Entrée."
echo "      Rien ne s'affiche pendant le collage : c'est normal."
read -rs SECRET_INPUT
echo
case "$SECRET_INPUT" in
  sb_secret_*) ;;
  *) echo "✗ Ça ne ressemble pas à une clé secrète (sb_secret_…). Relance la commande."; exit 1 ;;
esac

echo "2/2 — Tape le mot de passe de la base de données, puis Entrée (rien ne s'affiche non plus)."
read -rs PASSWORD_INPUT
echo
[ -n "$PASSWORD_INPUT" ] || { echo "✗ Mot de passe vide. Relance la commande."; exit 1; }

SK="$SECRET_INPUT" PW="$PASSWORD_INPUT" REF="$REF" POOLER="$POOLER" ENV_FILE="$ENV_FILE" python3 - <<'PY'
import os, urllib.parse
path = os.environ["ENV_FILE"]
db_url = "postgresql://postgres.{ref}:{pw}@{host}:5432/postgres".format(
    ref=os.environ["REF"],
    pw=urllib.parse.quote(os.environ["PW"], safe=""),
    host=os.environ["POOLER"],
)
values = {"SUPABASE_SECRET_KEY": os.environ["SK"], "SUPABASE_DB_URL": db_url}
lines = open(path).read().splitlines()
for key, value in values.items():
    for i, line in enumerate(lines):
        if line.startswith(key + "="):
            lines[i] = f"{key}={value}"
            break
    else:
        lines.append(f"{key}={value}")
open(path, "w").write("\n".join(lines) + "\n")
PY
unset SECRET_INPUT PASSWORD_INPUT

val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }

if PGCONNECT_TIMEOUT=10 psql "$(val SUPABASE_DB_URL)" -X -tAc "select 1" >/dev/null 2>&1; then
  echo "✓ Base de données : connexion réussie"
else
  echo "✗ Base de données : connexion refusée. Vérifie le mot de passe et relance la commande."
  exit 1
fi

code=$(printf 'header = "apikey: %s"\n' "$(val SUPABASE_SECRET_KEY)" |
  curl -s -o /dev/null -w '%{http_code}' -K - "$(val NEXT_PUBLIC_SUPABASE_URL)/rest/v1/leads?select=id&limit=1")
if [ "$code" = "200" ]; then
  echo "✓ Clé secrète : valide"
else
  echo "✗ Clé secrète refusée (code $code). Recopie-la et relance la commande."
  exit 1
fi

echo
echo "C'est bon. Tu peux dire « c'est fait » à Claude."
