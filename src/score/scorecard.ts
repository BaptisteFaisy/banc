/**
 * Scorecard d'une version (§8, §20 écran 2).
 *
 * Une jauge n'est jamais annoncée seule : elle vient avec son effectif, sa
 * fourchette et son plancher. Sous l'effectif minimal, la jauge affiche
 * « pas assez de recul » au lieu d'un pourcentage — c'est la règle
 * d'honnêteté du §25, et elle est encodée dans le type (`value: number | null`).
 *
 * Les deux modes d'essai (§12) ne sont JAMAIS fusionnés : un agent peut être
 * excellent en livre ouvert et médiocre en livre fermé, et c'est précisément
 * l'écart entre les deux qui dit si le problème est la récupération ou le
 * raisonnement.
 */
import type {
  BenchMode, BudgetUsage, Gauge, GaugeDelta, OracleState, Scorecard, ScorecardRow, Verdict,
} from '../domain/vocabulary.js';
import { MIN_SAMPLE } from '../domain/vocabulary.js';
import { measuredGauge } from './interval.js';
import { GAUGE_FLOORS } from './floors.js';

/** Entrée de construction d'une scorecard. */
export interface ScorecardInput {
  readonly agentVersionId: string;
  readonly suiteId: string;
  readonly mode: BenchMode;
  readonly verdicts: readonly Verdict[];
  readonly oracleStates: readonly OracleState[];
  readonly budget: BudgetUsage;
  readonly witness?: { readonly versionId: string; readonly rows: readonly ScorecardRow[] };
  readonly floors?: Readonly<Record<Gauge, number>>;
  readonly generatedAt?: string;
}

/** Un verdict compte-t-il dans la jauge ? (ni mort, ni incident, ni null). */
function counts(verdict: Verdict): boolean {
  return verdict.value !== null && verdict.kind !== 'invérifiable' && verdict.kind !== 'incident';
}

/** Construit la ligne d'une jauge, avec effectif et fourchette de Wilson. */
export function rowFor(
  gauge: Gauge,
  verdicts: readonly Verdict[],
  mode: BenchMode,
  agentVersionId: string,
  suiteId: string,
  floors: Readonly<Record<Gauge, number>>,
  generatedAt: string,
): ScorecardRow {
  const scoped = verdicts.filter((verdict) => verdict.gauge === gauge && counts(verdict));
  // La jauge de coût mesure une grandeur, pas un taux de réussite : on moyenne.
  const successes = gauge === 'coût'
    ? scoped.length
    : scoped.filter((verdict) => (verdict.value ?? 0) >= 1).length;
  const measured = measuredGauge(successes, scoped.length, floors[gauge] ?? 0, MIN_SAMPLE);
  const value = gauge === 'coût' && scoped.length >= MIN_SAMPLE
    ? averageCost(scoped)
    : measured.value;
  return {
    agentVersionId, suiteId, mode, gauge, n: scoped.length, value,
    ciLow: measured.ciLow, ciHigh: measured.ciHigh, floor: floors[gauge] ?? 0, computedAt: generatedAt,
  };
}

/** Coût moyen observé sur les passages mesurés. */
function averageCost(verdicts: readonly Verdict[]): number | null {
  const costs = verdicts.map((verdict) => verdict.value ?? 0).filter((value) => value > 0);
  if (costs.length === 0) return null;
  return costs.reduce((total, cost) => total + cost, 0) / costs.length;
}

/** Taux d'oracles morts (§6.4) : un banc dont un tiers est mort ne vaut rien. */
export function deadOracleRate(states: readonly OracleState[]): number {
  if (states.length === 0) return 0;
  return states.filter((state) => !state.alive).length / states.length;
}

/** Écart d'une jauge au témoin (§10) : on compare à une mesure figée. */
export function deltaToWitness(row: ScorecardRow, witness: ScorecardRow | undefined): GaugeDelta {
  if (!witness || witness.value === null || row.value === null) {
    return {
      gauge: row.gauge, candidate: row.value, witness: witness?.value ?? null, delta: null,
      kind: 'stable', belowFloor: row.value !== null && row.value < row.floor,
    };
  }
  const delta = row.value - witness.value;
  const costGauge = row.gauge === 'coût';
  const kind = delta === 0 ? 'stable' : (costGauge ? delta > 0 : delta < 0) ? 'regression' : 'progress';
  return {
    gauge: row.gauge, candidate: row.value, witness: witness.value, delta, kind,
    belowFloor: row.value < row.floor,
  };
}

/** Construit la scorecard complète d'une version, dans un mode donné. */
export function buildScorecard(input: ScorecardInput): Scorecard {
  const floors = input.floors ?? GAUGE_FLOORS;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const gauges = Object.keys(floors) as readonly Gauge[];
  const rows = gauges.map((gauge) => rowFor(
    gauge, input.verdicts, input.mode, input.agentVersionId, input.suiteId, floors, generatedAt,
  ));
  const witnessRows = input.witness?.rows ?? [];
  const deltas = rows.map((row) => deltaToWitness(
    row, witnessRows.find((item) => item.gauge === row.gauge),
  ));
  return {
    agentVersionId: input.agentVersionId,
    suiteId: input.suiteId,
    mode: input.mode,
    rows,
    ...(input.witness ? { witnessVersionId: input.witness.versionId } : {}),
    deltas,
    deadOracleRate: deadOracleRate(input.oracleStates),
    budget: input.budget,
    generatedAt,
  };
}

/** Les jauges en rouge d'une scorecard, pour l'écran et la vidéo (§28). */
export function failingRows(scorecard: Scorecard): readonly ScorecardRow[] {
  return scorecard.rows.filter((row) => row.value !== null && row.value < row.floor);
}

/** Les jauges sans effectif suffisant : ce que le banc refuse d'annoncer. */
export function undecidedRows(scorecard: Scorecard): readonly ScorecardRow[] {
  return scorecard.rows.filter((row) => row.value === null);
}
