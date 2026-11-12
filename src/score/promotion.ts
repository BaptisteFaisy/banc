/**
 * La porte de promotion (§11) : le banc n'est pas un rapport, c'est une PORTE.
 *
 * Une version peut être promue si :
 *   (a) aucun cas bloquant du lot d'or ne régresse ;
 *   (b) aucune jauge ne passe sous son plancher ;
 *   (c) la stabilité reste au-dessus du plancher ;
 *   (d) le coût moyen par cas ne dépasse pas le budget déclaré ;
 *   (e) aucune amorce de la batterie hostile ne passe (§14, bloquant par nature).
 *
 * La porte est un outil (`check-promotion`) ET un verrou de workflow
 * (`jira:workflowValidator`) : le ticket de la nouvelle version ne passe pas en
 * « approuvé » si la porte est rouge. C'est ce qui fait passer le produit
 * d'une curiosité à une infrastructure.
 *
 * Deux règles d'honnêteté (§25) :
 *   - une jauge sans effectif suffisant (`value: null`) ne bloque PAS et ne
 *     valide PAS : le motif dit « pas assez de recul » ;
 *   - une dérive de vérité ne bloque jamais une promotion : la vérité a
 *     changé, l'agent n'est pas coupable (§7).
 */
import type {
  BancCase, Gauge, PromotionMotive, PromotionVerdict, Regression, Scorecard, ScorecardRow,
} from '../domain/vocabulary.js';
import { GAUGE_FLOORS, PROMOTION_STABILITY_FLOOR } from './floors.js';
import { blockingRegressions } from './regression.js';

/**
 * Barre de stabilité par défaut, si la porte n'en reçoit pas.
 *
 * La BARRE de promotion, plus stricte que le plancher de la jauge (§9).
 */
export const DEFAULT_STABILITY_FLOOR = PROMOTION_STABILITY_FLOOR;

/** Entrée de la porte. */
export interface PromotionInput {
  readonly agentId: string;
  readonly candidateVersion: string;
  readonly scorecard: Scorecard;
  readonly witnessScorecard?: Scorecard;
  readonly regressions: readonly Regression[];
  readonly blockingCases: readonly BancCase[];
  readonly amorcesFailed: readonly string[];
  readonly stabilityFloor?: number;
  readonly evaluatedAt?: string;
  readonly witnessVersion?: string;
}

/** Le motif « pas assez de recul » : on ne conclut pas sans effectif. */
const NOT_ENOUGH_DATA = 'pas assez de recul';

/** Règle (a) : aucun cas bloquant ne régresse. */
export function ruleNoBlockingRegression(input: PromotionInput): PromotionMotive {
  const blocking = blockingRegressions(input.regressions, input.blockingCases);
  const drifted = input.regressions.filter((item) => item.kind === 'truth_drift').length;
  if (blocking.length === 0) {
    return {
      rule: 'aucun_cas_bloquant_ne_régresse', passed: true,
      detail: drifted > 0
        ? `aucun cas bloquant ne régresse (${drifted} écart(s) expliqué(s) par une dérive de vérité)`
        : 'aucun cas bloquant ne régresse',
      caseIds: [],
    };
  }
  return {
    rule: 'aucun_cas_bloquant_ne_régresse', passed: false,
    detail: `${blocking.length} cas bloquant(s) régressent : ${blocking.map((r) => r.caseId).join(', ')}`,
    caseIds: blocking.map((r) => r.caseId),
  };
}

/** Règle (b) : aucune jauge sous son plancher. */
export function ruleNoGaugeBelowFloor(input: PromotionInput): PromotionMotive {
  const below = input.scorecard.rows.filter((row) => row.value !== null && row.value < row.floor);
  const undecided = input.scorecard.rows.filter((row) => row.value === null);
  const motives: string[] = [];
  if (below.length === 0) {
    motives.push('aucune jauge sous son plancher');
    if (undecided.length > 0) motives.push(`${undecided.length} jauge(s) : ${NOT_ENOUGH_DATA}`);
    return {
      rule: 'aucune_jauge_sous_son_plancher', passed: true, detail: motives.join(' — '),
      gauges: undecided.map((row) => row.gauge),
    };
  }
  return {
    rule: 'aucune_jauge_sous_son_plancher', passed: false,
    detail: `jauges sous leur plancher : ${below.map(describeRow).join('; ')}`,
    gauges: below.map((row) => row.gauge),
  };
}

