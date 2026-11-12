/**
 * Oracle « règle vivante » (§6.2) : la réponse n'est pas une valeur mais un
 * PRÉDICAT sur l'état courant. L'agent n'a pas à connaître la règle — il doit
 * la redécouvrir — et le banc mesure deux choses séparément : l'exactitude du
 * verdict, et la qualité des motifs cités.
 *
 * C'est le type de cas qui casse les agents, et celui qu'un test classique ne
 * sait pas évaluer : un agent peut arriver à « non » pour de mauvaises
 * raisons, et un agent dont la conclusion diffère peut rester cohérent avec
 * ce qu'il avance.
 *
 * On ne devine jamais un atome : si une source manque ou si un droit est
 * absent, l'oracle entier est mort. Une règle à moitié devinée produirait un
 * verdict faux que le banc attribuerait à l'agent.
 */
import type {
  BancCase,
  DeadOracleReason,
  OracleState,
  RuleAtom,
  RuleOracleSpec,
  RuleOutcome,
} from '../domain/vocabulary.js';
import type { PathReader, SourceRegistry } from './deps.js';
import { readPathSimple, systemClock } from './deps.js';
import { hashValue } from './hash.js';
import type { RecomputeOptions } from './recompute.js';

/** État d'un atome après lecture : vrai/faux, et vivant ou non. */
export interface AtomState {
  readonly id: string;
  readonly ok: boolean;
  readonly alive: boolean;
  readonly value: unknown;
  readonly denied?: boolean;
}

/** Résultat complet de l'évaluation d'une règle. */
export interface RuleEvaluation {
  readonly outcome: RuleOutcome | null;
  readonly alive: boolean;
  readonly deadReason?: DeadOracleReason;
  readonly atomStates: readonly AtomState[];
}

/** Applique l'opérateur d'un atome à la valeur lue. */
export function applyAtomOp(op: RuleAtom['op'], actual: unknown, expected: RuleAtom['expected']): boolean {
  switch (op) {
    case 'exists':
      return actual !== undefined && actual !== null && !(Array.isArray(actual) && actual.length === 0);
    case 'absent':
      return actual === undefined || actual === null || (Array.isArray(actual) && actual.length === 0);
    case 'gt':
    case 'lt':
      return compareNumbers(op, actual, expected);
    case 'contains':
      return contains(actual, expected);
    default:
      return looseEquals(op === 'not_equals', actual, expected);
  }
}

/** `gt` / `lt` : faux si l'une des deux valeurs n'est pas numérique. */
function compareNumbers(op: 'gt' | 'lt', actual: unknown, expected: RuleAtom['expected']): boolean {
  const left = Number(actual);
  const right = Number(expected);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return op === 'gt' ? left > right : left < right;
}

/** `contains` : le conteneur (chaîne ou tableau) porte la valeur attendue. */
function contains(actual: unknown, expected: RuleAtom['expected']): boolean {
  if (Array.isArray(actual)) {
    return actual.some((item) => String(item).toLowerCase() === String(expected).toLowerCase());
  }
  if (typeof actual === 'string') {
    return actual.toLowerCase().includes(String(expected).toLowerCase());
  }
  return false;
}

/** `equals` / `not_equals` : comparaison tolérante sur chaînes, nombres, booléens. */
function looseEquals(negate: boolean, actual: unknown, expected: RuleAtom['expected']): boolean {
  const left = String(actual ?? '').trim().toLowerCase();
  const right = String(expected ?? '').trim().toLowerCase();
  const numeric = Number(left) === Number(right) && left !== '' && right !== '';
  return negate ? !(left === right || numeric) : left === right || numeric;
}

/** Combine les atomes selon le combinateur déclaré dans le cas. */
export function combineAtoms(spec: RuleOracleSpec, truth: Readonly<Record<string, boolean>>): boolean {
  const ids = spec.atoms.map((atom) => atom.id);
  if (spec.combinator === 'all') return ids.every((id) => truth[id] === true);
  if (spec.combinator === 'any') return ids.some((id) => truth[id] === true);
  // Un identifiant inconnu dans l'expression vaut `false` : on ne devine pas.
  if (spec.combinator.and) return spec.combinator.and.every((id) => truth[id] === true);
  if (spec.combinator.or) return spec.combinator.or.some((id) => truth[id] === true);
  return false;
}

