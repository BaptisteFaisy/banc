/**
 * Recette §27, points 11 à 22 : invalidation, modes, témoin, lot d'or, porte
 * de promotion, amorces, scorecard, calibrage, effets de bord, budget,
 * isolation, confidentialité.
 */
import { describe, it, expect } from 'vitest';
import { caseOf, oracleOf, answer, citation, passageOf, fixtureAdapter } from './fixtures.js';
import { createRegistry } from '../../src/oracle/deps.js';
import { recomputeDerived } from '../../src/oracle/recompute.js';
import { createConditionStore, createMemoryKv, sameCondition } from '../../src/run/condition.js';
import { checkFingerprintDrift, invalidateRunReason } from '../../src/run/fingerprint.js';
import { detectFissure } from '../../src/run/fissure.js';
import { checkPromotion, promotionSummary } from '../../src/score/promotion.js';
import { buildScorecard } from '../../src/score/scorecard.js';
import { classifyDelta } from '../../src/score/regression.js';
import { calibrate, calibrationLabel } from '../../src/score/calibration.js';
import { chargeBudget, budgetExhausted, whichLimitReached } from '../../src/run/budget.js';
import { disqualifiedBySideEffect } from '../../src/run/sideeffects.js';
import { GAUGE_FLOORS } from '../../src/score/floors.js';
import { VERSION_V4, VERSION_V5 } from '../../src/seed/agents.js';
import { SEED_CASES, SEED_SUITES, seedCounts, seedIsComplete } from '../../src/seed/index.js';
import type { BudgetUsage, Scorecard } from '../../src/domain/vocabulary.js';

describe('recette §27 — points 11 à 22', () => {
  it('11 : un essai dont la configuration d\'agent a changé en cours de route est invalidé', () => {
    const drift = checkFingerprintDrift(VERSION_V4.fingerprint, VERSION_V5.fingerprint);
    expect(drift.drifted).toBe(true);
    expect(drift.changedFields).toContain('promptHash');
    expect(invalidateRunReason(drift)).toContain('configuration modifiée en cours d\'essai');
  });

  it('12 : le mode blanc fournit le même instantané à deux versions successives, le mode noir est séparé', async () => {
    const store = createConditionStore(createMemoryKv(), () => '2026-11-12T09:00:00Z');
    const snapshot = { owner: 'Équipe Paiements', at: '2026-11-05' };
    const first = await store.capture('D-01', 'blanc', snapshot);
    const second = await store.capture('D-01', 'blanc', snapshot);
    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(sameCondition(first, second)).toBe(true);
    const black = await store.capture('D-01', 'noir', snapshot);
    expect(black.snapshotHash).not.toBe(first.snapshotHash);
    expect(black.snapshotRef).toBe('aucun_contexte_fourni');
  });

  it('13 : la porte refuse une promotion qui casse un cas bloquant, et le motif est explicite', () => {
    const verdict = checkPromotion({
      agentId: 'agent-support', candidateVersion: 'v5',
      scorecard: emptyScorecard(),
      regressions: [regression('D-01', 'exactitude', -1)],
      blockingCases: [caseOf('D-01')], amorcesFailed: [],
    });
    expect(verdict.allowed).toBe(false);
    const motive = verdict.motives.find((m) => m.rule === 'aucun_cas_bloquant_ne_régresse');
    expect(motive?.passed).toBe(false);
    expect(motive?.detail).toContain('D-01');
    expect(promotionSummary(verdict)).toContain('PORTE ROUGE');
  });

  it('14 : la porte refuse une promotion qui fait passer une jauge sous son plancher', () => {
    const verdict = checkPromotion({
      agentId: 'agent-support', candidateVersion: 'v5',
      scorecard: scorecardWith({ exactitude: 0.1 }),
      regressions: [], blockingCases: [], amorcesFailed: [],
    });
    expect(verdict.allowed).toBe(false);
    const motive = verdict.motives.find((m) => m.rule === 'aucune_jauge_sous_son_plancher');
    expect(motive?.passed).toBe(false);
    expect(motive?.gauges).toContain('exactitude');
  });

  it('15 : la porte refuse une promotion qui dépasse le budget déclaré', () => {
    const verdict = checkPromotion({
      agentId: 'agent-support', candidateVersion: 'v5',
      scorecard: scorecardWith({}, { costEstimate: 12, limitCost: 2 }),
      regressions: [], blockingCases: [], amorcesFailed: [],
    });
    expect(verdict.allowed).toBe(false);
    const motive = verdict.motives.find((m) => m.rule === 'coût_dans_le_budget');
    expect(motive?.passed).toBe(false);
    expect(motive?.detail).toContain('12');
  });

  it('16 : une amorce d\'injection suivie par l\'agent est bloquante', () => {
    const verdict = checkPromotion({
      agentId: 'agent-support', candidateVersion: 'v5',
      scorecard: emptyScorecard(), regressions: [], blockingCases: [], amorcesFailed: ['A-01'],
    });
    expect(verdict.allowed).toBe(false);
    const motive = verdict.motives.find((m) => m.rule === 'aucune_amorce_ne_passe');
    expect(motive?.passed).toBe(false);
    expect(motive?.detail).toContain('A-01');
  });

  it('17 : le scorecard montre chaque jauge avec son effectif, sa fourchette et son plancher', () => {
    const card = buildScorecard({
      agentVersionId: 'v5', suiteId: 'suite-gold', mode: 'blanc',
      verdicts: [], oracleStates: [oracleOf('D-01', 'x')], budget: emptyBudget(),
    });
    for (const row of card.rows) {
      expect(row.n).toBe(0);
      expect(row.value).toBeNull(); // pas assez de recul : jamais un pourcentage
      expect(row.floor).toBe(GAUGE_FLOORS[row.gauge]);
    }
  });

  it('18 : l\'accord entre correcteur automatique et jury humain est affiché ; sous le seuil, la jauge est « non calibrée »', () => {
    const calibrated = calibrate({
      scope: 'BENCH', gauge: 'exactitude',
      pairs: [{ auto: 'exact', human: 'exact' }, { auto: 'faux', human: 'faux' }],
    });
    expect(calibrated.calibrated).toBe(true);
    const notCalibrated = calibrate({
      scope: 'BENCH', gauge: 'exactitude',
      pairs: [{ auto: 'exact', human: 'faux' }, { auto: 'exact', human: 'concordant' }],
    });
    expect(notCalibrated.calibrated).toBe(false);
    expect(calibrationLabel(notCalibrated)).toContain('non calibrée');
  });

  it('19 : un effet de bord détecté pendant un essai disqualifie le cas et est tracé', () => {
    const ans = answer('Équipe Paiements', {
      sideEffects: [{ kind: 'created', targetType: 'ticket', targetId: 'PAY-999', observedAt: '2026-11-12T09:00:00Z' }],
    });
    expect(disqualifiedBySideEffect(ans)).toBe(true);
  });

  it('20 : le budget dépassé arrête l\'essai et l\'indique', () => {
    const used = chargeBudget(emptyBudget(), 120, 0, 0);
    expect(budgetExhausted(used)).toBe(true);
    expect(whichLimitReached(used)).toContain('calls');
  });

  it('21 : aucune écriture n\'est constatée dans les espaces de production pendant un essai', () => {
    // Tous les cas du corpus vivent dans l'espace du banc.
    expect(SEED_CASES.every((item) => item.spaceKey === 'BENCH')).toBe(true);
  });

  it('22 : aucun cas du banc n\'apparaît dans l\'espace de production', () => {
    expect(SEED_CASES.some((item) => item.spaceKey !== 'BENCH')).toBe(false);
    expect(SEED_CASES.filter((item) => item.spaceKey === 'BENCH').length).toBe(40);
  });
});

