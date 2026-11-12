/**
 * Énumérations primitives du banc — aucune dépendance, aucun import.
 *
 * Les mots viennent du cahier des charges §4 (vocabulaire du produit) : un
 * concept a exactement une représentation, et le commentaire porte le § qui
 * le motive. Ce module est la racine du graphe d'imports du domaine.
 */
// ---------------------------------------------------------------------------
// §4 Gravité, verdicts, discipline de vocabulaire
// ---------------------------------------------------------------------------

/** Gravité d'un cas : `bloquant` entre dans le lot d'or, `souhaitable` mesure. */
export type Gravity = 'bloquant' | 'souhaitable';

/**
 * Discipline de vocabulaire (§4, dernier paragraphe). Les quatre mots ne sont
 * pas interchangeables et ne doivent jamais être confondus dans un écran :
 *  - `exact`         l'agent donne la valeur de l'oracle ;
 *  - `concordant`    l'agent ne se contredit pas et reste cohérent avec
 *                    l'oracle sans le nommer ;
 *  - `fonde`         toute affirmation est adossée à une source vérifiable ;
 *  - `infonde`       une citation ne résout pas, ou ne dit pas ça ;
 *  - `invérifiable`  aucune source ne permet de trancher (oracle mort).
 */
export type VerdictKind =
  | 'exact'
  | 'concordant'
  | 'fonde'
  | 'refus'
  | 'infonde'
  | 'invérifiable'
  | 'faux'
  | 'fissure'
  | 'incident';

/** Les trois formes d'oracle, non interchangeables (§6). */
export type OracleType = 'valeur_dérivée' | 'règle_vivante' | 'refus_attendu';

/** Les huit jauges (§8). L'ordre est celui du rapport. */
export type Gauge =
  | 'exactitude'
  | 'fondation'
  | 'citation_vivante'
  | 'exactitude_de_règle'
  | 'refus_correct'
  | 'complétude'
  | 'stabilité'
  | 'coût';

/** Les deux modes de contexte d'essai (§12), toujours rapportés séparément. */
export type BenchMode = 'blanc' | 'noir';

/** Nature d'un écart entre deux versions (§7) : la distinction centrale. */
export type DeltaKind = 'regression' | 'truth_drift' | 'stable' | 'progress';

/** Ce qui rend un oracle mort (§6.4) — « pas de droit » ≠ « pas de données ». */
export type DeadOracleReason =
  | 'source_absente'
  | 'droit_manquant'
  | 'système_non_branché'
  | 'règle_non_expressible';

/** Nature d'une amorce de la batterie hostile (§14). */
export type AmorceKind = 'injection' | 'contradiction' | 'fausse_citation';

/** Les quatre familles de suites (§10, §14, §17). */
export type SuiteKind = 'gold' | 'smoke' | 'battery' | 'full';

/** État d'un essai (§13, §17, §21) : un essai invalidé ne produit aucun score. */
export type RunState =
  | 'queued'
  | 'running'
  | 'sliced'
  | 'done'
  | 'stopped_budget'
  | 'invalidated';
