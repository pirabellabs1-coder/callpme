#!/usr/bin/env bash
# Mise en ligne de Callpme sur Vercel (projet « callpme » déjà relié dans .vercel/).
#
# Copie les variables de production vers Vercel SANS les afficher, puis déploie.
#   - secrets générés pour la prod : .env.production.local (ignoré par git)
#   - clés des fournisseurs et base : .env
# À lancer depuis la racine du projet :  bash scripts/mise-en-ligne.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PROD_URL="${PROD_URL:-https://callpme-eight.vercel.app}"

val() { grep "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//' || true; }

push() {
  local key="$1" value="$2"
  if [ -z "$value" ]; then echo "  - $key : absent, ignoré"; return; fi
  npx vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx vercel env add "$key" production >/dev/null
  echo "  ✓ $key"
}

[ -f .env.production.local ] || { echo "Fichier .env.production.local introuvable."; exit 1; }

echo "Variables de production :"
for k in NEXTAUTH_SECRET ENCRYPTION_KEY ADMIN_GATE_SLUG CRON_SECRET; do
  push "$k" "$(val "$k" .env.production.local)"
done
# Sur Vercel, une seule connexion par fonction (pooler Supabase en mode transaction).
push DATABASE_URL "$(val DATABASE_URL .env | sed 's/connection_limit=[0-9]*/connection_limit=1/')"
for k in ANTHROPIC_API_KEY OPENAI_API_KEY MISTRAL_API_KEY DEEPGRAM_API_KEY ELEVENLABS_API_KEY \
         TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN RESEND_API_KEY RESEND_FROM; do
  push "$k" "$(val "$k" .env)"
done
push PUBLIC_URL "$PROD_URL"

echo
echo "Déploiement en production…"
npx vercel deploy --prod --yes
echo
echo "En ligne : $PROD_URL"
echo "Espace d'administration : $PROD_URL/portail/<ADMIN_GATE_SLUG> (valeur dans .env.production.local)"
