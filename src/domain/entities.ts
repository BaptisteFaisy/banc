/**
 * Les entités du banc : cas, plaque, condition d'essai, suite, empreinte de
 * spécification, agent et version (§4, §10, §13).
 *
 * L'empreinte de spécification répond à « savoir ce qu'on teste » (§13) : un
 * agent est un assemblage (prompt, skills, actions, outils, modèle,
 * température), et la version est identifiée par empreinte, jamais par le
 * nom (§26).
 */
import type { AmorceKind, BenchMode, Gravity, OracleType, SuiteKind } from './kinds.js';
import type { OracleSpec } from './oracles.js';
/** Grille courte du jury humain (§15) : 3 critères, notes séparées. */
export interface Rubric {
  readonly criteria: readonly { readonly id: string; readonly label: string }[];
}

/** Un cas du banc (§4) : question + oracle + gravité. La « plaque ». */
export interface BancCase {
  readonly id: string;
  readonly spaceKey: string;
  readonly question: string;
  readonly oracleType: OracleType;
  readonly oracleSpec: OracleSpec;
  readonly gravity: Gravity;
  readonly tags: readonly string[];
  readonly rubric?: Readonly<Rubric>;
  readonly createdAt: string;
  readonly createdByRef: string;
  /** Provenance : ticket réel, question réelle, ou écrit à la main (§35.1). */
  readonly originRef?: string;
  readonly disabledAt?: string;
  /** Une amorce est bloquante par nature (§14). */
  readonly amorce?: Readonly<Amorce>;
}

/** Cas hostile de la batterie d'amorces (§14) : bloquant, jamais négocié. */
export interface Amorce {
  readonly kind: AmorceKind;
  /** Comportement attendu : ne pas suivre, signaler, ne pas fabriquer. */
  readonly expectedBehavior: string;
  readonly blocking: true;
}

/**
 * Condition d'essai (§4, §16) : l'instantané du contexte fourni à l'agent.
 * Figé et horodaté — deux versions testées à dix minutes d'intervalle
 * reçoivent le MÊME instantané, sinon la comparaison est malhonnête (§5).
 */
export interface TestCondition {
  readonly id: string;
  readonly caseId: string;
  readonly snapshotHash: string;
  readonly snapshotRef: string;
  readonly capturedAt: string;
  readonly mode: BenchMode;
}

/** Une suite : lot d'or, banc de fumée, batterie, suite complète (§10, §17). */
export interface Suite {
  readonly id: string;
  readonly name: string;
  readonly kind: SuiteKind;
  readonly caseIds: readonly string[];
  readonly version: number;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// §13 Empreinte de spécification — « savoir ce qu'on teste »
// ---------------------------------------------------------------------------

/**
 * Empreinte de la configuration testée (§13). Un agent n'est pas un objet,
 * c'est un assemblage ; tester « l'agent » sans dire lequel est un non-sens.
 * La version est identifiée par empreinte, JAMAIS par le nom (§26).
 */
export interface SpecFingerprint {
  readonly specHash: string;
  readonly promptHash: string;
  readonly skills: readonly { readonly key: string; readonly hash: string }[];
  readonly actions: readonly string[];
  readonly tools: readonly string[];
  readonly model: string;
  readonly temperature: number;
  readonly capturedAt: string;
}

/** Version d'agent, dont le témoin (§10) qui sert de plancher. */
export interface AgentVersion {
  readonly id: string;
  readonly agentId: string;
  readonly label: string;
  readonly fingerprint: Readonly<SpecFingerprint>;
  readonly isWitness: boolean;
  readonly createdAt: string;
}

/** Un agent sous test (§22 table `agent`). */
export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly rovoRef: string;
  readonly ownerRef: string;
  readonly suiteKind: SuiteKind;
  readonly createdAt: string;
}
