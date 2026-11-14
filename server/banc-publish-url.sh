#!/usr/bin/env bash
# Publie l'URL vivante du proxy du banc, là où le site sait la lire.
#
# Le site est statique : une URL cuite dans le bundle meurt avec le tunnel. Ce
# script écrit donc l'URL courante dans `site/public/banc-proxy.json`, mais sur
# la branche **`live`** du dépôt et non sur `main` : pas de CI, pas de
# redéploiement, pas de bruit dans l'historique — et le site lit cette URL
# fraîche au moment où le visiteur clique (le fichier cuit dans le bundle ne
# sert plus que de repli).
#
# Requiert : `gh` authentifié sur le dépôt (le serveur l'a), un fichier
# d'URL écrit par le superviseur du tunnel. Idempotent : aucune écriture
# quand le contenu distant est déjà celui-là.
#
# Usage : banc-publish-url.sh [url]   (sinon, lue dans $FICHIER_URL)
set -uo pipefail

REPO="${REPO:-Tradoooo/banc}"
BRANCHE="${BRANCHE:-live}"
CHEMIN="${CHEMIN:-site/public/banc-proxy.json}"
FICHIER_URL="${FICHIER_URL:-$HOME/banc-tunnel/url}"
GH="${GH:-$HOME/bin/gh}"
JOURNAL="${JOURNAL:-$HOME/banc-tunnel/publish.log}"

trace() { printf '%s [publish] %s\n' "$(date -Is)" "$*" | tee -a "$JOURNAL"; }

url_courante() {
  local url="${1:-}"
  [ -z "$url" ] && [ -f "$FICHIER_URL" ] && url="$(cat "$FICHIER_URL")"
  printf '%s' "${url//[[:space:]]/}"
}

# Crée la branche `live` depuis `main` si elle n'existe pas encore.
garantir_branche() {
  "$GH" api "repos/$REPO/branches/$BRANCHE" >/dev/null 2>&1 && return 0
  local sha
  sha="$("$GH" api "repos/$REPO/git/ref/heads/main" --jq .object.sha)"
  "$GH" api --method POST "repos/$REPO/git/refs" \
    -f ref="refs/heads/$BRANCHE" -f sha="$sha" >/dev/null
  trace "branche $BRANCHE créée depuis main"
}

# Le contenu distant actuel, vide si le fichier n'existe pas.
contenu_distal() {
  "$GH" api "repos/$REPO/contents/$CHEMIN?ref=$BRANCHE" --jq .content 2>/dev/null \
    | base64 -d 2>/dev/null | tr -d '[:space:]'
}

publier() {
  local url="$1" voulu distant sha payload
  voulu="{\"url\":\"$url\"}"
  distant="$(contenu_distal)"
  if [ "$distant" = "$(printf '%s' "$voulu" | tr -d '[:space:]')" ]; then
    trace "URL déjà publiée : $url"
    return 0
  fi
  sha="$("$GH" api "repos/$REPO/contents/$CHEMIN?ref=$BRANCHE" --jq .sha 2>/dev/null || true)"
  payload="$(printf '{"message":"Live: publie %s","content":"%s","branch":"%s"}' \
    "$url" "$(printf '%s' "$voulu" | base64 -w0)" "$BRANCHE")"
  [ -n "$sha" ] && payload="${payload%\}},\"sha\":\"$sha\"}"
  printf '%s' "$payload" | "$GH" api --method PUT "repos/$REPO/contents/$CHEMIN" --input - >/dev/null
  trace "URL publiée sur $BRANCHE : $url"
}

main() {
  local url; url="$(url_courante "${1:-}")"
  if [ -z "$url" ]; then trace "aucune URL à publier ($FICHIER_URL absent)"; exit 1; fi
  garantir_branche
  publier "$url"
}

main "$@"
