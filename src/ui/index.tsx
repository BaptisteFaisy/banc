/**
 * Les écrans du banc (§20), UI Kit 2.
 *
 * La métaphore de la métrologie : un **banc**, des **éprouvettes**, un
 * **témoin**, des **jauges** avec leur graduation et leur plancher, un
 * **cadran de stabilité**, une **amorce**, un **lot d'or**, une **fissure**,
 * un **filet** (la porte), un **registre d'essai**, un **calibre**, une
 * **paille** (la dérive), une **étiquette de budget**.
 *
 * Deux exigences non fonctionnelles (§25) :
 *   - **accessibilité** : aucune information portée par la seule couleur —
 *     chaque état porte aussi un MOT et un MOTIF ; navigation clavier ;
 *   - **honnêteté** : pas de pourcentage sans effectif ; un oracle mort est
 *     affiché comme mort ; une jauge non calibrée est marquée ; un budget
 *     épuisé le dit.
 *
 * Les composants vivent dans `src/ui/components/`, la logique de présentation
 * dans `src/ui/viewmodel/` (fonctions pures, testables sans DOM).
 */
export { SCREENS } from '../actions/resolver.js';
export type { ScreenId } from '../actions/resolver.js';
