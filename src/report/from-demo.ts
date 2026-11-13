/**
 * Du résultat mesuré d'une version au rapport d'essai exportable (BE-29, §18).
 *
 * Ce module est le SEUL adaptateur entre le moteur (qui mesure) et le rapport
 * (qui met en forme). Il ne calcule rien : il réduit chaque cas à sa preuve
 * (`caseEvidence`) et confie l'assemblage à `buildAuditReport`. Brancher une
 * autre source de mesure — un essai réel, un essai Forge — ne demande donc
 * qu'un nouvel adaptateur, jamais une seconde mise en forme.
 */
import type {
  BenchMode, Fissure, Gauge, OracleHealth, RunState,
} from '../domain/vocabulary.js';
import type { DemoVersion } from '../demo/run.js';
import { buildAuditReport } from './build.js';
import type { ReportInput } from './build.js';
import { caseEvidence } from './evidence.js';
import type { AuditReport, ReportCase } from './types.js';

/** Tout ce qu'il faut pour exporter l'essai d'UNE version mesurée. */
export interface DemoReportSpec {
  readonly version: DemoVersion;
  /** L'agent sous test : la version testée en est une version, pas l'agent. */
  readonly agentId: string;
  readonly health: OracleHealth;
  readonly mode: BenchMode;
  readonly passes: number;
  readonly runId: string;
  /** Empreinte de la condition d'essai (§13) : les mêmes cas, le même instantané. */
  readonly conditionHash: string;
  readonly configHashAtEnd?: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly state?: RunState;
  readonly sampled?: boolean;
  readonly calibrated?: boolean;
  readonly calibratedGauges?: readonly Gauge[];
  readonly generatedAt?: string;
}

/** Réduit les cas mesurés d'une version à leur preuve auditable. */
export function casesOfVersion(version: DemoVersion): readonly ReportCase[] {
  return version.outcomes.map((outcome) => caseEvidence({
    kase: {
      id: outcome.caseId, question: outcome.question,
      gravity: outcome.gravity, oracleType: outcome.oracleType,
    },
    oracle: outcome.oracle,
    verdicts: outcome.verdicts,
    answers: outcome.answers,
    citations: outcome.citations,
  }));
}

/** Les fissures observées dans l'essai d'une version. */
function fissuresOf(version: DemoVersion): readonly Fissure[] {
  return version.outcomes.flatMap((outcome) => (outcome.crack ? [outcome.crack] : []));
}

/** Bâtit le rapport exportable d'une version mesurée. */
export function reportOfVersion(spec: DemoReportSpec): AuditReport {
  const version = spec.version;
  const input: ReportInput = {
    header: {
      title: `Bench trial — ${version.id}`,
      runId: spec.runId,
      agentId: spec.agentId,
      agentVersionId: version.id,
      suiteId: version.scorecard.suiteId,
      mode: spec.mode,
      passes: spec.passes,
      startedAt: spec.startedAt,
      ...(spec.finishedAt ? { finishedAt: spec.finishedAt } : {}),
      state: spec.state ?? 'done',
      conditionHash: spec.conditionHash,
      ...(spec.configHashAtEnd ? { configHashAtEnd: spec.configHashAtEnd } : {}),
    },
    scorecard: version.scorecard,
    gate: version.gate,
    cases: casesOfVersion(version),
    budget: version.scorecard.budget,
    fissures: fissuresOf(version),
    regressions: version.regressions,
    drifts: version.drifts,
    health: spec.health,
    passages: spec.passes * version.outcomes.length,
    sampled: spec.sampled ?? false,
    calibrated: spec.calibrated ?? false,
    ...(spec.calibratedGauges ? { calibratedGauges: spec.calibratedGauges } : {}),
    ...(spec.generatedAt ? { generatedAt: spec.generatedAt } : {}),
  };
  return buildAuditReport(input);
}