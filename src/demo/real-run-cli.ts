/**
 * Lance un banc RÉEL et enregistre sa mesure.
 *
 * Le site public est statique : la clé InferHub ne peut pas y vivre (elle
 * serait lisible dans le bundle). Le banc réel se joue donc ici, côté serveur,
 * et c'est SA MESURE qui est publiée : vraies réponses, vraie latence, vrais
 * jetons, vrai coût, vraie non-détermination.
 *
 * C'est la différence entre une démo et une illustration : ce qui est affiché
 * a été mesuré sur un vrai modèle, à un instant donné, sur un vrai corpus.
 *
 * Usage :
 *   INFERHUB_API_KEY=… npm run demo:real
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { AgentUnderTest, BancCase, Fissure, OracleState, Passage, Scorecard, Verdict } from '../domain/vocabulary.js';
import { recomputeOracle } from '../oracle/recompute.js';
import { evaluateRuleForCase } from '../oracle/rule.js';
import { judgePassage, withStability } from '../judge/index.js';
import { detectFissure } from '../run/fissure.js';
import { playPasses } from '../run/passes.js';
import { buildScorecard } from '../score/scorecard.js';
import { checkPromotion } from '../score/promotion.js';
import { seededRegistry } from './sources.js';
import { createHttpChatClient, createRealAgent } from './real-agent.js';
import { gaugeOfCase } from './run.js';
import { SEED_CASES } from '../seed/index.js';

/** Les cas joués : un tour complet des trois formes d'oracle et des amorces. */
const PLAYED = ['D-01', 'D-02', 'D-04', 'D-15', 'R-04', 'R-01', 'R-07', 'F-01', 'F-02', 'F-03', 'A-01', 'A-05'];

/** Passages par cas : trois, comme un essai réel (§9). */
const PASSES = 3;

/** Tarif affiché : une estimation, jamais muette (§17). */
const USD_PER_THOUSAND = 0.0003;

/** Modèle appelé. */
const MODEL = process.env.DEMO_MODEL ?? 'combo/cheap';

/** Base de l'API. */
const BASE_URL = process.env.DEMO_BASE_URL ?? 'https://api.inferhub.dev/v1';

/** La mesure d'un cas, telle que le site l'affiche. */
interface RealCase {
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
  verdicts: { gauge: string; kind: string; value: number | null }[];
  crack: string | null;
}

/** Ce que le jeu réel produit : les cas, les verdicts, les mesures. */
interface PlayOutcome {
  readonly cases: RealCase[];
  readonly verdicts: Verdict[];
  readonly latencies: number[];
  readonly tokens: number;
  readonly cost: number;
}

/** Joue tous les cas, trois passages chacun, et mesure. */
async function playCases(
  cases: readonly BancCase[],
  oracles: Readonly<Record<string, OracleState>>,
  agent: AgentUnderTest,
): Promise<PlayOutcome> {
  const records: RealCase[] = [];
  const verdicts: Verdict[] = [];
  const latencies: number[] = [];
  let tokens = 0;
  let cost = 0;
  for (const kase of cases) {
    const oracle = oracles[kase.id] as OracleState;
    const played = await playPasses(kase, PASSES, agent, { runId: 'demo:real', mode: 'noir' });
    const caseVerdicts = await judgeAll(kase, oracle, played.passages);
    const gauge = gaugeOfCase(kase);
    const scoped = caseVerdicts.filter((verdict) => verdict.gauge === gauge);
    const crack = detectFissure(kase.id, 'réel', played.passages, scoped, true);
    const withStability = stabilityFor(kase, oracle, played.passages, caseVerdicts, crack);
    verdicts.push(...withStability);
    const caseTokens = played.passages.reduce((total, p) => total + p.tokens, 0);
    const caseCost = played.passages.reduce((total, p) => total + p.costEstimate, 0);
    const latency = played.passages.map((passage) => passage.latencyMs);
    latencies.push(...latency);
    tokens += caseTokens;
    cost += caseCost;
    records.push(toRecord(kase, oracle, played.passages, withStability, crack, caseCost));
    process.stdout.write(`  ${kase.id} — ${played.passages.length} passages, ${caseTokens} jetons\n`);
  }
  return { cases: records, verdicts, latencies, tokens, cost };
}

/** Juge tous les passages d'un cas. */
async function judgeAll(
  kase: BancCase, oracle: OracleState, passages: readonly Passage[],
): Promise<Verdict[]> {
  const verdicts: Verdict[] = [];
  for (const passage of passages) {
    verdicts.push(...await judgePassage({
      kase, passage, oracle, mode: 'noir', citationsResolved: passage.answer.citations,
    }));
  }
  return verdicts;
}

