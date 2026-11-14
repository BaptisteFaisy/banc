#!/usr/bin/env bash
# Superviseur de tunnel Cloudflare « quick », pour les démos publiques du banc.
#
# Un quick tunnel n'a aucune garantie de disponibilité, et le piège vu sur le
# serveur le 2026-11-14 est pire qu'une coupure : quand Cloudflare efface le
# tunnel, `cloudflared` continue d'envoyer le MÊME identifiant et tourne en
# boucle sur « Unauthorized: Tunnel not found ». Le process est vivant, le
# port écoute, l'unité systemd est « active » — et l'URL publique est morte
# depuis des heures, sans que personne ne le voie.
#
# Ce script fait une seule chose : quand le tunnel ne va plus, il en crée un
# NOUVEAU (donc une URL neuve), écrit cette URL dans un fichier d'état, puis
# appelle un crochet pour la republier. Tout est paramétré — un nom, un port,
# un fichier, un crochet — donc la même mécanique sert à n'importe quel quick
# tunnel du serveur, sans copie.
#
# Usage : cloudflared-watch.sh <nom> <port> <fichier-url> [crochet]
set -uo pipefail

NOM="${1:?nom du tunnel manquant}"
PORT="${2:?port local manquant}"
FICHIER_URL="${3:?fichier d URL manquant}"
CROCHET="${4:-}"

CLOUDFLARED="${CLOUDFLARED:-/home/baptiste/tools/cloudflared}"
DELAI_URL_S="${DELAI_URL_S:-40}"
DELAI_RELANCE_S="${DELAI_RELANCE_S:-3}"
URL_REGEX='https://[a-z0-9-]+\.trycloudflare\.com'

journal_msg() { printf '%s [%s] %s\n' "$(date -Is)" "$NOM" "$*"; }

# Première URL publique présente dans le journal du tunnel, sinon rien.
extraire_url() { grep -oE "$URL_REGEX" "$1" 2>/dev/null | head -n 1; }

# Le tunnel est-il mort côté Cloudflare (identifiant effacé) ?
desenregistre() { grep -q "Tunnel not found" "$1" 2>/dev/null; }

# Publie l URL courante : fichier d état d abord, crochet ensuite.
annoncer() {
  local url="$1" journal="$2" precedente=""
  [ -f "$FICHIER_URL" ] && precedente="$(cat "$FICHIER_URL")"
  if [ "$url" = "$precedente" ]; then return 0; fi
  mkdir -p "$(dirname "$FICHIER_URL")"
  printf '%s\n' "$url" >"$FICHIER_URL"
  journal_msg "URL publiée : $url"
  [ -z "$CROCHET" ] && return 0
  if ! "$CROCHET" "$url" >>"$journal" 2>&1; then
    journal_msg "crochet de publication en échec (voir le journal)"
  fi
}

# Vie d un tunnel : démarrer, attendre l URL, surveiller, puis rendre la main.
surveiller() {
  local journal pid url="" i
  journal="$(mktemp)"
  "$CLOUDFLARED" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >"$journal" 2>&1 &
  pid=$!
  for ((i = 0; i < DELAI_URL_S; i++)); do
    url="$(extraire_url "$journal")"
    [ -n "$url" ] && break
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  if [ -n "$url" ]; then
    annoncer "$url" "$journal"
  else
    journal_msg "aucune URL obtenue en ${DELAI_URL_S}s — le tunnel est relancé"
  fi
  while kill -0 "$pid" 2>/dev/null; do
    desenregistre "$journal" && { journal_msg "tunnel désenregistré côté Cloudflare — relance"; break; }
    sleep 5
  done
  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  rm -f "$journal"
  sleep "$DELAI_RELANCE_S"
}

mkdir -p "$(dirname "$FICHIER_URL")"
journal_msg "superviseur démarré (port $PORT, fichier $FICHIER_URL)"
while true; do
  surveiller
done
