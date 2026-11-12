/**
 * La démo du banc, calculée par le banc (§29).
 *
 * Ce module ne fabrique AUCUN chiffre : il fait tourner le vrai moteur —
 * recalcul des oracles, k passages, les huit jauges, la détection de fissures,
 * la scorecard, la classification régression / dérive, et la porte de
 * promotion — sur le vrai corpus de 40 cas, avec un agent simulé dont le
 * comportement est celui du scénario semé.
 *
 * Le site public consomme CE résultat : ce qu'il affiche est le produit, pas
 * une transcription. C'est la différence entre une démo et une illustration.
 */
import type {
  BancCase, Fissure, OracleHealth, OracleState, PromotionVerdict, Regression,
  Scorecard, Verdict,
} from '../domain/vocabulary.js';
import { DEFAULT_PASSES } from '../domain/vocabulary.js';
import { recomputeOracle } from '../oracle/recompute.js';
import { evaluateRuleForCase } from '../oracle/rule.js';
import { oracleHealth } from '../oracle/health.js';
import { judgePassage, withStability } from '../judge/index.js';
import { detectFissure } from '../run/fissure.js';
import { playPasses } from '../run/passes.js';
import { buildScorecard } from '../score/scorecard.js';
import { classifyDelta, recordTruthDrift } from '../score/regression.js';
import { checkPromotion } from '../score/promotion.js';
import { createSimulatedAgent, PROFILES } from './agent-simulator.js';
import type { SeededBehaviour } from './agent-simulator.js';
import { seededRegistry } from './sources.js';
import { SEED_CASES, SEED_SUITES, SEED_VERSIONS, seedOracleStates } from '../seed/index.js';

/** Ce qu'un cas a donné dans un essai simulé. */
export interface CaseOutcome {
  readonly caseId: string;
  readonly question: string;
  readonly gravity: BancCase['gravity'];
  readonly oracleType: BancCase['oracleType'];
  readonly oracle: OracleState;
  readonly verdicts: readonly Verdict[];
  readonly answers: readonly string[];
  readonly crack: Fissure | null;
}

/** Ce que le banc a mesuré pour une version. */
export interface DemoVersion {
  readonly id: string;
  readonly label: string;
  readonly behaviour: SeededBehaviour;
  readonly isWitness: boolean;
  readonly scorecard: Scorecard;
  readonly regressions: readonly Regression[];
  readonly drifts: readonly Regression[];
  readonly gate: PromotionVerdict;
  readonly stability: { readonly rate: number | null; readonly n: number; readonly fissured: number };
  readonly outcomes: readonly CaseOutcome[];
}

/** Le résultat complet de la démonstration. */
export interface DemoRun {
  readonly versions: readonly DemoVersion[];
  readonly health: OracleHealth;
  /** L'historique de vérité par cas : la preuve des dérives (§7). */
  readonly histories: Readonly<Record<string, readonly OracleState[]>>;
  readonly caseCount: number;
  readonly passes: number;
  readonly generatedAt: string;
}

/** Options de la démonstration. */
export interface DemoOptions {
  readonly cases?: readonly BancCase[];
  readonly passes?: number;
  readonly generatedAt?: string;
}

/** La jauge qui mesure un cas : une fissure se lit sur elle. */
export function gaugeOfCase(kase: BancCase): Verdict['gauge'] {
  if (kase.oracleType === 'règle_vivante') return 'exactitude_de_règle';
  if (kase.oracleType === 'refus_attendu') return 'refus_correct';
  return 'exactitude';
}

/** Recalcule l'oracle d'un cas, la règle vivante branchée. */
async function oracleOf(
  kase: BancCase, registry: ReturnType<typeof seededRegistry>,
): Promise<OracleState> {
  return recomputeOracle(kase, registry, { ruleEvaluator: evaluateRuleForCase, versionNo: 1 });
}

