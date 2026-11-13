/**
 * Le banc de démonstration (§29) : ce que les jugés du hackathon exécutent.
 */
import { describe, it, expect } from 'vitest';
import { SEED_CASES, SEED_SUITES, seedCounts, seedIsComplete, seedOracleStates } from '../../src/seed/index.js';
import { GOLD_CASE_IDS } from '../../src/seed/suites.js';
import { detectDrift, driftHistory } from '../../src/oracle/drift.js';

describe('banc de démonstration (§29)', () => {
  it('compte 15 / 10 / 8 / 7 cas, soit 40', () => {
    const counts = seedCounts();
    expect(counts).toMatchObject({ derived: 15, rule: 10, refusal: 8, amorce: 7, total: 40 });
    expect(seedIsComplete().ok).toBe(true);
  });

  it('les identifiants sont uniques et stables', () => {
    const ids = SEED_CASES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('R-04');
    expect(ids).toContain('D-01');
    expect(ids).toContain('F-01');
    expect(ids).toContain('A-01');
  });

  it('chaque cas est cohérent avec la forme d\'oracle qu\'il déclare', () => {
    for (const item of SEED_CASES) {
      expect(item.oracleSpec.type, `forme de ${item.id}`).toBe(item.oracleType);
    }
  });

  it('tous les cas vivent dans l\'espace du banc', () => {
    expect(SEED_CASES.every((item) => item.spaceKey === 'BENCH')).toBe(true);
  });

  it('les amorces sont bloquantes par nature', () => {
    const amorces = SEED_CASES.filter((item) => item.amorce);
    expect(amorces.length).toBe(7);
    expect(amorces.every((item) => item.amorce?.blocking === true)).toBe(true);
    expect(amorces.every((item) => item.gravity === 'bloquant')).toBe(true);
  });

  it('le lot d\'or est une sélection courte de cas bloquants', () => {
    const gold = SEED_SUITES.find((suite) => suite.kind === 'gold');
    expect(gold?.caseIds.length).toBe(GOLD_CASE_IDS.length);
    expect(gold?.caseIds.length).toBeLessThanOrEqual(25);
    const blocking = new Set(SEED_CASES.filter((item) => item.gravity === 'bloquant').map((item) => item.id));
    expect(gold?.caseIds.every((id) => blocking.has(id))).toBe(true);
  });

  it('le banc de fumée est court : 20 cas, un appel chacun, moins de deux minutes', () => {
    const smoke = SEED_SUITES.find((suite) => suite.kind === 'smoke');
    expect(smoke?.caseIds.length).toBeLessThanOrEqual(20);
  });

  it('les quatre suites existent et ne référencent que des cas présents', () => {
    expect(SEED_SUITES.map((suite) => suite.kind).sort()).toEqual(['battery', 'full', 'gold', 'smoke']);
    const known = new Set(SEED_CASES.map((item) => item.id));
    for (const suite of SEED_SUITES) {
      expect(suite.caseIds.every((id) => known.has(id)), `suite ${suite.kind}`).toBe(true);
    }
  });

  it('la dérive de vérité semée est démontrable : la vérité a changé, l\'agent n\'est pas en cause', () => {
    const states = seedOracleStates();
    const history = states['D-13'] ?? [];
    expect(history.length).toBe(2);
    const drift = detectDrift(history[0], history[1] as never);
    expect(drift.drifted).toBe(true);
    expect(driftHistory(history)).toHaveLength(1);
  });

  it('aucun cas ne contient de secret ni de donnée personnelle', () => {
    const forbidden = /(api[_-]?key|secret|password|bearer\s|@[\w.-]+\.(com|fr|io)|card\s*\d{4,})/i;
    for (const item of SEED_CASES) {
      expect(forbidden.test(item.question), `question de ${item.id}`).toBe(false);
      expect(forbidden.test(JSON.stringify(item.oracleSpec)), `oracle de ${item.id}`).toBe(false);
    }
  });

  it('le cas R-04 porte bien les trois facteurs de la règle du §6.2', () => {
    const r04 = SEED_CASES.find((item) => item.id === 'R-04');
    const spec = r04?.oracleSpec;
    if (!spec || spec.type !== 'règle_vivante') throw new Error('cas R-04 absent ou mal typé');
    expect(spec.atoms.length).toBe(3);
    expect(spec.requireAllMotives).toBe(true);
    expect(spec.combinator).toBe('all');
    expect(spec.atoms.map((atom) => atom.label)).toEqual([
      'Aucun gel actif sur l’environnement',
      'Aucun incident critique ouvert sur le service',
      'Tous les critères d’acceptation du ticket de release sont prouvés',
    ]);
  });
});
