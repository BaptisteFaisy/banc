// src/db/schema-tables.ts — DDL des 16 tables du banc d'essai d'agents (Forge SQL).
// Règles : types simples (TEXT/INTEGER/REAL/BOOLEAN), une instruction CREATE TABLE
// IF NOT EXISTS par table, NOT NULL sur l'obligatoire. Zéro contenu libre dans les
// tables de statistiques (voir `pass` et `scorecard` ci-dessous).
export type ColumnKind = 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN';
export type Column = readonly [name: string, kind: ColumnKind];

/** Joint la PRIMARY KEY (simple ou composite) aux colonnes typées. */
function stmt(table: string, cols: readonly Column[], pk: readonly string[]): string {
  const lines = cols.map(([name, kind]) => `  ${name} ${kind} NOT NULL`);
  return `CREATE TABLE IF NOT EXISTS ${table} (\n${lines.join(',\n')},\n  PRIMARY KEY (${pk.join(', ')})\n)`;
}

export const TABLES: readonly string[] = [
  'agent', 'agent_version', 'case', 'oracle_state', 'condition', 'suite', 'run',
  'pass', 'verdict', 'scorecard', 'regression', 'fissure', 'judgment',
  'calibration', 'amorce', 'budget',
] as const;

const AGENT: readonly Column[] = [
  ['id', 'TEXT'], ['name', 'TEXT'], ['rovo_ref', 'TEXT'], ['owner_ref', 'TEXT'],
  ['suite_kind', 'TEXT'], ['created_at', 'TEXT'],
];

const AGENT_VERSION: readonly Column[] = [
  ['id', 'TEXT'], ['agent_id', 'TEXT'], ['label', 'TEXT'], ['spec_hash', 'TEXT'],
  ['prompt_hash', 'TEXT'], ['skills_json', 'TEXT'], ['actions_json', 'TEXT'],
  ['tools_json', 'TEXT'], ['model', 'TEXT'], ['temperature', 'REAL'],
  ['created_at', 'TEXT'], ['is_witness', 'BOOLEAN'],
];

// `space_key` confine le cas à l'espace du banc : un cas n'est jamais rendu à un
// lecteur d'un autre espace (filtrage systématique par space_key avant lecture).
const CASE: readonly Column[] = [
  ['id', 'TEXT'], ['space_key', 'TEXT'], ['question', 'TEXT'], ['oracle_type', 'TEXT'],
  ['oracle_spec_json', 'TEXT'], ['gravity', 'TEXT'], ['tags_json', 'TEXT'],
  ['rubric_json', 'TEXT'], ['created_at', 'TEXT'], ['created_by_ref', 'TEXT'],
  ['origin_ref', 'TEXT'], ['disabled_at', 'TEXT'],
];

const ORACLE_STATE: readonly Column[] = [
  ['case_id', 'TEXT'], ['version_no', 'INTEGER'], ['value_hash', 'TEXT'],
  ['value_json', 'TEXT'], ['computed_at', 'TEXT'], ['source_refs_json', 'TEXT'],
  ['alive', 'BOOLEAN'], ['dead_reason', 'TEXT'], ['drift_at', 'TEXT'],
];

const CONDITION: readonly Column[] = [
  ['id', 'TEXT'], ['case_id', 'TEXT'], ['snapshot_hash', 'TEXT'],
  ['snapshot_json_ref', 'TEXT'], ['captured_at', 'TEXT'], ['mode', 'TEXT'],
];

const SUITE: readonly Column[] = [
  ['id', 'TEXT'], ['name', 'TEXT'], ['kind', 'TEXT'], ['case_ids_json', 'TEXT'],
  ['version', 'INTEGER'], ['updated_at', 'TEXT'],
];

const RUN: readonly Column[] = [
  ['id', 'TEXT'], ['agent_version_id', 'TEXT'], ['suite_id', 'TEXT'], ['mode', 'TEXT'],
  ['passes', 'INTEGER'], ['started_at', 'TEXT'], ['finished_at', 'TEXT'],
  ['state', 'TEXT'], ['budget_used_json', 'TEXT'], ['config_hash_at_end', 'TEXT'],
  ['invalidated_reason', 'TEXT'], ['cursor', 'INTEGER'], ['condition_hash', 'TEXT'],
];

// Confidentialité : la réponse de l'agent n'est JAMAIS stockée ici en clair —
// seulement `answer_ref` (référence vers l'objet réponse, hors tables de stats)
// et `answer_hash` (empreinte pour comparer deux passages). Le contenu d'un cas
// ne vit pas dans une table de statistiques.
const PASS: readonly Column[] = [
  ['id', 'TEXT'], ['run_id', 'TEXT'], ['case_id', 'TEXT'], ['passage_no', 'INTEGER'],
  ['answer_hash', 'TEXT'], ['answer_ref', 'TEXT'], ['latency_ms', 'INTEGER'],
  ['tokens', 'INTEGER'], ['cost_estimate', 'REAL'], ['tool_calls_json', 'TEXT'],
  ['side_effects_json', 'TEXT'],
];