/** Ajoute la jauge de stabilité : elle porte sur l'ensemble des passages. */
function stabilityFor(
  kase: BancCase, oracle: OracleState, passages: readonly Passage[],
  caseVerdicts: readonly Verdict[], crack: Fissure | null,
): readonly Verdict[] {
  const kinds = caseVerdicts.filter((v) => v.gauge === gaugeOfCase(kase)).map((v) => v.kind);
  return passages.flatMap((passage) => withStability(
    caseVerdicts.filter((verdict) => verdict.passageId === passage.id),
    { kase, passage, oracle, mode: 'noir', citationsResolved: passage.answer.citations },
    kinds,
    crack,
  ));
}

/** Transforme un cas joué en enregistrement publiable. */
function toRecord(
  kase: BancCase, oracle: OracleState, passages: readonly Passage[],
  verdicts: readonly Verdict[], crack: Fissure | null, cost: number,
): RealCase {
  return {
    id: kase.id,
    question: kase.question,
    gravity: kase.gravity,
    oracleType: kase.oracleType,
    oracle: oracle.value === null ? null : String(oracle.value),
    oracleAlive: oracle.alive,
    answers: passages.map((passage) => passage.answer.text),
    latencyMs: passages.map((passage) => passage.latencyMs),
    tokens: passages.map((passage) => passage.tokens),
    cost,
    citations: passages.reduce((total, p) => total + p.answer.citations.length, 0),
    verdicts: verdicts.map((verdict) => ({ gauge: verdict.gauge, kind: verdict.kind, value: verdict.value })),
    crack: crack?.attribution ?? null,
  };
}

/** Point d'entrée : joue, mesure, enregistre. */
export async function main(): Promise<number> {
  const apiKey = process.env.INFERHUB_API_KEY;
  if (!apiKey) {
    process.stderr.write('INFERHUB_API_KEY absente : le banc réel ne peut pas jouer.\n');
    return 1;
  }
  const registry = seededRegistry();
  const cases = SEED_CASES.filter((item) => PLAYED.includes(item.id));
  const oracles: Record<string, OracleState> = {};
  for (const kase of cases) {
    oracles[kase.id] = await recomputeOracle(kase, registry, {
      ruleEvaluator: evaluateRuleForCase, versionNo: 1,
    });
  }
  const chat = createHttpChatClient(BASE_URL, apiKey, MODEL);
  const agent = createRealAgent({
    chat, price: { usdPerThousandTokens: USD_PER_THOUSAND },
    cases, oracles, registry,
  });

  const outcome = await playCases(cases, oracles, agent);
  const totalTokens = outcome.tokens;
  const totalCost = outcome.cost;
  const latencies = outcome.latencies;

  const scorecard: Scorecard = buildScorecard({
    agentVersionId: 'réel', suiteId: 'suite-gold', mode: 'noir',
    verdicts: outcome.verdicts, oracleStates: Object.values(oracles),
    budget: {
      calls: cases.length * PASSES, tokens: totalTokens, costEstimate: totalCost,
      limitCalls: 1000, limitTokens: 1_000_000, limitCost: 5, exhausted: false,
    },
  });
  const gate = checkPromotion({
    agentId: 'agent-support', candidateVersion: 'réel', scorecard,
    regressions: [], blockingCases: [], amorcesFailed: [],
  });

  const payload = {
    meta: {
      model: MODEL,
      provider: 'inferhub.dev',
      recordedAt: new Date().toISOString(),
      passes: PASSES,
      mode: 'noir',
      priceUsdPerThousandTokens: USD_PER_THOUSAND,
      note: 'Banc réel : un vrai modèle a répondu, le banc a mesuré. La clé n\'a jamais quitté le serveur.',
    },
    totals: {
      cases: cases.length,
      calls: cases.length * PASSES,
      tokens: totalTokens,
      costUsd: totalCost,
      latencyMeanMs: Math.round(latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length)),
      latencyMaxMs: Math.max(0, ...latencies),
      citationsEmitted: outcome.cases.reduce((total, item) => total + item.citations, 0),
    },
    scorecard: scorecard.rows.map((row) => ({
      gauge: row.gauge, n: row.n, value: row.value, floor: row.floor,
      ciLow: row.ciLow, ciHigh: row.ciHigh,
    })),
    gate: { allowed: gate.allowed, motives: gate.motives.map((m) => ({ rule: m.rule, passed: m.passed, detail: m.detail })) },
    cases: outcome.cases,
  };
  const path = resolve(process.cwd(), 'site/public/real-run.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  process.stdout.write(`\nécrit : ${path}\n`);
  process.stdout.write(`jetons : ${totalTokens} · coût : ${totalCost.toFixed(4)} $ · `
    + `latence moyenne : ${payload.totals.latencyMeanMs} ms\n`);
  return 0;
}

process.exit(await main());
