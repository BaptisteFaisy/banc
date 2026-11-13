/**
 * Jauge « exactitude » (§8) : l'agent donne-t-il la valeur de l'oracle ?
 *
 * Trois degrés, pas deux — la discipline de vocabulaire du §4 :
 *   exact        la valeur de l'oracle est donnée ;
 *   concordant   l'agent ne se contredit pas et reste cohérent avec l'oracle
 *                sans le nommer (valeur 0.5, pas 1 : ce n'est pas exact) ;
 *   faux         la valeur est absente et contredite.
 *
 * Les tolérances viennent du cas, jamais du correcteur : une tolérance
 * implicite serait une mesure fausse.
 */
import type { Verdict } from '../domain/vocabulary.js';
import type { DerivedOracleSpec } from '../domain/vocabulary.js';
import { valuesEqual, extractNumbers, normalise } from '../oracle/normalise.js';
import { deadOracleVerdict, incidentVerdict, makeVerdict, notApplicable } from './deps.js';
import type { JudgeInput } from './deps.js';

/** Recouvrement de tokens entre la réponse et la valeur attendue (0..1). */
function tokenOverlap(answer: string, expected: string): number {
  const stopWords = new Set(['le', 'la', 'les', 'des', 'une', 'un', 'the', 'and', 'for', 'with', 'est', 'a']);
  const words = expected
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/i)
    .filter((word) => word.length >= 4 && !stopWords.has(word));
  if (words.length === 0) return 0;
  const haystack = answer.toLowerCase();
  return words.filter((word) => haystack.includes(word)).length / words.length;
}

/** La valeur de l'oracle apparaît-elle comme nombre dans la réponse ? */
function numberMatches(input: JudgeInput, expected: unknown): boolean {
  const target = Number(expected);
  if (!Number.isFinite(target)) return false;
  const tolerance = (input.kase.oracleSpec as DerivedOracleSpec).tolerance;
  const margin = tolerance?.numeric ?? 0;
  return extractNumbers(input.passage.answer.text).some((found) => Math.abs(found - target) <= margin);
}

/** Jauge l'exactitude d'un passage sur un cas à valeur dérivée. */
export function judgeExactitude(input: JudgeInput): Verdict | null {
  if (notApplicable('exactitude', input.kase.oracleType)) return null;
  if (!input.oracle.alive) return deadOracleVerdict(input, 'exactitude');
  const incident = incidentVerdict(input, 'exactitude');
  if (incident) return incident;
  return gradeAnswer(input);
}

/** Note la réponse : exact, concordant ou faux. */
function gradeAnswer(input: JudgeInput): Verdict {
  const spec = input.kase.oracleSpec as DerivedOracleSpec;
  const expected = input.oracle.value;
  const answer = input.passage.answer.text;
  if (valuesEqual(answer, expected, spec.tolerance) || numberMatches(input, expected)) {
    return makeVerdict(input, 'exactitude', 'exact', 1, { matched: 'valeur' });
  }
  if (containsValue(answer, expected)) {
    return makeVerdict(input, 'exactitude', 'exact', 1, { matched: 'valeur_incluse' });
  }
  const overlap = tokenOverlap(answer, normalise(expected));
  if (overlap >= 0.5) {
    return makeVerdict(input, 'exactitude', 'concordant', 0.5, { overlap });
  }
  return makeVerdict(input, 'exactitude', 'faux', 0, { overlap });
}

/** La valeur attendue est-elle contenue littéralement dans la réponse ? */
function containsValue(answer: string, expected: unknown): boolean {
  if (expected === null || expected === undefined) return false;
  const needle = normalise(expected).trim();
  return needle.length > 0 && answer.toLowerCase().includes(needle.toLowerCase());
}
