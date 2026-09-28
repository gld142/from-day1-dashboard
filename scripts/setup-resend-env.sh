#!/usr/bin/env bash
# Branche l'envoi d'emails (connexion, invitations) sur Resend : range la clé API
# et l'adresse d'expédition dans .env.local, puis vérifie chez Resend que le
# domaine de l'adresse est bien validé (sinon les emails partiraient mal).
#
# Usage : bash scripts/setup-resend-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=".env.local"

echo
echo "1/2 — Colle la clé API Resend (elle commence par re_), puis Entrée (rien ne s'affiche)."
read -rs KEY_INPUT
echo
case "$KEY_INPUT" in re_*) ;; *) echo "✗ Ça ne ressemble pas à une clé Resend (re_…)."; exit 1 ;; esac

echo "2/2 — Adresse d'expédition, puis Entrée [Day 1 Pro <contact@from-day1.com>] :"
read -r FROM_INPUT
FROM_INPUT=${FROM_INPUT:-"Day 1 Pro <contact@from-day1.com>"}
DOMAIN=$(echo "$FROM_INPUT" | sed -E 's/.*@([^>]+)>?.*/\1/')

domains=$(printf 'header = "Authorization: Bearer %s"\n' "$KEY_INPUT" | curl -s -K - https://api.resend.com/domains)
status=$(echo "$domains" | D="$DOMAIN" python3 -c "
import sys, json, os
d = json.load(sys.stdin)
if 'data' not in d: print('refus'); sys.exit()
print(next((x.get('status') for x in d['data'] if x.get('name') == os.environ['D']), 'absent'))")
case "$status" in
  verified) ;;
  refus) echo "✗ Resend a refusé la clé. Recopie-la et relance."; exit 1 ;;
  *) echo "✗ Le domaine $DOMAIN n'est pas validé chez Resend (état : $status)."
     echo "  Resend → Domains → ajoute/valide $DOMAIN, puis relance."; exit 1 ;;
esac

K="$KEY_INPUT" F="$FROM_INPUT" ENV_FILE="$ENV_FILE" python3 - <<'PY'
import os
path = os.environ["ENV_FILE"]
values = {"RESEND_API_KEY": os.environ["K"], "RESEND_FROM_EMAIL": os.environ["F"]}
lines = [l for l in open(path).read().splitlines() if not any(l.startswith(k + "=") for k in values)]
lines += ["", "# Emails (connexion, invitations) — remplis par scripts/setup-resend-env.sh"] + [f"{k}={v}" for k, v in values.items()]
open(path, "w").write("\n".join(lines) + "\n")
PY
unset KEY_INPUT
echo "✓ Resend branché : les emails partiront de $FROM_INPUT"
echo
echo "C'est bon. Tu peux dire « c'est fait » à Claude."
