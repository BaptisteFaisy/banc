// src/db/schema-indexes.ts — indexes Forge SQL du banc d'essai d'agents.
// Un CREATE INDEX IF NOT EXISTS par couple (table, colonne) listé ci-dessous.
export type IndexTarget = readonly [table: string, column: string];

const TARGETS: readonly IndexTarget[] = [
  ['condition', 'case_id'],
  ['pass', 'run_id'],
  ['pass', 'case_id'],
  ['verdict', 'pass_id'],
  ['verdict', 'case_id'],
  ['verdict', 'gauge'],
  ['run', 'agent_version_id'],
  ['run', 'suite_id'],
  ['scorecard', 'agent_version_id'],
  ['scorecard', 'suite_id'],
  ['scorecard', 'gauge'],
  ['regression', 'agent_version_id'],
  ['regression', 'case_id'],
  ['regression', 'gauge'],
  ['fissure', 'case_id'],
  ['fissure', 'agent_version_id'],
  ['judgment', 'case_id'],
  ['oracle_state', 'case_id'],
  ['amorce', 'case_id'],
  ['case', 'space_key'],
];

/** Noms d'index stables et uniques : idx_<table>_<colonne>. */
function indexName(table: string, column: string): string {
  return `idx_${table}_${column}`;
}

export const INDEXES: readonly string[] = TARGETS.map(([table, column]) =>
  `CREATE INDEX IF NOT EXISTS ${indexName(table, column)} ON ${table} (${column})`);
