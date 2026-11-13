/**
 * La démonstration du banc, calculée par le banc (§29).
 *
 * Ce test verrouille le scénario semé avec des DONNÉES CALCULÉES : c'est la
 * garantie que ce que le site affiche est le produit, et que le scénario ne
 * se dérègle pas en silence quand le moteur change.
 */
import { describe, it, expect } from 'vitest';
import { runDemo } from '../../src/demo/run.js';
import { gaugeOfCase } from '../../src/demo/run.js';
import { factsFrom } from '../../site/src/demo-facts.js';
import { SEED_CASES } from '../../src/seed/index.js';

describe('démonstration calculée (§29)', () => {
  it('le témoin v4 passe la porte', async () => {
    const demo = await runDemo();
    const v4 = demo.versions.find((version) => version.id === 'v4');
    expect(v4?.isWitness).toBe(true);
    expect(v4?.gate.allowed).toBe(true);
  }, 20_000);

  it('v5 casse deux cas bloquants et perd la fondation', async () => {
    const demo = await runDemo();
    const v5 = demo.versions.find((version) => version.id === 'v5');
    expect(v5?.gate.allowed).toBe(false);
    const fondation = v5?.scorecard.rows.find((row) => row.gauge === 'fondation');
    expect(fondation?.value).toBe(0);
    const baselines = v5?.regressions.some((regression) => regression.caseId === 'D-01');
    expect(baselines).toBe(true);
  }, 20_000);

  it('v6 répare la fondation mais casse la stabilité', async () => {
    const demo = await runDemo();
    const v6 = demo.versions.find((version) => version.id === 'v6');
    expect(v6?.gate.allowed).toBe(false);
    const fondation = v6?.scorecard.rows.find((row) => row.gauge === 'fondation');
    expect(fondation?.value ?? 0).toBeGreaterThan(0);
    const stability = v6?.scorecard.rows.find((row) => row.gauge === 'stabilité');
    expect(stability?.value ?? 1).toBeLessThan(1);
  }, 20_000);

  it('la dérive de vérité du cas D-13 est prouvée, et non comptée comme une régression', async () => {
    const demo = await runDemo();
    const history = demo.histories['D-13'];
    expect(history?.length).toBe(2);
    expect(String(history?.[0]?.value ?? '')).not.toBe(String(history?.[1]?.value ?? ''));
    expect(demo.health.driftedRecently.length).toBeGreaterThan(0);
  }, 20_000);

  it('une fissure est attribuée à l\'agent instable, pas au cas', async () => {
    const demo = await runDemo();
    const facts = factsFrom(demo);
    expect(facts.crack?.attribution).toBe('agent_instable');
  }, 20_000);

  it('chaque forme de cas est mesurée par la jauge qui lui correspond', () => {
    const derive = SEED_CASES.find((item) => item.id === 'D-01');
    const regle = SEED_CASES.find((item) => item.id === 'R-04');
    const refus = SEED_CASES.find((item) => item.id === 'F-01');
    expect(gaugeOfCase(derive as never)).toBe('exactitude');
    expect(gaugeOfCase(regle as never)).toBe('exactitude_de_règle');
    expect(gaugeOfCase(refus as never)).toBe('refus_correct');
  });

  it('aucun oracle n\'est mort sur le corpus complet', async () => {
    const demo = await runDemo();
    expect(demo.health.dead).toBe(0);
    expect(demo.health.total).toBe(40);
  }, 20_000);
});
