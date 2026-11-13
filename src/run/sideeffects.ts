// Effets de bord et incidents d'essai.
// Comportement produit exigé : un agent qui ÉCRIT pendant qu'on l'évalue est
// disqualifié pour ce cas, avec la trace. C'est aussi un résultat en soi :
// « votre agent écrit en production pendant qu'on l'évalue ».
// Un échec trivial (réponse vide, outil en erreur, incident déclaré) ne se
// rejoue PAS k fois : on signale immédiatement l'incident d'essai.
import type { AgentAnswer, SideEffect } from '../domain/vocabulary.js';

/** Rend les effets de bord observés dans la réponse de l'agent. */
export function detectSideEffects(answer: AgentAnswer): readonly SideEffect[] {
  return answer.sideEffects;
}

/** Disqualification : vrai dès qu'un effet de bord est présent. */
export function disqualifiedBySideEffect(answer: AgentAnswer): boolean {
  return detectSideEffects(answer).length > 0;
}

/**
 * Échec trivial : réponse vide (après trim), `trivialFailure` renseigné,
 * un appel d'outil en échec (`ok: false`) ou aucune réponse textuelle.
 * Dans ces cas on ne rejoue pas k fois, on signale immédiatement l'incident.
 */
export function isTrivialFailure(answer: AgentAnswer): boolean {
  return trivialFailureReason(answer) !== null;
}

/** La raison exacte de l'incident, lisible ; `null` si la réponse est saine. */
export function trivialFailureReason(answer: AgentAnswer): string | null {
  if (answer.text.trim() === '') return 'réponse vide';
  const incident = answer.trivialFailure;
  if (incident !== undefined && incident.trim() !== '') {
    return `incident déclaré : ${incident}`;
  }
  const outilEnEchec = answer.toolCalls.find((appel) => !appel.ok);
  if (outilEnEchec !== undefined) return `erreur d'outil : ${outilEnEchec.name}`;
  return null;
}

/** Trace lisible pour le rapport : une ligne par effet de bord. */
export function sideEffectTrace(effects: readonly SideEffect[]): string {
  if (effects.length === 0) return 'aucun effet de bord observé';
  return effects
    .map((effet) => `- ${effet.kind} ${effet.targetType} ${effet.targetId} (observé le ${effet.observedAt})`)
    .join('\n');
}
