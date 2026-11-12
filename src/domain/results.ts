/**
 * Ce que produit un essai : réponses, passages, verdicts avec leur preuve,
 * fissures, budget et journal (§4, §9, §16, §17).
 *
 * Trois exigences structurent ces types. (1) Un verdict voyage avec sa
 * preuve — réponse, oracle, sources — sinon l'explorateur d'échecs (§20
 * écran 3) ne peut rien montrer. (2) Une fissure porte son attribution : cas
 * mal écrit ou agent instable, le banc dit lequel (§9). (3) Un effet de bord
 * observé est tracé, jamais ignoré : écrire pendant un essai disqualifie le
 * cas (§16).
 */
import type { BenchMode, Gauge, RunState, VerdictKind } from './kinds.js';
import type { SourceRef } from './oracles.js';
/** Réponse de l'agent sur un passage, avec ce que le banc en observe. */
export interface AgentAnswer {
  readonly text: string;
  /** Citations produites par l'agent : résolues ou non (§8 fondation). */
  readonly citations: readonly AgentCitation[];
  readonly latencyMs: number;
  readonly tokens: number;
  readonly costEstimate: number;
  readonly toolCalls: readonly { readonly name: string; readonly ok: boolean }[];
  /** Effets de bord observés : écrire pendant l'essai disqualifie (§16). */
  readonly sideEffects: readonly SideEffect[];
  /** Réponse vide ou erreur d'outil : rejet précoce, pas de rejeu (§17). */
  readonly trivialFailure?: string;
}

/** Une citation produite par l'agent, et ce que le banc en résout (§8). */
export interface AgentCitation {
  readonly raw: string;
  readonly resolved: SourceRef | null;
  /** La source existe et contient réellement l'affirmation (§8). */
  readonly alive: boolean;
  readonly passage?: string;
}

/** Effet de bord détecté pendant un essai (§16) : tracé, jamais silencieux. */
export interface SideEffect {
  readonly kind: 'created' | 'updated' | 'commented' | 'deleted';
  readonly targetType: string;
  readonly targetId: string;
  readonly observedAt: string;
}

/** Un passage (§4) : une répétition d'un cas au sein d'un essai. */
export interface Passage {
  readonly id: string;
  readonly runId: string;
  readonly caseId: string;
  readonly passageNo: number;
  readonly answerHash: string;
  readonly answerRef: string;
  readonly answer: Readonly<AgentAnswer>;
  readonly latencyMs: number;
  readonly tokens: number;
  readonly costEstimate: number;
}

/**
 * Verdict d'un cas sur une jauge, avec sa preuve (§4). Un verdict sans
 * preuve n'est pas stocké : la réponse, l'oracle et les sources voyagent
 * avec lui, pour l'explorateur d'échecs (§20 écran 3).
 */
export interface Verdict {
  readonly id: string;
  readonly passageId: string;
  readonly caseId: string;
  readonly gauge: Gauge;
  readonly kind: VerdictKind;
  /** 1 = la jauge passe, 0 = elle échoue ; `null` = non applicable ou mort. */
  readonly value: number | null;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly evidence: Readonly<VerdictEvidence>;
  readonly computedAt: string;
}

/** Preuve jointe au verdict (§4) : ce que l'explorateur d'échecs affiche. */
export interface VerdictEvidence {
  readonly answer?: string;
  readonly oracle?: string;
  readonly sources?: readonly SourceRef[];
  readonly motives?: readonly string[];
  readonly missingMotives?: readonly string[];
}

/**
 * Fissure (§9) : le verdict diffère entre passages. Un cas fissuré n'est pas
 * un cas difficile, c'est un cas mal écrit OU un agent non stable — et le
 * banc dit lequel des deux, avec l'écart entre les réponses.
 */
export interface Fissure {
  readonly id: string;
  readonly caseId: string;
  readonly agentVersionId: string;
  readonly passages: number;
  readonly spread: Readonly<FissureSpread>;
  /** Le diagnostic exigé par §9 : le cas ou l'agent. */
  readonly attribution: 'cas_mal_écrit' | 'agent_instable' | 'indéterminé';
  readonly state: 'ouverte' | 'réécrite' | 'tranchée' | 'désactivée';
  readonly openedAt: string;
}

/** Écart mesuré entre passages : ce qui justifie l'attribution (§9). */
export interface FissureSpread {
  readonly verdicts: readonly VerdictKind[];
  readonly distinctAnswers: number;
  readonly answerDistance: number;
  readonly oracleStable: boolean;
}

// ---------------------------------------------------------------------------
// §17 Essai et budget
// ---------------------------------------------------------------------------

/** Budget consommé (§17, §21) : affiché et plafonné, jamais muet. */
export interface BudgetUsage {
  readonly calls: number;
  readonly tokens: number;
  readonly costEstimate: number;
  readonly limitCalls: number;
  readonly limitTokens: number;
  readonly limitCost: number;
  readonly exhausted: boolean;
}

/** Un essai (§4) : l'exécution du banc sur une version donnée d'un agent. */
export interface Run {
  readonly id: string;
  readonly agentVersionId: string;
  readonly suiteId: string;
  readonly mode: BenchMode;
  readonly passes: number;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly state: RunState;
  readonly budget: Readonly<BudgetUsage>;
  /** Empreinte finale : différente de l'empreinte de départ → invalidé (§13). */
  readonly configHashAtEnd?: string;
  readonly invalidatedReason?: string;
  /** Curseur de reprise : un essai long tourne par tranches (§17, §21). */
  readonly cursor?: number;
  readonly conditionHash: string;
}
