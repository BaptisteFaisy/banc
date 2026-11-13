/**
 * Moteur d'essai (§17, §21) : l'orchestration d'un essai par tranches.
 *
 * Ce qu'impose la plateforme Forge : une action dure 55 s, une fonction 25 s,
 * et un essai long passe par un `consumer` de 900 s. Un essai de 200 cas × 3
 * passages ne tient donc dans AUCUNE fonction : il est découpé en tranches
 * avec curseur, et chaque tranche est reprenable.
 *
 * Trois garanties portées ici :
 *   - reproductibilité : la même condition d'essai pour toutes les versions ;
 *   - invalidation : si l'empreinte de l'agent a changé pendant l'essai, aucun
 *     score n'est publié (§13) ;
 *   - budget : le banc s'arrête à la limite et le dit, il ne coupe jamais une
 *     mesure en silence (§17, §25).
 */
import type {
  AgentUnderTest, BancCase, BenchMode, BudgetUsage, Fissure, Passage, Run, RunState, Verdict,
} from '../domain/vocabulary.js';
import { SLICE_SECONDS } from '../domain/vocabulary.js';
import type { SourceRegistry, Clock } from '../oracle/deps.js';
import { systemClock } from '../oracle/deps.js';
import type { CachePort } from '../oracle/deps.js';
import { recomputeOracle } from '../oracle/recompute.js';
import { evaluateRuleForCase } from '../oracle/rule.js';
import { detectDrift } from '../oracle/drift.js';
import type { OracleState } from '../domain/vocabulary.js';
import { judgePassage, withStability } from '../judge/index.js';
import { playPasses } from './passes.js';
import { detectFissure } from './fissure.js';
import { chargeBudget, budgetExhausted } from './budget.js';
import { checkFingerprintDrift, invalidateRunReason } from './fingerprint.js';
import type { ConditionStore } from './condition.js';
import { appendLog, runLogEntry } from './log.js';
import type { RunLogEntry } from './log.js';
import { sampleSuite } from './sampler.js';

/** Dépendances injectées du moteur : rien d'impur n'est appelé en dur. */
export interface RunDeps {
  readonly agent: AgentUnderTest;
  readonly registry: SourceRegistry;
  readonly conditions: ConditionStore;
  readonly clock?: Clock;
  readonly cache?: CachePort;
  readonly snapshots?: Readonly<Record<string, unknown>>;
  readonly sliceSeconds?: number;
}

/** Ce que rend une tranche d'essai. */
export interface SliceResult {
  readonly run: Run;
  readonly passages: readonly Passage[];
  readonly verdicts: readonly Verdict[];
  readonly fissures: readonly Fissure[];
  readonly oracleStates: readonly OracleState[];
  readonly log: readonly RunLogEntry[];
  readonly state: RunState;
  readonly cursor: number;
  readonly invalidatedReason?: string;
  readonly sampled: boolean;
}

/** Entrée d'un essai : ce que l'orchestrateur fournit. */
export interface RunInput {
  readonly run: Run;
  readonly cases: readonly BancCase[];
  readonly previousOracles?: Readonly<Record<string, OracleState>>;
}

/** Recalcule la vérité d'un cas et trace la dérive éventuelle. */
async function refreshOracle(
  kase: BancCase,
  deps: RunDeps,
  previous: OracleState | undefined,
): Promise<{ state: OracleState; drifted: boolean }> {
  const state = await recomputeOracle(kase, deps.registry, {
    cache: deps.cache,
    clock: deps.clock,
    versionNo: previous ? previous.versionNo + 1 : 1,
    ruleEvaluator: evaluateRuleForCase,
  });
  const drift = detectDrift(previous, state);
  return { state, drifted: drift.drifted };
}

