#!/usr/bin/env bash
# Ajoute la clé Stripe de TEST (sk_test_… ou rk_test_…) dans .env.local, sans l'afficher, puis
# vérifie auprès de Stripe qu'elle marche et qu'elle est bien en mode test.
# Les clés « live » (sk_live_, rk_live_) sont refusées : en local, on ne touche
# jamais à de l'argent réel.
#
# Usage : bash scripts/setup-stripe-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || { echo "✗ $ENV_FILE introuvable dans $(pwd)"; exit 1; }

echo
echo "Colle la clé Stripe de TEST (elle commence par sk_test_ ou rk_test_), puis Entrée."
echo "Rien ne s'affiche pendant le collage : c'est normal."
read -rs KEY_INPUT
echo
case "$KEY_INPUT" in
  sk_test_*|rk_test_*) ;;
  *_live_*) echo "✗ C'est une clé LIVE (argent réel) : refusée. Active le mode test dans Stripe et prends la clé sk_test_."; exit 1 ;;
  *) echo "✗ Ça ne ressemble pas à une clé de test Stripe (sk_test_…). Relance la commande."; exit 1 ;;
esac

K="$KEY_INPUT" ENV_FILE="$ENV_FILE" python3 - <<'PY'
import os
path, value = os.environ["ENV_FILE"], os.environ["K"]
lines = open(path).read().splitlines()
for i, line in enumerate(lines):
    if line.startswith("STRIPE_SECRET_KEY="):
        lines[i] = f"STRIPE_SECRET_KEY={value}"
        break
else:
    lines += ["", "# Stripe — clé de TEST uniquement (sk_test_), remplie par scripts/setup-stripe-env.sh", f"STRIPE_SECRET_KEY={value}"]
open(path, "w").write("\n".join(lines) + "\n")
PY
unset KEY_INPUT

KEY=$(grep -E '^STRIPE_SECRET_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2-)
reply=$(printf 'user = "%s:"\n' "$KEY" | curl -s -K - https://api.stripe.com/v1/balance)
if echo "$reply" | grep -q '"livemode": false'; then
  echo "✓ Clé Stripe de test : valide"
  echo
  echo "C'est bon. Tu peux dire « c'est fait » à Claude."
else
  echo "✗ Stripe a refusé la clé. Recopie-la et relance la commande."
  exit 1
fi