/** Évalue chaque atome ; un atome illisible rend toute la règle morte. */
async function evaluateAtoms(
  spec: RuleOracleSpec,
  registry: SourceRegistry,
  readPath: PathReader,
): Promise<{ states: AtomState[]; dead?: DeadOracleReason }> {
  const states: AtomState[] = [];
  for (const atom of spec.atoms) {
    const adapter = registry.get(atom.source);
    if (!adapter) return { states, dead: 'source_absente' };
    const read = await adapter.read(atom.query);
    if (!read.ok) return { states, dead: read.denied ? 'droit_manquant' : 'source_absente' };
    const value = readPath(read.value, atom.path);
    if (value === undefined) return { states, dead: 'source_absente' };
    states.push({ id: atom.id, ok: applyAtomOp(atom.op, value, atom.expected), alive: true, value });
  }
  return { states };
}

/** Évalue une règle vivante et rend son verdict avec ses motifs. */
export async function evaluateRule(
  spec: RuleOracleSpec,
  registry: SourceRegistry,
  options: { pathReader?: PathReader } = {},
): Promise<RuleEvaluation> {
  const readPath = options.pathReader ?? readPathSimple;
  const { states, dead } = await evaluateAtoms(spec, registry, readPath);
  if (dead) return { outcome: null, alive: false, deadReason: dead, atomStates: states };
  const truth: Record<string, boolean> = {};
  for (const state of states) truth[state.id] = state.ok;
  const satisfied = combineAtoms(spec, truth);
  return {
    outcome: {
      satisfied,
      trueAtoms: states.filter((state) => state.ok).map((state) => state.id),
      falseAtoms: states.filter((state) => !state.ok).map((state) => state.id),
      expectedAnswer: satisfied ? spec.expectedWhenTrue : spec.expectedWhenFalse,
    },
    alive: true,
    atomStates: states,
  };
}

/** Les motifs attendus : ce que l'agent doit citer pour être fondé. */
export function expectedMotives(spec: RuleOracleSpec, outcome: RuleOutcome): readonly string[] {
  const wanted = outcome.satisfied ? outcome.trueAtoms : outcome.falseAtoms;
  return spec.atoms.filter((atom) => wanted.includes(atom.id)).map((atom) => atom.label);
}

/** Forme canonique d'un motif, pour une comparaison insensible. */
function canonical(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Un motif cité correspond-il à un motif attendu (label ou identifiant) ? */
function matchesMotive(cited: string, spec: RuleOracleSpec, wanted: readonly string[]): boolean {
  const needle = canonical(cited);
  return spec.atoms.some(
    (atom) => wanted.includes(atom.label) && (canonical(atom.label) === needle || canonical(atom.id) === needle),
  );
}

/** Compare les motifs cités par l'agent aux motifs attendus (§6.2). */
export function compareMotives(
  spec: RuleOracleSpec,
  outcome: RuleOutcome,
  citedMotives: readonly string[],
): { cited: readonly string[]; missing: readonly string[]; complete: boolean } {
  const wanted = expectedMotives(spec, outcome);
  const cited = wanted.filter((motive) => citedMotives.some((item) => matchesMotive(item, spec, [motive])));
  const missing = wanted.filter((motive) => !cited.includes(motive));
  const complete = spec.requireAllMotives ? missing.length === 0 : cited.length > 0;
  return { cited, missing, complete };
}

/**
 * Recalcule l'oracle d'un cas à règle vivante, au format `OracleState`.
 * C'est cette fonction que `recomputeOracle` appelle via son port.
 */
export async function evaluateRuleForCase(
  kase: BancCase,
  registry: SourceRegistry,
  options: RecomputeOptions = {},
): Promise<OracleState> {
  const clock = options.clock ?? systemClock;
  const versionNo = options.versionNo ?? 1;
  const spec = kase.oracleSpec;
  if (spec.type !== 'règle_vivante') {
    return {
      caseId: kase.id, versionNo, valueHash: '', value: null, computedAt: clock(),
      sourceRefs: [], alive: false, deadReason: 'règle_non_expressible',
    };
  }
  const evaluation = await evaluateRule(spec, registry, { pathReader: options.pathReader });
  if (!evaluation.alive || !evaluation.outcome) {
    return {
      caseId: kase.id, versionNo, valueHash: hashValue({ dead: evaluation.deadReason }), value: null,
      computedAt: clock(), sourceRefs: [], alive: false, deadReason: evaluation.deadReason,
    };
  }
  return {
    caseId: kase.id, versionNo, valueHash: hashValue(evaluation.outcome), value: evaluation.outcome.expectedAnswer,
    computedAt: clock(), sourceRefs: [], alive: true, ruleOutcome: evaluation.outcome,
  };
}