/** Joue un cas : passages, oracle recalculé, verdicts, fissure. */
async function playCase(
  kase: BancCase,
  run: Run,
  deps: RunDeps,
  previous: OracleState | undefined,
): Promise<CaseOutcome> {
  const clock = deps.clock ?? systemClock;
  const { state: oracle, drifted } = await refreshOracle(kase, deps, previous);
  const condition = await deps.conditions.capture(kase.id, run.mode, deps.snapshots?.[kase.id] ?? null);
  const played = await playPasses(kase, run.passes, deps.agent, {
    runId: run.id, mode: run.mode, condition,
  });
  const verdicts = await judgeAll(played.passages, kase, oracle, run.mode, clock);
  const fissure = detectFissure(kase.id, run.agentVersionId, played.passages, verdicts, !drifted);
  return { oracle, passages: played.passages, verdicts, fissure, calls: played.calls, stoppedEarly: played.stoppedEarly };
}

/** Résultat d'un cas joué. */
interface CaseOutcome {
  readonly oracle: OracleState;
  readonly passages: readonly Passage[];
  readonly verdicts: readonly Verdict[];
  readonly fissure: Fissure | null;
  readonly calls: number;
  readonly stoppedEarly: string | null;
}

/** Juge tous les passages d'un cas, stabilité comprise. */
async function judgeAll(
  passages: readonly Passage[],
  kase: BancCase,
  oracle: OracleState,
  mode: BenchMode,
  clock: () => string,
): Promise<readonly Verdict[]> {
  const all: Verdict[] = [];
  for (const passage of passages) {
    const input = {
      kase, passage, oracle, mode,
      citationsResolved: passage.answer.citations,
      clock,
    };
    all.push(...await judgePassage(input));
  }
  const kinds = all.filter((v) => v.gauge === 'exactitude').map((v) => v.kind);
  const fissure = detectFissure(kase.id, '', passages, all.filter((v) => v.gauge === 'exactitude'), true);
  return passages.flatMap((passage) => withStability(
    all.filter((v) => v.passageId === passage.id),
    { kase, passage, oracle, mode, citationsResolved: passage.answer.citations, clock },
    kinds,
    fissure,
  ));
}

/** Exécute UNE tranche d'essai, reprenable par curseur. */
export async function runSlice(input: RunInput, deps: RunDeps): Promise<SliceResult> {
  const clock = deps.clock ?? systemClock;
  const deadline = Date.now() + (deps.sliceSeconds ?? SLICE_SECONDS) * 1000;
  const sampling = sampleSuite(input.cases, input.cases.length);
  const start = input.run.cursor ?? 0;
  let run = input.run;
  let log: readonly RunLogEntry[] = [runLogEntry(run.id, 'tranche_démarrée', clock(), { cursor: start })];
  const state = { passages: [], verdicts: [], fissures: [], oracles: [] } as MutableAccumulator;

  for (let index = start; index < sampling.selected.length; index += 1) {
    if (Date.now() > deadline || budgetExhausted(run.budget)) {
      return finish(run, state, log, index, clock, stopReasonOf(run.budget, deadline));
    }
    const kase = sampling.selected[index] as BancCase;
    const outcome = await playCase(kase, run, deps, input.previousOracles?.[kase.id]);
    accumulate(state, outcome);
    run = withBudget(run, outcome);
    log = traceCase(log, run.id, kase.id, outcome, clock);
  }
  return finish(run, state, log, sampling.selected.length, clock, null);
}

/** Accumulateur mutable interne (le résultat rendu, lui, est immuable). */
interface MutableAccumulator {
  passages: Passage[];
  verdicts: Verdict[];
  fissures: Fissure[];
  oracles: OracleState[];
}

/** Ajoute le résultat d'un cas à l'accumulateur. */
function accumulate(state: MutableAccumulator, outcome: CaseOutcome): void {
  state.passages.push(...outcome.passages);
  state.verdicts.push(...outcome.verdicts);
  if (outcome.fissure) state.fissures.push(outcome.fissure);
  state.oracles.push(outcome.oracle);
}

