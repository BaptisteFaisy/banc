/**
 * Le rapport d'essai exportable pour auditeur (BE-29, §18).
 *
 * C'est la vue « opposable » du banc : un objet sérialisable et autonome,
 * qui contient tout ce qu'un auditeur doit pouvoir vérifier SANS accès à
 * l'application — l'identité de l'essai, ses conditions, la scorecard, la
 * porte, les fissures, les régressions distinguées des dérives de vérité, la
 * preuve cas par cas, les oracles morts, et l'honnêteté (§25).
 *
 * Le rapport ne calcule rien : il met en forme ce que le banc a mesuré. Les
 * deux rendus (Confluence, Markdown) ne font que sérialiser ce modèle — une
 * seule mesure, deux sorties.
 */
import type {
  BenchMode, DeadOracleReason, DeltaKind, Gauge, Gravity, OracleType, RunState, VerdictKind,
} from '../domain/vocabulary.js';

/** Identité de l'essai audité : ce qui a été testé, et par qui. */
export interface ReportHeader {
  readonly title: string;
  readonly runId: string;
  readonly agentId: string;
  readonly agentVersionId: string;
  readonly suiteId: string;
  readonly mode: BenchMode;
  readonly passes: number;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly state: RunState;
  /** Empreinte de la condition d'essai : le même instantané, les mêmes cas. */
  readonly conditionHash: string;
  /** Empreinte de la configuration testée (§13). */
  readonly configHashAtEnd?: string;
  readonly invalidatedReason?: string;
}

/** Les conditions de l'essai : ce qui rend la mesure reproductible. */
export interface ReportConditions {
  readonly cases: number;
  readonly passages: number;
  readonly calls: number;
  readonly tokens: number;
  readonly costEstimate: number;
  readonly limitCalls: number;
  readonly limitTokens: number;
  readonly limitCost: number;
  readonly exhausted: boolean;
  readonly sampled: boolean;
  readonly witnessVersionId?: string;
}

/** Statut d'une jauge dans le rapport — la jauge refuse de mentir (§8). */
export type GaugeStatus = 'au-dessus_du_plancher' | 'sous_le_plancher' | 'pas_assez_de_recul';

/** Une jauge du rapport : la mesure, son effectif, sa fourchette, son plancher. */
export interface ReportGauge {
  readonly gauge: Gauge;
  readonly n: number;
  /** `null` = pas assez de recul : jamais `0` (§8). */
  readonly value: number | null;
  readonly ciLow: number | null;
  readonly ciHigh: number | null;
  readonly floor: number;
  readonly status: GaugeStatus;
  readonly witness: number | null;
  readonly delta: number | null;
  readonly kind: DeltaKind;
}

/** Un motif de la porte : la porte explique son refus, elle ne refuse pas en silence. */
export interface ReportGateMotif {
  readonly rule: string;
  readonly passed: boolean;
  readonly detail: string;
  readonly caseIds: readonly string[];
  readonly gauges: readonly Gauge[];
}

/** La porte de promotion et ses motifs. */
export interface ReportGate {
  readonly allowed: boolean;
  readonly motives: readonly ReportGateMotif[];
}

/** Une fissure : le verdict change d'un passage à l'autre (§9). */
export interface ReportFissure {
  readonly caseId: string;
  readonly attribution: 'cas_mal_écrit' | 'agent_instable' | 'indéterminé';
  readonly passages: number;
  readonly distinctAnswers: number;
  readonly answerDistance: number;
  readonly oracleStable: boolean;
  readonly state: string;
}

/** Un écart au témoin : régression de l'agent, ou dérive de vérité (§7). */
export interface ReportChange {
  readonly caseId: string;
  readonly gauge: Gauge;
  readonly delta: number;
  readonly kind: DeltaKind;
  readonly truthEvidence?: Readonly<{ from: string; to: string; at: string }>;
}

/** Un verdict rendu dans la preuve d'un cas. */
export interface ReportVerdict {
  readonly gauge: Gauge;
  readonly kind: VerdictKind;
  readonly value: number | null;
  readonly motives: readonly string[];
  readonly missingMotives: readonly string[];
}

/** La preuve d'un cas : la question, l'oracle, la réponse, les verdicts. */
export interface ReportCase {
  readonly caseId: string;
  readonly question: string;
  readonly gravity: Gravity;
  readonly oracleType: OracleType;
  readonly oracleValue: string | null;
  readonly oracleAlive: boolean;
  readonly oracleDeadReason?: DeadOracleReason;
  /** La réponse de l'agent, tronquée : le rapport garde la preuve, pas le volume. */
  readonly answer: string;
  readonly answerHash: string;
  readonly citations: readonly Readonly<{ raw: string; alive: boolean }>[];
  readonly verdicts: readonly ReportVerdict[];
  /** Le cas passe-t-il ? Aucun verdict en échec → oui. */
  readonly passed: boolean;
}

/** La santé des oracles : morts, taux, raisons (§6.4). */
export interface ReportOracleHealth {
  readonly total: number;
  readonly dead: number;
  readonly deadRate: number;
  readonly deadByReason: Readonly<Record<DeadOracleReason, number>>;
}

/**
 * L'honnêteté (§25) : ce que le rapport ne dit pas. Les réserves sont des
 * FAITS, pas des phrases : le rendu les met en mots dans la langue demandée.
 */
export interface ReportHonesty {
  /** Les jauges que le banc refuse d'annoncer faute d'effectif. */
  readonly undecidedGauges: readonly Gauge[];
  /** Un jury humain a-t-il calibré ce banc ? */
  readonly calibrated: boolean;
  /** Les jauges calibrées, quand elles existent. */
  readonly calibratedGauges: readonly Gauge[];
  readonly deadOracles: number;
  readonly budgetExhausted: boolean;
  readonly invalidated: boolean;
  readonly sampled: boolean;
}

/** L'intégrité : l'empreinte du corps du rapport (§18). */
export interface ReportIntegrity {
  readonly algorithm: 'sha256';
  /** SHA-256 du corps canonique : toute retouche casse cette empreinte. */
  readonly digest: string;
  readonly generatedAt: string;
}

/** Le rapport d'essai, exportable. */
export interface AuditReport {
  readonly header: ReportHeader;
  readonly conditions: ReportConditions;
  readonly gauges: readonly ReportGauge[];
  readonly gate: ReportGate;
  readonly fissures: readonly ReportFissure[];
  readonly regressions: readonly ReportChange[];
  readonly drifts: readonly ReportChange[];
  readonly health: ReportOracleHealth;
  readonly cases: readonly ReportCase[];
  readonly honesty: ReportHonesty;
  readonly integrity: ReportIntegrity;
}
