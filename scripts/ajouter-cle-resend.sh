#!/usr/bin/env bash
# Branche l'envoi des e-mails (Resend) : bienvenue, reçus et factures,
# réinitialisation de mot de passe, invitations, rappels d'échéance…
#
# Avant de lancer : dans Resend (https://resend.com/domains), ajoutez le domaine
# callpme.com et recopiez les enregistrements DNS demandés dans Cloudflare,
# puis créez une clé API (https://resend.com/api-keys, accès « Sending »).
#
# La clé est saisie sans s'afficher, écrite dans .env (ignoré par git), puis
# copiée vers Vercel (site) et Fly (serveur vocal) sans être imprimée.
set -euo pipefail
cd "$(dirname "$0")/.."
touch .env

set_env() { # set_env NOM VALEUR → remplace ou ajoute la ligne dans .env
  grep -v "^$1=" .env > .env.tmp || true
  printf '%s=%s\n' "$1" "$2" >> .env.tmp
  mv .env.tmp .env
}

key=""
while [ -z "$key" ]; do
  printf 'Clé API Resend (re_…) : '
  IFS= read -rs key
  echo
  key="$(printf '%s' "$key" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
done
set_env RESEND_API_KEY "$key"
echo "  ✓ RESEND_API_KEY enregistrée"

printf 'Adresse d'"'"'expédition [Callpme <bonjour@callpme.com>] : '
IFS= read -r from
from="${from:-Callpme <bonjour@callpme.com>}"
set_env RESEND_FROM "$from"
echo "  ✓ RESEND_FROM : $from"

echo
echo "Envoi vers le site (Vercel)…"
for k in RESEND_API_KEY RESEND_FROM; do
  v="$(grep "^$k=" .env | head -1 | cut -d= -f2-)"
  npx vercel env rm "$k" production --yes >/dev/null 2>&1 || true
  printf "%s" "$v" | timeout 120 npx vercel env add "$k" production >/dev/null 2>&1 || echo "  ! $k : envoi à refaire"
  echo "  ✓ $k"
done
unset v key

if command -v flyctl >/dev/null 2>&1 || [ -x "$HOME/.fly/bin/flyctl" ]; then
  echo "Envoi vers le serveur vocal (Fly)…"
  FLY="$(command -v flyctl || echo "$HOME/.fly/bin/flyctl")"
  grep -E '^(RESEND_API_KEY|RESEND_FROM)=' .env | "$FLY" secrets import -a callpme-voix >/dev/null && echo "  ✓ serveur vocal"
fi

echo
echo "Redéploiement du site…"
npx vercel deploy --prod --yes >/dev/null && echo "  ✓ site en ligne avec l'envoi d'e-mails"
