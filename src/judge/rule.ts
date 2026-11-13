/**
 * Jauge « exactitude de règle » (§8) : pour un cas à règle vivante, on mesure
 * DEUX choses séparément — le verdict, et la qualité des motifs cités.
 *
 * C'est la jauge qui casse les agents (§6.2) : un agent peut arriver à la
 * bonne conclusion sans citer les trois facteurs (il a deviné), et un agent
 * dont la conclusion diffère peut rester cohérent avec ce qu'il avance (il a
 * lu un état différent, ou s'est trompé de règle — mais il n'a pas inventé).
 * Ces deux situations ne reçoivent pas la même note.
 */
import type { RuleOracleSpec, Verdict } from '../domain/vocabulary.js';
import { compareMotives, expectedMotives } from '../oracle/rule.js';
import { deadOracleVerdict, incidentVerdict, makeVerdict, notApplicable } from './deps.js';
import type { JudgeInput } from './deps.js';

/** La réponse de l'agent tranche-t-elle dans le sens attendu ? */
function answerMatchesExpected(answer: string, expected: string): boolean {
  const haystack = answer.toLowerCase();
  const needle = expected.toLowerCase().trim();
  if (needle.length === 0) return false;
  if (haystack.includes(needle)) return true;
  const words = needle.split(/\s+/).filter((word) => word.length >= 3);
  if (words.length === 0) return false;
  return words.filter((word) => haystack.includes(word)).length / words.length >= 0.6;
}

/** Motifs cités par l'agent : ses propres citations, plus le texte. */
function citedMotives(input: JudgeInput): readonly string[] {
  const fromCitations = input.citationsResolved.map((item) => item.raw);
  return [...fromCitations, input.passage.answer.text];
}

/** Jauge le verdict et les motifs d'un cas à règle vivante. */
export function judgeRule(input: JudgeInput): Verdict | null {
  if (notApplicable('exactitude_de_règle', input.kase.oracleType)) return null;
  if (!input.oracle.alive || !input.oracle.ruleOutcome) {
    return deadOracleVerdict(input, 'exactitude_de_règle');
  }
  const incident = incidentVerdict(input, 'exactitude_de_règle');
  if (incident) return incident;
  return gradeRule(input);
}

/** Combine l'exactitude du verdict et la complétude des motifs. */
function gradeRule(input: JudgeInput): Verdict {
  const spec = input.kase.oracleSpec as RuleOracleSpec;
  const outcome = input.oracle.ruleOutcome;
  if (!outcome) return deadOracleVerdict(input, 'exactitude_de_règle');
  const expected = expectedMotives(spec, outcome);
  const motives = compareMotives(spec, outcome, citedMotives(input));
  const verdictOk = answerMatchesExpected(input.passage.answer.text, outcome.expectedAnswer);
  return makeVerdict(input, 'exactitude_de_règle', kindOf(verdictOk, motives.complete),
    scoreOf(verdictOk, motives), {
      expectedAnswer: outcome.expectedAnswer,
      verdictCorrect: verdictOk,
      motivesCited: motives.cited,
      motivesMissing: motives.missing,
      motivesComplete: motives.complete,
      expectedMotives: expected,
      satisfied: outcome.satisfied,
    }, { motives: motives.cited, missingMotives: motives.missing });
}

/** Verdict : exact si la conclusion est bonne et les motifs complets. */
function kindOf(verdictOk: boolean, complete: boolean): 'exact' | 'concordant' | 'faux' {
  if (verdictOk && complete) return 'exact';
  if (verdictOk || complete) return 'concordant';
  return 'faux';
}

/** Barème : la conclusion vaut 0.6, les motifs 0.4 — les deux sont mesurés. */
function scoreOf(verdictOk: boolean, motives: { complete: boolean; cited: readonly string[] }): number {
  const verdictPart = verdictOk ? 0.6 : 0;
  if (motives.complete) return verdictPart + 0.4;
  return verdictPart + (motives.cited.length > 0 ? 0.2 : 0);
}
