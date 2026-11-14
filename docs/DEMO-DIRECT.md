# La démo en direct — comment elle tient debout

Le site public du banc ne récite pas des chiffres : il **exécute le banc**. Deux
modes coexistent, et c'est le second qui coûte à maintenir.

| Mode | Où ça tourne | Clé InferHub | Ce que le visiteur voit |
|---|---|---|---|
| Enregistré | `npm run demo:real` (CLI, serveur) | lisible dans l'environnement | `site/public/real-run.json`, chargé à l'ouverture |
| **Direct** | dans le navigateur du visiteur | **jamais** — elle reste sur r630 | un run réel, cas après cas, devant lui |

Le mode direct impose une règle non négociable : **la clé ne sort pas**. Un site
statique embarquerait la clé dans son bundle, donc l'appel passe par un proxy
posé sur r630, exposé par un tunnel Cloudflare, et le navigateur ne parle qu'au
proxy.

```
navigateur ──POST /api/chat──▶ proxy r630 (:8830) ──Bearer clé──▶ InferHub combo/cheap
    (aucune clé)                  (seul détenteur de la clé)         (vrai modèle)
```

- `server/banc-proxy.mjs` — 133 lignes, stdlib Node, CORS restreint aux origines
  du banc, quota par IP et par jour, jamais la clé dans les journaux.
- `GET /api/health` — la sonde : 200 sans clé, c'est ce que le site teste avant
  d'afficher « proxy online ».

## Le piège réel (2026-11-14)

Un tunnel « quick » Cloudflare n'a aucune garantie de disponibilité. Ce qui est
arrivé, mesuré sur le serveur :

1. Cloudflare efface le tunnel ;
2. `cloudflared` continue d'envoyer **le même identifiant** et boucle sur
   `Unauthorized: Tunnel not found` ;
3. le process est vivant, le port écoute, l'unité systemd est `active` ;
4. l'URL publique est morte depuis des heures, et le fichier `banc-proxy.json`
   cuite dans le bundle pointe dessus.

Un moniteur qui regarde « le service est-il démarré ? » ne voit rien. Ce qui
compte, c'est : **l'URL publique répond-elle ?**

## Les trois mécaniques de réparation

1. **Superviseur de tunnel** — `server/cloudflared-watch.sh` : démarrera un
   tunnel **nouveau** (donc une URL neuve) dès que Cloudflare désenregistre
   l'ancien, écrira l'URL dans `~/banc-tunnel/url`, et appellera le crochet de
   publication. Paramétré par nom/port/fichier : la même mécanique sert à
   n'importe quel quick tunnel du serveur, sans copie.
2. **Publication de l'URL** — `server/banc-publish-url.sh` : écrit l'URL
   courante dans `site/public/banc-proxy.json` sur la branche **`live`** du
   dépôt. Une branche dédiée, pas `main` : pas de CI, pas de redéploiement du
   site, pas de bruit dans l'historique — et l'URL est fraîche en quelques
   secondes.
3. **Découverte résiliente côté site** — `site/src/proxy-resolve.ts` : le
   navigateur lit d'abord l'URL publiée sur `live` (via `raw.githubusercontent`,
   cachée-bustée), puis l'URL cuite dans le bundle, puis son cache local ; il
   **sonde** chaque candidate et n'utilise que celle qui répond. Et comme
   `src/demo/proxy-endpoint.ts` garde la liste des candidates, chaque appel du
   run peut basculer sur la suivante : un tunnel refait au milieu d'un banc de
   36 appels ne condamne pas la mesure.

## Vérifier, de bout en bout

```bash
# sur r630 : l'URL vivante, et le proxy derrière
cat ~/banc-tunnel/url
curl -s "$(cat ~/banc-tunnel/url)/api/health"

# l'URL telle que le site la lit
curl -s https://raw.githubusercontent.com/Tradoooo/banc/live/site/public/banc-proxy.json

# un appel réel, la clé ne quitte pas le serveur
curl -s -X POST "$(cat ~/banc-tunnel/url)/api/chat" -H 'Content-Type: application/json' \
  -d '{"system":"Une phrase.","user":"Bonjour."}'
```

Côté site, la section « Real environment » affiche une pastille d'état du proxy
(`proxy online` / `proxy offline` / `proxy: probing`) — un mot et un glyphe,
jamais la couleur seule — et l'URL retenue. Le bouton « ▶ Run live now » joue le
banc devant le visiteur ; si le proxy est mort, le message nomme la cause au
lieu d'échouer en silence.

## Ce que ça coûte, et ce que ça ne promet pas

Un run direct, c'est 36 appels réels (~3 minutes, ~0,01 $). Le bouton existe
pour ça : lancer un run au chargement de la page ferait payer des appels à
chaque visiteur et brûlerait le quota. Le quota par IP et par jour (200 appels)
borne l'abus.

Le tunnel reste un service gratuit sans engagement de disponibilité : la
mécanique rend la panne **visible et auto-réparée**, pas impossible. Un jour,
un tunnel nommé derrière un compte Cloudflare (URL stable) remplacera ce
montage — c'est le §35 « banc continu », pas une dette cachée.
