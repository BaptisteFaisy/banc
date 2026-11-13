/**
 * La construction du rapport d'essai (BE-29, §18).
 *
 * Le rapport est une FONCTION de ce que le banc a mesuré : mêmes verdicts,
 * même scorecard, même porte → même rapport. Il ne recompte rien, ne
 * réinterprète rien, et surtout il ne masque rien : une jauge sans effectif
 * reste sans effectif, un oracle mort reste mort, un essai invalidé reste
 * invalidé.
 *
 * L'honnêteté (§25) est structurelle, pas rédactionnelle : `ReportHonesty`
 * porte des FAITS (jauges non annoncées, calibrage, oracles morts, budget,
 * invalidation, échantillonnage) et les rendus les mettent en mots. Un
 * rapport ne peut donc pas être « optimiste » : il n'a pas la place de
 * l'être.
 */
import type {
  BudgetUsage, Fissure, Gauge, OracleHealth, PromotionVerdict, Regression, Scorecard,
} from '../domain/vocabulary.js';
import { digestOf } from './integrity.js';
import type {
  AuditReport, GaugeStatus, ReportChange, ReportConditions, ReportFissure, ReportGate,
  ReportGauge, ReportHonesty, ReportOracleHealth, ReportCase, ReportHeader,
} from './types.js';

/** Ce qu'il faut pour bâtir un rapport. */
export interface ReportInput {
  readonly header: ReportHeader;
  readonly scorecard: Scorecard;
  readonly gate: PromotionVerdict;
  readonly cases: readonly ReportCase[];
  readonly budget: BudgetUsage;
  readonly fissures?: readonly Fissure[];
  readonly regressions?: readonly Regression[];
  readonly drifts?: readonly Regression[];
  readonly health?: OracleHealth;
  /** Nombre de passages réellement joués. */
  readonly passages?: number;
  /** L'essai a-t-il porté sur un échantillon ? */
  readonly sampled?: boolean;
  /** Un jury humain a-t-il calibré ce banc ? */
  readonly calibrated?: boolean;
  readonly calibratedGauges?: readonly Gauge[];
  readonly generatedAt?: string;
}

/** Le statut d'une jauge : sous le plancher, dessus, ou sans recul (§8). */
function statusOf(value: number | null, floor: number): GaugeStatus {
  if (value === null) return 'pas_assez_de_recul';
  return value < floor ? 'sous_le_plancher' : 'au-dessus_du_plancher';
}

/** Les huit jauges du rapport, avec leur statut et leur écart au témoin. */
function buildGauges(scorecard: Scorecard): readonly ReportGauge[] {
  return scorecard.rows.map((row) => {
    const delta = scorecard.deltas.find((item) => item.gauge === row.gauge);
    return {
      gauge: row.gauge,
      n: row.n,
      value: row.value,
      ciLow: row.ciLow,
      ciHigh: row.ciHigh,
      floor: row.floor,
      status: statusOf(row.value, row.floor),
      witness: delta?.witness ?? null,
      delta: delta?.delta ?? null,
      kind: delta?.kind ?? 'stable',
    };
  });
}

/** La porte et ses motifs, avec les cas et les jauges que chaque motif cite. */
function buildGate(gate: PromotionVerdict): ReportGate {
  return {
    allowed: gate.allowed,
    motives: gate.motives.map((motive) => ({
      rule: motive.rule,
      passed: motive.passed,
      detail: motive.detail,
      caseIds: motive.caseIds ?? [],
      gauges: motive.gauges ?? [],
    })),
  };
}

/** Les fissures, avec l'attribution exigée par §9. */
function buildFissures(fissures: readonly Fissure[]): readonly ReportFissure[] {
  return fissures.map((crack) => ({
    caseId: crack.caseId,
    attribution: crack.attribution,
    passages: crack.passages,
    distinctAnswers: crack.spread.distinctAnswers,
    answerDistance: crack.spread.answerDistance,
    oracleStable: crack.spread.oracleStable,
    state: crack.state,
  }));
}

/** Les écarts au témoin : régression ou dérive, jamais confondus (§7). */
function buildChanges(changes: readonly Regression[]): readonly ReportChange[] {
  return changes.map((change) => ({
    caseId: change.caseId,
    gauge: change.gauge,
    delta: change.delta,
    kind: change.kind,
    ...(change.truthEvidence ? { truthEvidence: change.truthEvidence } : {}),
  }));
}

/** La santé des oracles : morts, taux, raisons (§6.4). */
function buildHealth(health: OracleHealth | undefined, cases: readonly ReportCase[]): ReportOracleHealth {
  if (health) {
    return {
      total: health.total, dead: health.dead, deadRate: health.deadRate,
      deadByReason: health.deadByReason,
    };
  }
  const dead = cases.filter((item) => !item.oracleAlive);
  return {
    total: cases.length,
    dead: dead.length,
    deadRate: cases.length === 0 ? 0 : dead.length / cases.length,
    deadByReason: {
      source_absente: 0, droit_manquant: 0, 'système_non_branché': 0, 'règle_non_expressible': 0,
    },
  };
}

/** Les conditions de l'essai : ce qui rend la mesure reproductible. */
function buildConditions(
  input: ReportInput, scorecard: Scorecard, budget: BudgetUsage,
): ReportConditions {
  return {
    cases: input.cases.length,
    passages: input.passages ?? input.cases.length * input.header.passes,
    calls: budget.calls,
    tokens: budget.tokens,
    costEstimate: budget.costEstimate,
    limitCalls: budget.limitCalls,
    limitTokens: budget.limitTokens,
    limitCost: budget.limitCost,
    exhausted: budget.exhausted,
    sampled: input.sampled ?? true,
    ...(scorecard.witnessVersionId ? { witnessVersionId: scorecard.witnessVersionId } : {}),
  };
}

/** L'honnêteté : les faits que le rapport assume (§25). */
function buildHonesty(
  input: ReportInput, gauges: readonly ReportGauge[], health: ReportOracleHealth,
): ReportHonesty {
  return {
    undecidedGauges: gauges.filter((gauge) => gauge.value === null).map((gauge) => gauge.gauge),
    calibrated: input.calibrated ?? false,
    calibratedGauges: input.calibratedGauges ?? [],
    deadOracles: health.dead,
    budgetExhausted: input.budget.exhausted,
    invalidated: input.header.state === 'invalidated',
    sampled: input.sampled ?? true,
  };
}

/** Bâtit le rapport d'essai. */
export function buildAuditReport(input: ReportInput): AuditReport {
  const gauges = buildGauges(input.scorecard);
  const health = buildHealth(input.health, input.cases);
  const body = {
    header: input.header,
    conditions: buildConditions(input, input.scorecard, input.budget),
    gauges,
    gate: buildGate(input.gate),
    fissures: buildFissures(input.fissures ?? []),
    regressions: buildChanges(input.regressions ?? []),
    drifts: buildChanges(input.drifts ?? []),
    health,
    cases: input.cases,
    honesty: buildHonesty(input, gauges, health),
  };
  return {
    ...body,
    integrity: {
      algorithm: 'sha256',
      digest: digestOf(body),
      generatedAt: input.generatedAt ?? new Date().toISOString(),
    },
  };
}
