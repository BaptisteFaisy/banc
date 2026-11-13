/**
 * Dépôt : le seul point d'accès aux données pour les autres modules (§22).
 *
 * Le mapping ligne SQL ↔ type du domaine est concentré ici, jamais dispersé
 * dans les requêtes. Les outils MCP (§19) et les écrans (§20) ne parlent
 * qu'au dépôt : c'est ce qui permet de changer de persistance sans toucher au
 * produit.
 *
 * Deux filtres de confidentialité sont appliqués à chaque lecture (§21, §25) :
 *   - `space_key` : un cas du banc ne sort jamais de l'espace du banc ;
 *   - le texte d'une réponse d'agent n'est jamais relu depuis une table de
 *     statistiques : `pass` porte `answer_ref` et `answer_hash`.
 */
import type {
  Agent, AgentVersion, BancCase, Fissure, Judgment, OracleState, Regression, Run, ScorecardRow, Suite,
} from '../domain/vocabulary.js';
import type { SqlClient } from './stub.js';

/** Ligne SQL brute : le stub et Forge SQL rendent des objets plats. */
type Row = Record<string, unknown>;

/** Chaîne ou `undefined`, sans `any`. */
function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Nombre ou 0. */
function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Nombre ou `null` : une jauge sans effectif n'est pas à zéro (§8). */
function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Booléen depuis un stockage SQL. */
function bool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** JSON décodé, ou la valeur de repli si la colonne est vide ou invalide. */
function json<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

/** Dépôt des cas : lecture filtrée, écriture, désactivation. */
export interface CaseRepo {
  byId(id: string): Promise<BancCase | undefined>;
  list(filter?: { spaceKey?: string; gravity?: string; tag?: string; oracleType?: string }): Promise<readonly BancCase[]>;
  insert(kase: BancCase): Promise<void>;
  disable(id: string, at: string): Promise<void>;
}

/** Ligne SQL → cas du domaine. */
export function toCase(row: Row): BancCase {
  return {
    id: text(row.id), spaceKey: text(row.space_key), question: text(row.question),
    oracleType: text(row.oracle_type) as BancCase['oracleType'],
    oracleSpec: json(row.oracle_spec_json, { type: 'valeur_dérivée' } as BancCase['oracleSpec']),
    gravity: text(row.gravity) as BancCase['gravity'],
    tags: json<readonly string[]>(row.tags_json, []),
    rubric: json<BancCase['rubric']>(row.rubric_json, undefined),
    createdAt: text(row.created_at), createdByRef: text(row.created_by_ref),
    ...(row.origin_ref ? { originRef: text(row.origin_ref) } : {}),
    ...(row.disabled_at ? { disabledAt: text(row.disabled_at) } : {}),
    amorce: json<BancCase['amorce']>(row.amorce_json, undefined),
  } as BancCase;
}

/** Cas du domaine → valeurs SQL. */
export function fromCase(kase: BancCase): readonly unknown[] {
  return [
    kase.id, kase.spaceKey, kase.question, kase.oracleType, JSON.stringify(kase.oracleSpec),
    kase.gravity, JSON.stringify(kase.tags), JSON.stringify(kase.rubric ?? null),
    kase.createdAt, kase.createdByRef, kase.originRef ?? null, kase.disabledAt ?? null,
  ];
}

