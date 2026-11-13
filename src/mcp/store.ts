/**
 * Port de données des outils MCP (§19).
 *
 * Les outils ne parlent pas à Forge SQL directement : ils parlent à ce port.
 * C'est ce qui permet (a) de tester les douze outils sans aucune persistance,
 * (b) de brancher le dépôt réel (`src/db/`) en production, et (c) de faire
 * tourner le banc de démonstration (§29) sur des données semées en mémoire.
 *
 * Un outil ne calcule rien : tout ce qui est mesuré (scorecard, porte,
 * stabilité, santé des oracles) est calculé par `src/score/` et `src/oracle/`.
 */
import type {
  BancCase, Fissure, OracleState, PromotionVerdict, Regression, Scorecard, VerdictKind,
} from '../domain/vocabulary.js';
import type { CaseRepo, OracleRepo } from '../db/repo.js';
import type { McpResult } from './handlers.js';

/** Ce que le dépôt expose aux outils. */
export interface BancStore {
  readonly cases: CaseRepo;
  readonly oracles: OracleRepo;
  /** Cas d'une suite donnée, parmi ceux déjà visibles. */
  suiteOf(suite: string, visible: readonly BancCase[]): Promise<readonly BancCase[]>;
  /** Scorecard d'une version (la dernière si `version` est absent). */
  scorecardOf(agentId: string, version?: string): Promise<Scorecard | undefined>;
  /** Régressions et dérives entre deux versions. */
  regressionsBetween(agentId: string, from: string, to: string): Promise<{
    regressions: readonly Regression[]; drifts: readonly Regression[];
  }>;
  /** Diff de verdicts et fissures communes entre deux versions. */
  compareVersions(agentId: string, versionA: string, versionB: string): Promise<McpResult>;
  /** Verdict de la porte de promotion. */
  promotionOf(agentId: string, candidateVersion: string): Promise<PromotionVerdict | undefined>;
  /** Taux de fissures et cas instables. */
  stabilityOf(agentId: string, version?: string): Promise<McpResult>;
  /** Santé des oracles d'un périmètre. */
  oracleHealthOf(scope: string): Promise<McpResult>;
  /** Cas proposé depuis un ticket ou une question, oracle candidat à valider. */
  proposeCase(issueKey?: string, question?: string): Promise<McpResult>;
  /** Vote du jury humain, avec accord inter-notateurs. */
  recordJudgment(input: {
    caseId: string; verdict: VerdictKind; notes: string; judgeRef: string;
  }): Promise<McpResult>;
  /** Journal d'essai rejouable. */
  runLogOf(runId: string): Promise<McpResult | undefined>;
  /** Crée un essai et en joue une tranche. */
  startRun(input: { agentId: string; suite: 'smoke' | 'full'; passes?: number }): Promise<{
    runId: string; state: string; progress: { played: number; total: number }; budget: McpResult;
  }>;
}

/** Données semées d'un magasin de démonstration. */
export interface SeedData {
  readonly cases: readonly BancCase[];
  readonly oracles: Readonly<Record<string, readonly OracleState[]>>;
  readonly scorecards: Readonly<Record<string, Scorecard>>;
  readonly regressions: readonly Regression[];
  readonly fissures: readonly Fissure[];
  readonly promotions: Readonly<Record<string, PromotionVerdict>>;
  readonly logs: Readonly<Record<string, McpResult>>;
}

/** Magasin vide : sert de socle au magasin de démonstration. */
export function emptySeed(): SeedData {
  return { cases: [], oracles: {}, scorecards: {}, regressions: [], fissures: [], promotions: {}, logs: {} };
}