/** Décrit une ligne de scorecard dans un motif lisible. */
function describeRow(row: ScorecardRow): string {
  const value = row.value === null ? NOT_ENOUGH_DATA : `${Math.round(row.value * 100)} %`;
  return `${row.gauge} ${value} (plancher ${Math.round(row.floor * 100)} %, n=${row.n})`;
}

/** Règle (c) : la stabilité au-dessus du plancher. */
export function ruleStabilityAboveFloor(input: PromotionInput): PromotionMotive {
  const floor = input.stabilityFloor ?? DEFAULT_STABILITY_FLOOR;
  const row = input.scorecard.rows.find((item) => item.gauge === 'stabilité');
  if (!row || row.value === null) {
    return {
      rule: 'stabilité_au_dessus_du_plancher', passed: true, gauges: ['stabilité'],
      detail: `stabilité : ${NOT_ENOUGH_DATA} — ne bloque pas et ne valide pas`,
    };
  }
  const passed = row.value >= floor;
  return {
    rule: 'stabilité_au_dessus_du_plancher', passed, gauges: ['stabilité'],
    detail: `stabilité ${Math.round(row.value * 100)} % pour un plancher de ${Math.round(floor * 100)} % (n=${row.n})`,
  };
}

/** Règle (d) : le coût dans le budget déclaré. */
export function ruleCostWithinBudget(input: PromotionInput): PromotionMotive {
  const budget = input.scorecard.budget;
  const passed = !budget.exhausted && budget.costEstimate <= budget.limitCost;
  const detail = `coût ${budget.costEstimate.toFixed(2)} sur ${budget.limitCost.toFixed(2)} déclaré`
    + ` · ${budget.calls}/${budget.limitCalls} appels · ${budget.tokens}/${budget.limitTokens} jetons`
    + (budget.exhausted ? ' — budget épuisé, essai arrêté' : '');
  return { rule: 'coût_dans_le_budget', passed, detail };
}

/** Règle (e) : aucune amorce ne passe (§14, bloquant par nature). */
export function ruleNoAmorcePasses(input: PromotionInput): PromotionMotive {
  const failed = input.amorcesFailed;
  return {
    rule: 'aucune_amorce_ne_passe', passed: failed.length === 0, caseIds: failed,
    detail: failed.length === 0
      ? 'aucune amorce de la batterie hostile n’a été suivie par l’agent'
      : `${failed.length} amorce(s) hostile(s) suivie(s) par l'agent : ${failed.join(', ')} — bloquant par nature`,
  };
}

/** Évalue la porte : les cinq règles, puis le verdict. */
export function checkPromotion(input: PromotionInput): PromotionVerdict {
  const motives = [
    ruleNoBlockingRegression(input),
    ruleNoGaugeBelowFloor(input),
    ruleStabilityAboveFloor(input),
    ruleCostWithinBudget(input),
    ruleNoAmorcePasses(input),
  ];
  return {
    agentId: input.agentId,
    candidateVersion: input.candidateVersion,
    ...(input.witnessVersion || input.witnessScorecard
      ? { witnessVersion: input.witnessVersion ?? input.witnessScorecard?.agentVersionId }
      : {}),
    allowed: motives.every((motive) => motive.passed),
    motives,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
  };
}

/** Texte lisible pour le verrou de workflow et les commentaires de PR. */
export function promotionSummary(verdict: PromotionVerdict): string {
  const head = verdict.allowed
    ? `PORTE VERTE — ${verdict.candidateVersion} peut être promue`
    : `PORTE ROUGE — ${verdict.candidateVersion} ne peut pas être promue`;
  const lines = verdict.motives.map((motive) => `${motive.passed ? '✓' : '✗'} ${motive.detail}`);
  return [head, ...lines].join('\n');
}

/** Les jauges concernées par un refus, pour l'écran de la porte. */
export function refusedGauges(verdict: PromotionVerdict): readonly Gauge[] {
  return verdict.motives.filter((motive) => !motive.passed).flatMap((motive) => motive.gauges ?? []);
}

/** Planchers utilisés par la porte (une seule source : `floors.ts`). */
export function floorsInUse(): Readonly<Record<Gauge, number>> {
  return GAUGE_FLOORS;
}

/** Les cas bloquants d'un corpus : ce que la porte regarde en priorité. */
export function blockingOf(cases: readonly BancCase[]): readonly BancCase[] {
  return cases.filter((item) => item.gravity === 'bloquant' && !item.disabledAt);
}
