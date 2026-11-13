/**
 * Déclencheurs de la plateforme Forge (§21).
 *
 * Limite plateforme : **cinq déclencheurs planifiés au plus, un seul à 5
 * minutes**. Trois sont déclarés dans le manifeste — la fumée sur événement
 * de version (le seul rapide), la suite complète la nuit, la veille de santé
 * des oracles. La marge reste disponible.
 *
 * Un essai long ne tient dans aucune fonction (25 s) : il passe par le
 * `consumer` (900 s) et se découpe en tranches avec curseur (§17).
 */
import type { BenchMode } from '../domain/vocabulary.js';
import { SLICE_SECONDS } from '../domain/vocabulary.js';

/** Ce qu'un déclencheur reçoit de la plateforme. */
export interface TriggerEvent {
  readonly issueKey?: string;
  readonly caseId?: string;
  readonly agentId?: string;
  readonly version?: string;
  readonly mode?: BenchMode;
}

/** Ce qu'un déclencheur décide de lancer. */
export interface TriggerDecision {
  readonly runSuite: 'smoke' | 'full' | 'none';
  readonly agentId?: string;
  readonly passes?: number;
  readonly reason: string;
}

/** Le déclencheur « cas créé » : un cas nouveau entre dans le corpus. */
export function onCaseCreated(event: TriggerEvent): TriggerDecision {
  if (!event.caseId) {
    return { runSuite: 'none', reason: 'aucun cas identifié' };
  }
  return {
    runSuite: 'smoke',
    ...(event.agentId ? { agentId: event.agentId } : {}),
    reason: `cas ${event.caseId} créé : fumée rejouée pour vérifier que le corpus reste vert`,
  };
}

/** Le déclencheur « ticket lié » : un ticket réel peut fournir un cas. */
export function onIssueLinked(event: TriggerEvent): TriggerDecision {
  if (!event.issueKey) return { runSuite: 'none', reason: 'aucun ticket lié' };
  return {
    runSuite: 'none',
    reason: `ticket ${event.issueKey} lié : proposition de cas à valider, pas d'essai`,
  };
}

/** Le déclencheur « version d'agent modifiée » : c'est là que la fumée sert. */
export function onAgentVersionChanged(event: TriggerEvent): TriggerDecision {
  if (!event.agentId) return { runSuite: 'none', reason: 'aucun agent identifié' };
  return {
    runSuite: 'smoke',
    agentId: event.agentId,
    passes: 1,
    reason: `version ${event.version ?? 'inconnue'} modifiée : fumée avant promotion (§17)`,
  };
}

/** La fumée planifiée sur événement de version. */
export function runSmoke(event: TriggerEvent): TriggerDecision {
  return onAgentVersionChanged(event);
}

/** La suite complète de la nuit, par tranches de 900 s. */
export function runFullSuite(event: TriggerEvent): TriggerDecision {
  if (!event.agentId) return { runSuite: 'none', reason: 'aucun agent identifié' };
  return {
    runSuite: 'full',
    agentId: event.agentId,
    passes: 3,
    reason: `suite complète de la nuit, par tranches de ${SLICE_SECONDS} s avec reprise`,
  };
}

/** La veille de santé des oracles : le référentiel se périme (§28). */
export function watchOracleHealth(): TriggerDecision {
  return { runSuite: 'none', reason: 'veille de santé des oracles : oracles morts et dérives récentes' };
}
