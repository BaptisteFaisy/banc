/**
 * Ce que le banc annonce : scorecards, écarts au témoin, régressions, porte
 * de promotion, jury humain, calibrage, santé des oracles (§8, §11, §15,
 * §6.4), plus les adaptateurs de sources et les garde-fous chiffrés.
 *
 * La règle d'honnêteté (§25) est encodée dans les types : `value: number |
 * null` avec `n` — sous l'effectif minimal, une jauge affiche « pas assez de
 * recul » au lieu d'un pourcentage (§8), et le banc refuse d'annoncer une
 * jauge qu'il n'a pas calibrée (§15).
 */
import type {
  BenchMode,
  DeadOracleReason,
  DeltaKind,
  Gauge,
  OracleType,
  VerdictKind,
} from './kinds.js';
import type { SourceRef } from './oracles.js';
import type { SpecFingerprint, TestCondition } from './entities.js';
import type { AgentAnswer, BudgetUsage } from './results.js';
/**
 * Une jauge mesurée (§8). `n` sous l'effectif → « pas assez de recul » :
 * `value` vaut alors `null` et l'écran l'affiche, jamais un pourcentage.
 */
export interface ScorecardRow {
  readonly agentVersionId: string;
  readonly suiteId: string;
  readonly mode: BenchMode;
  readonly gauge: Gauge;
  readonly n: number;
  readonly value: number | null;
  readonly ciLow: number | null;
  readonly ciHigh: number | null;
  readonly floor: number;
  readonly computedAt: string;
}

/** Scorecard d'une version (§20 écran 2) : jauges + écarts au témoin. */
export interface Scorecard {
  readonly agentVersionId: string;
  readonly suiteId: string;
  readonly mode: BenchMode;
  readonly rows: readonly ScorecardRow[];
  readonly witnessVersionId?: string;
  readonly deltas: readonly GaugeDelta[];
  readonly deadOracleRate: number;
  readonly budget: Readonly<BudgetUsage>;
  readonly generatedAt: string;
}

/** Écart d'une jauge au témoin (§10), avec sa nature (§7). */
export interface GaugeDelta {
  readonly gauge: Gauge;
  readonly candidate: number | null;
  readonly witness: number | null;
  readonly delta: number | null;
  readonly kind: DeltaKind;
  readonly belowFloor: boolean;
}

/** Régression ou dérive de vérité (§7) : jamais confondues. */
export interface Regression {
  readonly id: string;
  readonly agentVersionId: string;
  readonly baselineVersionId: string;
  readonly caseId: string;
  readonly gauge: Gauge;
  readonly delta: number;
  readonly kind: DeltaKind;
  readonly openedAt: string;
  readonly state: 'ouverte' | 'close_dérive' | 'close_réparée';
  /** Preuve du changement de vérité, quand c'est une dérive (§25). */
  readonly truthEvidence?: Readonly<{ from: string; to: string; at: string }>;
}

/** Verdict de la porte de promotion (§11), avec les motifs du refus. */
export interface PromotionVerdict {
  readonly agentId: string;
  readonly candidateVersion: string;
  readonly witnessVersion?: string;
  readonly allowed: boolean;
  readonly motives: readonly PromotionMotive[];
  readonly evaluatedAt: string;
}

/** Les quatre conditions de la porte (§11) — une par motif, explicite. */
export interface PromotionMotive {
  readonly rule:
    | 'aucun_cas_bloquant_ne_régresse'
    | 'aucune_jauge_sous_son_plancher'
    | 'stabilité_au_dessus_du_plancher'
    | 'coût_dans_le_budget'
    | 'aucune_amorce_ne_passe';
  readonly passed: boolean;
  /** Le motif est lisible : la porte explique, elle ne refuse pas en silence. */
  readonly detail: string;
  readonly caseIds?: readonly string[];
  readonly gauges?: readonly Gauge[];
}

