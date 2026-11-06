#!/usr/bin/env bash
# Branche les paiements GeniusPay (V3, geniuspay.ci) sur la production Vercel.
#
# 1. Dans votre tableau de bord GeniusPay (https://geniuspay.ci/dashboard/settings?tab=api),
#    copiez vos clés et ajoutez-les dans le fichier .env (jamais dans le chat, jamais dans git) :
#      GENIUS_PAY_API_KEY=pk_sandbox_...      (pk_live_... pour encaisser pour de vrai)
#      GENIUS_PAY_API_SECRET=sk_sandbox_...
#      GENIUS_PAY_WEBHOOK_SECRET=whsec_...    (affiché une seule fois à la création du webhook)
#    Le webhook à créer chez GeniusPay pointe vers :
#      https://callpme.com/api/payments/geniuspay/webhook   (événements payment.*)
# 2. Lancez depuis la racine du projet :  bash scripts/paiements-en-ligne.sh
#
# Les valeurs sont copiées vers Vercel SANS être affichées, puis le site est redéployé.
set -euo pipefail
cd "$(dirname "$0")/.."

val() { grep "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//' || true; }

push() {
  local key="$1" value="$2"
  if [ -z "$value" ]; then echo "  - $key : absent de .env"; return 1; fi
  npx vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx vercel env add "$key" production >/dev/null
  echo "  ✓ $key"
}

missing=0
echo "Clés GeniusPay :"
for k in GENIUS_PAY_API_KEY GENIUS_PAY_API_SECRET GENIUS_PAY_WEBHOOK_SECRET; do
  if ! push "$k" "$(val "$k")"; then missing=1; fi
done
if [ "$missing" -eq 1 ]; then
  echo
  echo "Ajoutez les clés manquantes dans .env puis relancez le script."
  exit 1
fi

case "$(val GENIUS_PAY_API_KEY)" in
  pk_sandbox_*) echo "Mode TEST (sandbox) : les paiements sont simulés, rien n'est débité." ;;
  pk_live_*) echo "Mode RÉEL : les paiements seront vraiment débités." ;;
esac

echo
echo "Déploiement en production…"
npx vercel deploy --prod --yes
