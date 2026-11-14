/**
 * Le cœur du banc réel, partagé par le CLI (enregistrement) et le navigateur
 * (mode direct).
 *
 * Une seule implémentation : `runRealBench` joue les cas, recalcule les
 * oracles, juge avec les huit jauges, détecte les fissures, construit la
 * scorecard et la porte. Le CLI l'appelle avec le client HTTP du serveur ;
 * le site l'appelle avec le client qui passe par le proxy — la mesure est la
 * même, seul le chemin de l'appel change.
 */
import type {
  AgentUnderTest, BancCase, Fissure, OracleState, Passage, Scorecard, Verdict,
} from '../domain/vocabulary.js';
import type { SourceRegistry } from '../oracle/deps.js';
import { recomputeOracle } from '../oracle/recompute.js';
import { evaluateRuleForCase } from '../oracle/rule.js';
import { judgePassage, withStability } from '../judge/index.js';
import { detectFissure } from '../run/fissure.js';
import { playPasses } from '../run/passes.js';
import { buildScorecard } from '../score/scorecard.js';
import { checkPromotion } from '../score/promotion.js';
import { gaugeOfCase } from './run.js';
import type { TraceTour } from './real-agent.js';
import { REAL_CORPUS, sceauValide } from '../real/corpus.js';
import { REAL_CASES, REAL_DEMO_CASE_IDS } from '../real/cases.js';

/**
 * Les cas joués par la démo réelle (CLI et mode direct navigateur) : le corpus
 * RÉEL du dépôt, pas le monde inventé de `src/seed/`.
 */
export const DEMO_CASE_IDS: readonly string[] = REAL_DEMO_CASE_IDS;

/** Les cas du banc réel, dans l'ordre des familles (§6). */
export const DEMO_CASES: readonly BancCase[] = REAL_CASES;

/** La mesure d'un cas, publiée au site. */
export interface RealCaseRecord {
  id: string;
  question: string;
  gravity: string;
  oracleType: string;
  oracle: string | null;
  oracleAlive: boolean;
  answers: string[];
  latencyMs: number[];
  tokens: number[];
  cost: number;
  citations: number;
  /** Citations résolues sur un document réel du corpus, sur le total émis. */
  citationsFondees: number;
  verdicts: { gauge: string; kind: string; value: number | null }[];
  crack: string | null;
  /** Le modèle réellement servi par le méta-routeur au dernier tour. */
  modeleServi: string | null;
  /** Les documents que l'agent a réellement lus (retrieval), par chemin. */
  docsLus: readonly string[];
  /** Nombre d'appels au modèle pour ce cas (1 si rien à demander, 2 avec retrieval). */
  tours: number;
}

/** La mesure complète d'un banc réel. */
export interface RealRunRecord {
  meta: {
    model: string; provider: string; recordedAt: string; passes: number;
    mode: TrackedMode; priceUsdPerThousandTokens: number; note: string;
    /** Provenance du corpus réel : commit capturé, horodatage, empreinte, sceau. */
    corpus: {
      commit: string; capture: string; depot: string;
      documents: number; empreinte: string; sceauValide: boolean; sources: string;
    };
  };
  totals: {
    cases: number; calls: number; tours: number; tokens: number; costUsd: number;
    latencyMeanMs: number; latencyMaxMs: number; citationsEmitted: number;
    citationsFondees: number; documentsLus: number;
    /** Les fournisseurs réellement servis, distincts : un méta-routeur bouge. */
    modeleservis: readonly string[];
  };
  scorecard: { gauge: string; n: number; value: number | null; floor: number; ciLow: number | null; ciHigh: number | null }[];
  gate: { allowed: boolean; motives: { rule: string; passed: boolean; detail: string }[] };
  cases: readonly RealCaseRecord[];
}

/** Le mode d'essai, aligné sur le domaine. */
export type TrackedMode = 'blanc' | 'noir';

