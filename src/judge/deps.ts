/**
 * Contrat commun des huit jauges (§8) et fabrique de verdicts.
 *
 * Une seule implémentation de `makeVerdict` pour tout le module : un verdict
 * voyage TOUJOURS avec sa preuve (réponse, oracle, sources), sinon
 * l'explorateur d'échecs (§20 écran 3) n'a rien à montrer et la piste
 * d'essais n'est pas opposable (§3).
 *
 * Trois règles transverses, valables pour les huit jauges :
 *   1. un oracle mort ne produit jamais un verdict d'échec — il produit
 *      `invérifiable` avec `value: null` (§6.4) ;
 *   2. une jauge non applicable à la forme d'oracle du cas rend `null` et
 *      n'entre pas dans le score ;
 *   3. une réponse vide ou une erreur d'outil est un `incident` : pas de
 *      rejeu, signalement immédiat (§17).
 */
import type {
  BancCase,
  Gauge,
  OracleState,
  Passage,
  BenchMode,
  AgentCitation,
  Verdict,
  VerdictEvidence,
  VerdictKind,
} from '../domain/vocabulary.js';
import { normalise, valuesEqual } from '../oracle/normalise.js';
import { systemClock } from '../oracle/deps.js';
import { isTrivialFailure, trivialFailureReason } from '../run/sideeffects.js';

/** Tout ce dont une jauge a besoin pour juger un passage. */
export interface JudgeInput {
  readonly kase: BancCase;
  readonly passage: Passage;
  readonly oracle: OracleState;
  readonly mode: BenchMode;
  readonly citationsResolved: readonly AgentCitation[];
  /** Vérification d'implication d'une citation (LLM hébergé, §24). */
  readonly implication?: (passage: string, claim: string) => Promise<boolean>;
  readonly clock?: () => string;
}

/** Port de normalisation : la jauge d'exactitude ne réimplémente rien. */
export interface Normaliser {
  normalise(value: unknown, tolerance?: unknown): string;
  equal(a: unknown, b: unknown, tolerance?: unknown): boolean;
}

/** Normaliseur par défaut, branché sur `src/oracle/normalise.ts`. */
export const defaultNormaliser: Normaliser = {
  normalise: (value, tolerance) => normalise(value, tolerance as never),
  equal: (a, b, tolerance) => valuesEqual(a, b, tolerance as never),
};

/** Rend l'oracle lisible pour la preuve jointe au verdict. */
export function oracleLabel(oracle: OracleState): string {
  if (!oracle.alive) return `oracle mort (${oracle.deadReason ?? 'raison inconnue'})`;
  if (oracle.value === null) return 'null';
  if (Array.isArray(oracle.value)) return oracle.value.join(', ');
  return String(oracle.value);
}

/** Construit un verdict, preuve comprise. */
export function makeVerdict(
  input: JudgeInput,
  gauge: Gauge,
  kind: VerdictKind,
  value: number | null,
  detail: Record<string, unknown>,
  evidence: Partial<VerdictEvidence> = {},
): Verdict {
  const clock = input.clock ?? systemClock;
  return {
    id: `${input.passage.id}:${gauge}`,
    passageId: input.passage.id,
    caseId: input.kase.id,
    gauge,
    kind,
    value,
    detail,
    evidence: {
      answer: input.passage.answer.text,
      oracle: oracleLabel(input.oracle),
      sources: input.oracle.sourceRefs,
      ...evidence,
    },
    computedAt: clock(),
  };
}

/** Oracle mort : `invérifiable`, jamais un échec (§6.4). */
export function deadOracleVerdict(input: JudgeInput, gauge: Gauge): Verdict {
  return makeVerdict(input, gauge, 'invérifiable', null, {
    reason: 'oracle_mort',
    deadReason: input.oracle.deadReason ?? null,
  });
}

/** Une jauge s'applique-t-elle à la forme d'oracle de ce cas ? */
export function notApplicable(gauge: Gauge, oracleType: BancCase['oracleType']): boolean {
  if (gauge === 'exactitude' || gauge === 'citation_vivante') return oracleType !== 'valeur_dérivée';
  if (gauge === 'exactitude_de_règle') return oracleType !== 'règle_vivante';
  if (gauge === 'refus_correct') return oracleType !== 'refus_attendu';
  return false;
}

/** Échec trivial : réponse vide ou erreur d'outil, signalé sans rejeu (§17). */
export function trivialFailureVerdict(input: JudgeInput, gauge: Gauge, reason: string): Verdict {
  return makeVerdict(input, gauge, 'incident', null, { reason, trivial: true });
}

/** Le passage est-il un incident d'essai (échec trivial ou effet de bord) ? */
export function incidentVerdict(input: JudgeInput, gauge: Gauge): Verdict | null {
  if (isTrivialFailure(input.passage.answer)) {
    return trivialFailureVerdict(input, gauge, trivialFailureReason(input.passage.answer) ?? 'échec trivial');
  }
  const effects = input.passage.answer.sideEffects;
  if (effects.length > 0) {
    return makeVerdict(input, gauge, 'incident', null, {
      reason: 'effet_de_bord',
      sideEffects: effects.map((effect) => `${effect.kind}:${effect.targetType}:${effect.targetId}`),
    });
  }
  return null;
}

/** Part de citations résolues : socle de la jauge de fondation (§8). */
export function resolvedRatio(citations: readonly AgentCitation[]): number {
  if (citations.length === 0) return 0;
  return citations.filter((item) => item.resolved !== null).length / citations.length;
}
