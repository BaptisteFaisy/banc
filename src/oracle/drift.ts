/**
 * Historique de vérité : dérive de vérité ≠ régression de l'agent (§7).
 *
 * Les oracles sont recalculés à chaque essai. Quand la vérité change, ce
 * n'est pas l'agent qui a régressé : c'est l'organisation qui a bougé. Chaque
 * cas garde donc un historique (`version_no`, `computed_at`, `value_hash`) et
 * le banc compare les empreintes pour qualifier l'événement.
 *
 * C'est la distinction que tous les frameworks d'évaluation oublient, et
 * celle qui évite de passer trois jours à déboguer un prompt alors que c'est
 * la source qui a changé.
 */
import type { OracleState } from '../domain/vocabulary.js';

/** Ce que la comparaison de deux états de vérité permet de conclure. */
export interface DriftResult {
  readonly drifted: boolean;
  readonly from?: string;
  readonly to?: string;
  readonly at: string;
  /** Les deux états étaient morts : rien à comparer, aucune dérive affirmée. */
  readonly bothDead?: boolean;
}

/** Rend une valeur lisible pour la preuve de dérive (jamais un objet brut). */
export function describeValue(state: OracleState): string {
  if (!state.alive) return `oracle mort (${state.deadReason ?? 'raison inconnue'})`;
  if (state.value === null) return 'null';
  if (Array.isArray(state.value)) return state.value.join(', ');
  return String(state.value);
}

/**
 * Compare deux états de vérité du même cas.
 *
 * - premier recalcul (`previous` absent) → pas de dérive, rien à comparer ;
 * - empreintes identiques → pas de dérive : la vérité n'a pas bougé, donc un
 *   changement de réponse de l'agent EST une régression ;
 * - empreintes différentes → dérive, avec la preuve (avant, après, instant).
 *
 * Un oracle mort des deux côtés n'est pas une dérive : on ne compare pas du
 * vide. Un passage vivant → mort (ou l'inverse) en est une, et elle est
 * décrite comme telle.
 */
export function detectDrift(previous: OracleState | undefined, current: OracleState): DriftResult {
  if (!previous) return { drifted: false, at: current.computedAt };
  if (!previous.alive && !current.alive) {
    return { drifted: false, at: current.computedAt, bothDead: true };
  }
  if (previous.valueHash === current.valueHash) {
    return { drifted: false, at: current.computedAt };
  }
  return {
    drifted: true,
    from: describeValue(previous),
    to: describeValue(current),
    at: current.computedAt,
  };
}

/** Trie un historique de vérité par numéro de version croissant. */
export function sortHistory(history: readonly OracleState[]): readonly OracleState[] {
  return [...history].sort((a, b) => a.versionNo - b.versionNo);
}

/** Toutes les dérives observées dans un historique, dans l'ordre. */
export function driftHistory(history: readonly OracleState[]): readonly DriftResult[] {
  const ordered = sortHistory(history);
  const drifts: DriftResult[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const result = detectDrift(ordered[index - 1], ordered[index]);
    if (result.drifted) drifts.push(result);
  }
  return drifts;
}

/** L'oracle a-t-il bougé depuis cette date (ISO) ? Sert à la veille (§28). */
export function driftedSince(history: readonly OracleState[], since: string): boolean {
  return driftHistory(history).some((drift) => drift.at >= since);
}
