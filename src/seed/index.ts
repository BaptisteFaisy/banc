/**
 * Banc de démonstration (§29) : ce que les juges du hackathon exécutent.
 *
 * 40 cas seedés dans l'espace du banc — 15 valeurs dérivées, 10 cas à règle,
 * 8 cas à refus, 7 amorces — et trois versions d'un agent, dont la v4 comme
 * témoin. La v5 casse deux cas bloquants et perd un point de fondation ; la
 * v6 répare la fondation mais casse la stabilité. Les juges le voient
 * immédiatement, sans configuration.
 */
import type { Agent, AgentVersion, BancCase, OracleState, Suite } from '../domain/vocabulary.js';
import { AMORCE_CASES, AMORCE_COUNT } from './cases-amorce.js';
import { DERIVED_CASES, DERIVED_COUNT } from './cases-derived.js';
import { REFUSAL_CASES, REFUSAL_COUNT } from './cases-refusal.js';
import { RULE_CASES, RULE_COUNT } from './cases-rule.js';
import { SEED_AGENT, SEED_VERSIONS, VERSION_V4, VERSION_V5, VERSION_V6 } from './agents.js';
import { buildSuites, SUITE_IDS } from './suites.js';
import { hashValue } from '../oracle/hash.js';
import { readPathSimple } from '../oracle/deps.js';
import { CONFLUENCE_TRUTH, GRAPH_TRUTH, JIRA_TRUTH, JSM_TRUTH } from './truth.js';

/** Les 40 cas du corpus de démonstration, dans l'ordre d'affichage. */
export const SEED_CASES: readonly BancCase[] = [
  ...DERIVED_CASES, ...RULE_CASES, ...REFUSAL_CASES, ...AMORCE_CASES,
];

/** Décompte par forme d'oracle, et le décompte attendu au §29. */
export interface SeedCounts {
  readonly derived: number;
  readonly rule: number;
  readonly refusal: number;
  readonly amorce: number;
  readonly total: number;
  readonly expected: { readonly derived: number; readonly rule: number; readonly refusal: number; readonly amorce: number };
}

/** Décompte par forme d'oracle : la CI vérifie 15 / 10 / 8 / 7. */
export function seedCounts(): SeedCounts {
  return {
    derived: DERIVED_CASES.length,
    rule: RULE_CASES.length,
    refusal: REFUSAL_CASES.length,
    amorce: AMORCE_CASES.length,
    total: SEED_CASES.length,
    expected: { derived: DERIVED_COUNT, rule: RULE_COUNT, refusal: REFUSAL_COUNT, amorce: AMORCE_COUNT },
  };
}

/** Le corpus respecte-t-il le décompte annoncé aux juges (§29) ? */
export function seedIsComplete(): { ok: boolean; motive: string } {
  const counts = seedCounts();
  const expected = counts.expected;
  if (counts.derived !== expected.derived || counts.rule !== expected.rule
    || counts.refusal !== expected.refusal || counts.amorce !== expected.amorce) {
    return {
      ok: false,
      motive: `corpus incomplet : ${counts.derived}/${expected.derived} valeurs dérivées, `
        + `${counts.rule}/${expected.rule} règles, ${counts.refusal}/${expected.refusal} refus, `
        + `${counts.amorce}/${expected.amorce} amorces`,
    };
  }
  if (counts.total !== 40) return { ok: false, motive: `corpus de ${counts.total} cas, 40 attendus` };
  return { ok: true, motive: '40 cas : 15 valeurs dérivées, 10 règles vivantes, 8 refus attendus, 7 amorces' };
}

/** L'agent de démonstration et ses trois versions. */
export const SEED_AGENTS: readonly Agent[] = [SEED_AGENT];
export { SEED_AGENT, SEED_VERSIONS, VERSION_V4, VERSION_V5, VERSION_V6 };
export { SEEDED_DRIFT, R04_EXPECTED, DRIFT_BEFORE } from './truth.js';
export { GRAPH_TRUTH, JIRA_TRUTH, CONFLUENCE_TRUTH, JSM_TRUTH } from './truth.js';