/** Ce que la fabrique d'agent doit produire. */
export type AgentFactory = (input: {
  readonly cases: readonly BancCase[];
  readonly oracles: Readonly<Record<string, OracleState>>;
  readonly registry: SourceRegistry;
  /** Consigned après chaque cas : qui a réellement servi, et ce qui a été lu. */
  readonly trace?: (caseId: string, tour: TraceTour) => void;
}) => AgentUnderTest;

/** Les entrées du banc réel. */
export interface RealBenchOptions {
  readonly cases: readonly BancCase[];
  readonly registry: SourceRegistry;
  readonly priceUsdPerThousandTokens: number;
  readonly model: string;
  readonly provider: string;
  readonly passes?: number;
  readonly mode?: TrackedMode;
  /** Progression, appelée après chaque cas joué (mode direct navigateur). */
  readonly onCasePlayed?: (caseId: string, done: number, total: number) => void;
  /** Le corpus réel dont les oracles sont recalculés ; le corpus capturé par défaut. */
  readonly corpus?: typeof REAL_CORPUS;
}

/** Recalcule les oracles de tous les cas joués. */
async function computeOracles(
  cases: readonly BancCase[], registry: SourceRegistry,
): Promise<Record<string, OracleState>> {
  const oracles: Record<string, OracleState> = {};
  for (const kase of cases) {
    oracles[kase.id] = await recomputeOracle(kase, registry, {
      ruleEvaluator: evaluateRuleForCase, versionNo: 1,
    });
  }
  return oracles;
}

/** Joue un cas : rend la vue publiée ET les verdicts complets. */
async function playCase(
  kase: BancCase, oracle: OracleState, passes: number,
  agent: AgentUnderTest, mode: TrackedMode, trace?: TraceTour,
): Promise<{ record: RealCaseRecord; verdicts: readonly Verdict[] }> {
  const played = await playPasses(kase, passes, agent, { runId: 'demo:reel', mode });
  const verdicts: Verdict[] = [];
  for (const passage of played.passages) {
    verdicts.push(...await judgePassage({
      kase, passage, oracle, mode, citationsResolved: passage.answer.citations,
    }));
  }
  const scoped = verdicts.filter((verdict) => verdict.gauge === gaugeOfCase(kase));
  const crack = detectFissure(kase.id, 'réel', played.passages, scoped, true);
  const withStab = addStability(kase, oracle, played.passages, verdicts, crack, mode);
  const record: RealCaseRecord = {
    id: kase.id,
    question: kase.question,
    gravity: kase.gravity,
    oracleType: kase.oracleType,
    oracle: oracle.value === null ? null : String(oracle.value),
    oracleAlive: oracle.alive,
    answers: played.passages.map((passage) => passage.answer.text),
    latencyMs: played.passages.map((passage) => passage.latencyMs),
    tokens: played.passages.map((passage) => passage.tokens),
    cost: played.passages.reduce((total, passage) => total + passage.costEstimate, 0),
    citations: played.passages.reduce((total, passage) => total + passage.answer.citations.length, 0),
    citationsFondees: played.passages.reduce(
      (total, passage) => total + passage.answer.citations.filter((c) => c.resolved !== null).length, 0),
    verdicts: withStab.map((verdict) => ({ gauge: verdict.gauge, kind: verdict.kind, value: verdict.value })),
    crack: crack?.attribution ?? null,
    modeleServi: trace?.modeleServi ?? null,
    docsLus: trace?.docsLus ?? [],
    tours: trace?.tours ?? 0,
  };
  return { record, verdicts: withStab };
}

/** La stabilité se mesure sur l'ensemble des passages, pas sur un seul. */
function addStability(
  kase: BancCase, oracle: OracleState, passages: readonly Passage[],
  verdicts: readonly Verdict[], crack: Fissure | null, mode: TrackedMode,
): readonly Verdict[] {
  const kinds = verdicts.filter((v) => v.gauge === gaugeOfCase(kase)).map((v) => v.kind);
  return passages.flatMap((passage) => withStability(
    verdicts.filter((verdict) => verdict.passageId === passage.id),
    { kase, passage, oracle, mode, citationsResolved: passage.answer.citations },
    kinds,
    crack,
  ));
}

