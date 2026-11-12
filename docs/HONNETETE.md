# Les exigences non fonctionnelles, rendues opposables

Le cahier des charges (§25) pose des exigences d'honnêteté. Ce document ne les
répète pas : il dit **où elles sont encodées dans le code** et **quel test les
prouve**. Une exigence sans emplacement ni test est une promesse.

---

## 1. Aucune jauge sans effectif ni fourchette

**Encodé dans** `ScorecardRow` : `{ n, value: number | null, ciLow, ciHigh, floor }`.
Le type interdit une jauge sans effectif — `value` porte `null` quand
l'effectif minimal n'est pas atteint.

**Calculé par** `measuredGauge()` (`src/score/interval.ts`) : intervalle de
**Wilson** (pas l'approximation normale de Wald — les petits effectifs sont
la norme ici), et `value: null` sous `MIN_SAMPLE`.

**Affiché par** `gaugeView()` (`src/ui/viewmodel/gauge.ts`) : statut
`pas_assez_de_recul`, libellé `—`, motif « pas assez de recul — n cas
mesurés, effectif minimal non atteint ».

**Prouvé par** `tests/ui/gauge.test.ts` (« sous l'effectif minimal, affiche
"pas assez de recul" et pas un pourcentage ») et
`tests/acceptance/recette-11-a-22.test.ts` (point 17).

## 2. Un oracle mort est affiché, jamais traité comme faux

**Encodé dans** `OracleState.alive` et `OracleState.deadReason`.

**Décidé par** `deadOracleVerdict()` (`src/judge/deps.ts`) : un oracle mort
produit `invérifiable` avec `value: null` — jamais un verdict d'échec.

**Separé par** `recomputeDerived()` (`src/oracle/recompute.ts`) : `denied`
vient de `droit_manquant`, pas de `source_absente` — la plateforme vide un
résultat sans erreur quand un droit manque (§21), et confondre les deux fait
déboguer un prompt sain.

**Affiché par** `oracleHealth()` (`src/oracle/health.ts`) : taux d'oracles
morts, répartition par raison, et le verdict « inexploitable » au-delà d'un
tiers.