const VERDICT: readonly Column[] = [
  ['id', 'TEXT'], ['pass_id', 'TEXT'], ['case_id', 'TEXT'], ['gauge', 'TEXT'],
  ['kind', 'TEXT'], ['value', 'REAL'], ['detail_json', 'TEXT'],
  ['evidence_json', 'TEXT'], ['computed_at', 'TEXT'],
];

// Confidentialité : scorecard ne porte AUCUNE colonne de texte libre (pas de
// notes, pas de réponse, pas de question) — uniquement des identifiants, la
// jauge, des nombres et un horodatage.
const SCORECARD: readonly Column[] = [
  ['id', 'TEXT'], ['agent_version_id', 'TEXT'], ['suite_id', 'TEXT'], ['mode', 'TEXT'],
  ['gauge', 'TEXT'], ['n', 'INTEGER'], ['value', 'REAL'], ['ci_low', 'REAL'],
  ['ci_high', 'REAL'], ['floor', 'REAL'], ['computed_at', 'TEXT'],
];

const REGRESSION: readonly Column[] = [
  ['id', 'TEXT'], ['agent_version_id', 'TEXT'], ['baseline_version_id', 'TEXT'],
  ['case_id', 'TEXT'], ['gauge', 'TEXT'], ['delta', 'REAL'], ['kind', 'TEXT'],
  ['opened_at', 'TEXT'], ['state', 'TEXT'],
];

const FISSURE: readonly Column[] = [
  ['id', 'TEXT'], ['case_id', 'TEXT'], ['agent_version_id', 'TEXT'],
  ['passages', 'INTEGER'], ['spread_json', 'TEXT'], ['attribution', 'TEXT'],
  ['state', 'TEXT'], ['opened_at', 'TEXT'],
];

const JUDGMENT: readonly Column[] = [
  ['id', 'TEXT'], ['case_id', 'TEXT'], ['judge_ref', 'TEXT'], ['verdict', 'TEXT'],
  ['notes', 'TEXT'], ['at', 'TEXT'], ['sample_id', 'TEXT'],
];

const CALIBRATION: readonly Column[] = [
  ['scope', 'TEXT'], ['gauge', 'TEXT'], ['n', 'INTEGER'],
  ['auto_vs_human_agreement', 'REAL'], ['inter_judge_agreement', 'REAL'],
  ['threshold', 'REAL'], ['calibrated', 'BOOLEAN'], ['computed_at', 'TEXT'],
];

const AMORCE: readonly Column[] = [
  ['id', 'TEXT'], ['case_id', 'TEXT'], ['kind', 'TEXT'],
  ['expected_behavior', 'TEXT'], ['blocking', 'BOOLEAN'],
];

const BUDGET: readonly Column[] = [
  ['scope', 'TEXT'], ['period', 'TEXT'], ['calls', 'INTEGER'], ['tokens', 'INTEGER'],
  ['cost_estimate', 'REAL'], ['limit_calls', 'INTEGER'], ['limit_tokens', 'INTEGER'],
  ['limit_cost', 'REAL'], ['stopped_at', 'TEXT'],
];

const DEFS: Readonly<Record<string, readonly [cols: readonly Column[], pk: readonly string[]]>> = {
  agent: [AGENT, ['id']],
  agent_version: [AGENT_VERSION, ['id']],
  case: [CASE, ['id']],
  oracle_state: [ORACLE_STATE, ['case_id', 'version_no']],
  condition: [CONDITION, ['id']],
  suite: [SUITE, ['id']],
  run: [RUN, ['id']],
  pass: [PASS, ['id']],
  verdict: [VERDICT, ['id']],
  scorecard: [SCORECARD, ['id']],
  regression: [REGRESSION, ['id']],
  fissure: [FISSURE, ['id']],
  judgment: [JUDGMENT, ['id']],
  calibration: [CALIBRATION, ['scope', 'gauge']],
  amorce: [AMORCE, ['id']],
  budget: [BUDGET, ['scope', 'period']],
};

export const SCHEMA: readonly string[] = TABLES.map((t) => {
  const [cols, pk] = DEFS[t] ?? [[], ['id']];
  return stmt(t, cols, pk);
});

export function tableOf(name: string): string | undefined {
  const i = TABLES.indexOf(name);
  return i >= 0 ? SCHEMA[i] : undefined;
}

/** Tables attendues absentes du schéma (tableau vide = schéma complet). */
export function assertSchemaComplete(): readonly string[] {
  const have = new Set(SCHEMA.map((s) => /CREATE TABLE IF NOT EXISTS (\w+)/.exec(s)?.[1] ?? ''));
  return TABLES.filter((t) => !have.has(t));
}
