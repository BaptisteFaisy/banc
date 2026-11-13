/**
 * Jauge « complétude » (§8) : tous les éléments de la question sont-ils
 * traités ?
 *
 * La décomposition est **déterministe et testable** : aucun appel LLM. Un
 * correcteur non reproductible rendrait la mesure impossible à rejouer, ce
 * qui contredit l'exigence de reproductibilité (§25).
 *
 * Une question à un seul élément ne déclenche pas cette jauge : `exactitude`
 * suffit, et afficher une jauge redondante noierait le signal.
 */
import type { Verdict } from '../domain/vocabulary.js';
import { incidentVerdict, makeVerdict } from './deps.js';
import type { JudgeInput } from './deps.js';

/** Connecteurs qui séparent les éléments d'une question composite. */
const CONNECTORS: readonly string[] = [
  ' et ', ' ainsi que ', ' de même que ', ' par ailleurs ', ' puis ', ' also ', ' and ',
];

/** Séparateurs forts : point d'interrogation, point-virgule, puces. */
const SEPARATORS = /[?;]|\n\s*[-*•]\s*/;

/** Mots-outils ignorés dans le calcul de recouvrement (français et anglais). */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'le', 'la', 'les', 'des', 'une', 'un', 'du', 'de', 'dans', 'pour', 'par', 'sur', 'avec',
  'est', 'sont', 'quel', 'quelle', 'quels', 'quelles', 'qui', 'que', 'quoi', 'dont',
  'the', 'and', 'for', 'with', 'that', 'this', 'are', 'was', 'were', 'what', 'which', 'who',
]);

/** Découpe une question en éléments vérifiables séparément. */
export function decomposeQuestion(question: string): readonly string[] {
  const parts = question
    .split(SEPARATORS)
    .flatMap((chunk) => splitOnConnectors(chunk))
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [question.trim()];
}

/** Découpe un fragment sur les connecteurs d'énumération. */
function splitOnConnectors(chunk: string): readonly string[] {
  let parts: string[] = [chunk];
  for (const connector of CONNECTORS) {
    parts = parts.flatMap((part) => part.split(connector));
  }
  return parts;
}

/** Mots significatifs d'un élément (longueur >= 4, hors mots-outils). */
function significantWords(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/i)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

/** Un élément est-il traité dans la réponse ? */
function elementCovered(element: string, answer: string): boolean {
  const words = significantWords(element);
  if (words.length === 0) return false;
  const haystack = answer.toLowerCase();
  return words.filter((word) => haystack.includes(word)).length / words.length >= 0.6;
}

/** Jauge la complétude d'un passage, toutes formes d'oracle confondues. */
export function judgeCompletude(input: JudgeInput): Verdict | null {
  const elements = decomposeQuestion(input.kase.question);
  if (elements.length < 2) return null; // question simple : la jauge ne s'applique pas
  if (!input.oracle.alive) return null;   // sans vérité, on ne peut pas exiger la complétude
  const incident = incidentVerdict(input, 'complétude');
  if (incident) return incident;
  return gradeCompleteness(input, elements);
}

/** Note la part d'éléments traités et choisit le verdict. */
function gradeCompleteness(input: JudgeInput, elements: readonly string[]): Verdict {
  const answer = input.passage.answer.text;
  const covered = elements.filter((element) => elementCovered(element, answer));
  const ratio = covered.length / elements.length;
  const kind = ratio === 1 ? 'exact' : ratio > 0 ? 'concordant' : 'faux';
  return makeVerdict(input, 'complétude', kind, ratio, {
    elements: elements.length,
    covered: covered.length,
    missing: elements.filter((element) => !covered.includes(element)),
  });
}
