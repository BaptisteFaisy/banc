/**
 * Journal d'essai (§4, §18 BE-18) : complet et rejouable.
 *
 * La piste d'essais est ce que la sécurité et la conformité attendent (§3) :
 * datée, rejouable, opposable. Chaque entrée porte l'heure, l'événement et le
 * détail — y compris les arrêts (budget, effet de bord, invalidation), parce
 * qu'un banc interrompu doit le dire plutôt que de rendre un score tronqué.
 *
 * Le journal ne contient jamais le texte des réponses : il porte des
 * empreintes et des références (§21 — l'app conserve des faits, pas du
 * contenu métier dans une table de statistiques).
 */

/** Une entrée du journal d'essai. */
export interface RunLogEntry {
  readonly at: string;
  readonly runId: string;
  readonly event: RunLogEvent;
  readonly detail: Readonly<Record<string, unknown>>;
}

/** Événements tracés : tout ce qui change l'état d'un essai. */
export type RunLogEvent =
  | 'essai_créé'
  | 'condition_capturée'
  | 'empreinte_initiale'
  | 'tranche_démarrée'
  | 'cas_posé'
  | 'passage_joué'
  | 'oracle_recalculé'
  | 'oracle_mort'
  | 'verdict_calculé'
  | 'fissure_ouverte'
  | 'effet_de_bord'
  | 'échec_trivial'
  | 'budget_chargé'
  | 'budget_épuisé'
  | 'empreinte_finale'
  | 'essai_invalidé'
  | 'tranche_terminée'
  | 'essai_terminé';

/** Crée une entrée de journal. */
export function runLogEntry(
  runId: string,
  event: RunLogEvent,
  at: string,
  detail: Record<string, unknown> = {},
): RunLogEntry {
  return { at, runId, event, detail };
}

/** Ajoute une entrée à un journal (les données sont immuables). */
export function appendLog(log: readonly RunLogEntry[], entry: RunLogEntry): readonly RunLogEntry[] {
  return [...log, entry];
}

/** Journal trié par horodatage : ce qui est rejoué dans l'ordre. */
export function replayableLog(log: readonly RunLogEntry[]): readonly RunLogEntry[] {
  return [...log].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Filtre le journal sur un type d'événement (explorateur d'échecs). */
export function logOfEvent(log: readonly RunLogEntry[], event: RunLogEvent): readonly RunLogEntry[] {
  return log.filter((entry) => entry.event === event);
}

/** Les événements qui justifient un arrêt ou une invalidation. */
export function blockingEvents(log: readonly RunLogEntry[]): readonly RunLogEntry[] {
  const blocking: readonly RunLogEvent[] = [
    'budget_épuisé', 'effet_de_bord', 'essai_invalidé', 'échec_trivial',
  ];
  return log.filter((entry) => blocking.includes(entry.event));
}

/** Rend le journal lisible pour un commentaire de PR ou un rapport. */
export function renderLog(log: readonly RunLogEntry[], limit = 40): string {
  return replayableLog(log)
    .slice(0, limit)
    .map((entry) => `${entry.at} ${entry.event}`)
    .join('\n');
}
