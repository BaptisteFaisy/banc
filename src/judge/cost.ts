/**
 * Jauge « coût et latence » (§8) : ce que la qualité a coûté.
 *
 * Cette jauge ne compare jamais à un oracle : elle mesure. Jetons,
 * millisecondes et coût estimé par cas et par essai — c'est ce qui permet à la
 * porte de promotion de refuser une version qui dépasse le budget déclaré
 * (§11 règle d), et à l'organisation de comparer deux modèles à qualité et à
 * coût affichés (§32).
 *
 * Un oracle mort n'affecte pas cette jauge : le coût se mesure même quand la
 * vérité manque, et c'est même une information — on a payé pour rien.
 */
import type { Passage, Verdict } from '../domain/vocabulary.js';
import { incidentVerdict, makeVerdict } from './deps.js';
import type { JudgeInput } from './deps.js';

/** Coût agrégé d'un ensemble de passages, et coût moyen par cas. */
export interface CostSummary {
  readonly calls: number;
  readonly tokens: number;
  readonly costEstimate: number;
  readonly latencyMs: number;
  readonly averageCostPerCase: number;
  readonly averageLatencyMs: number;
}

/** Jauge le coût d'un passage. */
export function judgeCout(input: JudgeInput): Verdict | null {
  const incident = incidentVerdict(input, 'coût');
  if (incident) return incident;
  const { costEstimate, tokens, latencyMs } = input.passage;
  const measurable = Number.isFinite(costEstimate) && costEstimate >= 0;
  return makeVerdict(input, 'coût', measurable ? 'exact' : 'incident', measurable ? costEstimate : null, {
    costEstimate,
    tokens,
    latencyMs,
  });
}

/** Agrège le coût de plusieurs passages (un cas, ou tout un essai). */
export function costOf(passages: readonly Passage[]): CostSummary {
  const calls = passages.length;
  const tokens = passages.reduce((total, passage) => total + passage.tokens, 0);
  const costEstimate = passages.reduce((total, passage) => total + passage.costEstimate, 0);
  const latencyMs = passages.reduce((total, passage) => total + passage.latencyMs, 0);
  const cases = new Set(passages.map((passage) => passage.caseId)).size || 1;
  return {
    calls,
    tokens,
    costEstimate,
    latencyMs,
    averageCostPerCase: costEstimate / cases,
    averageLatencyMs: latencyMs / calls || 0,
  };
}

/** Le coût moyen par cas dépasse-t-il le budget déclaré ? */
export function overCostBudget(summary: CostSummary, limitCostPerCase: number): boolean {
  return summary.averageCostPerCase > limitCostPerCase;
}
