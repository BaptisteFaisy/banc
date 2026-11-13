/**
 * Jauge « fondation » (§8) : chaque affirmation est-elle adossée à une source ?
 *
 * Deux décisions de produit, non négociables :
 *   - une citation qui ne résout pas est une affirmation **infondée**, et
 *     c'est plus grave qu'une absence de citation (§26) : l'agent fabrique ;
 *   - cette jauge est **indépendante** de l'exactitude. Un agent exact mais
 *     qui ne cite rien a `exactitude: 1` et `fondation: 0`, et la régression
 *     est signalée sur fondation, pas sur exactitude (§26).
 *
 * La fondation est bloquante : ce n'est pas un indice de satisfaction (§31).
 */
import type { AgentCitation, RefusalOracleSpec, Verdict } from '../domain/vocabulary.js';
import { classifyRefusal } from '../oracle/refusal.js';
import { deadOracleVerdict, incidentVerdict, makeVerdict, resolvedRatio } from './deps.js';
import type { JudgeInput } from './deps.js';

/** Jauge la fondation d'un passage, quelle que soit la forme d'oracle. */
export function judgeFondation(input: JudgeInput): Verdict | null {
  if (!input.oracle.alive) return deadOracleVerdict(input, 'fondation');
  const incident = incidentVerdict(input, 'fondation');
  if (incident) return incident;
  // Un refus n'affirme rien : il n'y a donc aucune affirmation à fonder, et
  // la jauge ne s'y applique pas. Compter un refus sans citation comme une
  // fondation nulle condamnerait l'agent pour avoir bien refusé — le
  // contraire du §6.3, où le refus correct est une jauge à part entière.
  if (input.kase.oracleType === 'refus_attendu' && !input.kase.amorce) {
    const spec = input.kase.oracleSpec as RefusalOracleSpec;
    const refusal = classifyRefusal(spec, input.passage.answer);
    if (refusal.refused) return null;
  }
  const citations = input.citationsResolved;
  if (citations.length === 0) {
    return makeVerdict(input, 'fondation', 'infonde', 0, {
      reason: 'aucune_citation',
      note: 'exactitude éventuellement bonne, mais rien n’est adossé à une source',
    });
  }
  const unresolved = citations.filter((item) => item.resolved === null);
  if (unresolved.length > 0) {
    return makeVerdict(input, 'fondation', 'infonde', resolvedRatio(citations), {
      reason: 'citation_inexistante',
      unresolved: unresolved.map((item) => item.raw),
    }, { sources: resolvedSources(citations) });
  }
  return makeVerdict(input, 'fondation', 'fonde', 1, { citations: citations.length },
    { sources: resolvedSources(citations) });
}

/** Sources résolues, pour la preuve jointe au verdict. */
function resolvedSources(citations: readonly AgentCitation[]): readonly NonNullable<AgentCitation['resolved']>[] {
  return citations.map((item) => item.resolved).filter((ref): ref is NonNullable<typeof ref> => ref !== null);
}
