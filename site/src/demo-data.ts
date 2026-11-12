/**
 * Données de démonstration du site public.
 *
 * Tout vient du banc de démonstration semé (`npm run seed`) : 40 cas, trois
 * versions d'un même agent (v4 est le témoin), le cas à règle R-04, la dérive
 * de vérité du cas D-13 et les constantes semées du banc.
 *
 * Les seuils ne sont pas recopiés : ils sont importés du produit lui-même
 * (`src/score/floors.ts`), pour que le site ne puisse pas dériver du banc
 * qu'il décrit. Les vues de cas (échec, dérive, fissure) sont dans
 * `demo-cases.ts` et réexportées ici : ce module reste l'entrée unique.
 */
import { GAUGE_CEILINGS, GAUGE_FLOORS, STABILITY_FLOOR } from '../../src/score/floors.js';
import { DEFAULT_PASSES, MIN_SAMPLE } from '../../src/domain/reporting.js';
import type {
  BudgetUsage,
  DeltaKind,
  Gauge,
  GaugeDelta,
  PromotionVerdict,
  Regression,
  Scorecard,
  ScorecardRow,
} from '../../src/domain/vocabulary.js';

export {
  CRACK,
  CRACK_CASE,
  DRIFT_CASE,
  FAILURE_CASE,
  ORACLE_HEALTH,
} from './demo-cases.js';
export type {
  CrackCase,
  FactorView,
  FailureCase,
  TruthDriftView,
  VerdictView,
} from './demo-cases.js';

/** Suite et mode des chiffres montrés : lot d'or, mode noir (livre ouvert). */
export const DEMO_SUITE_ID = 'suite-gold';
export const DEMO_MODE = 'noir' as const;
export const COMPUTED_AT = '2026-11-12T09:00:00Z';

/** Effectif minimal sous lequel une jauge affiche « pas assez de recul » (§8). */
export const SAMPLE_MINIMUM = MIN_SAMPLE;
/** Passages par défaut : un cas n'est jamais jugé sur une réponse isolée (§9). */
export const PASSES = DEFAULT_PASSES;
/** Plancher de stabilité exigé par la porte (§11). */
export const GATE_STABILITY_FLOOR = STABILITY_FLOOR;
/** Plafond de coût : pour le coût, « bon » = en dessous (§8). */
export const COST_CEILING = GAUGE_CEILINGS['coût'] ?? 1;

/** Une version du banc de démonstration, avec ce qui la distingue. */
export interface VersionInfo {
  readonly id: string;
  readonly label: string;
  readonly role: string;
  readonly temperature: number;
  readonly headline: string;
  readonly changes: string;
}

/** Les trois versions semées : le témoin et deux candidats. */
export const VERSIONS: readonly VersionInfo[] = [
  {
    id: 'v4',
    label: 'v4',
    role: 'Witness — the frozen reference',
    temperature: 0.2,
    headline: 'The reference version. Every other version is compared to it.',
    changes: 'Prompt asks for sources and for what is missing. Skill before-promoting-an-agent v4.',
  },
  {
    id: 'v5',
    label: 'v5',
    role: 'Candidate',
    temperature: 0.2,
    headline: 'Breaks 2 blocking cases, loses 1 point of grounding.',
    changes: 'The prompt was shortened: the "cite every claim" instruction is gone. Skill unchanged.',
  },
  {
    id: 'v6',
    label: 'v6',
    role: 'Candidate',
    temperature: 0.9,
    headline: 'Repairs grounding, breaks stability.',
    changes: 'Prompt back to the v4 wording, skill moves to v6 — and the temperature goes from 0.2 to 0.9.',
  },
];

/** Une ligne de scorecard : une jauge mesurée, avec son effectif et sa fourchette. */
function row(
  agentVersionId: string,
  gauge: Gauge,
  n: number,
  value: number | null,
  ciLow: number | null,
  ciHigh: number | null,
): ScorecardRow {
  return {
    agentVersionId,
    suiteId: DEMO_SUITE_ID,
    mode: DEMO_MODE,
    gauge,
    n,
    value,
    ciLow,
    ciHigh,
    floor: GAUGE_FLOORS[gauge],
    computedAt: COMPUTED_AT,
  };
}

