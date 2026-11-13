/**
 * Oracle « valeur dérivée » (§6.1) : la réponse existe déjà dans les systèmes,
 * sous une forme calculable. L'oracle n'est PAS tapé : il est recalculé à
 * chaque essai depuis la source.
 *
 * Trois sorties possibles, et jamais une quatrième :
 *   vivante  la source a répondu, la valeur est là ;
 *   morte    la source est absente, en échec, ou la valeur n'existe pas ;
 *   refusée  la source a répondu « pas de droit » — distinct de « pas de
 *            données », parce que la plateforme vide le résultat sans erreur
 *            quand un droit manque (§21) et qu'un écran de santé des oracles
 *            qui confond les deux fait déboguer un prompt sain.
 *
 * Un oracle mort ne compte pas dans le score (§6.4) : il n'est jamais traité
 * comme une réponse fausse de l'agent.
 */
import type {
  BancCase,
  DeadOracleReason,
  DerivedOracleSpec,
  OracleState,
  SourceRead,
} from '../domain/vocabulary.js';
import type { CachePort, Clock, PathReader, SourceRegistry } from './deps.js';
import { readPathSimple, systemClock } from './deps.js';
import { hashValue } from './hash.js';

/** Options du recalcul : tout est injecté, rien n'est appelé en dur. */
export interface RecomputeOptions {
  readonly cache?: CachePort;
  readonly clock?: Clock;
  readonly pathReader?: PathReader;
  readonly versionNo?: number;
  readonly ruleEvaluator?: RuleEvaluator;
}

/** Port vers l'évaluateur de règle vivante (évite un cycle entre modules). */
export type RuleEvaluator = (
  kase: BancCase,
  registry: SourceRegistry,
  options?: RecomputeOptions,
) => Promise<OracleState>;

/** Options allégées pour un appel interne. */
type Opts = Pick<RecomputeOptions, 'clock' | 'pathReader' | 'versionNo'>;

/** Empreinte de la clé de cache : le couple (source, requête, chemin). */
function cacheKey(spec: DerivedOracleSpec): string {
  return hashValue({ source: spec.source, query: spec.query, path: spec.path });
}

/** Construit un `OracleState` mort, avec la raison exacte. */
function deadOracle(
  caseId: string,
  reason: DeadOracleReason,
  clock: Clock,
  versionNo: number,
): OracleState {
  return {
    caseId,
    versionNo,
    valueHash: hashValue({ dead: reason }),
    value: null,
    computedAt: clock(),
    sourceRefs: [],
    alive: false,
    deadReason: reason,
  };
}

/** Raison de mort correspondant à une lecture qui n'a pas abouti. */
function deadReasonOf(read: SourceRead): DeadOracleReason {
  return read.denied ? 'droit_manquant' : 'source_absente';
}

/** Recalcule l'oracle d'un cas « valeur dérivée ». */
export async function recomputeDerived(
  spec: DerivedOracleSpec,
  caseId: string,
  registry: SourceRegistry,
  options: RecomputeOptions = {},
): Promise<OracleState> {
  const clock = options.clock ?? systemClock;
  const readPath = options.pathReader ?? readPathSimple;
  const versionNo = options.versionNo ?? 1;
  const adapter = registry.get(spec.source);
  if (!adapter) return deadOracle(caseId, 'source_absente', clock, versionNo);

  const key = cacheKey(spec);
  if (options.cache) {
    const cached = await options.cache.get(key);
    if (cached && typeof cached === 'object') {
      return { ...(cached as Omit<OracleState, 'caseId' | 'versionNo'>), caseId, versionNo };
    }
  }

  const read = await adapter.read(spec.query);
  if (!read.ok) return deadOracle(caseId, deadReasonOf(read), clock, versionNo);
  return buildState(spec, caseId, read, readPath, clock, versionNo, options.cache, key);
}

/** Construit l'état vivant ou mort à partir d'une lecture réussie. */
async function buildState(
  spec: DerivedOracleSpec,
  caseId: string,
  read: SourceRead,
  readPath: PathReader,
  clock: Clock,
  versionNo: number,
  cache: CachePort | undefined,
  key: string,
): Promise<OracleState> {
  const raw = readPath(read.value, spec.path);
  if (raw === undefined) return deadOracle(caseId, 'source_absente', clock, versionNo);
  const value = Array.isArray(raw) ? (raw as readonly string[]) : (raw as string | number | boolean | null);
  const state: OracleState = {
    caseId,
    versionNo,
    valueHash: hashValue(value),
    value,
    computedAt: clock(),
    sourceRefs: read.sourceRefs,
    alive: true,
  };
  // Un oracle mort n'est jamais mis en cache : on doit retenter la lecture.
  if (cache) await cache.put(key, state);
  return state;
}

/**
 * Recalcule l'oracle d'un cas, quelle que soit sa forme.
 *
 * La règle vivante est déléguée à un port : `src/oracle/rule.ts` la fournit.
 * Sans évaluateur, le cas est marqué « règle non expressible » — le banc dit
 * qu'il ne sait pas plutôt que de rendre un verdict inventé.
 *
 * Le refus attendu n'a pas de vérité à recalculer : son oracle est écrit dans
 * le cas. L'état est donc vivant par construction, avec la liste de ce qui
 * manque comme valeur.
 */
export async function recomputeOracle(
  kase: BancCase,
  registry: SourceRegistry,
  options: RecomputeOptions = {},
): Promise<OracleState> {
  const clock = options.clock ?? systemClock;
  const versionNo = options.versionNo ?? 1;
  const spec = kase.oracleSpec;

  if (spec.type === 'valeur_dérivée') {
    return recomputeDerived(spec, kase.id, registry, options);
  }
  if (spec.type === 'règle_vivante') {
    if (!options.ruleEvaluator) {
      return deadOracle(kase.id, 'règle_non_expressible', clock, versionNo);
    }
    return options.ruleEvaluator(kase, registry, options);
  }
  return {
    caseId: kase.id,
    versionNo,
    valueHash: hashValue(spec.missing),
    value: null,
    computedAt: clock(),
    sourceRefs: [],
    alive: true,
  };
}

/** Options réduites utilisées par les appels internes (lisibilité des types). */
export type { Opts as RecomputeInternalOptions };
