# Journal des changements

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le
projet suit [SemVer](https://semver.org/lang/fr/).

## [0.1.0] — 2026-11-12

### Ajouté

- **Le produit.** Banc — le banc d'essai d'agents Rovo : trois formes d'oracle
  (valeur dérivée, règle vivante, refus attendu), huit jauges avec effectif,
  fourchette et plancher, une porte de promotion, et la distinction entre
  régression de l'agent et dérive de vérité.
- **Le domaine partagé** (`src/domain/`) : cinq modules sans cycle, un baril,
  et l'honnêteté du §25 encodée dans les types.
- **Le recalcul de la vérité** (`src/oracle/`) : valeur dérivée recalculée
  depuis les systèmes, règle vivante évaluée par prédicat, refus attendu
  classé de façon déterministe, oracles morts distingués par cause
  (« pas de droit » ≠ « pas de données »), historique de vérité et dérive.
- **Les huit jauges** (`src/judge/`) : exactitude, fondation, citation
  vivante, exactitude de règle, refus correct, complétude, stabilité, coût —
  indépendantes, chacune avec sa preuve.
- **Le moteur d'essai** (`src/run/`) : k passages, rejet précoce des échecs
  triviaux, fissures avec attribution, modes blanc et noir rapportés
  séparément, condition figée et horodatée, invalidation sur dérive
  d'empreinte, budget qui arrête l'essai en le disant, journal rejouable,
  exécution par tranches avec curseur.
- **Le scoring** (`src/score/`) : intervalles de Wilson, planchers par jauge,
  scorecards avec écarts au témoin, classification régression / dérive /
  progrès, porte de promotion à cinq règles, jury humain et calibrage.
- **La persistance** (`src/db/`) : les 16 tables du §22, le mapping ligne SQL
  ↔ domaine, et un client SQL en mémoire pour les tests.
- **Les douze outils MCP** (`src/mcp/`) : la table du §19, la validation
  d'entrées, la garde d'autorisation, et un handler par outil.
- **La couche Forge** (`src/actions/`) : le resolver des douze écrans, le
  verrou de workflow de la porte, les déclencheurs, le consommateur d'essais
  longs.
- **Le banc de démonstration** (`src/seed/`) : 40 cas (15 valeurs dérivées,
  10 règles vivantes, 8 refus attendus, 7 amorces), trois versions d'agent
  dont la v4 comme témoin, les quatre suites, et une dérive de vérité datée.
- **L'interface** (`src/i18n/`) : français et anglais, avec un test de
  parité.
- **La skill** `SKILL.md` — `before-promoting-an-agent`, publiée en source
  ouverte.
- **Le manifeste Forge** : 18 modules, 12 outils MCP, 16 tables SQL, aucune
  image distante.
- **Le site public** et la documentation : parcours des jugés, architecture,
  honnêteté, recette, feuille de route, contribution.
- **146 tests**, dont les 22 points de recette du §27 rendus exécutables.

### Infrastructure

- Socle CI à 5 minutes : types, tests, gardes de taille (fichier < 500
  lignes, fonction < 50 lignes), manifeste, sanity docs, auto-tests Hermes.
- Garde `ci-budget` : échoue si un job déclare plus de 5 minutes.
- Garde `couche0` : périmètre déclaré dans le corps de PR, motifs interdits.
- **Hermes**, le résolveur de conflits : rebase, résolution (InferHub
  `combo/cheap` d'abord, repli 100 % déterministe ensuite), validation par la
  toolchain du dépôt, push `--force-with-lease` sur la seule branche de la PR,
  escalade à un humain quand le résultat n'est pas prouvable.
- Runner GitHub Actions `r630-banc-01` sur le R630, labels `banc-worker` et
  `banc-fast`.
- `main` protégé : checks requis `ci`, `ci-budget`, `couche0` ; Mergify
  fusionne, jamais de push direct.
