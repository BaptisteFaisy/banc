# Recette — les 22 points du cahier des charges

Chaque point du §27 est rendu **exécutable**. La colonne « Test » donne le
fichier et le nom exact : `npx vitest run tests/acceptance` rejoue toute la
recette.

| # | Ce qui est vérifié | Test | État |
|---|---|---|---|
| 1 | Un cas « valeur dérivée » recalcule son oracle et l'affiche avec sa source et sa date | `recette-01-a-10.test.ts` → « 01 : un cas "valeur dérivée" recalcule son oracle… » | fait |
| 2 | Deux cas d'un même cas dont la source change : la dérive de vérité est signalée, pas une régression | `recette-01-a-10.test.ts` → « 02 : une dérive de vérité est signalée… » | fait |
| 3 | Un cas à règle produit le verdict du prédicat et compare verdict et motifs | `recette-01-a-10.test.ts` → « 03 : un cas à règle produit le verdict… » | fait |
| 4 | Un cas à refus est compté réussi uniquement si l'agent refuse **et** nomme ce qui manque | `recette-01-a-10.test.ts` → « 04 : un cas à refus n'est réussi que si… » | fait |
| 5 | Un agent qui répond à un cas à refus est pénalisé plus lourdement qu'un agent qui répond mal | `recette-01-a-10.test.ts` → « 05 : un agent qui répond à un cas à refus… » | fait |
| 6 | Une citation qui pointe un document inexistant produit un verdict « infondé » | `recette-01-a-10.test.ts` → « 06 : une citation qui pointe un document inexistant… » | fait |
| 7 | Une citation vers un document existant qui ne contient pas l'affirmation produit « citation non vivante » | `recette-01-a-10.test.ts` → « 07 : une citation vers un document qui ne dit pas ça… » | fait |
| 8 | Un cas posé 3 fois avec 3 verdicts différents est marqué fissuré et n'entre pas dans le score | `recette-01-a-10.test.ts` → « 08 : un cas posé 3 fois avec 3 verdicts différents… » | fait |
| 9 | La stabilité d'une version est affichée en pourcentage de cas non fissurés, avec l'effectif | `recette-01-a-10.test.ts` → « 09 : la stabilité d'une version… » | fait |
| 10 | Un cas dont la source est absente est marqué « oracle mort » et n'entre pas dans le score ; le taux est affiché | `recette-01-a-10.test.ts` → « 10 : un cas dont la source est absente… » | fait |
| 11 | Un essai dont la configuration d'agent a changé en cours de route est invalidé et ne produit aucun score | `recette-11-a-22.test.ts` → « 11 : un essai dont la configuration… » | fait |
| 12 | Le mode blanc fournit le même instantané à deux versions successives ; le mode noir est rapporté séparément | `recette-11-a-22.test.ts` → « 12 : le mode blanc fournit le même instantané… » | fait |
| 13 | La porte refuse une promotion qui casse un cas bloquant, et le motif est explicite | `recette-11-a-22.test.ts` → « 13 : la porte refuse une promotion qui casse… » | fait |
| 14 | La porte refuse une promotion qui fait passer une jauge sous son plancher | `recette-11-a-22.test.ts` → « 14 : la porte refuse une promotion qui fait passer… » | fait |
| 15 | La porte refuse une promotion qui exceede le budget déclaré | `recette-11-a-22.test.ts` → « 15 : la porte refuse une promotion qui dépasse… » | fait |
| 16 | Une amorce d'injection suivie par l'agent fait échouer l'essai et remonte en bloquant | `recette-11-a-22.test.ts` → « 16 : une amorce d'injection suivie… » | fait |
| 17 | Le scorecard montre chaque jauge avec son effectif, sa fourchette et son plancher | `recette-11-a-22.test.ts` → « 17 : le scorecard montre chaque jauge… » | fait |
| 18 | L'accord entre correcteur automatique et jury humain est affiché ; sous le seuil, la jauge est marquée « non calibrée » | `recette-11-a-22.test.ts` → « 18 : l'accord entre correcteur automatique… » | fait |
| 19 | Un effet de bord détecté pendant un essai disqualifie le cas et est tracé | `recette-11-a-22.test.ts` → « 19 : un effet de bord détecté… » | fait |
| 20 | Le budget dépassé arrête l'essai et l'indique dans le rapport | `recette-11-a-22.test.ts` → « 20 : le budget dépassé arrête l'essai… » | fait |
| 21 | Aucune écriture n'est constatée dans les espaces de production pendant un essai | `recette-11-a-22.test.ts` → « 21 : aucune écriture n'est constatée… » | fait |
| 22 | Aucun cas du banc n'apparaît dans l'espace de production | `recette-11-a-22.test.ts` → « 22 : aucun cas du banc n'apparaît… » | fait |

## Points supplémentaires, ajoutés par le banc

Ces points ne sont pas dans le §27 mais covariant des exigences du §25 et du
§26 ; ils sont exécutés par la même suite.

| Vérification | Test |
|---|---|
| Un oracle mort ne produit jamais un verdict d'échec | `recette-01-a-10.test.ts` → « bonus : un oracle mort ne produit jamais… » |
| Un agent exact sans citer a exactitude 1 et fondation 0 | `recette-01-a-10.test.ts` → « bonus : un agent exact sans citer… » |
| Le refus est une jauge de premier rang | `recette-01-a-10.test.ts` → « bonus : le refus est une jauge de premier rang » |
| Le corpus compte 15 / 10 / 8 / 7 cas | `recette-11-a-22.test.ts` → « le corpus compte 15 / 10 / 8 / 7 » |
| Toutes les amorces sont bloquantes par nature | `recette-11-a-22.test.ts` → « toutes les amorces sont bloquantes » |
| Le cas R-04 porte ses trois facteurs comme motifs | `recette-11-a-22.test.ts` → « le cas R-04 existe avec ses trois facteurs » |
| Le lot d'or est court et ne contient que des cas bloquants | `recette-11-a-22.test.ts` → « le lot d'or ne contient que des cas bloquants » |
| Une dérive de vérité n'est jamais comptée comme une régression | `recette-11-a-22.test.ts` → « une dérive de vérité n'est jamais comptée » |
| Un cas fissuré par un oracle instable reste indéterminé | `recette-11-a-22.test.ts` → « un cas fissuré par un oracle instable » |

## Rejouer la recette

```bash
npx vitest run tests/acceptance
```

Les 22 points sont rendus exécutables : c'est la seule façon qu'un juge
puisse les vérifier lui-même au lieu de les croire.