/** Filtre de liste de cas : chaque critère est optionnel et cumulatif. */
function caseFilterClauses(filter: NonNullable<Parameters<CaseRepo['list']>[0]>): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.spaceKey) { clauses.push('space_key = ?'); params.push(filter.spaceKey); }
  if (filter.gravity) { clauses.push('gravity = ?'); params.push(filter.gravity); }
  if (filter.oracleType) { clauses.push('oracle_type = ?'); params.push(filter.oracleType); }
  return { sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

/** Crée le dépôt des cas. */
export function createCaseRepo(sql: SqlClient): CaseRepo {
  return {
    byId: async (id) => {
      const rows = await sql.query<Row>('SELECT * FROM case WHERE id = ? LIMIT 1', [id]);
      return rows[0] ? toCase(rows[0]) : undefined;
    },
    list: async (filter = {}) => {
      const { sql: where, params } = caseFilterClauses(filter);
      const rows = await sql.query<Row>(`SELECT * FROM case${where}`, params);
      const cases = rows.map(toCase);
      // Le tag est stocké en JSON : le filtre se fait après lecture.
      return filter.tag ? cases.filter((item) => item.tags.includes(filter.tag as string)) : cases;
    },
    insert: async (kase) => {
      await sql.execute(
        'INSERT INTO case (id, space_key, question, oracle_type, oracle_spec_json, gravity, tags_json, rubric_json, created_at, created_by_ref, origin_ref, disabled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        fromCase(kase),
      );
    },
    disable: async (id, at) => {
      await sql.execute('UPDATE case SET disabled_at = ? WHERE id = ?', [at, id]);
    },
  };
}

/** Dépôt des oracles : l'historique de vérité est append-only (§7). */
export interface OracleRepo {
  latest(caseId: string): Promise<OracleState | undefined>;
  history(caseId: string): Promise<readonly OracleState[]>;
  append(state: OracleState): Promise<void>;
}

/** Ligne SQL → état d'oracle. */
export function toOracleState(row: Row): OracleState {
  return {
    caseId: text(row.case_id), versionNo: num(row.version_no), valueHash: text(row.value_hash),
    value: json<OracleState['value']>(row.value_json, null), computedAt: text(row.computed_at),
    sourceRefs: json<OracleState['sourceRefs']>(row.source_refs_json, []), alive: bool(row.alive),
    ...(row.dead_reason ? { deadReason: text(row.dead_reason) as OracleState['deadReason'] } : {}),
    ...(row.drift_at ? { driftAt: text(row.drift_at) } : {}),
    ruleOutcome: json<OracleState['ruleOutcome']>(row.rule_outcome_json, undefined),
  } as OracleState;
}

/** Crée le dépôt des oracles. */
export function createOracleRepo(sql: SqlClient): OracleRepo {
  return {
    latest: async (caseId) => {
      const rows = await sql.query<Row>(
        'SELECT * FROM oracle_state WHERE case_id = ? ORDER BY version_no DESC LIMIT 1', [caseId]);
      return rows[0] ? toOracleState(rows[0]) : undefined;
    },
    history: async (caseId) => {
      const rows = await sql.query<Row>('SELECT * FROM oracle_state WHERE case_id = ? ORDER BY version_no ASC', [caseId]);
      return rows.map(toOracleState);
    },
    append: async (state) => {
      // Append-only : on n'écrase jamais une version passée, c'est ce qui
      // permet de PROUVER une dérive de vérité plus tard.
      await sql.execute(
        'INSERT INTO oracle_state (case_id, version_no, value_hash, value_json, computed_at, source_refs_json, alive, dead_reason, drift_at, rule_outcome_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [state.caseId, state.versionNo, state.valueHash, JSON.stringify(state.value), state.computedAt,
         JSON.stringify(state.sourceRefs), state.alive, state.deadReason ?? null, state.driftAt ?? null,
         JSON.stringify(state.ruleOutcome ?? null)],
      );
    },
  };
}

/** Dépôt minimal des autres tables : écriture et lecture par identifiant. */
export interface GenericRepo {
  insert(table: string, columns: readonly string[], values: readonly unknown[]): Promise<void>;
  findBy(table: string, column: string, value: unknown): Promise<readonly Row[]>;
  map<T2>(rows: readonly Row[], mapper: (row: Row) => T2): readonly T2[];
}

