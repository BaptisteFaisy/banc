# Architecture de Banc

Banc est une app **Atlassian Forge** (TypeScript, `nodejs22.x`), Jira requis et
Confluence optionnel. Le principe qui organise tout le dépôt : **pur d'abord**.
Le domaine, les jauges, le score et la porte sont des fonctions pures ;
l'impur (SQL, API Atlassian, LLM) est isolé derrière un port injecté, avec un
stub en mémoire. Un test ne fait jamais d'appel réseau, et un essai est
rejouable.

---

## Le chemin d'un essai

```
question du cas
      │
      ▼
condition d'essai ── figée et horodatée (mode blanc : instantané fourni ;
      │                mode noir : l'agent cherche lui-même)
      ▼
k passages (3 par défaut) ── rejet précoce si réponse vide ou erreur d'outil
      │                        disqualification si effet de bord détecté
      ▼
oracle recalculé ── depuis le graphe / Jira / Confluence / JSM
      │              (cache par empreinte de contenu)
      ▼
huit jauges ── exactitude, fondation, citation vivante, règle, refus,
      │         complétude, stabilité, coût
      ▼
verdicts avec preuve ── réponse, oracle, sources, motifs
      │
      ▼
scorecard ── n, fourchette, plancher, écarts au témoin, taux d'oracles morts
      │
      ▼
porte de promotion ── cinq règles, motifs explicites, verrou de workflow
```

---

## Les modules

| Dossier | Rôle | Impur ? |
|---|---|---|
| `src/domain/` | les types partagés : cinq modules sans cycle + baril | non |
| `src/oracle/` | la vérité recalculée : empreintes, normalisation, valeur dérivée, règle vivante, refus, dérive, santé | non (sources injectées) |
| `src/collect/` | la seule couche qui parle au monde : adaptateurs de source, cache par empreinte | **oui** |
| `src/judge/` | les huit jauges, une par fichier, plus la fabrique de verdicts | non |
| `src/run/` | le moteur : passages, fissures, empreinte, conditions, budget, effets de bord, journal, tranches | non (agent injecté) |
| `src/score/` | ce que le banc annonce : intervalles, planchers, scorecard, régression vs dérive, porte, jury, calibrage | non |
| `src/db/` | 16 tables, mapping ligne SQL ↔ domaine, client et stub mémoire | **oui** (sauf le stub) |
| `src/mcp/` | les 12 outils : table, validation, garde d'autorisation, handlers | non (dépôt injecté) |
| `src/actions/` | resolver UI, verrou de workflow, déclencheurs, consommateur | **oui** |
| `src/ui/` | les 12 écrans et leur mise en forme (viewmodel pur, composants) | non (viewmodel) |
| `src/seed/` | le banc de démonstration : 40 cas, 3 versions, 4 suites, vérité semée | non |
| `src/i18n/` | français et anglais, parité vérifiée par un test | non |

---

## Le domaine : un concept, un type, un module

`src/domain/` est découpé en cinq modules **sans cycle**, assemblés par le
baril `vocabulary.ts` :

| Module | Contenu |
|---|---|
| `kinds.ts` | les énumérations primitives (§4) : gravité, verdicts, jauges, modes, formes d'oracle |
| `oracles.ts` | les trois formes d'oracle et l'état de vérité (§6, §7) |
| `entities.ts` | cas, condition, suite, empreinte, agent, version (§4, §10, §13) |
| `results.ts` | réponses, passages, verdicts, fissures, essai (§9, §16, §17) |
| `reporting.ts` | scorecards, porte, jury, calibrage, sources (§8, §11, §15) |

Modifier `src/domain/` exige une raison écrite : tout le dépôt en dépend.

**L'honnêteté est encodée dans les types**, pas dans une promesse :
`ScorecardRow.value: number | null` avec `n` — sous l'effectif minimal, une
jauge affiche « pas assez de recul » au lieu d'un pourcentage.

---

## Les contraintes de la plateforme (§21, §24)

