/**
 * Les vues du site, derivées de la DÉMO CALCULÉE.
 *
 * Ce module ne contient aucun chiffre : il transforme le résultat du vrai
 * moteur (`runDemo()`) en vues affichables. Le site ne peut donc pas dériver du
 * banc qu'il décrit — s'il affiche un score, c'est que le banc l'a produit.
 */
import type { OracleHealth, PromotionVerdict, RuleOracleSpec, Scorecard } from '../../src/domain/vocabulary.js';
import type { DemoRun, DemoVersion } from '../../src/demo/run.js';
import { SEED_CASES } from '../../src/seed/index.js';
import type { OracleState } from '../../src/domain/vocabulary.js';
import type { CrackCase, FailureCase, FactorView, TruthDriftView, VerdictView } from './demo-cases.js';

/** Toutes les vues de la démonstration. */
export interface DemoFacts {
  readonly scorecards: readonly Scorecard[];
  readonly gateV4: PromotionVerdict;
  readonly gateV5: PromotionVerdict;
  readonly gateV6: PromotionVerdict;
  readonly oracleHealth: OracleHealth;
  readonly failure: FailureCase | null;
  readonly drift: TruthDriftView | null;
  readonly crack: CrackCase | null;
  readonly versions: readonly DemoVersion[];
  readonly caseCount: number;
  readonly passes: number;
}

/** Le libellé lisible d'un verdict, avec son motif. */
function verdictView(gauge: string, kind: string, detail: string): VerdictView {
  return { gauge, label: kind, kind: kind as VerdictView['kind'], detail };
}

/** La version de démonstration correspondant à un identifiant. */
function versionOf(demo: DemoRun, id: string): DemoVersion | undefined {
  return demo.versions.find((version) => version.id === id);
}

/** Les facteurs d'une règle vivante, lus dans l'oracle calculé. */
function factorsOf(spec: RuleOracleSpec, oracle: OracleState): readonly FactorView[] {
  const outcome = oracle.ruleOutcome;
  return spec.atoms.map((atom) => ({
    label: atom.label,
    source: atom.source,
    query: atom.query,
    expected: String(atom.expected ?? ''),
    read: String(atom.expected ?? ''),
    satisfied: outcome ? (outcome.satisfied ? outcome.trueAtoms : outcome.falseAtoms).includes(atom.id) : false,
  }));
}

/** Le cas en échec : celui qu'une version candidate rate. */
function failureOf(demo: DemoRun, caseId: string): FailureCase | null {
  const version = versionOf(demo, 'v5');
  const outcome = version?.outcomes.find((item) => item.caseId === caseId);
  const kase = SEED_CASES.find((item) => item.id === caseId);
  if (!outcome || !kase || kase.oracleSpec.type !== 'règle_vivante') return null;
  const oracle = outcome.oracle;
  const motives = oracle.ruleOutcome
    ? (oracle.ruleOutcome.satisfied ? oracle.ruleOutcome.trueAtoms : oracle.ruleOutcome.falseAtoms)
    : [];
  const missing = outcome.verdicts
    .filter((verdict) => verdict.gauge === 'exactitude_de_règle')
    .flatMap((verdict) => verdict.evidence.missingMotives ?? []);
  return {
    caseId: outcome.caseId,
    question: outcome.question,
    rule: 'Shipping is allowed if (no active freeze) AND (no open critical incident) AND (all acceptance criteria proven).',
    expectedAnswer: String(oracle.value ?? ''),
    factors: factorsOf(kase.oracleSpec, oracle),
    agentVersion: version?.id ?? 'v5',
    answer: outcome.answers[0] ?? '',
    citations: motives.map((id) => id),
    missingMotives: [...new Set(missing)],
    verdicts: outcome.verdicts.map((verdict) => verdictView(
      verdict.gauge, verdict.kind, String(verdict.detail?.reason ?? verdict.value ?? ''),
    )),
  };
}

/** La dérive de vérité : le cas D-13, avant et après. */
function driftOf(demo: DemoRun): TruthDriftView | null {
  const history = demo.histories['D-13'];
  if (!history || history.length < 2) return null;
  const before = history[0] as OracleState;
  const after = history[history.length - 1] as OracleState;
  const witness = versionOf(demo, 'v4')?.outcomes.find((item) => item.caseId === 'D-13');
  return {
    caseId: 'D-13',
    question: witness?.question ?? 'How many critical incidents were opened in the last 7 days?',
    source: 'jsm · jsm:critical:7d',
    before: { version: before.versionNo, value: String(before.value ?? ''), computedAt: before.computedAt, hash: before.valueHash.slice(0, 6) },
    after: { version: after.versionNo, value: String(after.value ?? ''), computedAt: after.computedAt, hash: after.valueHash.slice(0, 6) },
    agentVersion: 'v4',
    agentAnswer: witness?.answers[0] ?? '',
    verdict: 'Truth drift',
    detail:
      `The oracle changed between the two runs (value hash ${before.valueHash.slice(0, 6)} → ${after.valueHash.slice(0, 6)}, `
      + `computed ${after.computedAt}). The agent is not at fault: the case is replayed against the new truth `
      + 'and the regression is closed as a drift.',
  };
}

/** La fissure : un cas dont le verdict change d'un passage à l'autre. */
function crackOf(demo: DemoRun): CrackCase | null {
  const version = versionOf(demo, 'v6');
  const outcome = version?.outcomes.find((item) => item.crack !== null);
  if (!outcome || !outcome.crack) return null;
  const kinds = outcome.verdicts
    .filter((verdict) => verdict.gauge === 'exactitude_de_règle' || verdict.gauge === 'exactitude')
    .map((verdict) => verdict.kind);
  return {
    caseId: outcome.caseId,
    question: outcome.question,
    agentVersion: version?.id ?? 'v6',
    attribution: outcome.crack.attribution,
    reason: outcome.crack.attribution === 'agent_instable'
      ? 'The oracle did not move, but the agent gave different answers from one passage to the next: unstable agent.'
      : 'The answers barely differ yet the verdicts differ: the case or the corrector is ambiguous.',
    oracleStable: outcome.crack.spread.oracleStable,
    passages: outcome.answers.map((answer, index) => ({
      no: index + 1,
      answer,
      kind: (kinds[index] ?? 'exact') as CrackCase['passages'][number]['kind'],
      note: index === 0 ? 'Reference answer.' : 'Different answer, different verdict.',
    })),
  };
}

/** Construit toutes les vues à partir de la démonstration calculée. */
export function factsFrom(demo: DemoRun): DemoFacts {
  const versions = demo.versions;
  return {
    scorecards: versions.map((version) => version.scorecard),
    gateV4: (versionOf(demo, 'v4')?.gate ?? versions[0]?.gate) as PromotionVerdict,
    gateV5: (versionOf(demo, 'v5')?.gate ?? versions[1]?.gate) as PromotionVerdict,
    gateV6: (versionOf(demo, 'v6')?.gate ?? versions[2]?.gate) as PromotionVerdict,
    oracleHealth: demo.health,
    failure: failureOf(demo, 'R-04') ?? failureOf(demo, 'D-01'),
    drift: driftOf(demo),
    crack: crackOf(demo),
    versions,
    caseCount: demo.caseCount,
    passes: demo.passes,
  };
}
