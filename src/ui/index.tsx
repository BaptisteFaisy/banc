/**
 * Point d'entrée UI du banc : la ressource `main` du manifeste Forge.
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
 * La logique de présentation est dans `src/ui/viewmodel/` (fonctions pures,
 * testables sans DOM) ; les composants ne font que mettre en forme.
 */
export { BenchApp } from './app.js';
export type { BenchAppProps, BenchTab } from './app.js';
export { ScorecardScreen } from './screens/scorecard.js';
export { FailuresScreen } from './screens/failures.js';
export { OracleHealthScreen } from './screens/oracle-health.js';
export { Gauge, GaugeList } from './components/gauge.js';
export { VerdictBadge } from './components/verdict-badge.js';
export { Gate } from './components/gate.js';
export { gaugeView, failingGauges, scorecardStatus, percent } from './viewmodel/gauge.js';
export { SCREENS } from '../actions/resolver.js';
export type { ScreenId } from '../actions/resolver.js';
