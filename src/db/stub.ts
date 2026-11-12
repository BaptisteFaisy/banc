/**
 * Client SQL : interface, adaptateur Forge, et stub mémoire pour les tests.
 *
 * Un test du banc ne fait jamais d'appel réseau (§25 reproductibilité) : la
 * persistance passe par cette interface, et le stub en mémoire joue le rôle
 * de Forge SQL en local comme en CI.
 *
 * Le stub n'est PAS un moteur SQL. Il accepte les formes réellement émises par
 * le dépôt (SELECT … WHERE … ORDER BY … LIMIT, INSERT, UPDATE, DELETE sur une
 * table) et **lève une erreur explicite** sur toute forme non supportée : un
 * stub qui rend un résultat faux en silence ferait passer des tests faux.
 */

/** Client SQL minimal, injecté partout où la persistance est nécessaire. */
export interface SqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
}

/** Forme de requête reconnue par le stub. */
type StatementKind = 'select' | 'insert' | 'update' | 'delete';

/** Découpe élémentaire d'une instruction. */
interface Parsed {
  readonly kind: StatementKind;
  readonly table: string;
  readonly rest: string;
}

/** Motif `table = ?` ou `table = 'x'` dans une clause WHERE. */
const WHERE_CLAUSE = /([a-z_][a-z0-9_]*)\s*(=|<>|!=|>|<|>=|<=)\s*(\?|'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?)/gi;

/** Extrait la table d'une instruction. */
function parse(sql: string): Parsed {
  const text = sql.replace(/\s+/g, ' ').trim();
  const lowered = text.toLowerCase();
  const kinds: readonly [StatementKind, RegExp][] = [
    ['select', /^select .*? from ([a-z_][a-z0-9_]*)/i],
    ['insert', /^insert into ([a-z_][a-z0-9_]*)/i],
    ['update', /^update ([a-z_][a-z0-9_]*)/i],
    ['delete', /^delete from ([a-z_][a-z0-9_]*)/i],
  ];
  for (const [kind, pattern] of kinds) {
    const match = pattern.exec(text);
    if (match) {
      return { kind, table: (match[1] ?? '').toLowerCase(), rest: text };
    }
  }
  if (lowered.startsWith('create') || lowered.startsWith('drop')) return { kind: 'select', table: '', rest: text };
  throw new Error(`stub SQL : forme non supportée — ${text.slice(0, 120)}`);
}

/** Valeur littérale d'un opérande : paramètre positionnel ou littéral. */
function operandValue(raw: string, params: readonly unknown[], cursor: { index: number }): unknown {
  if (raw === '?') {
    const value = params[cursor.index];
    cursor.index += 1;
    return value;
  }
  if (raw.startsWith("'") || raw.startsWith('"')) return raw.slice(1, -1);
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : raw;
}

/** Filtres d'une clause WHERE, appliqués à une ligne. */
function buildFilters(rest: string, params: readonly unknown[]): ((row: Row) => boolean) | null {
  const match = /\bwhere\b(.+?)(\border by\b|\blimit\b|$)/i.exec(rest);
  if (!match) return null;
  const clause = match[1] ?? '';
  if (/\bor\b/i.test(clause)) {
    throw new Error('stub SQL : WHERE avec OR non supporté — découpez la requête');
  }
  const cursor = { index: 0 };
  const conditions: { column: string; op: string; value: unknown }[] = [];
  let found = WHERE_CLAUSE.exec(clause);
  while (found !== null) {
    conditions.push({
      column: (found[1] ?? '').toLowerCase(),
      op: found[2] ?? '=',
      value: operandValue(found[3] ?? '', params, cursor),
    });
    if (found[0] === '') WHERE_CLAUSE.lastIndex += 1;
    found = WHERE_CLAUSE.exec(clause);
  }
  WHERE_CLAUSE.lastIndex = 0;
  return (row) => conditions.every((condition) => compare(row[condition.column], condition.op, condition.value));
}

/** Une ligne du stub. */
type Row = Record<string, unknown>;

/** Compare une colonne à une valeur attendue. */
function compare(actual: unknown, op: string, expected: unknown): boolean {
  const left = typeof actual === 'number' ? actual : String(actual ?? '');
  const right = typeof expected === 'number' ? expected : String(expected ?? '');
  switch (op) {
    case '=': return left === right;
    case '<>': case '!=': return left !== right;
    case '>': return Number(left) > Number(right);
    case '<': return Number(left) < Number(right);
    case '>=': return Number(left) >= Number(right);
    case '<=': return Number(left) <= Number(right);
    default: throw new Error(`stub SQL : opérateur non supporté — ${op}`);
  }
}

/** Trie selon `ORDER BY colonne [ASC|DESC]`. */
function applyOrder(rows: Row[], rest: string): Row[] {
  const match = /\border by\b\s+([a-z_][a-z0-9_]*)(\s+(asc|desc))?/i.exec(rest);
  if (!match) return rows;
  const column = (match[1] ?? '').toLowerCase();
  const descending = (match[3] ?? '').toLowerCase() === 'desc';
  return rows.sort((a, b) => {
    const left = a[column];
    const right = b[column];
    if (left === right) return 0;
    const before = (left ?? 0) < (right ?? 0) ? -1 : 1;
    return descending ? -before : before;
  });
}

/** Applique `LIMIT n`. */
function applyLimit(rows: Row[], rest: string): Row[] {
  const match = /\blimit\b\s+(\d+)/i.exec(rest);
  return match ? rows.slice(0, Number(match[1])) : rows;
}

/** Colonnes et valeurs d'un INSERT … (a, b) VALUES (?, ?). */
function parseInsert(rest: string, params: readonly unknown[]): Row {
  const columns = /\(([^)]*)\)\s*values/i.exec(rest)?.[1]
    ?.split(',').map((name) => name.trim().toLowerCase()) ?? [];
  if (columns.length === 0) throw new Error('stub SQL : INSERT sans liste de colonnes');
  const row: Row = {};
  columns.forEach((column, index) => {
    row[column] = params[index];
  });
  return row;
}

