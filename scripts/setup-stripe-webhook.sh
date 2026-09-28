#!/usr/bin/env bash
# À lancer au déploiement : déclare chez Stripe le webhook de l'app en ligne,
# puis affiche le secret de signature à mettre sur Vercel (STRIPE_WEBHOOK_SECRET).
# Utilise la clé STRIPE_SECRET_KEY de .env.local (test ou live selon la clé).
#
# Usage : bash scripts/setup-stripe-webhook.sh https://ton-domaine.fr
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${1:-}"
case "$BASE" in https://*) ;; *) echo "Usage : bash scripts/setup-stripe-webhook.sh https://ton-domaine.fr"; exit 1 ;; esac
KEY=$(grep -E '^STRIPE_SECRET_KEY=' .env.local | tail -1 | cut -d= -f2-)
[ -n "$KEY" ] || { echo "✗ STRIPE_SECRET_KEY vide dans .env.local"; exit 1; }

reply=$(printf 'user = "%s:"\n' "$KEY" | curl -s -K - https://api.stripe.com/v1/webhook_endpoints \
  -d "url=${BASE%/}/api/stripe/webhook" \
  -d "description=Day 1 Pro — comptes et abonnements" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted")
secret=$(echo "$reply" | python3 -c "import sys,json; print(json.load(sys.stdin).get('secret',''))")
[ -n "$secret" ] || { echo "✗ Stripe a refusé : $(echo "$reply" | head -c 300)"; exit 1; }
echo "✓ Webhook déclaré : ${BASE%/}/api/stripe/webhook"
echo
echo "Ajoute ce secret sur Vercel (Settings → Environment Variables → STRIPE_WEBHOOK_SECRET) :"
echo "$secret"