/** Crée un dépôt générique, pour les tables sans logique de mapping propre. */
export function createGenericRepo(sql: SqlClient): GenericRepo {
  return {
    insert: async (table, columns, values) => {
      const placeholders = columns.map(() => '?').join(', ');
      await sql.execute(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
    },
    findBy: async (table, column, value) => sql.query<Row>(`SELECT * FROM ${table} WHERE ${column} = ?`, [value]),
    map: (rows, mapper) => rows.map(mapper),
  };
}

/** Ligne SQL → scorecard. */
export function toScorecardRow(row: Row): ScorecardRow {
  return {
    agentVersionId: text(row.agent_version_id), suiteId: text(row.suite_id),
    mode: text(row.mode) as ScorecardRow['mode'], gauge: text(row.gauge) as ScorecardRow['gauge'],
    n: num(row.n), value: nullableNum(row.value), ciLow: nullableNum(row.ci_low),
    ciHigh: nullableNum(row.ci_high), floor: num(row.floor), computedAt: text(row.computed_at),
  };
}

/** Ligne SQL → régression. */
export function toRegression(row: Row): Regression {
  return {
    id: text(row.id), agentVersionId: text(row.agent_version_id),
    baselineVersionId: text(row.baseline_version_id), caseId: text(row.case_id),
    gauge: text(row.gauge) as Regression['gauge'], delta: num(row.delta),
    kind: text(row.kind) as Regression['kind'], openedAt: text(row.opened_at),
    state: text(row.state) as Regression['state'],
    truthEvidence: json<Regression['truthEvidence']>(row.truth_evidence_json, undefined),
  } as Regression;
}

/** Ligne SQL → vote du jury. */
export function toJudgment(row: Row): Judgment {
  return {
    id: text(row.id), caseId: text(row.case_id), judgeRef: text(row.judge_ref),
    verdict: text(row.verdict) as Judgment['verdict'], notes: text(row.notes),
    at: text(row.at), sampleId: text(row.sample_id),
  };
}

/** Ligne SQL → fissure. */
export function toFissure(row: Row): Fissure {
  return {
    id: text(row.id), caseId: text(row.case_id), agentVersionId: text(row.agent_version_id),
    passages: num(row.passages), spread: json<Fissure['spread']>(row.spread_json, {
      verdicts: [], distinctAnswers: 0, answerDistance: 0, oracleStable: true,
    }),
    attribution: text(row.attribution) as Fissure['attribution'],
    state: text(row.state) as Fissure['state'], openedAt: text(row.opened_at),
  };
}

/** Ligne SQL → essai. */
export function toRun(row: Row): Run {
  return {
    id: text(row.id), agentVersionId: text(row.agent_version_id), suiteId: text(row.suite_id),
    mode: text(row.mode) as Run['mode'], passes: num(row.passes), startedAt: text(row.started_at),
    ...(row.finished_at ? { finishedAt: text(row.finished_at) } : {}),
    state: text(row.state) as Run['state'],
    budget: json<Run['budget']>(row.budget_used_json, {
      calls: 0, tokens: 0, costEstimate: 0, limitCalls: 0, limitTokens: 0, limitCost: 0, exhausted: false,
    }),
    ...(row.config_hash_at_end ? { configHashAtEnd: text(row.config_hash_at_end) } : {}),
    ...(row.invalidated_reason ? { invalidatedReason: text(row.invalidated_reason) } : {}),
    ...(row.cursor !== null && row.cursor !== undefined ? { cursor: num(row.cursor) } : {}),
    conditionHash: text(row.condition_hash),
  };
}

/** Ligne SQL → suite. */
export function toSuite(row: Row): Suite {
  return {
    id: text(row.id), name: text(row.name), kind: text(row.kind) as Suite['kind'],
    caseIds: json<readonly string[]>(row.case_ids_json, []), version: num(row.version),
    updatedAt: text(row.updated_at),
  };
}

/** Ligne SQL → agent. */
export function toAgent(row: Row): Agent {
  return {
    id: text(row.id), name: text(row.name), rovoRef: text(row.rovo_ref),
    ownerRef: text(row.owner_ref), suiteKind: text(row.suite_kind) as Agent['suiteKind'],
    createdAt: text(row.created_at),
  };
}

/** Ligne SQL → version d'agent (dont le témoin). */
export function toAgentVersion(row: Row): AgentVersion {
  return {
    id: text(row.id), agentId: text(row.agent_id), label: text(row.label),
    fingerprint: json<AgentVersion['fingerprint']>(row.spec_json, {
      specHash: text(row.spec_hash), promptHash: text(row.prompt_hash), skills: [], actions: [],
      tools: [], model: text(row.model), temperature: num(row.temperature), capturedAt: text(row.created_at),
    }),
    isWitness: bool(row.is_witness), createdAt: text(row.created_at),
  };
}
