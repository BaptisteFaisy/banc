/**
 * Fissures et stabilité (§9).
 *
 * Un cas fissuré n'est pas un cas difficile : c'est un cas **mal écrit** ou un
 * agent **non stable** — et le banc dit lequel des deux, avec l'écart entre
 * les réponses. Sans cette attribution, la fissure est du bruit ; avec elle,
 * c'est une liste de travail : à réécrire, à trancher, ou à désactiver.
 *
 * Règle de fond : on ne conclut jamais sur un passage isolé. Un cas joué une
 * seule fois ne peut pas être fissuré.
 */
import type { Fissure, Passage, Verdict, VerdictKind } from '../domain/vocabulary.js';
import { hashValue } from '../oracle/hash.js';
import { systemClock } from '../oracle/deps.js';

/** Seuil de distance entre réponses : en dessous, les réponses sont proches. */
export const ANSWER_DISTANCE_THRESHOLD = 0.35;

/** Effectif minimal pour annoncer un taux de stabilité (§8). */
export const MIN_CASES_FOR_STABILITY = 5;

/** Verdicts distincts, dans l'ordre d'apparition. */
export function verdictSpread(verdicts: readonly Verdict[]): readonly VerdictKind[] {
  const seen: VerdictKind[] = [];
  for (const verdict of verdicts) {
    if (!seen.includes(verdict.kind)) seen.push(verdict.kind);
  }
  return seen;
}

/** Ensembles de mots d'un texte, pour une distance de Jaccard. */
function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-zà-ÿ0-9]+/i).filter((word) => word.length > 1));
}

/**
 * Distance normalisée entre deux textes (0 = identiques, 1 = disjoints).
 * Jaccard sur les mots : déterministe, sans dépendance externe.
 */
export function answerDistance(texts: readonly string[]): number {
  if (texts.length < 2) return 0;
  let worst = 0;
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      worst = Math.max(worst, jaccardDistance(wordSet(texts[i] ?? ''), wordSet(texts[j] ?? '')));
    }
  }
  return worst;
}

/** Distance de Jaccard entre deux ensembles. */
function jaccardDistance(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : 1 - shared / union;
}

/**
 * Attribution du diagnostic (§9) : le cas ou l'agent ?
 *
 * - oracle instable                → indéterminé (la vérité bouge, on ne peut
 *                                    accuser ni l'un ni l'autre) ;
 * - réponses différentes           → agent instable ;
 * - réponses quasi identiques mais
 *   verdicts différents            → cas mal écrit (le correcteur est ambigu).
 */
export function attributeFissure(
  oracleStable: boolean,
  distinctAnswers: number,
  distance: number,
): Fissure['attribution'] {
  if (!oracleStable) return 'indéterminé';
  if (distinctAnswers > 1 && distance >= ANSWER_DISTANCE_THRESHOLD) return 'agent_instable';
  if (distance < ANSWER_DISTANCE_THRESHOLD) return 'cas_mal_écrit';
  return 'indéterminé';
}

/** Réponses distinctes d'un cas, par empreinte. */
function distinctAnswersOf(passages: readonly Passage[]): number {
  return new Set(passages.map((passage) => passage.answerHash)).size;
}

/** Détecte une fissure sur un cas joué k fois ; `null` si aucune. */
export function detectFissure(
  caseId: string,
  agentVersionId: string,
  passages: readonly Passage[],
  verdicts: readonly Verdict[],
  oracleStable: boolean,
  openedAt: string = systemClock(),
): Fissure | null {
  if (passages.length < 2) return null; // jamais de conclusion sur un passage isolé
  const kinds = verdictSpread(verdicts);
  if (kinds.length <= 1) return null;
  const texts = passages.map((passage) => passage.answer.text);
  const distance = answerDistance(texts);
  const distinct = distinctAnswersOf(passages);
  return {
    id: `fissure:${agentVersionId}:${caseId}:${hashValue(kinds).slice(0, 8)}`,
    caseId,
    agentVersionId,
    passages: passages.length,
    spread: { verdicts: kinds, distinctAnswers: distinct, answerDistance: distance, oracleStable },
    attribution: attributeFissure(oracleStable, distinct, distance),
    state: 'ouverte',
    openedAt,
  };
}

/** Une fissure est-elle présente ? */
export function isFissured(fissure: Fissure | null): boolean {
  return fissure !== null;
}

/**
 * Stabilité d'une version : taux de cas NON fissurés, avec effectif.
 * Sous `MIN_CASES_FOR_STABILITY`, `rate` vaut `null` — pas assez de recul,
 * jamais un pourcentage (§8).
 */
export function stabilityRate(
  fissures: readonly Fissure[],
  caseCount: number,
): { rate: number | null; n: number; fissured: number } {
  const fissured = new Set(fissures.map((fissure) => fissure.caseId)).size;
  if (caseCount < MIN_CASES_FOR_STABILITY) {
    return { rate: null, n: caseCount, fissured };
  }
  if (caseCount === 0) return { rate: null, n: 0, fissured: 0 };
  return { rate: (caseCount - fissured) / caseCount, n: caseCount, fissured };
}

/** Liste de travail : les fissures encore ouvertes (§9). */
export function fissureWorklist(fissures: readonly Fissure[]): readonly Fissure[] {
  return fissures.filter((fissure) => fissure.state === 'ouverte');
}