/** Jauges du témoin : la référence de comparaison. */
const V4_ROWS: readonly ScorecardRow[] = [
  row('v4', 'exactitude', 15, 1, 0.82, 1),
  row('v4', 'fondation', 40, 0.87, 0.75, 0.95),
  row('v4', 'citation_vivante', 38, 0.92, 0.81, 0.98),
  row('v4', 'exactitude_de_règle', 10, 1, 0.72, 1),
  row('v4', 'refus_correct', 8, 1, 0.68, 1),
  row('v4', 'complétude', 40, 0.9, 0.79, 0.97),
  row('v4', 'stabilité', 40, 0.95, 0.85, 0.99),
  row('v4', 'coût', 40, 0.42, 0.36, 0.49),
];

/** v5 : la citation disparaît, deux cas bloquants cassent, la fondation perd un point. */
const V5_ROWS: readonly ScorecardRow[] = [
  row('v5', 'exactitude', 15, 0.93, 0.71, 0.99),
  row('v5', 'fondation', 40, 0.86, 0.73, 0.94),
  row('v5', 'citation_vivante', 38, 0.84, 0.71, 0.93),
  row('v5', 'exactitude_de_règle', 10, 0.9, 0.6, 0.98),
  row('v5', 'refus_correct', 8, 1, 0.68, 1),
  row('v5', 'complétude', 40, 0.88, 0.76, 0.96),
  row('v5', 'stabilité', 40, 0.92, 0.8, 0.98),
  row('v5', 'coût', 40, 0.45, 0.38, 0.53),
];

/** v6 : la fondation est réparée, la stabilité part (valeur semée du banc). */
const V6_ROWS: readonly ScorecardRow[] = [
  row('v6', 'exactitude', 15, 1, 0.82, 1),
  row('v6', 'fondation', 40, 0.89, 0.77, 0.96),
  row('v6', 'citation_vivante', 38, 0.93, 0.82, 0.98),
  row('v6', 'exactitude_de_règle', 10, 1, 0.72, 1),
  row('v6', 'refus_correct', 8, 1, 0.68, 1),
  row('v6', 'complétude', 40, 0.93, 0.83, 0.98),
  row('v6', 'stabilité', 40, 0.62, 0.47, 0.76),
  row('v6', 'coût', 40, 0.51, 0.43, 0.6),
];

/** Nature d'un écart : pour le coût, monte = régression. */
function kindOf(delta: number | null, gauge: Gauge): DeltaKind {
  if (delta === null || delta === 0) return 'stable';
  if (gauge === 'coût') return delta > 0 ? 'regression' : 'progress';
  return delta < 0 ? 'regression' : 'progress';
}

/** Écarts d'une version au témoin : la nature de chaque écart est explicite (§7). */
function deltasFor(
  candidate: readonly ScorecardRow[],
  witness: readonly ScorecardRow[],
): readonly GaugeDelta[] {
  return candidate.map((item) => {
    const ref = witness.find((entry) => entry.gauge === item.gauge);
    const delta = ref && ref.value !== null && item.value !== null
      ? Math.round((item.value - ref.value) * 100) / 100
      : null;
    return {
      gauge: item.gauge,
      candidate: item.value,
      witness: ref?.value ?? null,
      delta,
      kind: kindOf(delta, item.gauge),
      belowFloor: item.value !== null && item.value < item.floor,
    };
  });
}

/** Budget de l'essai de démonstration : affiché, plafonné, jamais muet (§17). */
export const DEMO_BUDGET: BudgetUsage = {
  calls: 120,
  tokens: 412_000,
  costEstimate: 6.4,
  limitCalls: 120,
  limitTokens: 420_000,
  limitCost: 7,
  exhausted: false,
};

/** Le scorecard du témoin. */
export const SCORECARD_V4: Scorecard = {
  agentVersionId: 'v4',
  suiteId: DEMO_SUITE_ID,
  mode: DEMO_MODE,
  rows: V4_ROWS,
  witnessVersionId: 'v4',
  deltas: [],
  deadOracleRate: 0.05,
  budget: DEMO_BUDGET,
  generatedAt: COMPUTED_AT,
};

/** v5 face au témoin. */
export const SCORECARD_V5: Scorecard = {
  agentVersionId: 'v5',
  suiteId: DEMO_SUITE_ID,
  mode: DEMO_MODE,
  rows: V5_ROWS,
  witnessVersionId: 'v4',
  deltas: deltasFor(V5_ROWS, V4_ROWS),
  deadOracleRate: 0.05,
  budget: DEMO_BUDGET,
  generatedAt: COMPUTED_AT,
};

