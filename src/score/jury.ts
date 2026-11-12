/**
 * Échantillonnage du jury humain (§15) et enregistrement des votes.
 *
 * Le tirage est **reproductible** : à `seed` fixé, le même échantillon sort.
 * C'est une exigence de la piste d'essais opposable (§3) — un échantillon
 * différent à chaque rejeu rendrait l'étalonnage incomparable.
 *
 * La grille est courte : 3 critères, notes séparées. Une grille longue n'est
 * pas remplie, et un jury qui ne remplit pas sa grille ne calibre rien.
 */
import type { BancCase, Judgment, VerdictKind } from '../domain/vocabulary.js';

/** Taille par défaut de l'échantillon soumis au jury. */
export const DEFAULT_SAMPLE_SIZE = 10;

/** Taille par défaut de la grille : trois critères, notes séparées (§15). */
export const DEFAULT_RUBRIC = [
  { id: 'exactitude', label: 'La réponse donne-t-elle la valeur attendue ?' },
  { id: 'fondation', label: 'Chaque affirmation est-elle adossée à une source ?' },
  { id: 'comportement', label: 'Le comportement est-il celui attendu (répondre / refuser) ?' },
] as const;

/** PRNG déterministe (mulberry32) : le tirage ne dépend pas de `Math.random`. */
function seededRandom(seed: string): () => number {
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange de Fisher-Yates avec un générateur semé. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    const swap = copy[index] as T;
    copy[index] = copy[target] as T;
    copy[target] = swap;
  }
  return copy;
}

/** Tire un échantillon de cas à soumettre au jury, de façon reproductible. */
export function sampleForJury(
  cases: readonly BancCase[],
  size: number = DEFAULT_SAMPLE_SIZE,
  seed: string,
): readonly BancCase[] {
  const eligible = cases.filter((item) => !item.disabledAt);
  if (eligible.length <= size) return eligible;
  return shuffle(eligible, seededRandom(seed)).slice(0, size);
}

/** Identifiant d'un échantillon : ce qui rend le tirage traçable. */
export function sampleId(seed: string, cases: readonly BancCase[]): string {
  return `sample:${seed}:${cases.length}`;
}

/** Construit un vote du jury humain. */
export function makeJudgment(input: {
  caseId: string; judgeRef: string; verdict: VerdictKind; notes: string;
  at: string; sampleId: string; id?: string;
}): Judgment {
  return {
    id: input.id ?? `judgment:${input.caseId}:${input.judgeRef}:${input.at}`,
    caseId: input.caseId,
    judgeRef: input.judgeRef,
    verdict: input.verdict,
    notes: input.notes,
    at: input.at,
    sampleId: input.sampleId,
  };
}

/** Paires auto/humain pour l'étalonnage, appariées par cas. */
export function pairJudgments(
  auto: Readonly<Record<string, VerdictKind>>,
  judgments: readonly Judgment[],
): readonly { auto: VerdictKind; human: VerdictKind }[] {
  const pairs: { auto: VerdictKind; human: VerdictKind }[] = [];
  for (const judgment of judgments) {
    const automatic = auto[judgment.caseId];
    if (automatic) pairs.push({ auto: automatic, human: judgment.verdict });
  }
  return pairs;
}

/** Accord entre deux notateurs sur les mêmes cas. */
export function judgePairs(judgments: readonly Judgment[]): readonly { a: VerdictKind; b: VerdictKind }[] {
  const byCase = new Map<string, Judgment[]>();
  for (const judgment of judgments) {
    byCase.set(judgment.caseId, [...(byCase.get(judgment.caseId) ?? []), judgment]);
  }
  const pairs: { a: VerdictKind; b: VerdictKind }[] = [];
  for (const votes of byCase.values()) {
    if (votes.length < 2) continue;
    const [first, second] = votes as [Judgment, Judgment];
    pairs.push({ a: first.verdict, b: second.verdict });
  }
  return pairs;
}

/** Les cas encore sans vote du jury : la liste de travail du jury. */
export function awaitingJudgment(sample: readonly BancCase[], judgments: readonly Judgment[]): readonly BancCase[] {
  const judged = new Set(judgments.map((judgment) => judgment.caseId));
  return sample.filter((item) => !judged.has(item.id));
}
