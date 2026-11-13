/**
 * src/score/interval.ts — statistiques honnêtes pour un banc d'essai.
 *
 * Principe directeur : AUCUNE jauge sans effectif ni fourchette.
 * Sous l'effectif minimal on rend `null`, et l'écran affiche
 * « pas assez de recul » au lieu d'un pourcentage trompeur.
 *
 * Aucune dépendance externe : `Math` seulement.
 * Pas de table de Student en dur : le quantile est exposé via `z`
 * (1.96 ≈ 95 % bilatéral, approximation normale) — choix documenté
 * sur chaque fonction qui l'utilise.
 *
 * ESM, TypeScript strict, jamais `any`, imports relatifs suffixés `.js`.
 */

/**
 * Effectif minimal en dessous duquel on refuse de conclure.
 *
 * Redéclaré ici volontairement (et non importé de `../domain/vocabulary.js`)
 * pour garder ce module autonome et testable même si le domaine n'est pas
 * encore câblé. Il DOIT rester aligné sur `src/domain/vocabulary.ts`, où
 * `MIN_SAMPLE` vaut aussi 5 : si l'un change, l'autre change avec.
 */
export const MIN_SAMPLE = 5;

/** Message affiché à l'écran quand l'effectif est insuffisant. */
export const NOT_ENOUGH_DATA = 'pas assez de recul';

/** Borne un nombre dans [0, 1] (les probabilités ne sortent jamais de là). */
function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * L'effectif `n` permet-il de conclure ?
 * `n` non fini ou négatif → jamais assez.
 */
export function enoughData(n: number, min: number = MIN_SAMPLE): boolean {
  return Number.isFinite(n) && Number.isFinite(min) && n >= min;
}

/**
 * Intervalle de confiance de Wilson pour une proportion.
 *
 * Wilson (score test), PAS l'approximation normale de Wald :
 * Wald s'effondre sur les petits effectifs (et colle aux bornes 0/1),
 * or les petits effectifs sont la norme sur ce banc.
 *
 * `z = 1.96` ≈ 95 % bilatéral (approximation normale du quantile).
 * Rend `null` si `n <= 0` ou si `successes` est hors de [0, n].
 * Bornes garanties dans [0, 1].
 */
export function wilsonInterval(
  successes: number,
  n: number,
  z = 1.96,
): { low: number; high: number } | null {
  if (!Number.isFinite(successes) || !Number.isFinite(n) || !Number.isFinite(z)) {
    return null;
  }
  if (n <= 0) return null;
  if (successes < 0 || successes > n) return null;

  const z2 = z * z;
  const denom = n + z2;
  const centre = successes + z2 / 2;
  const marge = z * Math.sqrt((successes * (n - successes)) / n + z2 / 4);

  return {
    low: clamp01((centre - marge) / denom),
    high: clamp01((centre + marge) / denom),
  };
}

/**
 * Taux observé `successes / n`, ou `null` si `n <= 0`
 * (pas de division par zéro, pas de taux inventé).
 */
export function rate(successes: number, n: number): number | null {
  if (!Number.isFinite(successes) || !Number.isFinite(n) || n <= 0) return null;
  return successes / n;
}

/** Une jauge mesurée : toujours l'effectif, la valeur, la fourchette, le verdict. */
export interface MeasuredGauge {
  /** Effectif ayant servi à la mesure — toujours fourni, jamais masqué. */
  n: number;
  /** Taux observé, ou `null` sous l'effectif minimal. */
  value: number | null;
  /** Borne basse de Wilson, ou `null` sous l'effectif minimal. */
  ciLow: number | null;
  /** Borne haute de Wilson, ou `null` sous l'effectif minimal. */
  ciHigh: number | null;
  /** Plancher de qualité appliqué (rappelé pour traçabilité). */
  floor: number;
  /** `true` seulement si on a assez de recul ET value < floor. */
  belowFloor: boolean;
  /** Recopie de `enoughData(n, min)` — le verdict d'effectif est explicite. */
  enoughData: boolean;
  /** Motif humain lisible quand on ne conclut pas ; `null` sinon. */
  motive: string | null;
}

/**
 * Fonction centrale : mesure une jauge sans jamais mentir.
 *
 * - Effectif insuffisant → `value`/`ciLow`/`ciHigh` = `null`,
 *   `belowFloor` = `false` (on ne peut PAS conclure, ni dans un sens
 *   ni dans l'autre) et `motive` = `'pas assez de recul'`.
 * - Sinon → taux observé + intervalle de Wilson, et
 *   `belowFloor = value < floor`.
 */
export function measuredGauge(
  successes: number,
  n: number,
  floor: number,
  min: number = MIN_SAMPLE,
): MeasuredGauge {
  const base = { n, floor, enoughData: enoughData(n, min) };

  if (!base.enoughData) {
    return {
      ...base,
      value: null,
      ciLow: null,
      ciHigh: null,
      belowFloor: false,
      motive: NOT_ENOUGH_DATA,
    };
  }

  const value = rate(successes, n);
  const ci = wilsonInterval(successes, n);

  if (value === null || ci === null) {
    // Entrée incohérente (ex. successes hors bornes) : on ne conclut pas.
    return {
      ...base,
      value: null,
      ciLow: null,
      ciHigh: null,
      belowFloor: false,
      motive: 'mesure incohérente',
    };
  }

  return {
    ...base,
    value,
    ciLow: ci.low,
    ciHigh: ci.high,
    belowFloor: value < floor,
    motive: null,
  };
}

/** Moyenne et écart-type échantillonnaux (n-1) — sert à la jauge de stabilité. */
export interface Spread {
  mean: number;
  stdev: number;
}

/**
 * Dispersion d'une série : moyenne + écart-type ÉCHANTILLONNAL (n-1),
 * car on observe un échantillon de runs, pas la population entière.
 * `null` si moins de 2 valeurs : un écart-type sur 1 point n'a aucun sens.
 */
export function studentSpread(values: readonly number[]): Spread | null {
  if (values.length < 2) return null;

  let sum = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) return null;
    sum += v;
  }
  const mean = sum / values.length;

  let squares = 0;
  for (const v of values) {
    const d = v - mean;
    squares += d * d;
  }
  const stdev = Math.sqrt(squares / (values.length - 1));

  return { mean, stdev };
}
