/**
 * Jauge « citation vivante » (§8) : la source citée existe, est lisible, et
 * contient RÉELLEMENT l'affirmation.
 *
 * Trois états distincts, que §26 impose de ne pas confondre :
 *   infonde            la citation ne résout sur aucun document — l'agent
 *                      fabrique une source (plus grave que ne pas citer) ;
 *   citation_non_vivante  la source existe mais ne dit pas ça ;
 *   fonde              la source existe et contient l'affirmation.
 *
 * La vérification d'implication passe par le LLM hébergé (§24, modèle léger).
 * Sans LLM, le banc retombe sur un contrôle déterministe : le passage cité
 * doit contenir la valeur de l'oracle. Le repli est documenté dans le
 * verdict, jamais silencieux.
 */
import type { AgentCitation, Verdict } from '../domain/vocabulary.js';
import { normalise } from '../oracle/normalise.js';
import { deadOracleVerdict, incidentVerdict, makeVerdict } from './deps.js';
import type { JudgeInput } from './deps.js';

/** Le passage cité contient-il la valeur de l'oracle (repli déterministe) ? */
export function passageImpliesOracle(passage: string, oracleValue: unknown): boolean {
  const expected = normalise(oracleValue).trim().toLowerCase();
  if (expected.length === 0) return false;
  return normalise(passage).toLowerCase().includes(expected);
}

/** Une citation est-elle vivante ? Implication LLM si disponible, repli sinon. */
async function isAlive(
  citation: AgentCitation,
  input: JudgeInput,
): Promise<{ alive: boolean; method: 'llm' | 'déterministe' }> {
  if (citation.resolved === null) return { alive: false, method: 'déterministe' };
  if (!citation.alive) return { alive: false, method: 'déterministe' };
  const passage = citation.passage ?? '';
  if (input.implication) {
    try {
      const claim = String(input.oracle.value ?? '');
      return { alive: await input.implication(passage, claim), method: 'llm' };
    } catch {
      // Un LLM en échec ne valide jamais : on retombe sur le repli déterministe.
      return { alive: passageImpliesOracle(passage, input.oracle.value), method: 'déterministe' };
    }
  }
  return { alive: passageImpliesOracle(passage, input.oracle.value), method: 'déterministe' };
}

/** Jauge la vivacité des citations d'un passage. */
export async function judgeCitationVivante(input: JudgeInput): Promise<Verdict | null> {
  const citations = input.citationsResolved;
  if (citations.length === 0) return null; // rien à vérifier : c’est `fondation` qui tranche
  if (!input.oracle.alive) return deadOracleVerdict(input, 'citation_vivante');
  const incident = incidentVerdict(input, 'citation_vivante');
  if (incident) return incident;
  return gradeCitations(input, citations);
}

/** Note l'ensemble des citations et choisit le verdict le plus grave. */
async function gradeCitations(input: JudgeInput, citations: readonly AgentCitation[]): Promise<Verdict> {
  const results = [];
  for (const citation of citations) results.push(await isAlive(citation, input));
  const aliveCount = results.filter((result) => result.alive).length;
  const ratio = aliveCount / citations.length;
  const methods = [...new Set(results.map((result) => result.method))];
  const unresolved = citations.filter((item) => item.resolved === null).length;
  const detail = { ratio, methods, aliveCount, total: citations.length };
  if (unresolved > 0) {
    return makeVerdict(input, 'citation_vivante', 'infonde', ratio, { ...detail, reason: 'citation_inexistante' });
  }
  if (aliveCount < citations.length) {
    return makeVerdict(input, 'citation_vivante', 'faux', ratio, { ...detail, reason: 'citation_non_vivante' });
  }
  return makeVerdict(input, 'citation_vivante', 'fonde', 1, detail);
}
