#!/usr/bin/env bash
# Applique à la base Supabase (SUPABASE_DB_URL dans .env.local) les migrations de
# supabase/migrations/ qui n'y sont pas encore, chacune dans une transaction.
# Le suivi utilise la même table que la CLI Supabase
# (supabase_migrations.schema_migrations) : on pourra passer à la CLI plus tard.
#
# Usage : bash scripts/db-migrate.sh            applique ce qui manque
#         bash scripts/db-migrate.sh --status   liste sans rien appliquer
set -euo pipefail
cd "$(dirname "$0")/.."

DB=$(grep -E '^SUPABASE_DB_URL=' .env.local | tail -1 | cut -d= -f2-)
[ -n "$DB" ] || { echo "✗ SUPABASE_DB_URL vide dans .env.local (lancer scripts/setup-supabase-env.sh)"; exit 1; }
q() { psql "$DB" -X -q -v ON_ERROR_STOP=1 "$@"; }

q -c "create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations
        (version text primary key, statements text[], name text);"

for file in supabase/migrations/*.sql; do
  base=$(basename "$file" .sql)
  version=${base%%_*}
  name=${base#*_}
  if [ -n "$(q -tAc "select 1 from supabase_migrations.schema_migrations where version = '$version'")" ]; then
    echo "  déjà appliquée  $base"
    continue
  fi
  if [ "${1:-}" = "--status" ]; then
    echo "  À APPLIQUER     $base"
    continue
  fi
  q --single-transaction -f "$file" \
    -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
  echo "✓ appliquée       $base"
done