/** Joue un cas : k passages, verdict par jauge, fissure éventuelle. */
async function playCase(
  kase: BancCase, oracle: OracleState, versionId: string, passes: number, behaviour: SeededBehaviour,
): Promise<CaseOutcome> {
  const agent = createSimulatedAgent({
    profile: PROFILES[behaviour], cases: [kase], oracles: { [kase.id]: oracle },
  });
  const played = await playPasses(kase, passes, agent, { runId: `demo:${versionId}`, mode: 'noir' });
  const verdicts: Verdict[] = [];
  for (const passage of played.passages) {
    verdicts.push(...await judgePassage({
      kase, passage, oracle, mode: 'noir', citationsResolved: passage.answer.citations,
    }));
  }
  // Une fissure est l'écart de verdict d UNE jauge d'un passage à l'autre :
  // celle qui mesure CE cas. Comparer tous les verdicts ensemble ne mesurerait
  // rien — deux jauges différentes ont naturellement des verdicts différents.
  const gauge = gaugeOfCase(kase);
  const scoped = verdicts.filter((verdict) => verdict.gauge === gauge);
  const crack = detectFissure(kase.id, versionId, played.passages, scoped, true);
  // La stabilité se mesure sur l'ENSEMBLE des passages : chaque passage reçoit
  // le même verdict, sinon la moyenne dépendrait de l'ordre de jeu.
  const kinds = scoped.map((verdict) => verdict.kind);
  const withStab = played.passages.flatMap((passage) => withStability(
    verdicts.filter((verdict) => verdict.passageId === passage.id),
    { kase, passage, oracle, mode: 'noir', citationsResolved: passage.answer.citations },
    kinds,
    crack,
  ));
  return {
    caseId: kase.id, question: kase.question, gravity: kase.gravity,
    oracleType: kase.oracleType, oracle, verdicts: withStab,
    answers: played.passages.map((passage) => passage.answer.text), crack,
  };
}

/**
 * La suite jouée : le lot d'or, plus le cas qui porte la dérive de vérité.
 *
 * D-13 n'est pas dans le lot d'or — il est ajouté ici pour que la dérive
 * soit DÉMONTRABLE : sans un cas dont la vérité a bougé entre le témoin et
 * les candidats, la distinction centrale du produit resterait une promesse.
 */
function suiteCases(cases: readonly BancCase[]): readonly BancCase[] {
  const gold = SEED_SUITES.find((suite) => suite.kind === 'gold');
  const ids = new Set(gold?.caseIds ?? []);
  ids.add('D-13');
  const selected = cases.filter((item) => ids.has(item.id));
  return selected.length > 0 ? selected : cases;
}

/** Compare deux versions : régressions et dérives, via le vrai classifieur. */
function compareToWitness(
  candidate: readonly CaseOutcome[], witness: readonly CaseOutcome[],
  candidateVersion: string, witnessVersion: string, openedAt: string,
): { regressions: readonly Regression[]; drifts: readonly Regression[] } {
  const baseline = new Map(witness.map((item) => [item.caseId, item]));
  const regressions: Regression[] = [];
  const drifts: Regression[] = [];
  for (const outcome of candidate) {
    const reference = baseline.get(outcome.caseId);
    if (!reference) continue;
    const drifted = outcome.oracle.valueHash !== reference.oracle.valueHash;
    const evidence = {
      from: String(reference.oracle.value ?? ''), to: String(outcome.oracle.value ?? ''),
      at: outcome.oracle.computedAt,
    };
    for (const gauge of gaugesOf(outcome, reference)) {
      const candidateValue = valueOf(outcome, gauge);
      const baselineValue = valueOf(reference, gauge);
      if (candidateValue === null || baselineValue === null) continue;
      const delta = classifyDelta({
        caseId: outcome.caseId, gauge, candidate: candidateValue, baseline: baselineValue,
        oracleDrifted: drifted, agentVersionId: candidateVersion, baselineVersionId: witnessVersion,
        openedAt, ...(drifted ? { driftEvidence: evidence } : {}),
      });
      if (!delta) continue;
      if (delta.kind === 'truth_drift') drifts.push(delta);
      else if (delta.kind === 'regression') regressions.push(delta);
    }
    // La vérité a changé et le score n'a pas bougé : c'est le cas le plus
    // important du produit — « la vérité a changé mardi, l'agent n'a rien
    // raté ». Aucun écart de score ne le révèle : seule l'empreinte le sait.
    if (drifted && !drifts.some((item) => item.caseId === outcome.caseId)) {
      drifts.push(recordTruthDrift({
        caseId: outcome.caseId, gauge: 'exactitude', agentVersionId: candidateVersion,
        baselineVersionId: witnessVersion, openedAt, evidence,
      }));
    }
  }
  return { regressions, drifts };
}

/** Les jauges mesurées à la fois sur le candidat et le témoin. */
function gaugesOf(candidate: CaseOutcome, witness: CaseOutcome): readonly Verdict['gauge'][] {
  const reference = new Set(witness.verdicts.map((verdict) => verdict.gauge));
  const common: Verdict['gauge'][] = [];
  for (const verdict of candidate.verdicts) {
    if (reference.has(verdict.gauge) && !common.includes(verdict.gauge)) common.push(verdict.gauge);
  }
  return common;
}

/** Valeur d'une jauge pour un cas, ou `null` si elle ne s'applique pas. */
function valueOf(outcome: CaseOutcome, gauge: Verdict['gauge']): number | null {
  const verdict = outcome.verdicts.find((item) => item.gauge === gauge);
  return verdict?.value ?? null;
}

