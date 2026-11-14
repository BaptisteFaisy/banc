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

---

## Le corpus RÉEL (2026-11-14) : le banc se bench lui-même

La démo en direct ne joue plus un monde inventé. Elle joue **le dépôt `banc`
lui-même** :

| | |
|---|---|
| Corpus | 19 fichiers exacts du dépôt (`manifest.yml`, les 9 workflows, `LICENSE`, `package.json`, `.mergify.yml`, `docs/RECETTE.md`, `docs/ROADMAP.md`, `README.md`, `SKILL.md`, `tsconfig.json`, `vitest.config.ts`) |
| Faits | les commits lus dans `git log` local ; les PR et les runs CI lus par le REST GitHub |
| Capture | `node tools/capture-real-corpus.mjs` → `src/real/corpus.json`, scellé par empreinte SHA-256 de l'ensemble |
| Cas | 16 questions réelles : 10 à valeur dérivée, 3 à règle vivante, 3 à refus attendu (dont une amorce à fausse citation) |

### Ce qui était un script, et comment il est mort

Trois choses faisaient semblant, et deux chiffres vedettes en découlaient :

1. **Le monde était fictif** (`src/seed/truth.ts` : « Tout est fictif ») — équipes
   et tickets inventés. Seul le *modèle* était réel.
2. **La réponse était versée à l'agent** : `contextOf()` injectait
   `JSON.stringify(oracle.value)` dans le prompt système, sur quatre adaptateurs.
   D'où **100 % d'exactitude** : le modèle recitait ce qu'on venait de lui donner.
3. **Les citations étaient décrétées mortes** : `extractCitations` rendait
   `resolved: null, alive: false` en dur. D'où **0 % de fondation** : un chiffre
   sans mesure. `src/judge/citation.ts` savait déjà distinguer *infondé* /
   *citation non vivante* / *fondé* — on la lui rend.

Le banc qui existe pour attraper les agents qui récitait récitait lui-même.

### Le circuit, maintenant

```
tour 1  prompt = rôle + règles de citation + INDEX des documents (ids et tailles, aucune valeur)
        l'agent répond soit « BESOIN: <chemin> » (un à quatre), soit nomme ce qui manque
tour 2  prompt = question + les documents RÉCLAMÉS, en pâture brute du corpus scellé
        l'agent répond en citant [source: <chemin>]
juge    la citation résout contre le corpus : document absent → infondé ;
        document présent mais ne contenant pas la valeur recalculée → citation non vivante ;
        sinon → fondé. Le fournisseur réellement servi est consigné par cas.
```

Le **mode blanc** (§12) verse d'emblée les documents de provenance du cas — la
valeur reste recalculée, jamais annoncée. `src/real/provenance.ts` porte le
mapping requête → fichiers, vérifié par test : une provenance inventée casse le
build.

### La garde qui rend le script impossible

`tests/real/no-script.test.ts` (25 tests) assert, pour chaque cas à valeur
dérivée :

- aucune valeur d'oracle n'apparaît dans le prompt de rôle ;
- au tour 1 en mode noir, l'agent n'a **aucun** bloc de document (`### `) ;
- aucun marqueur d'annonce (`réponse attendue`, `valeur attendue`, `oracle:`,
  `oracle =`) ne paraît, quel que soit le mode ;
- un agent qui ne demande rien ne lit rien (`toolCalls` vide, un seul appel) ;
- les trois verdicts de §8 sont atteignables (rien n'est constant) ;
- un document du corpus modifié sans recapture rompt le sceau et l'adaptateur
  **refuse** de servir (`corpus réel suspect`).

Le sceau hache les **bytes servis**, pas les champs d'auto-déclaration du JSON :
un `contenu` réécrit en douce sans toucher `empreinte` est détecté. C'est le
piège que `src/real/corpus.ts` ferme, et il était ouvert.

### Ce que la mesure réelle a trouvé (14/11, corpus du commit `6ca7f5b`)

Publié dans `site/public/real-run.json`, affiché sur la page. Les chiffres
bougent d'un run à l'autre : c'est le point — un agent réel n'est pas
déterministe, et le méta-routeur change de fournisseur entre deux appels
(`modeleservis` liste ceux qui ont réellement servi).

### Coût et limites, dits clairement

16 cas × 3 passages × jusqu'à 2 tours ≈ 96 appels ≈ 0,03 $ par run. Le bouton
« ▶ Run live now » existe pour ça : lancer un run au chargement de page ferait
payer la curiosité de chaque visiteur. Le quota reste de 200 appels/IP/jour.

Le corpus est une **capture**, pas un flux continu : entre deux captures, un
fichier du dépôt peut bouger sans que la mesure le sache. Le sceau le dirait si
la capture était refaite ; ce qui manque est le renouvellement automatique de la
capture (phase 2, §35 « banc continu »), pas un secret bien gardé.