/** Charge le budget d'un essai après un cas joué. */
function withBudget(run: Run, outcome: CaseOutcome): Run {
  const tokens = outcome.passages.reduce((total, p) => total + p.tokens, 0);
  const cost = outcome.passages.reduce((total, p) => total + p.costEstimate, 0);
  return { ...run, budget: chargeBudget(run.budget, outcome.calls, tokens, cost) };
}

/** Trace un cas joué : oracle mort, effet de bord, arrêt précoce, fissure. */
function traceCase(
  log: readonly RunLogEntry[],
  runId: string,
  caseId: string,
  outcome: CaseOutcome,
  clock: () => string,
): readonly RunLogEntry[] {
  let next = appendLog(log, runLogEntry(runId, 'cas_posé', clock(), { caseId, passages: outcome.passages.length }));
  if (!outcome.oracle.alive) {
    next = appendLog(next, runLogEntry(runId, 'oracle_mort', clock(), { caseId, reason: outcome.oracle.deadReason }));
  }
  if (outcome.stoppedEarly) {
    next = appendLog(next, runLogEntry(runId, 'échec_trivial', clock(), { caseId, reason: outcome.stoppedEarly }));
  }
  if (outcome.fissure) {
    next = appendLog(next, runLogEntry(runId, 'fissure_ouverte', clock(), {
      caseId, attribution: outcome.fissure.attribution,
    }));
  }
  return next;
}

/** Raison d'arrêt d'une tranche : budget ou temps. */
function stopReasonOf(budget: BudgetUsage, deadline: number): 'budget_épuisé' | 'tranche_terminée' | null {
  if (budgetExhausted(budget)) return 'budget_épuisé';
  return Date.now() > deadline ? 'tranche_terminée' : null;
}

/** Clôture une tranche : état, curseur, invalidation éventuelle. */
function finish(
  run: Run,
  state: MutableAccumulator,
  log: readonly RunLogEntry[],
  cursor: number,
  clock: () => string,
  stop: 'budget_épuisé' | 'tranche_terminée' | null,
): SliceResult {
  const exhausted = budgetExhausted(run.budget);
  const base = {
    passages: state.passages, verdicts: state.verdicts,
    fissures: state.fissures, oracleStates: state.oracles, cursor,
  };
  if (exhausted) {
    const stopped: Run = { ...run, state: 'stopped_budget', finishedAt: clock() };
    return {
      ...base, run: stopped, state: 'stopped_budget', sampled: false,
      log: appendLog(log, runLogEntry(run.id, 'budget_épuisé', clock(), { ...run.budget })),
    };
  }
  const next: Run = { ...run, cursor, state: stop === 'tranche_terminée' ? 'sliced' : 'done' };
  return {
    ...base, run: next, state: next.state, sampled: false,
    log: appendLog(log, runLogEntry(run.id, 'tranche_terminée', clock(), { cursor })),
  };
}

/**
 * Invalide un essai dont l'empreinte de configuration a changé en cours de
 * route (§13) : aucun score n'est attribué à une version qui n'était pas
 * celle testée.
 */
export function invalidateOnFingerprintDrift(
  run: Run,
  start: Parameters<typeof checkFingerprintDrift>[0],
  end: Parameters<typeof checkFingerprintDrift>[1],
  clock: Clock = systemClock,
): { run: Run; log: readonly RunLogEntry[] } {
  const drift = checkFingerprintDrift(start, end);
  const reason = invalidateRunReason(drift);
  if (!reason) return { run: { ...run, configHashAtEnd: end.specHash }, log: [] };
  return {
    run: { ...run, state: 'invalidated', invalidatedReason: reason, configHashAtEnd: end.specHash, finishedAt: clock() },
    log: [runLogEntry(run.id, 'essai_invalidé', clock(), { reason, changed: drift.changedFields })],
  };
}
