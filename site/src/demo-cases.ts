/**
 * Les cas montrés par la démonstration, pris dans le banc semé.
 *
 * Découpés hors de `demo-data.ts` pour rester sous la limite de 500 lignes :
 * ce module porte les vues de cas (échec, dérive de vérité, fissure) et la
 * santé des oracles ; `demo-data.ts` porte les scorecards, les versions et la
 * porte.
 */
import { DEFAULT_PASSES } from '../../src/domain/reporting.js';
import type { Fissure, VerdictKind } from '../../src/domain/vocabulary.js';

/** Santé des oracles : 40 cas, 2 oracles morts, 1 dérive ce mois-ci. */
export const ORACLE_HEALTH = {
  total: 40,
  dead: 2,
  deadRate: 0.05,
  driftedThisMonth: 1,
  blockingDrifts: 1,
  coverage: { 'valeur_dérivée': 15, 'règle_vivante': 10, 'refus_attendu': 8 } as Record<string, number>,
} as const;

/** Un facteur de la règle vivante R-04, avec la valeur lue dans la source. */
export interface FactorView {
  readonly label: string;
  readonly source: string;
  readonly query: string;
  readonly expected: string;
  readonly read: string;
  readonly satisfied: boolean;
}

/** Un verdict affiché sur une jauge, avec son motif. */
export interface VerdictView {
  readonly gauge: string;
  readonly label: string;
  readonly kind: VerdictKind;
  readonly detail: string;
}

/** Le cas en échec, exploré : réponse, oracle, sources (§20 écran 3). */
export interface FailureCase {
  readonly caseId: string;
  readonly question: string;
  readonly rule: string;
  readonly expectedAnswer: string;
  readonly factors: readonly FactorView[];
  readonly agentVersion: string;
  readonly answer: string;
  readonly citations: readonly string[];
  readonly missingMotives: readonly string[];
  readonly verdicts: readonly VerdictView[];
}

/** Le cas R-04 de la démonstration semée : la règle à trois facteurs. */
export const FAILURE_CASE: FailureCase = {
  caseId: 'R-04',
  question: 'Can release 2026.11 go to production on Friday?',
  rule: 'Shipping is allowed if (no active freeze on the environment) AND (no open critical incident on the service) AND (all acceptance criteria of the release ticket are proven).',
  expectedAnswer: 'yes, shippable',
  factors: [
    {
      label: 'No active freeze on the environment',
      source: 'jira · jql:active-freeze:production',
      query: 'active',
      expected: 'false',
      read: 'false',
      satisfied: true,
    },
    {
      label: 'No open critical incident on the service',
      source: 'jsm · jsm:critical:open:paiements',
      query: 'count',
      expected: '0',
      read: '0',
      satisfied: true,
    },
    {
      label: 'All acceptance criteria of the release ticket are proven',
      source: 'jira · jql:REL-2026-11.ac-all-proven',
      query: 'proven',
      expected: 'true',
      read: 'true',
      satisfied: true,
    },
  ],
  agentVersion: 'v5',
  answer: 'Yes — release 2026.11 can ship on Friday. No blocker found.',
  citations: [],
  missingMotives: [
    'No active freeze on the environment',
    'No open critical incident on the service',
    'All acceptance criteria of the release ticket are proven',
  ],
  verdicts: [
    {
      gauge: 'exactitude_de_règle',
      label: 'Rule exactness',
      kind: 'faux',
      detail: 'The verdict matches, but none of the three motives is cited: the rule requires all of them.',
    },
    {
      gauge: 'fondation',
      label: 'Grounding',
      kind: 'infonde',
      detail: 'No source cited: an answer with no traceable claim is an unfounded answer.',
    },
  ],
};

/** La dérive de vérité du cas D-13, avec l'historique de vérité. */
export interface TruthDriftView {
  readonly caseId: string;
  readonly question: string;
  readonly source: string;
  readonly before: { readonly version: number; readonly value: string; readonly computedAt: string; readonly hash: string };
  readonly after: { readonly version: number; readonly value: string; readonly computedAt: string; readonly hash: string };
  readonly agentVersion: string;
  readonly agentAnswer: string;
  readonly verdict: string;
  readonly detail: string;
}

/** D-13 : la vérité a changé mardi, l'agent n'a rien raté. */
export const DRIFT_CASE: TruthDriftView = {
  caseId: 'D-13',
  question: 'How many critical incidents were opened in the last 7 days?',
  source: 'jsm · jsm:critical:7d',
  before: { version: 3, value: '0', computedAt: '2026-11-09T08:00:00Z', hash: 'a1f4c8' },
  after: { version: 4, value: '2', computedAt: '2026-11-10T06:00:00Z', hash: 'c3d90b' },
  agentVersion: 'v4',
  agentAnswer: '0 — no critical incident was opened in the last 7 days.',
  verdict: 'Truth drift',
  detail:
    'The oracle changed between the two runs (value hash a1f4c8 → c3d90b, computed 2026-11-10T06:00:00Z). '
    + 'The agent is not at fault: the case is replayed against the new truth and the regression is closed as a drift.',
};

/** La fissure du cas R-02 sur v6 : trois passages, trois verdicts. */
export interface CrackCase {
  readonly caseId: string;
  readonly question: string;
  readonly agentVersion: string;
  readonly attribution: string;
  readonly reason: string;
  readonly oracleStable: boolean;
  readonly passages: readonly {
    readonly no: number;
    readonly answer: string;
    readonly kind: VerdictKind;
    readonly note: string;
  }[];
}

/** R-02 sur v6 : le cas est stable, l'agent ne l'est pas. */
export const CRACK_CASE: CrackCase = {
  caseId: 'R-02',
  question: 'Can pull-request PAY-118 be merged?',
  agentVersion: 'v6',
  attribution: 'Unstable agent',
  reason:
    'The oracle did not move between the three passages, and the same case passes on v4 and v5. '
    + 'The bench attributes the crack to the agent, not to the case.',
  oracleStable: true,
  passages: [
    {
      no: 1,
      answer: 'Yes — CI is green, 2 approvals, no conflict with the target branch.',
      kind: 'exact',
      note: 'Verdict and the three motives are there.',
    },
    {
      no: 2,
      answer: 'Yes, it looks mergeable.',
      kind: 'faux',
      note: 'Same conclusion, no motive cited.',
    },
    {
      no: 3,
      answer: 'No — that pull request cannot be merged.',
      kind: 'faux',
      note: 'The conclusion itself changes.',
    },
  ],
};

/** La fissure telle que le banc la stocke, attribution comprise (§9). */
export const CRACK: Fissure = {
  id: 'fis-v6-R-02',
  caseId: 'R-02',
  agentVersionId: 'v6',
  passages: DEFAULT_PASSES,
  spread: {
    verdicts: ['exact', 'faux', 'faux'],
    distinctAnswers: 3,
    answerDistance: 0.42,
    oracleStable: true,
  },
  attribution: 'agent_instable',
  state: 'ouverte',
  openedAt: '2026-11-09T07:41:00Z',
};