/** Les quatre suites, construites depuis le corpus. */
export const SEED_SUITES: readonly Suite[] = buildSuites(SEED_CASES, '2026-11-12T09:00:00Z', 1);

/** Suite par genre (`gold`, `smoke`, `battery`, `full`). */
export function seedSuite(kind: keyof typeof SUITE_IDS): Suite | undefined {
  return SEED_SUITES.find((suite) => suite.kind === kind || suite.id === SUITE_IDS[kind]);
}

/** Cas par identifiant. */
export function seedCase(id: string): BancCase | undefined {
  return SEED_CASES.find((item) => item.id === id);
}

/** Version par identifiant ou label. */
export function seedVersion(idOrLabel: string): AgentVersion | undefined {
  return SEED_VERSIONS.find((version) => version.id === idOrLabel || version.label === idOrLabel);
}

/**
 * État de vérité semé pour les cas à valeur dérivée.
 *
 * Chaque cas reçoit une valeur vivante, horodatée et empreinte, sauf D-13 qui
 * porte la dérive : sa version 2 est postérieure à la dérive semée. C'est ce
 * qui rend démontrable la recette 2 (§27) — la vérité a changé, l'agent n'a
 * rien raté.
 */
export function seedOracleStates(cases: readonly BancCase[] = SEED_CASES): Readonly<Record<string, readonly OracleState[]>> {
  const states: Record<string, OracleState[]> = {};
  for (const kase of cases) {
    const history = historyFor(kase);
    if (history.length > 0) states[kase.id] = [...history];
  }
  return states;
}

/** Historique de vérité d'un cas, avec la dérive semée pour D-13. */
function historyFor(kase: BancCase): readonly OracleState[] {
  if (kase.oracleType !== 'valeur_dérivée') return [];
  const value = seedValueOf(kase);
  // D-13 : la vérité a changé mardi. La version 1 porte la vérité D'AVANT
  // (zéro incident critique), la version 2 celle d'après — c'est ce couple
  // qui rend la dérive PROUVABLE, et non une intention de démonstration.
  if (kase.id === 'D-13') {
    return [
      stateOf(kase.id, 1, 0, '2026-11-05T06:00:00Z'),
      stateOf(kase.id, 2, value, '2026-11-10T06:00:00Z', '2026-11-10T06:00:00Z'),
    ];
  }
  return [stateOf(kase.id, 1, value, '2026-11-05T06:00:00Z')];
}

/**
 * Valeur seedée d'un cas à valeur dérivée.
 *
 * Elle est LUE dans les sources semées, pas recopiée dans une table : une
 * table en double les valeurs et finit par diverger — c'est exactement ce
 * qu'un cas d'amorce neglected a révélé (sa valeur était vide, et l'agent
 * répondait juste avec une valeur vide).
 */
function seedValueOf(kase: BancCase): string | number | boolean | readonly string[] {
  const spec = kase.oracleSpec;
  if (spec.type !== 'valeur_dérivée') return '';
  const sources: Record<string, Readonly<Record<string, unknown>>> = {
    graph: GRAPH_TRUTH, jira: JIRA_TRUTH, confluence: CONFLUENCE_TRUTH, jsm: JSM_TRUTH,
  };
  const data = sources[spec.source];
  if (!data || !(spec.query in data)) return '';
  const value = readPathSimple(data[spec.query], spec.path);
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value as readonly string[];
  return value as string | number | boolean;
}

/** Construit un état de vérité. */
function stateOf(caseId: string, versionNo: number, value: unknown, computedAt: string, driftAt?: string): OracleState {
  return {
    caseId, versionNo, valueHash: hashValue(value),
    value: value as OracleState['value'], computedAt,
    sourceRefs: [{ kind: 'seed', id: caseId, label: 'corpus de démonstration' }],
    alive: true, ...(driftAt ? { driftAt } : {}),
  };
}
