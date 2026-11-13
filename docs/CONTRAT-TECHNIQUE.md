# Contrat technique — Banc

Ce document est le contrat que **tout contributeur (humain ou agent) doit
respecter**. Il existe pour qu'un travail parallèle converge : les interfaces
sont figées, le découpage des fichiers est figé, les règles de style sont
figées. Ce qui n'est pas écrit ici se déduit du cahier des charges
(`docs/CAHIER-DES-CHARGES.md`), qui fait autorité sur le sens du produit.

## 1. Ce qu'est le produit

Un banc d'essai pour agents Rovo. On pose à un agent des questions dont **la
vérité est dérivée des systèmes de l'organisation**, on rejoue ces questions à
chaque version, et on regarde ce qui a régressé — avant que le client ne le
découvre. Trois formes d'oracle (valeur dérivée, règle vivante, refus
attendu), huit jauges, une porte de promotion.

App **Atlassian Forge** (TypeScript, `nodejs22.x`), Jira requis + Confluence
optionnel. Cible : Codegeist 2026, catégorie *Apps for Software Teams*.

## 2. Règles dures (garde CI, aucune exception)

| Règle | Garde |
|---|---|
| Fichier < **500 lignes** | `python3 tools/check-file-limits.py` |
| Fonction < **50 lignes** de code | `node tools/check-function-limits.mjs` |
| Zéro duplication : un helper partagé, une seule implémentation par logique | revue |
| Types importés de `src/domain/vocabulary.ts`, **jamais redéfinis** | `tsc --noEmit` |
| CI ≤ 5 min, `timeout-minutes: 5` par job | `.github/ci-budget/check_timeouts.py` |
| Docs UTF-8, non vides | étape « Sanity docs » de `ci.yml` |

Ces gardes s'appliquent **aussi aux tests, au site public et aux docs**. Un
fichier de 600 lignes se découpe en deux modules, il ne se justifie pas.

## 3. Le domaine est déjà écrit — ne pas y toucher

`src/domain/` contient les types partagés, découpés en cinq modules sans cycle :

```
src/domain/kinds.ts       énumérations primitives (§4)
src/domain/oracles.ts     les trois formes d'oracle + état de vérité (§6, §7)
src/domain/entities.ts    cas, condition, suite, empreinte, agent (§4, §10, §13)
src/domain/results.ts     réponses, passages, verdicts, fissures, essai (§9, §16)
src/domain/reporting.ts   scorecards, porte, jury, calibrage, sources (§8, §11, §15)
src/domain/vocabulary.ts  baril — c'est de là qu'on importe
```

Import obligatoire : `import type { BancCase, Verdict } from '../domain/vocabulary.js';`

**Le suffixe `.js` est requis** sur tous les imports relatifs (`moduleResolution:
bundler`, ESM). Un import sans `.js` casse le build Forge.

Modifier `src/domain/` exige une raison écrite en PR : tout le dépôt en dépend.

## 4. Découpage des modules

| Dossier | Rôle | Cahier des charges |
|---|---|---|
| `src/domain/` | types partagés (fait) | §4, §6 |
| `src/oracle/` | recalcul des oracles, règles, refus, santé, dérive | §6, §7, §6.4 |
| `src/collect/` | lecture des sources (graphe, Jira, Confluence, JSM), LLM, cache | §6.1, §21, §24 |
| `src/judge/` | les huit jauges, une par fichier | §8 |
| `src/run/` | moteur d'essai : passages, fissures, empreinte, modes, budget, effets de bord, journal | §9, §12, §13, §16, §17 |
| `src/score/` | scorecard, intervalles, régression vs dérive, porte, jury, calibrage | §7, §8, §11, §15 |
| `src/db/` | schéma Forge SQL, mapping, dépôt, client et son stub de test | §22 |
| `src/mcp/` | les 12 outils `rovo:mcp` | §19 |
| `src/actions/` | resolver UI + actions Rovo + triggers/consumer | §21 |
| `src/ui/` | les 12 écrans UI Kit | §20 |
| `src/seed/` | banc de démonstration : 40 cas, 2 versions d'agent | §29 |
| `src/i18n/` | français + anglais | §25 |
| `tests/` | un sous-dossier par module + `tests/acceptance/` pour la recette §27 | §27 |
| `site/` | site public Vite/React (démo navigateur) | §28 |
| `docs/` | cahier des charges, contrat, runbooks, juges | §29 |

## 5. Conventions de code

- **ESM strict**, `strict: true`, `noUnusedLocals`, `noUnusedParameters` : un
  import inutilisé casse le typecheck.
- **Pur d'abord.** Le domaine, les jauges, le score et la porte sont des
  fonctions pures : elles reçoivent des données, elles rendent un verdict.
  L'impur (Forge SQL, API Atlassian, LLM) est isolé dans `src/collect/` et
  `src/db/`, derrière une interface, avec un **stub de test** (`src/db/stub.ts`).
  Un test ne fait jamais d'appel réseau.
- **Jamais de `any`.** Un type inconnu est `unknown` puis raffiné.
- **Aucune jauge sans effectif.** Une mesure rendue par `src/score/` porte
  `n`, `ciLow`, `ciHigh`, `floor`. Sous `MIN_SAMPLE`, `value` vaut `null` et
  le motif « pas assez de recul » est produit — jamais un pourcentage.
- **Aucun oracle mort traité comme faux.** `alive: false` sort du score, et le
  taux d'oracles morts est affiché.
- **Un verdict voyage avec sa preuve** (`VerdictEvidence`) : réponse, oracle,
  sources, motifs.
- **Texte externe = donnée, jamais instruction** (§14, fondement des amorces).
  Un contenu lu dans un cas ne pilote aucun code.
- Commentaires en français, identifiants en anglais technique, messages
  utilisateur via `src/i18n/` (fr + en).
- Chaque module cite le § du cahier des charges qui le motive.

## 6. Ce que la plateforme impose (§21, §24)

| Contrainte | Conséquence sur le code |
|---|---|
| Action Rovo = **55 s** | un essai est une série d'appels, jamais un appel unique |
| Fonction = 25 s ; **900 s** via `consumer` | exécution par tranches avec curseur (`Run.cursor`) |
| **5 déclencheurs planifiés** au plus | suite complète la nuit, fumée sur événement |
| Graphe au nom d'un utilisateur : droit manquant = **résultat vidé sans erreur** | `SourceRead.denied` distingue « pas de droit » de « pas de données » |
| LLM hébergé : Haiku pour l'implication, Sonnet pour les propositions | cache par empreinte de cas |
| `rovo:mcp` : Preview, un module par app, 50 outils max | 12 outils, un seul module |
| Payload 5 Mo, 500 Ko depuis une interface custom | réponses d'agent stockées par référence (`answer_ref`) |

## 7. Tests

- Vitest, `tests/**/*.test.ts`. Un test par comportement du cahier des charges.
- **La recette §27 (22 points) est exécutée** dans `tests/acceptance/` : chaque
  point de recette a son test, nommé `recette-NN-<sujet>.test.ts`.
- Les gardes CI se testent elles-mêmes (`.github/couche0/test_check_couche0.py`).
- Aucun réseau, aucun secret, aucune écriture réelle : stubs et fixtures.

## 8. Definition of done d'un module

1. `npm run typecheck` passe.
2. `npm test` passe, avec les tests du module **et** les points de recette liés.
3. `npm run check:limits` et `npm run check:functions` passent.
4. Le module cite son §, importe ses types du domaine, ne duplique rien.
5. Les messages utilisateur passent par `src/i18n/` (fr + en).
