/**
 * Oracle « refus attendu » (§6.3) : la question n'a pas de réponse, et le bon
 * comportement est de NE PAS répondre — dire ce qui manque et où le trouver.
 *
 * Un banc qui ne mesure que les bonnes réponses **récompense
 * l'hallucination**. Ici le refus correct est une jauge à part entière, et
 * l'agent qui répond quand même est pénalisé plus lourdement qu'un agent qui
 * répond mal : d'où un score négatif, délibéré.
 *
 * La classification est strictement déterministe (motifs listés ci-dessous) :
 * aucun LLM, donc reproductible d'un essai à l'autre. Le texte de la réponse
 * est une donnée à classer, jamais une instruction à suivre.
 */
import type { AgentAnswer, RefusalOracleSpec } from '../domain/vocabulary.js';

/** Verdict de classification d'une réponse face à un cas à refus. */
export type RefusalVerdict = 'refus' | 'reponse' | 'reponse_partielle';

/** Résultat détaillé de la classification. */
export interface RefusalClassification {
  readonly refused: boolean;
  readonly partial: boolean;
  readonly namedMissing: readonly string[];
  readonly missingNotNamed: readonly string[];
  readonly pointedWhereToFind: boolean;
  readonly verdict: RefusalVerdict;
  readonly score: number;
  readonly reasonCorrect: boolean;
}

/**
 * Marqueurs de refus, français et anglais. Listés ici et nulle part ailleurs :
 * c'est cette liste qui rend la classification reproductible.
 */
const REFUSAL_SIGNALS: readonly string[] = [
  'je ne peux pas', 'je ne peux pas répondre', 'aucune donnée', 'aucune source',
  'impossible de répondre', 'pas dans les systèmes', 'il manque', 'manque',
  'non disponible', 'indisponible', 'je ne sais pas', 'sans objet',
  'i cannot', 'i can not', 'unable to', 'no data', 'not available',
  'missing', 'unknown', 'no source',
];

/** Forme canonique d'un fragment de texte, pour une comparaison tolérante. */
function canonical(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Repère les marqueurs de refus présents dans un texte. */
export function detectRefusalSignals(text: string): readonly string[] {
  const haystack = canonical(text);
  return REFUSAL_SIGNALS.filter((signal) => haystack.includes(signal));
}

/** Nomme les éléments manquants réellement cités dans la réponse. */
function namedIn(text: string, wanted: readonly string[]): readonly string[] {
  const haystack = canonical(text);
  return wanted.filter((item) => {
    const needle = canonical(item);
    if (needle.length === 0) return false;
    if (haystack.includes(needle)) return true;
    // Un élément long est nommé si la majorité de ses mots significatifs le sont.
    const words = needle.split(' ').filter((word) => word.length >= 4);
    if (words.length === 0) return false;
    return words.filter((word) => haystack.includes(word)).length / words.length >= 0.5;
  });
}

/** Une réponse affirmative qui tranche la question, malgré les précautions. */
function assertsAnswer(text: string): boolean {
  const haystack = canonical(text);
  return /\b(oui|non|yes|no)\b/.test(haystack) || /\b(la réponse est|the answer is)\b/.test(haystack);
}

/** Pénalité applicable quand l'agent répond au lieu de refuser. */
export function refusalPenalty(spec: RefusalOracleSpec, refused: boolean): number {
  return refused ? 0 : -Math.abs(spec.answeringPenalty);
}

/**
 * Classe une réponse face à un oracle « refus attendu ».
 *
 * Nuance exigée par §26 : un refus pour la mauvaise raison est compté refus,
 * avec motif faux — `refused` reste vrai, `reasonCorrect` est faux, et le
 * score est réduit sans être nul.
 */
export function classifyRefusal(spec: RefusalOracleSpec, answer: AgentAnswer): RefusalClassification {
  const text = answer.text ?? '';
  const signals = detectRefusalSignals(text);
  const named = namedIn(text, spec.missing);
  const missing = spec.missing.filter((item) => !named.includes(item));
  const refused = signals.length > 0 && !assertsAnswer(text);
  const partial = signals.length > 0 && assertsAnswer(text);
  const verdict: RefusalVerdict = refused ? 'refus' : partial ? 'reponse_partielle' : 'reponse';
  const reasonCorrect = spec.requireReason ? named.length > 0 : refused;
  return {
    refused,
    partial,
    namedMissing: named,
    missingNotNamed: missing,
    pointedWhereToFind: namedIn(text, spec.whereToFind ?? []).length > 0,
    verdict,
    score: scoreOf(spec, verdict, named, missing, reasonCorrect),
    reasonCorrect,
  };
}

/** Barème : le refus correct vaut 1, répondre vaut `-answeringPenalty`. */
function scoreOf(
  spec: RefusalOracleSpec,
  verdict: RefusalVerdict,
  named: readonly string[],
  missing: readonly string[],
  reasonCorrect: boolean,
): number {
  if (verdict === 'reponse') return -Math.abs(spec.answeringPenalty);
  if (verdict === 'reponse_partielle') return 0.25;
  if (!spec.requireReason) return missing.length === 0 ? 1 : 0.75;
  if (!reasonCorrect) return 0.25;
  return missing.length === 0 && named.length > 0 ? 1 : 0.5;
}