/** Colonnes modifiées d'un UPDATE … SET a = ?, b = ?. */
function parseUpdate(rest: string, params: readonly unknown[]): Row {
  const setClause = /\bset\b(.+?)(\bwhere\b|$)/i.exec(rest)?.[1] ?? '';
  const patch: Row = {};
  const cursor = { index: 0 };
  let found = WHERE_CLAUSE.exec(setClause);
  while (found !== null) {
    patch[(found[1] ?? '').toLowerCase()] = operandValue(found[3] ?? '', params, cursor);
    if (found[0] === '') WHERE_CLAUSE.lastIndex += 1;
    found = WHERE_CLAUSE.exec(setClause);
  }
  WHERE_CLAUSE.lastIndex = 0;
  return patch;
}

/** Crée un client SQL en mémoire. */
export function createStubSql(): SqlClient {
  const tables = new Map<string, Row[]>();
  const table = (name: string): Row[] => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name) as Row[];
  };
  return {
    query: async <T,>(sql: string, params: readonly unknown[] = []): Promise<readonly T[]> => {
      const parsed = parse(sql);
      if (parsed.kind !== 'select' || parsed.table === '') return [] as readonly T[];
      const filter = buildFilters(parsed.rest, params);
      let rows = table(parsed.table).filter((row) => (filter ? filter(row) : true));
      rows = applyOrder(rows, parsed.rest);
      return applyLimit(rows, parsed.rest) as readonly T[];
    },
    execute: async (sql: string, params: readonly unknown[] = []): Promise<void> => {
      const parsed = parse(sql);
      if (parsed.table === '') return; // CREATE/DROP : ignorés par le stub
      const rows = table(parsed.table);
      if (parsed.kind === 'insert') {
        rows.push(parseInsert(parsed.rest, params));
        return;
      }
      const filter = buildFilters(parsed.rest, params.slice(countPlaceholders(parsed.rest, parsed.kind)));
      if (parsed.kind === 'update') {
        const patch = parseUpdate(parsed.rest, params);
        for (const row of rows) if (!filter || filter(row)) Object.assign(row, patch);
        return;
      }
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (!filter || filter(rows[index] as Row)) rows.splice(index, 1);
      }
    },
  };
}

/** Nombre de `?` consommés avant la clause WHERE (SET ou VALUES). */
function countPlaceholders(rest: string, kind: StatementKind): number {
  const head = kind === 'update'
    ? /\bset\b(.+?)(\bwhere\b|$)/i.exec(rest)?.[1] ?? ''
    : /\(([^)]*)\)\s*values\s*\(([^)]*)\)/i.exec(rest)?.[2] ?? '';
  return (head.match(/\?/g) ?? []).length;
}
