/**
 * Échantillonnage d'une suite (§26).
 *
 * Quand le nombre de cas dépasse ce qu'un essai peut jouer dans son budget,
 * la suite est échantillonnée **en priorité sur les cas bloquants**, et
 * l'échantillonnage est affiché : un score calculé sur un sous-ensemble non
 * déclaré serait une mesure malhonnête (§25).
 */
import type { BancCase } from '../domain/vocabulary.js';

/** Ce que l'échantillonnage annonce, pour que rien ne soit implicite. */
export interface Sampling {
  readonly selected: readonly BancCase[];
  readonly sampled: boolean;
  readonly total: number;
  readonly selectedCount: number;
  readonly excludedBlocking: readonly string[];
  readonly motive: string | null;
}

/** Priorité : bloquants d'abord, puis le reste dans l'ordre du corpus. */
function byPriority(cases: readonly BancCase[]): readonly BancCase[] {
  const blocking = cases.filter((item) => item.gravity === 'bloquant' && !item.disabledAt);
  const others = cases.filter((item) => item.gravity !== 'bloquant' && !item.disabledAt);
  return [...blocking, ...others];
}

/** Échantillonne une suite dans la limite de cas jouables. */
export function sampleSuite(cases: readonly BancCase[], capacity: number): Sampling {
  const enabled = cases.filter((item) => !item.disabledAt);
  if (capacity <= 0 || enabled.length <= capacity) {
    return {
      selected: enabled, sampled: false, total: cases.length,
      selectedCount: enabled.length, excludedBlocking: [], motive: null,
    };
  }
  const ordered = byPriority(cases);
  const selected = ordered.slice(0, capacity);
  const chosen = new Set(selected.map((item) => item.id));
  const excludedBlocking = ordered
    .filter((item) => !chosen.has(item.id) && item.gravity === 'bloquant')
    .map((item) => item.id);
  return {
    selected,
    sampled: true,
    total: cases.length,
    selectedCount: selected.length,
    excludedBlocking,
    motive: excludedBlocking.length > 0
      ? `échantillonnage : ${excludedBlocking.length} cas bloquant(s) non joué(s) faute de budget`
      : `échantillonnage : ${selected.length} cas joués sur ${cases.length}`,
  };
}

/** Le lot d'or : les cas bloquants non désactivés (§10). */
export function goldSuite(cases: readonly BancCase[]): readonly BancCase[] {
  return cases.filter((item) => item.gravity === 'bloquant' && !item.disabledAt);
}

/** Le banc de fumée : sous-ensemble rapide, ≤ 2 minutes (§10, §17). */
export function smokeSuite(cases: readonly BancCase[], maxCases = 20): readonly BancCase[] {
  return goldSuite(cases).slice(0, maxCases);
}