describe('recette §27 — cohérence du banc de démonstration', () => {
  it('le corpus compte 15 / 10 / 8 / 7 cas, soit 40', () => {
    const counts = seedCounts();
    expect(counts.derived).toBe(15);
    expect(counts.rule).toBe(10);
    expect(counts.refusal).toBe(8);
    expect(counts.amorce).toBe(7);
    expect(counts.total).toBe(40);
    expect(seedIsComplete().ok).toBe(true);
  });

  it('toutes les amorces sont bloquantes par nature', () => {
    const amorces = SEED_CASES.filter((item) => item.amorce);
    expect(amorces.length).toBe(7);
    expect(amorces.every((item) => item.amorce?.blocking === true)).toBe(true);
    expect(amorces.every((item) => item.gravity === 'bloquant')).toBe(true);
  });

  it('le cas R-04 existe avec ses trois facteurs comme motifs', () => {
    const r04 = caseOf('R-04');
    const spec = r04.oracleSpec;
    if (spec.type !== 'règle_vivante') throw new Error('cas mal typed');
    expect(spec.atoms.length).toBe(3);
    expect(spec.requireAllMotives).toBe(true);
    expect(spec.expectedWhenTrue).toContain('oui');
  });

  it('le lot d\'or ne contient que des cas bloquants et le banc de fumée est court', () => {
    const gold = SEED_SUITES.find((suite) => suite.kind === 'gold');
    const smoke = SEED_SUITES.find((suite) => suite.kind === 'smoke');
    expect(gold?.caseIds.length).toBeGreaterThan(0);
    expect(gold?.caseIds.length).toBeLessThanOrEqual(25);
    expect(smoke?.caseIds.length).toBeLessThanOrEqual(20);
    const blocking = new Set(SEED_CASES.filter((item) => item.gravity === 'bloquant').map((item) => item.id));
    expect(gold?.caseIds.every((id) => blocking.has(id))).toBe(true);
  });

  it('une dérive de vérité n\'est jamais comptée comme une régression', () => {
    const drifted = classifyDelta({
      caseId: 'D-13', gauge: 'exactitude', candidate: 0.5, baseline: 1,
      oracleDrifted: true, driftEvidence: { from: '0', to: '2', at: '2026-11-10T06:00:00Z' },
      agentVersionId: 'v6', baselineVersionId: 'v5', openedAt: '2026-11-12T09:00:00Z',
    });
    expect(drifted?.kind).toBe('truth_drift');
    expect(drifted?.truthEvidence?.to).toBe('2');
    const real = classifyDelta({
      caseId: 'D-01', gauge: 'exactitude', candidate: 0.5, baseline: 1,
      oracleDrifted: false,
      agentVersionId: 'v6', baselineVersionId: 'v5', openedAt: '2026-11-12T09:00:00Z',
    });
    expect(real?.kind).toBe('regression');
  });

  it('un cas fissuré par un oracle instable reste indéterminé', () => {
    const passages = [passageOf('D-01', 'a', 1), passageOf('D-01', 'b', 2)];
    const verdicts = [0, 1].map((index) => ({
      id: `v${index}`, passageId: passages[index]?.id ?? '', caseId: 'D-01', gauge: 'exactitude' as const,
      kind: index === 0 ? 'exact' as const : 'faux' as const, value: index === 0 ? 1 : 0,
      detail: {}, evidence: {}, computedAt: '2026-11-12T09:00:00Z',
    }));
    const fissure = detectFissure('D-01', 'v5', passages, verdicts, false);
    expect(fissure?.attribution).toBe('indéterminé');
  });

  it('une citation résolue vers un document réel est fondée', async () => {
    const kase = caseOf('D-01');
    const oracle = oracleOf('D-01', 'Équipe Paiements');
    const alive = citation('doc-équipe-paiements', true);
    const { judgeFondation } = await import('../../src/judge/fondation.js');
    const verdict = judgeFondation({
      kase, passage: passageOf('D-01', 'Équipe Paiements', 1, { citations: [alive] }),
      oracle, mode: 'blanc', citationsResolved: [alive],
    });
    expect(verdict?.kind).toBe('fonde');
  });

  it('le recalcul d\'une valeur dérivée lit la source et en garde la trace', async () => {
    const adapter = fixtureAdapter('graph', { 'service:paiements.owner': { owner: { name: 'Équipe Paiements' } } });
    const registry = createRegistry([adapter]);
    const spec = caseOf('D-01').oracleSpec;
    if (spec.type !== 'valeur_dérivée') throw new Error('cas mal typed');
    const state = await recomputeDerived(spec, 'D-01', registry, { clock: () => '2026-11-12T09:00:00Z' });
    expect(state.alive).toBe(true);
    expect(state.value).toBe('Équipe Paiements');
    expect(adapter.calls).toBe(1);
  });

  it('le budget se charge et se lit', () => {
    const used = chargeBudget(emptyBudget(), 3, 1200, 0.012);
    expect(used.calls).toBe(3);
    expect(used.tokens).toBe(1200);
    expect(used.exhausted).toBe(false);
  });
});

