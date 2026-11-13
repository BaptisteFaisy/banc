# Pour les jugés — Banc, le banc d'essai

Ce document décrit le parcours d'un juge en sept points. Chaque point indique
**ce que vous cliquez**, **ce que vous devez voir**, et **pourquoi c'est
intéressant**. Tout est déjà chargé : aucun compte à créer, aucune
configuration, aucune donnée réelle.

> Banc est une app Atlassian Forge (Codegeist 2026). Ce dépôt contient
> l'application, la skill publiée en source ouverte, le banc de démonstration
> et le site public.

---

## Mise en route

```bash
git clone git@github.com:BaptisteFaisy/banc.git
cd banc
npm install
npm test          # 146 tests, dont la recette de 22 points
npm run seed      # écrit le corpus de démonstration dans dist/seed/
npm run site:dev  # le site public de démonstration
```

## Ce qui est chargé

| Élément | Détail |
|---|---|
| Cas | **40** dans l'espace du banc : 15 valeurs dérivées, 10 règles vivantes, 8 refus attendus, 7 amorces |
| Versions d'agent | **v4** (témoin), **v5** (casse deux cas bloquants, perd un point de fondation), **v6** (répare la fondation, casse la stabilité) |
| Suites | lot d'or (20 cas), banc de fumée (20 cas, 1 passage, < 2 min), batterie d'amorces, suite complète |
| Dérive de vérité | le cas **D-13** a dérivé mardi : la vérité a changé, l'agent n'est pas en cause |

---

## Les sept points

### 1. Le banc

**Ce que vous cliquez** : l'écran « Le banc » (`jira:globalPage`).

**Ce que vous voyez** : un agent sous test, sa version gravée sur la plaque,
le lot d'or fermé à côté, le témoin posé pour comparaison immédiate.

**Pourquoi c'est intéressant** : la métaphore de la métrologie. Chaque
élément encode une donnée — le banc (l'agent), l'éprouvette (un cas), le
témoin (la référence), la jauge (une métrique avec son plancher). Rien n'est
décoratif : un écran de plus beau rapport ne vaut pas une mesure reproductible.

### 2. La scorecard de deux versions côte à côte

**Ce que vous cliquez** : `get-scorecard` sur v4 puis sur v5, ou l'écran
« Scorecard ».

**Ce que vous voyez** : les huit jauges, chacune avec son **effectif**, sa
**fourchette** et son **plancher**. Trois jauges en rouge sur la v5, deux
cas bloqués. Les écarts au témoin v4 sont affichés en regard.

**Pourquoi c'est intéressant** : la v5 a perdu un point de fondation parce
que son prompt a été raccourci et que la consigne de citer a sauté. C'est
exactement le bug qu'un test classique ne voit pas : la réponse est toujours
juste, elle a juste cessé d'être sourcée.

**À noter** : une jauge sous l'effectif minimal affiche « pas assez de
recul », pas un pourcentage. Un banc qui annonce 0 % quand il n'a rien mesuré
mentirait sur sa propre capacité.

### 3. L'explorateur d'échecs

**Ce que vous cliquez** : un cas régressé dans la liste.

**Ce que vous voyez** : la réponse de l'agent, l'oracle, les sources, le diff
avec la version précédente, et le verdict **par jauge** — pas une note
globale.

**Pourquoi c'est intéressant** : c'est le diagnostic. « Exact mais infondé »
et « faux mais fondé » ne se réparent pas de la même façon, et la réponse
ne suffit pas à trancher.

### 4. La dérive de vérité

**Ce que vous cliquez** : le cas D-13 dans `list-regressions`.

**Ce que vous voyez** : deux événements distincts. Une **régression** — la
vérité n'a pas bougé, la réponse si. Une **dérive** — la vérité a changé
mardi (de 0 à 2 incidents critiques), avec la preuve : l'empreinte de l'oracle
avant et après.

**Pourquoi c'est intéressant** : c'est la distinction que tous les frameworks
d'évaluation oublient. Sans elle, on débogue un prompt pendant trois jours
alors que c'est l'organisation qui a changé.

### 5. La fissure

**Ce que vous cliquez** : le cas instable sur la v6 dans `get-stability`.

**Ce que vous voyez** : trois réponses, trois verdicts, l'écart entre les
réponses, et l'**attribution** : « cas mal écrit » ou « agent instable ».

**Pourquoi c'est intéressant** : la v6 répare la fondation mais casse la
stabilité (température remontée de 0,2 à 0,9). Un cas fissuré n'est pas un
cas difficile : c'est une liste de travail, et le banc dit de quoi elle est
faite.

### 6. La porte de promotion

**Ce que vous cliquez** : `check-promotion` sur la v6.

**Ce que vous voyez** : **PORTE ROUGE**, avec un motif par règle :
« 2 cas bloquant(s) régressent : D-01, R-04 », « fondation 85 % sous le
plancher de 90 % », « coût 12,00 sur 2,00 déclaré ».

**Pourquoi c'est intéressant** : la porte refuse **en nommant** le motif. Une
porte rouge sans motif est une porte qu'on contourne au bout de la semaine.

### 7. Le mode blanc contre le mode noir

**Ce que vous cliquez** : le même cas dans les deux modes.

**Ce que vous voyez** : en mode blanc (livre fermé) le banc fournit
l'instantané et mesure le raisonnement ; en mode noir (livre ouvert) l'agent
cherche lui-même et on mesure la chaîne complète. Les deux modes sont
**rapportés séparément**, jamais fusionnés.

**Pourquoi c'est intéressant** : l'écart entre les deux modes indique si le
problème est la récupération ou le raisonnement. C'est un diagnostic que
personne n'offre aujourd'hui.

---

## Ce que vous pouvez casser exprès

- **Amorces** : les 7 cas hostiles du banc (injection, contradiction, fausse
  citation) sont bloquants par nature. Une amorce suivie par l'agent fait
  échouer l'essai et remonte en bloquant.
- **Le rôle** : l'agent sous test ne peut ni s'auto-évaluer ni attester. Le
  jury humain est la seule autorité de recours.
- **L'accès** : un lecteur non autorisé n'obtient **aucun** contenu de cas,
  et une erreur explicite — jamais une liste vide, qui se lirait comme
  « il n'y a pas de cas ».
- **Le budget** : passé la limite, l'essai s'arrête et **le dit**.

---

## La skill

`SKILL.md` est la procédure courte à suivre avant de pousser une version
d'agent : jouer le lot d'or, ne pas promouvoir si la porte est rouge, vérifier
la **dérive de vérité** avant d'accuser une régression, ne jamais conclure sur
un cas unique, consigner l'empreinte de la configuration testée.

Elle est écrite pour être réutilisable par un agent tiers qui ne connaît pas
Banc.
