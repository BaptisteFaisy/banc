/**
 * Point d'entrée du jugement : une réponse d'agent devient des verdicts par
 * jauge, chacun avec sa preuve.
 *
 * Un outil, un écran ou le moteur d'essai n'appelle QUE ce fichier. Les huit
 * jauges vivent dans leur propre module ; ici on dispatche selon la forme
 * d'oracle du cas, on écarte ce qui ne s'applique pas, et on garantit les
 * trois règles transverses (§25) :
 *   - un oracle mort produit `invérifiable`, jamais un échec ;
 *   - une jauge non applicable n'apparaît pas dans le résultat ;
 *   - un incident d'essai (réponse vide, erreur d'outil, effet de bord)
 *     court-circuite les jauges de fond : on ne note pas une réponse absente.
 */
import type { Fissure, Verdict } from '../domain/vocabulary.js';
import { judgeExactitude } from './exactitude.js';
import { judgeFondation } from './fondation.js';
import { judgeCitationVivante } from './citation.js';
import { judgeRule } from './rule.js';
import { judgeRefus } from './refusal.js';
import { judgeCompletude } from './completeness.js';
import { judgeStabilite } from './stability.js';
import { judgeCout } from './cost.js';
import type { JudgeInput } from './deps.js';

export type { JudgeInput } from './deps.js';
export { makeVerdict, deadOracleVerdict, notApplicable, incidentVerdict } from './deps.js';

/** Les huit jauges, dans l'ordre du rapport (§8). */
export const GAUGES = [
  'exactitude', 'fondation', 'citation_vivante', 'exactitude_de_règle',
  'refus_correct', 'complétude', 'stabilité', 'coût',
] as const;

/** Jauges évaluées sur un seul passage (la stabilité porte sur les k passages). */
const PER_PASSAGE_GAUGES = [
  'exactitude', 'fondation', 'citation_vivante', 'exactitude_de_règle',
  'refus_correct', 'complétude', 'coût',
] as const;

/** Jauge un passage sur toutes les jauges applicables. */
export async function judgePassage(input: JudgeInput): Promise<readonly Verdict[]> {
  const verdicts: Verdict[] = [];
  for (const verdict of await perPassageVerdicts(input)) {
    if (verdict) verdicts.push(verdict);
  }
  return verdicts;
}

/** Évalue les jauges qui portent sur un passage unique. */
async function perPassageVerdicts(input: JudgeInput): Promise<readonly (Verdict | null)[]> {
  return [
    judgeExactitude(input),
    judgeFondation(input),
    await judgeCitationVivante(input),
    judgeRule(input),
    judgeRefus(input),
    judgeCompletude(input),
    judgeCout(input),
  ];
}

/**
 * Ajoute la jauge de stabilité, calculée sur l'ensemble des passages du cas.
 * Chaque passage reçoit le même verdict de stabilité : sinon la moyenne
 * dépendrait de l'ordre de jeu, et la mesure ne serait pas reproductible.
 */
export function withStability(
  verdicts: readonly Verdict[],
  input: JudgeInput,
  allVerdictKinds: readonly Verdict['kind'][],
  fissure: Fissure | null,
): readonly Verdict[] {
  const stability = judgeStabilite(input, allVerdictKinds, fissure);
  return stability ? [...verdicts, stability] : verdicts;
}

/** Les jauges effectivement produites pour un cas, dans l'ordre du rapport. */
export function gaugesOf(verdicts: readonly Verdict[]): readonly string[] {
  const present = new Set(verdicts.map((verdict) => verdict.gauge));
  return GAUGES.filter((gauge) => present.has(gauge));
}

/** Nombre de jauges attendues pour un passage (sert aux rapports de couverture). */
export function expectedGaugeCount(): number {
  return PER_PASSAGE_GAUGES.length;
}