**Prouvé par** `tests/acceptance/recette-01-a-10.test.ts` (point 10 et le
test « un oracle mort ne produit jamais un verdict d'échec »).

## 3. Une jauge non calibrée est marquée comme telle

**Encodé dans** `Calibration.calibrated`.

**Décidé par** `calibrate()` (`src/score/calibration.ts`) : sans vote du jury,
l'accord vaut `null` et la jauge est **non calibrée** — ne pas savoir n'est
pas savoir que ça va. Sous le seuil de 65 %, idem.

**Corrigé du hasard** : `agreementKappa()` retire la part d'accord due à la
fréquence d'un verdict ; l'accord brut ment quand un verdict est très
fréquent.

**Prouvé par** `tests/acceptance/recette-11-a-22.test.ts` (point 18).

## 4. Un banc interrompu par budget le dit

**Encodé dans** `RunState` (`'stopped_budget'`) et `BudgetUsage.exhausted`.

**Décidé par** `chargeBudget()` et `budgetExhausted()`
(`src/run/budget.ts`), avec `whichLimitReached()` qui nomme **laquelle** des
trois limites est atteinte : le rapport dit « 120/100 appels », pas « budget
dépassé ».

**Prouvé par** `tests/acceptance/recette-11-a-22.test.ts` (point 20) et
`tests/run/budget.test.ts`.

## 5. Séparation des rôles : l'agent sous test ne s'atteste pas

**Encodé dans** `Caller.isAgentUnderTest`.

**Décidé par** `assertCanReadBench()` (`src/mcp/guard.ts`) : un appel
d'agent est refusé, avec le motif « l'agent sous test ne peut pas lire le
banc ». Le jury humain est la seule autorité de recours (§15).

**Prouvé par** `tests/mcp/tools.test.ts`.

## 6. Reproductibilité : un essai se rejoue à l'identique

**Encodé dans** `TestCondition.snapshotHash`, `Run.conditionHash`,
`SpecFingerprint`.

**Décidé par** `createConditionStore()` (`src/run/condition.ts`) : la clé de
l'instantané est déterministe, donc deux versions testées à dix minutes
d'intervalle reçoivent le même instantané ; et
`checkFingerprintDrift()` (`src/run/fingerprint.ts`) : si la configuration a
changé pendant l'essai, l'essai est **invalidé** et aucun score n'est publié.

**Prouvé par** `tests/acceptance/recette-11-a-22.test.ts` (points 11 et 12).

## 7. Distinction : régression de l'agent et dérive de vérité

**Encodé dans** `Regression.kind` (`'regression' | 'truth_drift' | 'progress'`)
et `Regression.truthEvidence`.

**Décidé par** `classifyDelta()` (`src/score/regression.ts`) : une dérive
prime sur le signe du delta, et une hausse du coût est une régression (le
sens de la jauge est porté par la jauge, pas par le signe).

**Prouvé par** `tests/acceptance/recette-11-a-22.test.ts` (« une dérive de
vérité n'est jamais comptée comme une régression »).

## 8. Isolation : aucun effet de bord toléré

**Encodé dans** `SideEffect` et `Passage.sideEffects`.

**Décidé par** `disqualifiedBySideEffect()` (`src/run/sideeffects.ts`) : un
agent qui écrit pendant l'essai est disqualifié pour ce cas, **avec la
trace** — et c'est aussi un résultat : « votre agent écrit en production
pendant qu'on l'évalue ».

**Prouvé par** `tests/acceptance/recette-11-a-22.test.ts` (point 19).

## 9. Confidentialité : les cas restent dans l'espace du banc

**Encodé dans** `Case.spaceKey`, `BENCH_SPACE`.

**Décidé par** `filterCases()` (`src/mcp/guard.ts`) : un cas d'un autre espace
n'est jamais rendu ; et `src/db/schema.ts` : la table `pass` porte
`answer_ref` et `answer_hash`, **jamais** le texte de la réponse — le
contenu d'un cas ne vit pas dans une table de statistiques.

**Prouvé par** `tests/acceptance/recette-11-a-22.test.ts` (points 21 et 22),
`tests/db/schema.test.ts` et `tests/seed/corpus.test.ts` (aucun secret, aucune
donnée personnelle dans le corpus).

## 10. Accessibilité : aucune information par la seule couleur

**Encidé dans** `GaugeView.status` et `GaugeView.motif` : un état porte un
MOT et un MOTIF, jamais une couleur seule.

**Prouvé par** `tests/ui/gauge.test.ts`.

## 11. Sobriété : le LLM ne sert qu'à deux choses

**Encodé dans** le bloc `llm` du manifeste : `implication` (vérifier qu'une
citation contient l'affirmation) et `proposal` (proposer un cas depuis un
ticket). Tout le reste du jugement est déterministe — un correcteur non
reproductible rendrait la mesure impossible à rejouer.

## 12. Rapidité

- Banc de fumée : 20 cas × 1 passage, moins de deux minutes (§17) ;
- scorecard servie depuis le cache ;
- explorateur d'échecs : lecture seule, aucun recalcul ;
- CI : 5 minutes maximum, garde-fou `ci-budget` qui échoue si un job déclare
  plus.

---

## Ce qui reste à faire

| Exigence | État |
|---|---|
| Étalonnage sur un vrai jury humain | le mécanisme est là (`record-judgment`, `calibrate`), l'échantillon réel n'est pas encore collecté |
| Export du rapport pour auditeur (Confluence) | le module `confluence:globalPage` est déclaré, l'export reste à écrire |
| Test d'outils MCP (contrat, erreurs, idempotence) | le contrat des 12 outils est testé ; les tests d'idempotence restent à faire |