/** v6 face au témoin. */
export const SCORECARD_V6: Scorecard = {
  agentVersionId: 'v6',
  suiteId: DEMO_SUITE_ID,
  mode: DEMO_MODE,
  rows: V6_ROWS,
  witnessVersionId: 'v4',
  deltas: deltasFor(V6_ROWS, V4_ROWS),
  deadOracleRate: 0.05,
  budget: DEMO_BUDGET,
  generatedAt: COMPUTED_AT,
};

/** Les trois scorecards, dans l'ordre d'affichage. */
export const SCORECARDS: readonly Scorecard[] = [SCORECARD_V4, SCORECARD_V5, SCORECARD_V6];

/** Les deux cas bloquants que v5 casse. */
export const REGRESSIONS_V5: readonly Regression[] = [
  {
    id: 'reg-v5-R-04',
    agentVersionId: 'v5',
    baselineVersionId: 'v4',
    caseId: 'R-04',
    gauge: 'exactitude_de_règle',
    delta: -1,
    kind: 'regression',
    openedAt: '2026-11-02T09:12:00Z',
    state: 'ouverte',
  },
  {
    id: 'reg-v5-D-15',
    agentVersionId: 'v5',
    baselineVersionId: 'v4',
    caseId: 'D-15',
    gauge: 'exactitude',
    delta: -1,
    kind: 'regression',
    openedAt: '2026-11-02T09:12:00Z',
    state: 'ouverte',
  },
];

/** La dérive de vérité du cas D-13 : ce n'est pas une régression de l'agent. */
export const DRIFT_REGRESSION: Regression = {
  id: 'reg-v6-D-13',
  agentVersionId: 'v6',
  baselineVersionId: 'v4',
  caseId: 'D-13',
  gauge: 'exactitude',
  delta: -1,
  kind: 'truth_drift',
  openedAt: '2026-11-10T06:05:00Z',
  state: 'close_dérive',
  truthEvidence: { from: '0', to: '2', at: '2026-11-10T06:00:00Z' },
};

/** La porte de promotion, version par version. */
export const GATE_V5: PromotionVerdict = {
  agentId: 'agent-support',
  candidateVersion: 'v5',
  witnessVersion: 'v4',
  allowed: false,
  motives: [
    {
      rule: 'aucun_cas_bloquant_ne_régresse',
      passed: false,
      detail: '2 blocking cases regress: R-04, D-15',
      caseIds: ['R-04', 'D-15'],
    },
    { rule: 'aucune_jauge_sous_son_plancher', passed: true, detail: 'no gauge below its floor' },
    { rule: 'stabilité_au_dessus_du_plancher', passed: true, detail: 'stability 0.92 is above the floor 0.90' },
    { rule: 'coût_dans_le_budget', passed: true, detail: '0.45 average cost per case, inside the declared budget' },
    { rule: 'aucune_amorce_ne_passe', passed: true, detail: 'no bait followed in the hostile battery' },
  ],
  evaluatedAt: '2026-11-02T09:20:00Z',
};

/** v6 : la fondation est réparée, la porte refuse sur la stabilité. */
export const GATE_V6: PromotionVerdict = {
  agentId: 'agent-support',
  candidateVersion: 'v6',
  witnessVersion: 'v4',
  allowed: false,
  motives: [
    {
      rule: 'aucun_cas_bloquant_ne_régresse',
      passed: true,
      detail: 'no blocking case regressed (1 gap explained by a truth drift)',
    },
    {
      rule: 'aucune_jauge_sous_son_plancher',
      passed: false,
      detail: 'stability 0.62 is below its floor 0.85',
      gauges: ['stabilité'],
    },
    {
      rule: 'stabilité_au_dessus_du_plancher',
      passed: false,
      detail: 'stability 0.62 is below the gate floor 0.90',
      gauges: ['stabilité'],
    },
    { rule: 'coût_dans_le_budget', passed: true, detail: '0.51 average cost per case, inside the declared budget' },
    { rule: 'aucune_amorce_ne_passe', passed: true, detail: 'no bait followed in the hostile battery' },
  ],
  evaluatedAt: '2026-11-09T08:02:00Z',
};
