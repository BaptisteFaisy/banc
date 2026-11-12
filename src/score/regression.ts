/**
 * Régression de l'agent OU dérive de vérité (§7) — la distinction centrale.
 *
 * Les oracles sont recalculés à chaque essai. Quand la vérité change, ce
 * n'est pas l'agent qui a régressé : c'est l'organisation qui a bougé. Confondre
 * les deux fait perdre trois jours à déboguer un prompt sain.
 *
 *   régression     la vérité n'a pas bougé, la réponse de l'agent si ;
 *   dérive         la vérité a bougé entre deux essais → l'agent n'est pas
 *                  coupable, le cas est rejoué et l'événement est tracé.
 *
 * Asymétrie assumée : pour la jauge `coût`, une HAUSSE est la régression.
 * Partout ailleurs, c'est une baisse. Le sens est donc porté par la jauge,
 * pas par le signe du delta.
 */
import type { BancCase, DeltaKind, Gauge, Regression } from '../domain/vocabulary.js';

/** Preuve du changement de vérité : avant, après, instant. */
export interface TruthEvidence {
  readonly from: string;
  readonly to: string;
  readonly at: string;
}

/** Entrée de classification d'un écart entre deux versions. */
export interface DeltaInput {
  readonly caseId: string;
  readonly gauge: Gauge;
  readonly candidate: number;
  readonly baseline: number;
  readonly oracleDrifted: boolean;
  readonly driftEvidence?: TruthEvidence;
  readonly agentVersionId: string;
  readonly baselineVersionId: string;
  readonly openedAt: string;
  readonly id?: string;
}

/** Le sens de la jauge : `coût` se lit à l'envers. */
function isCostGauge(gauge: Gauge): boolean {
  return gauge === 'coût';
}

/** Qualifie un écart : régression, dérive, progrès, ou rien à signaler. */
export function classifyDelta(input: DeltaInput): Regression | null {
  const delta = input.candidate - input.baseline;
  if (delta === 0) return null; // rien à signaler
  const worsened = isCostGauge(input.gauge) ? delta > 0 : delta < 0;
  const base = {
    id: input.id ?? `reg:${input.agentVersionId}:${input.caseId}:${input.gauge}`,
    agentVersionId: input.agentVersionId,
    baselineVersionId: input.baselineVersionId,
    caseId: input.caseId,
    gauge: input.gauge,
    delta,
    openedAt: input.openedAt,
  };
  if (input.oracleDrifted) {
    // La vérité a bougé : l'agent n'est pas coupable, même si le score baisse.
    return { ...base, kind: 'truth_drift' as DeltaKind, state: 'close_dérive', truthEvidence: input.driftEvidence };
  }
  if (!worsened) return { ...base, kind: 'progress' as DeltaKind, state: 'ouverte' };
  return { ...base, kind: 'regression' as DeltaKind, state: 'ouverte' };
}

/** Les régressions réelles : ce qui bloque une promotion. */
export function listRegressions(all: readonly Regression[]): readonly Regression[] {
  return all.filter((item) => item.kind === 'regression');
}

/** Les dérives de vérité : ce qui ne bloque rien, mais se trace. */
export function listDrifts(all: readonly Regression[]): readonly Regression[] {
  return all.filter((item) => item.kind === 'truth_drift');
}

/**
 * Enregistre une dérive de vérité, même quand le score n'a pas bougé.
 *
 * C'est le cas le plus important du produit : « la vérité a changé mardi,
 * l'agent n'a rien raté ». Aucun écart de score ne le révèle — seule
 * l'empreinte de l'oracle le sait. Sans cet enregistrement, la dérive
 * n'apparaîtrait que lorsqu'elle coïncide avec une régression, et le
 * banc laisserait passer exactement le cas qu'il prétend distinguer.
 */
export function recordTruthDrift(input: {
  caseId: string; gauge: Gauge; agentVersionId: string; baselineVersionId: string;
  openedAt: string; evidence: TruthEvidence; id?: string;
}): Regression {
  return {
    id: input.id ?? `drift:${input.agentVersionId}:${input.caseId}`,
    agentVersionId: input.agentVersionId,
    baselineVersionId: input.baselineVersionId,
    caseId: input.caseId,
    gauge: input.gauge,
    delta: 0,
    kind: 'truth_drift',
    openedAt: input.openedAt,
    state: 'close_dérive',
    truthEvidence: input.evidence,
  };
}

/** Clôt une régression en dérive de vérité, avec la preuve du changement. */
export function closeOnDrift(reg: Regression, evidence: TruthEvidence): Regression {
  return { ...reg, kind: 'truth_drift', state: 'close_dérive', truthEvidence: evidence };
}

/** Clôt une régression réparée par une nouvelle version. */
export function closeOnFix(reg: Regression): Regression {
  return { ...reg, state: 'close_réparée' };
}

/** Regroupe les régressions par cas, pour l'explorateur d'échecs. */
export function regressionsByCase(regs: readonly Regression[]): ReadonlyMap<string, readonly Regression[]> {
  const byCase = new Map<string, Regression[]>();
  for (const reg of regs) {
    byCase.set(reg.caseId, [...(byCase.get(reg.caseId) ?? []), reg]);
  }
  return byCase;
}

/** Les régressions qui bloquent : celles portant sur un cas bloquant (§10). */
export function blockingRegressions(regs: readonly Regression[], cases: readonly BancCase[]): readonly Regression[] {
  const blocking = new Set(cases.filter((item) => item.gravity === 'bloquant').map((item) => item.id));
  return listRegressions(regs).filter((reg) => blocking.has(reg.caseId));
}

/** Les régressions ouvertes, triées de la plus grave à la moins grave. */
export function openRegressions(regs: readonly Regression[]): readonly Regression[] {
  return listRegressions(regs)
    .filter((reg) => reg.state === 'ouverte')
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
