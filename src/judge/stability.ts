/**
 * Jauge « stabilité » (§8, §9) : le verdict change-t-il d'un passage à l'autre ?
 *
 * Un agent n'est pas déterministe. Le banc pose donc chaque cas k fois (3 par
 * défaut) et ne juge jamais sur une réponse isolée. Un cas fissuré n'est pas
 * un cas difficile : c'est un cas **mal écrit** ou un agent **non stable**, et
 * le banc dit lequel des deux — c'est le diagnostic qui rend la fissure
 * actionnable au lieu d'être du bruit.
 *
 * Le calcul de la fissure et de son attribution vit dans `src/run/fissure.ts`
 * (il porte sur l'ensemble des passages d'un cas) ; ce fichier n'en expose que
 * la traduction en jauge, pour que les huit jauges aient la même forme.
 */
import type { Fissure, Passage, Verdict, VerdictKind } from '../domain/vocabulary.js';
import { incidentVerdict, makeVerdict } from './deps.js';
import type { JudgeInput } from './deps.js';

/** Les verdicts d'un cas sont-ils tous identiques ? */
export function verdictsAgree(verdicts: readonly VerdictKind[]): boolean {
  return new Set(verdicts).size <= 1;
}

/**
 * Jauge la stabilité d'UN passage à la lumière de tous les passages du cas.
 *
 * Un passage isolé ne peut pas être jugé instable : c'est l'écart entre
 * passages qui constitue la fissure. Le verdict rendu ici porte donc sur
 * l'ensemble, et chaque passage reçoit le même — sinon la moyenne dépendrait
 * de l'ordre de jeu.
 */
export function judgeStabilite(
  input: JudgeInput,
  allVerdicts: readonly VerdictKind[],
  fissure: Fissure | null,
): Verdict | null {
  const incident = incidentVerdict(input, 'stabilité');
  if (incident) return incident;
  if (allVerdicts.length < 2) return null; // un seul passage : on ne conclut pas
  if (!fissure) return makeVerdict(input, 'stabilité', 'exact', 1, { passages: allVerdicts.length });
  return makeVerdict(input, 'stabilité', 'fissure', 0, {
    passages: allVerdicts.length,
    distinctVerdicts: new Set(allVerdicts).size,
    attribution: fissure.attribution,
    spread: fissure.spread,
  });
}

/** Écart-type des valeurs d'une jauge sur k passages (0 si un seul passage). */
export function verdictSpreadValue(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Taux de fissures d'une version : part de cas dont le verdict a varié. */
export function fissureRate(fissures: readonly Fissure[], caseCount: number): number | null {
  if (caseCount < 5) return null; // pas assez de recul : jamais un pourcentage (§8)
  return fissures.length / caseCount;
}

/** Les passages d'un cas, triés par numéro de passage. */
export function orderedPassages(passages: readonly Passage[]): readonly Passage[] {
  return [...passages].sort((a, b) => a.passageNo - b.passageNo);
}
