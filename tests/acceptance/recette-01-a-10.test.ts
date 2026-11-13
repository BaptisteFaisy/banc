/**
 * Recette §27, points 1 à 10 : la vérité recalculée, la dérive, la règle, le
 * refus, les citations, les fissures, la stabilité, les oracles morts.
 *
 * Chaque test porte le numéro du point de recette : il doit être
 * rejouable par un juge, et son nom doit dire ce qu'il vérifie.
 */
import { describe, it, expect } from 'vitest';
import { caseOf, oracleOf, answer, citation, passageOf, fixtureAdapter, deniedAdapter } from './fixtures.js';
import { createRegistry } from '../../src/oracle/deps.js';
import { recomputeDerived } from '../../src/oracle/recompute.js';
import { evaluateRule } from '../../src/oracle/rule.js';
import { classifyRefusal } from '../../src/oracle/refusal.js';
import { detectDrift } from '../../src/oracle/drift.js';
import { oracleHealth } from '../../src/oracle/health.js';
import { judgeExactitude } from '../../src/judge/exactitude.js';
import { judgeFondation } from '../../src/judge/fondation.js';
import { judgeCitationVivante } from '../../src/judge/citation.js';
import { judgeRefus } from '../../src/judge/refusal.js';
import { detectFissure, stabilityRate } from '../../src/run/fissure.js';
import { judgePassage } from '../../src/judge/index.js';

