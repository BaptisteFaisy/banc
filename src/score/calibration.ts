/**
 * Jury humain et étalonnage (§15).
 *
 * Certaines réponses ne s'auto-notent pas. Le banc tire un échantillon au
 * sort, le fait relire par des humains sur une grille courte, puis mesure
 * l'accord entre le correcteur automatique et le jury — et surtout il affiche
 * son propre taux d'accord.
 *
 * Règle la plus importante du module : le banc **refuse d'annoncer une jauge
 * qu'il n'a pas calibrée**. Sous le seuil, la jauge est marquée « non
 * calibrée » et le rapport le dit. Un banc qui se trompe en silence est pire
 * que pas de banc.
 *
 * Séparation des rôles (§25) : l'agent sous test ne peut ni s'auto-évaluer ni
 * attester. Le jury humain est la seule autorité de recours.
 */
import type { Calibration, Gauge, VerdictKind } from '../domain/vocabulary.js';
import { CALIBRATION_THRESHOLD } from '../domain/vocabulary.js';

/** Une paire de verdicts à comparer. */
export interface VerdictPair {
  readonly auto: VerdictKind;
  readonly human: VerdictKind;
}

/** Accord brut : part de paires où les deux juges disent la même chose. */
export function agreement(pairs: readonly VerdictPair[]): number | null {
  if (pairs.length === 0) return null; // pas d'effectif : pas d'accord annoncé
  const same = pairs.filter((pair) => pair.auto === pair.human).length;
  return same / pairs.length;
}

/**
 * Accord corrigé du hasard (kappa de Cohen).
 *
 * L'accord brut ment quand un verdict est très fréquent : deux juges qui
 * disent toujours « exact » tombent d'accord sans se comprendre. Le kappa
 * retire cette part due au hasard.
 */
export function agreementKappa(pairs: readonly VerdictPair[]): number | null {
  if (pairs.length === 0) return null;
  const observed = agreement(pairs) ?? 0;
  const expected = chanceAgreement(pairs);
  if (expected >= 1) return observed >= 1 ? 1 : 0;
  return (observed - expected) / (1 - expected);
}

/** Part d'accord attendue du seul hasard, sur les distributions marginales. */
function chanceAgreement(pairs: readonly VerdictPair[]): number {
  const auto = distribution(pairs.map((pair) => pair.auto));
  const human = distribution(pairs.map((pair) => pair.human));
  let expected = 0;
  for (const [kind, share] of auto) {
    expected += share * (human.get(kind) ?? 0);
  }
  return expected;
}

/** Distribution de fréquences d'une liste de verdicts. */
function distribution(values: readonly VerdictKind[]): ReadonlyMap<VerdictKind, number> {
  const counts = new Map<VerdictKind, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const total = values.length || 1;
  return new Map([...counts].map(([kind, count]) => [kind, count / total]));
}

/** Accord entre deux notateurs humains (même calcul, autre entrée). */
export function interJudgeAgreement(pairs: readonly { a: VerdictKind; b: VerdictKind }[]): number | null {
  return agreement(pairs.map((pair) => ({ auto: pair.a, human: pair.b })));
}

/** Entrée de l'étalonnage d'une jauge. */
export interface CalibrateInput {
  readonly scope: string;
  readonly gauge: Gauge;
  readonly pairs: readonly VerdictPair[];
  readonly interJudge?: readonly { a: VerdictKind; b: VerdictKind }[];
  readonly threshold?: number;
  readonly computedAt?: string;
}

/**
 * Étalonne une jauge.
 *
 * Sans paire, l'accord vaut `null` et la jauge est **non calibrée** : ne pas
 * savoir n'est pas savoir que ça va. Sous le seuil, idem — et c'est affiché.
 */
export function calibrate(input: CalibrateInput): Calibration {
  const threshold = input.threshold ?? CALIBRATION_THRESHOLD;
  const autoVsHuman = agreement(input.pairs);
  const inter = input.interJudge ? interJudgeAgreement(input.interJudge) : null;
  return {
    scope: input.scope,
    gauge: input.gauge,
    n: input.pairs.length,
    autoVsHumanAgreement: autoVsHuman,
    interJudgeAgreement: inter,
    threshold,
    calibrated: autoVsHuman !== null && autoVsHuman >= threshold,
    computedAt: input.computedAt ?? new Date().toISOString(),
  };
}

/** Ce que le rapport affiche pour une jauge : valeur, ou « non calibrée ». */
export function calibrationLabel(calibration: Calibration): string {
  if (calibration.autoVsHumanAgreement === null) {
    return `${calibration.gauge} : non calibrée (aucun vote du jury)`;
  }
  if (!calibration.calibrated) {
    return `${calibration.gauge} : non calibrée — accord auto/humain `
      + `${Math.round(calibration.autoVsHumanAgreement * 100)} % sous le seuil de `
      + `${Math.round(calibration.threshold * 100)} %`;
  }
  return `${calibration.gauge} : calibrée — accord auto/humain `
    + `${Math.round(calibration.autoVsHumanAgreement * 100)} %`;
}

/** Les jauges qu'on a le droit d'annoncer (§15). */
export function calibratedGauges(calibrations: readonly Calibration[]): readonly Gauge[] {
  return calibrations.filter((item) => item.calibrated).map((item) => item.gauge);
}
