#!/usr/bin/env bash
# Mise en ligne du serveur vocal Callpme sur Fly.io, puis branchement de l'application Vercel.
#
# Prérequis (une seule fois) :
#   1. Compte Fly.io + CLI :  powershell -c "iwr https://fly.io/install.ps1 -useb | iex"
#      puis :                 fly auth login
#   2. DEEPGRAM_API_KEY renseignée dans .env (transcription de l'appelant).
#
# Lancement depuis la racine du dépôt :  bash scripts/voix-en-ligne.sh
# Les secrets sont lus dans .env et .env.production.local et ne sont jamais affichés.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.fly/bin:$PATH"

APP="${VOICE_APP:-callpme-voix}"
CONFIG="voice-server/fly.toml"

val() { grep "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//' || true; }

command -v flyctl >/dev/null || { echo "CLI Fly.io absente. Installez-la : powershell -c \"iwr https://fly.io/install.ps1 -useb | iex\""; exit 1; }
flyctl auth whoami >/dev/null 2>&1 || { echo "Connectez-vous d'abord : fly auth login"; exit 1; }
[ -f .env.production.local ] || { echo "Fichier .env.production.local introuvable (lancez d'abord scripts/mise-en-ligne.sh)."; exit 1; }
[ -n "$(val DEEPGRAM_API_KEY .env)" ] || { echo "DEEPGRAM_API_KEY est vide dans .env : sans elle l'agent n'entend pas l'appelant."; exit 1; }

echo "Application Fly.io : $APP"
flyctl apps create "$APP" --org "${FLY_ORG:-personal}" >/dev/null 2>&1 && echo "  ✓ créée" || echo "  - existe déjà (ou nom pris : relancez avec VOICE_APP=autre-nom)"

# Processus long : pooler Supabase en mode session (port 5432), pas le mode transaction.
DB_SESSION="$(val DATABASE_URL .env | sed 's/:6543\/postgres?.*$/:5432\/postgres/')"

echo "Secrets du serveur vocal :"
{
  printf 'DATABASE_URL=%s\n' "$DB_SESSION"
  # Identiques à Vercel : ils signent les jetons de session vocale et chiffrent les identifiants.
  for k in NEXTAUTH_SECRET ENCRYPTION_KEY; do printf '%s=%s\n' "$k" "$(val "$k" .env.production.local)"; done
  printf 'PUBLIC_URL=%s\n' "${PROD_URL:-https://callpme-five.vercel.app}"
  for k in ANTHROPIC_API_KEY OPENAI_API_KEY MISTRAL_API_KEY DEEPGRAM_API_KEY ELEVENLABS_API_KEY CARTESIA_API_KEY \
           VOICE_TTS_PROVIDER VOICE_DEFAULT_FEMALE_ID VOICE_DEFAULT_MALE_ID \
           TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN RESEND_API_KEY RESEND_FROM; do
    v="$(val "$k" .env)"
    if [ -n "$v" ]; then printf '%s=%s\n' "$k" "$v"; fi
  done
} | flyctl secrets import -a "$APP" --stage >/dev/null
echo "  ✓ enregistrés"

echo "Déploiement (construction de l'image, quelques minutes)…"
flyctl deploy . -a "$APP" -c "$CONFIG" --dockerfile voice-server/Dockerfile --ha=false

URL="https://$APP.fly.dev"
echo "Sonde : $(curl -s "$URL/health" || echo 'pas de réponse')"

echo "Branchement de l'application Vercel…"
npx vercel env rm VOICE_SERVER_URL production --yes >/dev/null 2>&1 || true
printf '%s' "wss://$APP.fly.dev" | npx vercel env add VOICE_SERVER_URL production >/dev/null
npx vercel deploy --prod --yes >/dev/null
echo
echo "Serveur vocal en ligne : $URL  (application reliée : wss://$APP.fly.dev)"
