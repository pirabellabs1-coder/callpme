#!/usr/bin/env bash
# Saisie des clés GeniusPay : rien ne s'affiche pendant la frappe, rien n'est
# imprimé. Les clés sont écrites dans .env (ignoré par git), puis copiées vers
# Vercel par scripts/paiements-en-ligne.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
touch .env

ask() {
  local key="$1" label="$2" value=""
  while [ -z "$value" ]; do
    printf '%s : ' "$label"
    IFS= read -rs value
    echo
    value="$(printf '%s' "$value" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    [ -z "$value" ] && echo "  (vide, recommencez)"
  done
  # Remplace la ligne existante ou l'ajoute, sans jamais afficher la valeur.
  grep -v "^${key}=" .env > .env.tmp || true
  printf '%s=%s\n' "$key" "$value" >> .env.tmp
  mv .env.tmp .env
  echo "  ✓ ${key} enregistrée"
}

echo "Collez chaque clé puis appuyez sur Entrée (la saisie reste invisible)."
echo
ask GENIUS_PAY_API_KEY "Clé publique (pk_sandbox_… ou pk_live_…)"
ask GENIUS_PAY_API_SECRET "Clé secrète (sk_sandbox_… ou sk_live_…)"
ask GENIUS_PAY_WEBHOOK_SECRET "Secret du webhook (whsec_…)"
echo
echo "Envoi des clés vers le site en ligne…"
bash scripts/paiements-en-ligne.sh
