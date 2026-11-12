# Contribuer

## Avant d'écrire

1. Lisez `docs/CONTRAT-TECHNIQUE.md` (règles dures, découpage des modules).
2. Lisez `docs/CONTRAT-INTERFACES.md` (les signatures figées entre modules).
3. Lisez le § du cahier des charges qui motive votre changement — le
   cahier des charges fait autorité sur le **sens** du produit, le contrat sur
   la **forme** du code.

## Les règles dures

| Règle | Garde | Raison |
|---|---|---|
| fichier < **500 lignes** | `python3 tools/check-file-limits.py` | un fichier long est un fichier à découper |
| fonction < **50 lignes** de code | `node tools/check-function-limits.mjs` | une fonction longue est une fonction à découper |
| zéro duplication | revue | une seule implémentation par logique ; extraire et partager |
| types importés de `src/domain/vocabulary.js` | `tsc --noEmit` | un concept a un type, un module le définit |
| CI ≤ **5 minutes** | `.github/ci-budget/check_timeouts.py` | jamais de timeout allongé : on optimise ou on découpe |
| imports relatifs suffixés `.js` | `tsc --noEmit` | ESM strict (`moduleResolution: bundler`) |
| jamais de `any` | `tsc --noEmit` | `unknown` puis raffiné |
| aucun réseau dans les tests | revue | un test doit être rejouable hors ligne |

Ces règles s'appliquent **aussi** aux tests, au site public et aux docs.

## La discipline de vocabulaire

Les mots du §4 ne sont pas interchangeables, et les confondre casse le
produit :

| Mot | Sens |
|---|---|
| **exact** | l'agent donne la valeur de l'oracle |
| **concordant** | l'agent ne se contredit pas et reste cohérent avec l'oracle sans le nommer |
| **fondé** | toute affirmation est adossée à une source vérifiable |
| **infondé** | une citation ne résout pas, ou ne dit pas ce qui est affirmé |
| **invérifiable** | aucune source ne permet de trancher |

Un contributeur qui écrit « exact » pour « concordant » produit une mesure
fausse. De même : un **oracle mort** n'est jamais un échec de l'agent, et une
**dérive de vérité** n'est jamais une régression.

## Faire et ne pas faire

- **Pur d'abord.** Les fonctions de domaine, de jugement et de score sont
  pures ; l'impur est injecté. Un nouveau module qui lit Forge SQL en direct
  dans une fonction de calcul ne sera pas accepté.
- **Les effets de bord sont des résultats.** Un agent qui écrit pendant un
  essai est disqualifié **avec la trace** : ne le masquez pas.
- **Un verdict voyage avec sa preuve** (réponse, oracle, sources, motifs).
- **Une jauge sans effectif n'est pas une jauge.** Renvoyez `null`, jamais
  `0`.
- **Une chaîne visible passe par `t()`** (`src/i18n/`), en français et en
  anglais.

## Ouvrir une pull request

1. Branche depuis `main`, jamais de push direct sur `main`.
2. La CI doit être verte : `ci`, `ci-budget`, `couche0`.
3. **Déclarez le périmètre** dans le corps de la PR : la garde `couche0`
   refuse tout fichier modifié qui n'est pas déclaré, et toute déclaration
   qui ne sert pas.
4. Mergify fusionne après les checks requis. Le gate `hermes-lite` constate
   les conflits et dispatche le résolveur.

## Les conflits

Hermes résout les conflits de rebase tout seul : il rebase, résout (InferHub
d'abord, repli déterministe ensuite), **valide le résultat avec la toolchain
du dépôt**, et pousse en `--force-with-lease` sur la seule branche de la PR.

S'il ne peut pas **prouver** que le résultat est bon, il escalade à un
humain : label `hermes/conflit`, commentaire avec la raison exacte, sortie
non nulle. Il ne devine jamais.

Les fichiers dérivés — `package-lock.json`, `site/dist`, `coverage`, les
caches `tsc` — ne sont jamais soumis à l'IA : ils sont régénérés par la
toolchain. Un modèle qui réécrit un fichier généré produit quelque chose de
plausible et de faux ; le banc a payé pour l'apprendre.

## Lancer la suite

```bash
npm install
npm run typecheck        # tsc --noEmit
npm test                 # vitest
npm run check:limits     # garde de taille des fichiers
npm run check:functions  # garde de taille des fonctions
npm run check:manifest   # manifeste Forge
python3 tools/check-workflows-yaml.py
python3 .github/hermes/resolve.py --selftest
python3 .github/hermes/resolver.py --selftest
```