| Contrainte | Conséquence sur le code |
|---|---|
| Action Rovo = **55 s** | un essai est une série d'appels, jamais un appel unique |
| Fonction = 25 s ; **900 s** via `consumer` | `runSlice()` découpe par tranches avec curseur (`Run.cursor`) |
| **5 déclencheurs planifiés** au plus, un seul à 5 min | trois déclarés dans le manifeste, un seul à 5 min |
| Graphe au nom d'un utilisateur : droit manquant = **résultat vidé sans erreur** | `SourceRead.denied` distingue « pas de droit » de « pas de données » |
| LLM hébergé : Haiku pour l'implication, Sonnet pour les propositions | deux entrées `llm` dans le manifeste ; cache par empreinte |
| `rovo:mcp` : Preview, un module par app, 50 outils max | un seul module, 12 outils |
| Payload 5 Mo, 500 Ko depuis une interface custom | les réponses d'agent sont stockées par référence (`answer_ref`) |
| Cypher brut refusé aux nouvelles apps | requêtes prêtes uniquement |

---

## Le modèle de données (§22)

16 tables, déclarées dans le manifeste et dont le DDL complet vit dans
`src/db/schema.ts`. Deux règles de confidentialité sont **encodées dans le
schéma** et vérifiées par un test :

1. la table `pass` porte `answer_ref` (référence vers l'objet) et
   `answer_hash` (empreinte), **jamais** le texte de la réponse — le contenu
   d'un cas ne vit pas dans une table de statistiques ;
2. `case.space_key` existe pour que les cas restent dans l'espace du banc et
   ne soient jamais rendus à un lecteur d'un autre espace.

`oracle_state` a une clé primaire **composite** `(case_id, version_no)` et
est **append-only** : on n'écrase jamais une version passée, c'est ce qui
permet de prouver une dérive de vérité plus tard.

---

## La garde d'autorisation

Aucun outil n'expose le contenu d'un cas à un agent non autorisé (§19). Le
filtrage est appliqué dans `src/mcp/guard.ts`, **avant** tout accès aux
données :

- un appel non authentifié est refusé ;
- un appel de **l'agent sous test** est refusé (séparation des rôles : il ne
  s'auto-évalue pas) ;
- un lecteur sans droit sur l'espace du banc est refusé ;
- un refus rend une **erreur explicite**, jamais une liste vide — une liste
  vide se lirait comme « il n'y a pas de cas », ce qui est une information
  fausse.

---

## Les tests

| Suite | Ce qu'elle prouve |
|---|---|
| `tests/oracle/` | empreintes stables, normalisation avec tolérances, recalcul, oracles morts, dérive |
| `tests/run/` | budget, rejets précoces, fissures et attribution, conditions figées, empreinte |
| `tests/score/` | intervalles de Wilson, planchers, porte, régression vs dérive, calibrage |
| `tests/db/` | les 16 tables, les clés primaires, et les deux règles de confidentialité |
| `tests/mcp/` | le contrat des 12 outils contre le §19, la validation, la garde d'autorisation |
| `tests/i18n/` | la parité fr/en et la distinction des mots de la discipline |
| `tests/seed/` | le corpus de démonstration : 15/10/8/7, lot d'or curaté, dérive semée |
| `tests/ui/` | la mise en forme honnête : pas de pourcentage sans effectif |
| `tests/acceptance/` | **les 22 points de recette du §27**, rendus exécutables |

---

## L'intégration continue

- `ci` : types, tests, gardes de taille (fichier < 500 lignes, fonction < 50
  lignes), manifeste Forge, auto-tests Hermes, sanity docs — **5 minutes
  maximum** ;
- `ci-budget` : garde-fou qui échoue si un job déclare plus de 5 minutes ;
- `couche0` : le périmètre déclaré dans le corps de PR, plus les motifs
  interdits ;
- `site` : build du site public, déployé sur GitHub Pages depuis `main` ;
- `hermes-lite` : le gate qui constate les conflits et dispatche le résolveur ;
- `hermes-conflict-resolver` : rebase + résolution (InferHub puis repli
  déterministe) + validation par la toolchain + push `--force-with-lease`.

Mergify merge sur `main` protégé, après les trois checks requis. Aucun push
direct.
