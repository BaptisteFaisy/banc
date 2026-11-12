/**
 * Les trois formes d'oracle (§6) et l'état de vérité recalculé (§7).
 *
 * C'est la pièce centrale du produit : toute question du banc appartient à
 * une des trois formes, non interchangeables. L'oracle n'est jamais tapé
 * quand il est dérivable — il est RECALCULÉ à chaque essai depuis la source,
 * et son empreinte permet de distinguer une dérive de vérité d'une
 * régression de l'agent (§7).
 */
import type { DeadOracleReason } from './kinds.js';

/** Référence à une source réelle du graphe ou des produits (§8, fondation). */
export interface SourceRef {
  /** Type d'objet du Teamwork Graph ou produit : `document`, `work-item`… */
  readonly kind: string;
  /** Identifiant résolvable (ARI, clé de ticket, id de page). */
  readonly id: string;
  /** Ce qui est attendu dans la source, lisible par un humain. */
  readonly label?: string;
  /** Extrait attendu, pour la vérification d'implication (citation vivante). */
  readonly passage?: string;
}

/**
 * Oracle « valeur dérivée » (§6.1) : la réponse existe déjà dans les systèmes
 * sous une forme calculable. L'oracle n'est pas tapé, il est RECALCULÉ.
 */
export interface DerivedOracleSpec {
  readonly type: 'valeur_dérivée';
  /** Source qui détient la vérité : `graph`, `jira`, `confluence`, `jsm`. */
  readonly source: 'graph' | 'jira' | 'confluence' | 'jsm';
  /** Requête prête ou Cypher persisté (§24 : le Cypher brut est refusé). */
  readonly query: string;
  /** Chemin vers la valeur dans la réponse (point ou crochets). */
  readonly path: string;
  /** Unité déclarée pour la comparaison normalisée (dates, nombres, listes). */
  readonly unit?: string;
  /** Tolérances déclarées (§8 exactitude) — jamais implicites. */
  readonly tolerance?: Readonly<Tolerance>;
}

/** Tolérance de comparaison, déclarée dans le cas, jamais devinée (§8). */
export interface Tolerance {
  readonly numeric?: number;
  readonly dateGranularity?: 'day' | 'hour' | 'minute';
  readonly listOrderInsensitive?: boolean;
  readonly caseInsensitive?: boolean;
}

/** Un atome de prédicat : une condition élémentaire sur l'état courant. */
export interface RuleAtom {
  readonly id: string;
  /** Ce que l'atome vérifie, lisible — c'est le « motif » attendu (§6.2). */
  readonly label: string;
  readonly source: 'graph' | 'jira' | 'confluence' | 'jsm';
  readonly query: string;
  readonly path: string;
  /** Comparaison appliquée à la valeur lue. */
  readonly op: 'equals' | 'not_equals' | 'exists' | 'absent' | 'gt' | 'lt' | 'contains';
  readonly expected?: string | number | boolean;
}

/**
 * Oracle « règle vivante » (§6.2) : la réponse est un PRÉDICAT sur l'état
 * courant. L'agent n'a pas à connaître la règle, il doit la redécouvrir ;
 * le banc mesure le verdict ET la qualité des motifs cités.
 */
export interface RuleOracleSpec {
  readonly type: 'règle_vivante';
  readonly atoms: readonly RuleAtom[];
  /** Combinaison des atomes : `all` = ET, `any` = OU, sinon expression. */
  readonly combinator: 'all' | 'any' | { readonly and?: readonly string[]; readonly or?: readonly string[] };
  /** Verdict attendu quand le prédicat est vrai (ex. « oui, livrable »). */
  readonly expectedWhenTrue: string;
  readonly expectedWhenFalse: string;
  /** Un atome cité par l'agent compte comme motif ; tous sont exigés (§6.2). */
  readonly requireAllMotives: boolean;
}

/**
 * Oracle « refus attendu » (§6.3) : la question n'a pas de réponse et le bon
 * comportement est de ne pas répondre — dire ce qui manque et où le trouver.
 */
export interface RefusalOracleSpec {
  readonly type: 'refus_attendu';
  /** Ce qui manque : l'agent doit le nommer pour que le refus soit correct. */
  readonly missing: readonly string[];
  /** Où le trouver, si l'organisation le sait (le refus nuancé est accepté). */
  readonly whereToFind?: readonly string[];
  /**
   * Un refus pour la mauvaise raison est compté refus, motif faux (§26).
   * Quand `true`, seul un refus nommant `missing` passe.
   */
  readonly requireReason: boolean;
  /**
   * Pénalité appliquée quand l'agent répond au lieu de refuser : répondre à
   * un cas à refus est PLUS grave que répondre mal (§6.3, §27 recette 5).
   */
  readonly answeringPenalty: number;
}

/** Union des trois formes — jamais une quatrième (§6). */
export type OracleSpec = DerivedOracleSpec | RuleOracleSpec | RefusalOracleSpec;

/**
 * État recalculé d'un oracle (§7). Chaque cas garde un historique de vérité :
 * c'est ce qui permet de séparer régression de l'agent et dérive de vérité.
 */
export interface OracleState {
  readonly caseId: string;
  readonly versionNo: number;
  /** Empreinte SHA-256 de la valeur : la dérive se détecte par comparaison. */
  readonly valueHash: string;
  /** Valeur calculée, ou `null` quand l'oracle est mort. */
  readonly value: string | number | boolean | readonly string[] | null;
  readonly computedAt: string;
  readonly sourceRefs: readonly SourceRef[];
  /** Un oracle mort ne compte pas dans le score (§6.4) — jamais « faux ». */
  readonly alive: boolean;
  readonly deadReason?: DeadOracleReason;
  /** Instant de la dernière dérive observée, si la vérité a bougé. */
  readonly driftAt?: string;
  /** Verdicts du prédicat pour une règle vivante (§6.2). */
  readonly ruleOutcome?: Readonly<RuleOutcome>;
}

/** Résultat de l'application d'un prédicat de règle vivante. */
export interface RuleOutcome {
  readonly satisfied: boolean;
  /** Atomes vrais : ce sont les motifs que l'agent doit citer. */
  readonly trueAtoms: readonly string[];
  readonly falseAtoms: readonly string[];
  readonly expectedAnswer: string;
}
