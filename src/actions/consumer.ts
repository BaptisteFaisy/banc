/**
 * Consommateur d'essais longs (§17, §21).
 *
 * Une action Forge dure 55 s, une fonction 25 s, et un `consumer` 900 s. Un
 * essai de 200 cas × 3 passages ne tient donc dans AUCUNE fonction : il est
 * découpé en tranches avec curseur, et chaque tranche est reprenable.
 *
 * Deux garanties : aucun cas n'est perdu (le curseur avance sur ce qui a été
 * joué) et aucun cas n'est rejoué (le curseur est persisté avant la tranche
 * suivante).
 */
import type { BenchMode, Run, Suite } from '../domain/vocabulary.js';
import { SLICE_SECONDS } from '../domain/vocabulary.js';

/** Ce qu'une tranche doit faire. */
export interface SliceRequest {
  readonly run: Run;
  readonly suite: Suite;
  readonly mode: BenchMode;
  readonly sliceSeconds?: number;
}

/** Ce que le consommateur renvoie au runtime. */
export interface SliceOutcome {
  readonly runId: string;
  readonly cursor: number;
  readonly total: number;
  readonly finished: boolean;
  readonly reason: string;
}

/** Calcule la tranche courante à jouer. */
export function nextSlice(request: SliceRequest, totalCases: number): {
  from: number; to: number; finished: boolean;
} {
  const from = request.run.cursor ?? 0;
  const to = Math.min(from + Math.max(1, totalCases), totalCases);
  return { from, to, finished: from >= totalCases };
}

/** La tranche est-elle finie ? */
export function isFinished(outcome: SliceOutcome): boolean {
  return outcome.finished;
}

/** Pourquoi la tranche s'est arrêtée — toujours explicite (§25). */
export function stopReason(run: Run): string {
  if (run.state === 'stopped_budget') return 'budget épuisé : l’essai s’est arrêté et le dit';
  if (run.state === 'invalidated') return `essai invalidé : ${run.invalidatedReason ?? 'raison inconnue'}`;
  if (run.state === 'done') return 'essai terminé';
  return `en cours — curseur ${run.cursor ?? 0}`;
}

/** Durée maximale d'une tranche, alignée sur la limite plateforme. */
export function sliceSeconds(): number {
  return SLICE_SECONDS;
}