/** Construit la scorecard et la porte depuis les verdicts et les totaux. */
function buildReport(
  cases: readonly BancCase[], passes: number, oracles: Record<string, OracleState>,
  verdicts: readonly Verdict[], records: readonly RealCaseRecord[],
  priceUsdPerThousandTokens: number, model: string, provider: string, mode: TrackedMode,
  corpus: typeof REAL_CORPUS,
): RealRunRecord {
  const tokens = records.reduce((total, item) => total + item.tokens.reduce((a, b) => a + b, 0), 0);
  const cost = (tokens / 1000) * priceUsdPerThousandTokens;
  const latencies = records.flatMap((item) => item.latencyMs);
  const scorecard: Scorecard = buildScorecard({
    agentVersionId: 'réel', suiteId: 'suite-gold', mode,
    verdicts, oracleStates: Object.values(oracles),
    budget: {
      calls: cases.length * passes, tokens, costEstimate: cost,
      limitCalls: 10_000, limitTokens: 10_000_000, limitCost: 50, exhausted: false,
    },
  });
  const gate = checkPromotion({
    agentId: 'agent-support', candidateVersion: 'réel', scorecard,
    regressions: [], blockingCases: [], amorcesFailed: [],
  });
  return {
    meta: {
      model, provider, recordedAt: new Date().toISOString(), passes, mode,
      priceUsdPerThousandTokens,
      note: 'Live — un vrai modèle a lu de vrais fichiers du dépôt et a répondu sans que la réponse lui soit donnée. Le banc a mesuré, la clé n\'a jamais quitté le serveur.',
      corpus: {
        commit: corpus.meta.commit, capture: corpus.meta.capturéLe, depot: corpus.meta.dépôt,
        documents: corpus.documents.length, empreinte: corpus.meta.empreinteEnsemble,
        sceauValide: sceauValide(corpus), sources: corpus.meta.sources,
      },
    },
    totals: {
      cases: cases.length, calls: cases.length * passes,
      tours: records.reduce((total, item) => total + item.tours, 0),
      tokens, costUsd: cost,
      latencyMeanMs: latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length),
      latencyMaxMs: Math.max(0, ...latencies),
      citationsEmitted: records.reduce((total, item) => total + item.citations, 0),
      citationsFondees: records.reduce((total, item) => total + item.citationsFondees, 0),
      documentsLus: new Set(records.flatMap((item) => item.docsLus)).size,
      modeleservis: [...new Set(records.map((item) => item.modeleServi).filter((m): m is string => Boolean(m)))].sort(),
    },
    scorecard: scorecard.rows.map((row) => ({
      gauge: row.gauge, n: row.n, value: row.value, floor: row.floor, ciLow: row.ciLow, ciHigh: row.ciHigh,
    })),
    gate: { allowed: gate.allowed, motives: gate.motives.map((m) => ({ rule: m.rule, passed: m.passed, detail: m.detail })) },
    cases: records,
  };
}

/** Lance le banc réel et rend sa mesure. */
export async function runRealBench(options: RealBenchOptions, agentFactory: AgentFactory): Promise<RealRunRecord> {
  const passes = options.passes ?? 3;
  const mode = options.mode ?? 'noir';
  const corpus = options.corpus ?? REAL_CORPUS;
  const oracles = await computeOracles(options.cases, options.registry);
  const traces = new Map<string, TraceTour>();
  const agent = agentFactory({
    cases: options.cases, oracles, registry: options.registry,
    trace: (caseId, tour) => traces.set(caseId, tour),
  });
  const records: RealCaseRecord[] = [];
  const verdicts: Verdict[] = [];
  for (const kase of options.cases) {
    const played = await playCase(kase, oracles[kase.id] as OracleState, passes, agent, mode, traces.get(kase.id));
    records.push(played.record);
    verdicts.push(...played.verdicts);
    options.onCasePlayed?.(kase.id, records.length, options.cases.length);
  }
  return buildReport(
    options.cases, passes, oracles, verdicts, records,
    options.priceUsdPerThousandTokens, options.model, options.provider, mode, corpus,
  );
}