/** Construit le résultat d'une version : scorecard, écarts, porte. */
function buildVersion(
  behaviour: SeededBehaviour, versionId: string, outcomes: readonly CaseOutcome[],
  witness: readonly CaseOutcome[],
): DemoVersion {
  const verdicts = outcomes.flatMap((outcome) => outcome.verdicts);
  const oracles = outcomes.map((outcome) => outcome.oracle);
  const scorecard = buildScorecard({
    agentVersionId: versionId, suiteId: 'suite-gold', mode: 'noir',
    verdicts, oracleStates: oracles,
    budget: { calls: outcomes.length * DEFAULT_PASSES, tokens: 0, costEstimate: 0, limitCalls: 1000, limitTokens: 0, limitCost: 0, exhausted: false },
  });
  const comparison = compareToWitness(outcomes, witness, versionId, 'v4', '2026-11-12T09:00:00Z');
  const cracked = outcomes.filter((outcome) => outcome.crack);
  const gate = checkPromotion({
    agentId: 'agent-support', candidateVersion: versionId, scorecard,
    regressions: comparison.regressions,
    blockingCases: outcomes.filter((outcome) => outcome.gravity === 'bloquant')
      .map(() => ({ gravity: 'bloquant' } as never)),
    amorcesFailed: [],
  });
  const version = SEED_VERSIONS.find((item) => item.id === versionId);
  return {
    id: versionId, label: version?.label ?? versionId, behaviour, isWitness: version?.isWitness ?? false,
    scorecard, regressions: comparison.regressions, drifts: comparison.drifts, gate,
    stability: { rate: null, n: outcomes.length, fissured: cracked.length },
    outcomes,
  };
}

/**
 * Exécute la démonstration complète.
 *
 * L'ordre est celui du §29 : le témoin d'abord (v4), puis les candidats, que
 * l'on compare à la mesure figée du témoin — on ne compare pas à un souvenir.
 */
export async function runDemo(options: DemoOptions = {}): Promise<DemoRun> {
  const cases = options.cases ?? SEED_CASES;
  const passes = options.passes ?? DEFAULT_PASSES;
  const generatedAt = options.generatedAt ?? '2026-11-12T09:00:00Z';
  const registry = seededRegistry();
  const played = suiteCases(cases);
  // L'historique de vérité semé : la version 1 est la vérité d'AVANT la
  // dérive, la version 2 celle d'après. Le témoin est mesuré sur la première,
  // les candidats sur la dernière — c'est ainsi que la dérive de vérité du
  // cas D-13 est RÉELLE, et non une intention de démonstration.
  const history = seedOracleStates(cases);
  const oracles = new Map<string, OracleState>();
  for (const kase of played) {
    const versions = history[kase.id];
    oracles.set(kase.id, versions?.[0] ?? await oracleOf(kase, registry));
  }
  const currentOracles = new Map<string, OracleState>();
  for (const kase of played) {
    const versions = history[kase.id];
    currentOracles.set(kase.id, versions?.[versions.length - 1] ?? await oracleOf(kase, registry));
  }

  const outcomesFor = async (
    behaviour: SeededBehaviour, versionId: string, oraclesIn: ReadonlyMap<string, OracleState>,
  ): Promise<CaseOutcome[]> => {
    const list: CaseOutcome[] = [];
    for (const kase of played) {
      const oracle = oraclesIn.get(kase.id) as OracleState;
      list.push(await playCase(kase, oracle, versionId, passes, behaviour));
    }
    return list;
  };

  const witnessOutcomes = await outcomesFor('témoin', 'v4', oracles);
  const versions: DemoVersion[] = [buildVersion('témoin', 'v4', witnessOutcomes, witnessOutcomes)];
  for (const [versionId, behaviour] of [['v5', 'perte_fondation'], ['v6', 'instabilité']] as const) {
    const outcomes = await outcomesFor(behaviour, versionId, currentOracles);
    versions.push(buildVersion(behaviour, versionId, outcomes, witnessOutcomes));
  }
  // La santé porte sur le CORPS entier, pas seulement sur la suite jouée :
  // c'est lui qui contient le cas D-13, dont la vérité a dérivé.
  const allOracles = new Map<string, OracleState>();
  for (const kase of cases) {
    const versions = history[kase.id];
    allOracles.set(kase.id, versions?.[versions.length - 1] ?? await oracleOf(kase, registry));
  }
  const health = oracleHealth([...allOracles.values()], cases, 'BENCH', history, {
    since: '2026-10-12T00:00:00Z', now: generatedAt,
  });
  return { versions, health, histories: history, caseCount: played.length, passes, generatedAt };
}