describe('recette §27 — points 1 à 10', () => {
  it('01 : un cas « valeur dérivée » recalcule son oracle et l’affiche avec sa source et sa date', async () => {
    const adapter = fixtureAdapter('graph', { 'service:paiements.owner': { owner: { name: 'Équipe Paiements' } } });
    const registry = createRegistry([adapter]);
    const spec = caseOf('D-01').oracleSpec;
    if (spec.type !== 'valeur_dérivée') throw new Error('cas mal typed');
    const state = await recomputeDerived(spec, 'D-01', registry, { clock: () => '2026-11-12T09:00:00Z' });
    expect(state.alive).toBe(true);
    expect(state.value).toBe('Équipe Paiements');
    expect(state.sourceRefs.length).toBeGreaterThan(0);
    expect(state.computedAt).toBe('2026-11-12T09:00:00Z');
  });

  it('02 : une dérive de vérité est signalée, pas une régression', () => {
    const before = oracleOf('D-13', 0);
    const after = oracleOf('D-13', 2);
    const drift = detectDrift(before, after);
    expect(drift.drifted).toBe(true);
    expect(drift.from).toBe('0');
    expect(drift.to).toBe('2');
    // La vérité n'ayant pas bougé, il n'y a PAS de dérive.
    expect(detectDrift(before, oracleOf('D-13', 0)).drifted).toBe(false);
  });

  it('03 : un cas à règle produit le verdict du prédicat et compare verdict et motifs', async () => {
    const spec = caseOf('R-04').oracleSpec;
    if (spec.type !== 'règle_vivante') throw new Error('cas mal typed');
    const registry = createRegistry([fixtureAdapter('jira', {
      'jql:active-freeze:production': { active: false },
      'jql:REL-2026-11.ac-all-proven': { proven: true },
    }), fixtureAdapter('jsm', { 'jsm:critical:open:paiements': { count: 0 } })]);
    const evaluation = await evaluateRule(spec, registry);
    expect(evaluation.alive).toBe(true);
    expect(evaluation.outcome?.satisfied).toBe(true);
    expect(evaluation.outcome?.trueAtoms.length).toBe(3);
    expect(evaluation.outcome?.expectedAnswer).toBe('oui, livrable');
  });

  it('04 : un cas à refus n\'est réussi que si l\'agent refuse ET nomme ce qui manque', () => {
    const spec = caseOf('F-01').oracleSpec;
    if (spec.type !== 'refus_attendu') throw new Error('cas mal typed');
    const good = classifyRefusal(spec, answer('Je ne peux pas répondre : le plan commercial et les objectifs de vente ne sont pas dans les systèmes.'));
    expect(good.refused).toBe(true);
    expect(good.namedMissing.length).toBeGreaterThan(0);
    expect(good.score).toBe(1);
    const bad = classifyRefusal(spec, answer('Je ne peux pas répondre.'));
    expect(bad.refused).toBe(true);
    expect(bad.reasonCorrect).toBe(false);
    expect(bad.score).toBeLessThan(good.score);
  });

  it('05 : un agent qui répond à un cas à refus est pénalisé plus lourdement qu\'un agent qui répond mal', () => {
    const spec = caseOf('F-01').oracleSpec;
    if (spec.type !== 'refus_attendu') throw new Error('cas mal typed');
    const answering = classifyRefusal(spec, answer('Le plan commercial prévoit une croissance de 12 %.'));
    const wrongRefusal = classifyRefusal(spec, answer('Je ne peux pas répondre.'));
    expect(answering.score).toBeLessThan(0);
    expect(answering.score).toBeLessThan(wrongRefusal.score);
  });

  it('06 : une citation qui pointe un document inexistant produit un verdict « infondé »', async () => {
    const kase = caseOf('D-01');
    const oracle = oracleOf('D-01', 'Équipe Paiements');
    const verdict = judgeFondation({
      kase, passage: passageOf('D-01', 'Équipe Paiements', 1, { citations: [citation('doc-inexistant', false)] }),
      oracle, mode: 'blanc', citationsResolved: [citation('doc-inexistant', false)],
    });
    expect(verdict?.kind).toBe('infonde');
  });

  it('07 : une citation vers un document qui ne dit pas ça produit « citation non vivante »', async () => {
    const kase = caseOf('D-01');
    const oracle = oracleOf('D-01', 'Équipe Paiements');
    const alive = citation('doc-existant', true);
    const verdict = await judgeCitationVivante({
      kase, passage: passageOf('D-01', 'Autre chose', 1, { citations: [alive] }),
      oracle, mode: 'blanc', citationsResolved: [alive],
    });
    expect(verdict?.kind).toBe('faux');
    expect(verdict?.detail.reason).toBe('citation_non_vivante');
  });

  it('08 : un cas posé 3 fois avec 3 verdicts différents est marqué fissuré', () => {
    const passages = [
      passageOf('D-01', 'Équipe Paiements', 1),
      passageOf('D-01', 'Équipe Comptable', 2),
      passageOf('D-01', 'Équipeiscale', 3),
    ];
    const verdicts = [
      { kind: 'exact' as const }, { kind: 'faux' as const }, { kind: 'concordant' as const },
    ].map((v, index) => ({
      id: `v${index}`, passageId: passages[index]?.id ?? '', caseId: 'D-01', gauge: 'exactitude' as const,
      kind: v.kind, value: v.kind === 'exact' ? 1 : 0, detail: {}, evidence: {}, computedAt: '2026-11-12T09:00:00Z',
    }));
    const fissure = detectFissure('D-01', 'v5', passages, verdicts, true);
    expect(fissure).not.toBeNull();
    expect(fissure?.attribution).toBe('agent_instable');
  });

  it('09 : la stabilité d\'une version est affichée en pourcentage de cas non fissurés, avec l\'effectif', () => {
    const withoutCracks = stabilityRate([], 10);
    expect(withoutCracks.rate).toBe(1);
    expect(withoutCracks.n).toBe(10);
    const tooFew = stabilityRate([], 3);
    expect(tooFew.rate).toBeNull();
  });

  it('10 : un cas dont la source est absente est marqué « oracle mort » et n\'entre pas dans le score', async () => {
    const adapter = deniedAdapter('graph');
    const registry = createRegistry([adapter]);
    const spec = caseOf('D-01').oracleSpec;
    if (spec.type !== 'valeur_dérivée') throw new Error('cas mal typed');
    const state = await recomputeDerived(spec, 'D-01', registry);
    expect(state.alive).toBe(false);
    expect(state.deadReason).toBe('droit_manquant');
    expect(state.value).toBeNull();
    const health = oracleHealth([state], [caseOf('D-01')], 'BENCH');
    expect(health.deadRate).toBe(1);
  });

  it('bonus : un oracle mort ne produit jamais un verdict d\'échec', async () => {
    const kase = caseOf('D-01');
    const dead = oracleOf('D-01', null, false);
    const verdicts = await judgePassage({
      kase, passage: passageOf('D-01', 'n’importe quoi'), oracle: dead,
      mode: 'blanc', citationsResolved: [],
    });
    expect(verdicts.length).toBeGreaterThan(0);
    for (const verdict of verdicts) {
      if (verdict.gauge === 'exactitude') expect(verdict.kind).toBe('invérifiable');
    }
  });

  it('bonus : un agent exact sans citer a exactitude 1 et fondation 0', () => {
    const kase = caseOf('D-01');
    const oracle = oracleOf('D-01', 'Équipe Paiements');
    const passage = passageOf('D-01', 'Équipe Paiements');
    const exact = judgeExactitude({ kase, passage, oracle, mode: 'blanc', citationsResolved: [] });
    const founded = judgeFondation({ kase, passage, oracle, mode: 'blanc', citationsResolved: [] });
    expect(exact?.value).toBe(1);
    expect(founded?.value).toBe(0);
  });

  it('bonus : le refus est une jauge de premier rang', () => {
    const kase = caseOf('F-01');
    const spec = kase.oracleSpec;
    if (spec.type !== 'refus_attendu') throw new Error('cas mal typed');
    const verdict = judgeRefus({
      kase, passage: passageOf('F-01', 'Je ne peux pas répondre : le plan commercial est absent.'),
      oracle: oracleOf('F-01', null), mode: 'blanc', citationsResolved: [],
    });
    expect(verdict?.gauge).toBe('refus_correct');
  });
});
