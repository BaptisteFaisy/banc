/**
 * Les TYPES des vues de démonstration du site.
 *
 * Il n'existe AUCUNE donnée écrite ici : les vues (cas en échec, dérive,
 * fissure, santé des oracles) sont CONSTRUITES par `demo-facts.ts` à partir
 * de la démonstration CALCULÉE par le vrai moteur. Ce fichier ne porte que la
 * forme des vues affichées, pour que le site reste typé sans dupliquer le
 * produit.
 */
import type { VerdictKind } from '../../src/domain/vocabulary.js';

/** Un facteur de la règle vivante, lu dans l'oracle calculé. */
export interface FactorView {
  readonly label: string;
  readonly source: string;
  readonly query: string;
  readonly expected: string;
  readonly read: string;
  readonly satisfied: boolean;
}

/** Un verdict affiché sur une jauge, avec son motif. */
export interface VerdictView {
  readonly gauge: string;
  readonly label: string;
  readonly kind: VerdictKind;
  readonly detail: string;
}

/** Le cas en échec, exploré : réponse, oracle, sources (§20 écran 3). */
export interface FailureCase {
  readonly caseId: string;
  readonly question: string;
  readonly rule: string;
  readonly expectedAnswer: string;
  readonly factors: readonly FactorView[];
  readonly agentVersion: string;
  readonly answer: string;
  readonly citations: readonly string[];
  readonly missingMotives: readonly string[];
  readonly verdicts: readonly VerdictView[];
}

/** La dérive de vérité, avec l'historique de vérité avant/après. */
export interface TruthDriftView {
  readonly caseId: string;
  readonly question: string;
  readonly source: string;
  readonly before: { readonly version: number; readonly value: string; readonly computedAt: string; readonly hash: string };
  readonly after: { readonly version: number; readonly value: string; readonly computedAt: string; readonly hash: string };
  readonly agentVersion: string;
  readonly agentAnswer: string;
  readonly verdict: string;
  readonly detail: string;
}

/** La fissure, avec l'attribution et les passages. */
export interface CrackCase {
  readonly caseId: string;
  readonly question: string;
  readonly agentVersion: string;
  readonly attribution: string;
  readonly reason: string;
  readonly oracleStable: boolean;
  readonly passages: readonly {
    readonly no: number;
    readonly answer: string;
    readonly kind: VerdictKind;
    readonly note: string;
  }[];
}
