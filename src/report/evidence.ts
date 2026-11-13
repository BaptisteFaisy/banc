/**
 * La preuve, cas par cas : ce qui permet à un auditeur de vérifier le banc
 * sans croire le banc.
 *
 * Un verdict qui voyage sans sa preuve ne prouve rien (§4). Cette réduction
 * est l'UNIQUE endroit où la réponse, l'oracle, les citations et les
 * verdicts d'un cas sont assemblés pour le rapport : le banc de démonstration
 * et le banc réel passent tous les deux par ici, donc le rapport d'essai
 * raconte la même histoire dans les deux cas.
 */
import type {
  AgentCitation, BancCase, OracleState, Verdict,
} from '../domain/vocabulary.js';
import { sha256 } from '../oracle/sha256.js';
import type { ReportCase, ReportVerdict } from './types.js';

/** Longueur de la réponse conservée dans la preuve : la preuve, pas le volume (§21). */
export const ANSWER_EXCERPT = 600;

/** Ce qu'il faut pour réduire un cas à sa preuve auditable. */
export interface CaseEvidenceInput {
  readonly kase: Pick<BancCase, 'id' | 'question' | 'gravity' | 'oracleType'>;
  readonly oracle: OracleState;
  readonly verdicts: readonly Verdict[];
  readonly answers: readonly string[];
  readonly citations?: readonly AgentCitation[];
  /** Empreinte de la réponse : si elle est absente, elle est recalculée. */
  readonly answerHash?: string;
}

/** Réduit un verdict à sa preuve : la jauge, le mot, la valeur, les motifs. */
function reduceVerdict(verdict: Verdict): ReportVerdict {
  return {
    gauge: verdict.gauge,
    kind: verdict.kind,
    value: verdict.value,
    motives: verdict.evidence.motives ?? [],
    missingMotives: verdict.evidence.missingMotives ?? [],
  };
}

/** Tronque la réponse en gardant le début, qui porte la réponse elle-même. */
function excerpt(text: string): string {
  if (text.length <= ANSWER_EXCERPT) return text;
  return `${text.slice(0, ANSWER_EXCERPT)}…`;
}

/** Réduit un cas à sa preuve auditable. */
export function caseEvidence(input: CaseEvidenceInput): ReportCase {
  const answer = excerpt(input.answers[0] ?? '');
  const verdicts = input.verdicts.map(reduceVerdict);
  return {
    caseId: input.kase.id,
    question: input.kase.question,
    gravity: input.kase.gravity,
    oracleType: input.kase.oracleType,
    oracleValue: input.oracle.value === null ? null : String(input.oracle.value),
    oracleAlive: input.oracle.alive,
    ...(input.oracle.deadReason ? { oracleDeadReason: input.oracle.deadReason } : {}),
    answer,
    answerHash: input.answerHash ?? sha256(input.answers[0] ?? ''),
    citations: (input.citations ?? []).map((citation) => ({
      raw: citation.raw, alive: citation.alive,
    })),
    verdicts,
    passed: !verdicts.some((verdict) => verdict.value === 0),
  };
}