/** Vote du jury humain (§15) : l'agent sous test ne s'auto-évalue jamais. */
export interface Judgment {
  readonly id: string;
  readonly caseId: string;
  readonly judgeRef: string;
  readonly verdict: VerdictKind;
  readonly notes: string;
  readonly at: string;
  readonly sampleId: string;
}

/**
 * Étalonnage (§15) : le banc affiche son propre taux d'accord et REFUSE
 * d'annoncer une jauge qu'il n'a pas calibrée.
 */
export interface Calibration {
  readonly scope: string;
  readonly gauge: Gauge;
  readonly n: number;
  readonly autoVsHumanAgreement: number | null;
  readonly interJudgeAgreement: number | null;
  readonly threshold: number;
  readonly calibrated: boolean;
  readonly computedAt: string;
}

// ---------------------------------------------------------------------------
// §6.4 Santé des oracles — ce que le banc dit en face
// ---------------------------------------------------------------------------

/** Santé du référentiel (§20 écran 8) : morts, dérives, couverture. */
export interface OracleHealth {
  readonly scope: string;
  readonly total: number;
  readonly dead: number;
  readonly deadRate: number;
  readonly deadByReason: Readonly<Record<DeadOracleReason, number>>;
  readonly driftedRecently: readonly { readonly caseId: string; readonly at: string }[];
  readonly coverage: Readonly<Record<OracleType, number>>;
  readonly computedAt: string;
}

// ---------------------------------------------------------------------------
// §24 Sources : ce que le banc sait lire, et ce qu'il ne sait pas
// ---------------------------------------------------------------------------

/**
 * Résultat de lecture d'une source. Un droit manquant VIDE le résultat sans
 * erreur (§21) : `denied` distingue donc « pas de droit » de « pas de
 * données », et l'écran de santé des oracles affiche la différence.
 */
export interface SourceRead {
  readonly ok: boolean;
  readonly value: unknown;
  readonly denied: boolean;
  readonly sourceRefs: readonly SourceRef[];
  readonly readAt: string;
  readonly error?: string;
}

/** Adaptateur de source : Jira, Confluence, graphe, JSM (§6.1). */
export interface SourceAdapter {
  readonly name: 'graph' | 'jira' | 'confluence' | 'jsm';
  read(query: string): Promise<SourceRead>;
  /** Résout une citation d'agent en document réel (§8 fondation). */
  resolve(ref: SourceRef): Promise<SourceRead>;
}

/**
 * L'agent sous test, vu par le banc. Une interface, pas un client Rovo :
 * le banc de démonstration l'implémente avec des agents semés (§29), la
 * production avec une action Rovo (§21, 55 s par appel).
 */
export interface AgentUnderTest {
  readonly versionId: string;
  /** Empreinte lue au début de l'essai, relue à la fin (§13). */
  fingerprint(): Promise<Readonly<SpecFingerprint>>;
  /** Pose la question une fois, dans le mode demandé (§12). */
  ask(question: string, mode: BenchMode, condition?: TestCondition): Promise<AgentAnswer>;
}

// ---------------------------------------------------------------------------
// Garde-fous partagés
// ---------------------------------------------------------------------------

/** Passages par défaut (§9) : jamais de verdict sur un passage isolé. */
export const DEFAULT_PASSES = 3;

/** Effectif minimal sous lequel une jauge affiche « pas assez de recul » (§8). */
export const MIN_SAMPLE = 5;

/** Seuil d'accord auto/humain proposé (§15), à valider. */
export const CALIBRATION_THRESHOLD = 0.65;

/** Le banc de fumée tient en moins de deux minutes (§10, §17). */
export const SMOKE_BUDGET_SECONDS = 120;

/** Taille cible du lot d'or (§10) : une vingtaine de cas, pas plus. */
export const GOLD_SUITE_TARGET = 20;

/** Tranche d'exécution longue (§21) : 900 s via consumer, avec reprise. */
export const SLICE_SECONDS = 900;
