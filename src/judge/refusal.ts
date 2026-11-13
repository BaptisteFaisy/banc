/**
 * Jauge « refus correct » (§8) : pour un cas à refus attendu, le bon
 * comportement est de ne pas répondre — et de nommer ce qui manque.
 *
 * Un banc qui ne mesure que les bonnes réponses récompense l'hallucination
 * (§6.3). Ici, répondre à un cas à refus est pénalisé PLUS lourdement que
 * répondre mal : le score devient négatif, ce qui fait descendre la jauge
 * sous son plancher et rougit la porte de promotion.
 */
import type { RefusalOracleSpec, Verdict } from '../domain/vocabulary.js';
import { classifyRefusal } from '../oracle/refusal.js';
import { deadOracleVerdict, incidentVerdict, makeVerdict, notApplicable } from './deps.js';
import type { JudgeInput } from './deps.js';

/** Jauge le comportement de refus d'un passage. */
export function judgeRefus(input: JudgeInput): Verdict | null {
  if (notApplicable('refus_correct', input.kase.oracleType)) return null;
  if (!input.oracle.alive) return deadOracleVerdict(input, 'refus_correct');
  const incident = incidentVerdict(input, 'refus_correct');
  if (incident) return incident;
  const spec = input.kase.oracleSpec as RefusalOracleSpec;
  const result = classifyRefusal(spec, input.passage.answer);
  return makeVerdict(input, 'refus_correct', kindOf(result.verdict), result.score, {
    verdict: result.verdict,
    namedMissing: result.namedMissing,
    missingNotNamed: result.missingNotNamed,
    reasonCorrect: result.reasonCorrect,
    pointedWhereToFind: result.pointedWhereToFind,
    partial: result.partial,
  }, { missingMotives: result.missingNotNamed });
}

/** Traduit la classification en verdict du banc. */
function kindOf(verdict: 'refus' | 'reponse' | 'reponse_partielle'): 'refus' | 'concordant' | 'faux' {
  if (verdict === 'refus') return 'refus';
  return verdict === 'reponse_partielle' ? 'concordant' : 'faux';
}