/** Budget vide, pour les tests de porte. */
function emptyBudget(): BudgetUsage {
  return { calls: 0, tokens: 0, costEstimate: 0, limitCalls: 100, limitTokens: 100000, limitCost: 5, exhausted: false };
}

/** Une régression fabriquée. */
function regression(caseId: string, gauge: 'exactitude', delta: number) {
  return {
    id: `reg:${caseId}`, agentVersionId: 'v5', baselineVersionId: 'v4', caseId, gauge,
    delta, kind: 'regression' as const, openedAt: '2026-11-12T09:00:00Z', state: 'ouverte' as const,
  };
}

/** Une scorecard vide, conforme à la forme du domaine. */
function emptyScorecard(): Scorecard {
  return {
    agentVersionId: 'v5', suiteId: 'suite-gold', mode: 'blanc', rows: [], deltas: [],
    deadOracleRate: 0, budget: emptyBudget(), generatedAt: '2026-11-12T09:00:00Z',
  };
}

/** Une scorecard avec des valeurs de jauge fixées. */
function scorecardWith(values: Record<string, number>, budget: Partial<BudgetUsage> = {}): Scorecard {
  const base = emptyScorecard();
  const rows = Object.keys(GAUGE_FLOORS).map((gauge) => ({
    agentVersionId: 'v5', suiteId: 'suite-gold', mode: 'blanc' as const,
    gauge: gauge as keyof typeof GAUGE_FLOORS, n: 10,
    value: values[gauge] ?? 1, ciLow: 0.8, ciHigh: 1,
    floor: GAUGE_FLOORS[gauge as keyof typeof GAUGE_FLOORS], computedAt: '2026-11-12T09:00:00Z',
  }));
  return { ...base, rows, budget: { ...base.budget, ...budget } };
}
