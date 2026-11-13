/**
 * Mise en forme des jauges (§8, §25) : c'est ici que se joue l'honnêteté de
 * l'interface — pas de pourcentage sans effectif, pas de couleur seule.
 */
import { describe, it, expect } from 'vitest';
import { gaugeView, failingGauges, scorecardStatus, percent } from '../../src/ui/viewmodel/gauge.js';
import type { ScorecardRow } from '../../src/domain/vocabulary.js';

/** Une ligne de scorecard fabriquée. */
function row(gauge: ScorecardRow['gauge'], value: number | null, n = 10, floor = 0.9): ScorecardRow {
  return {
    agentVersionId: 'v5', suiteId: 'suite-gold', mode: 'blanc', gauge, n, value,
    ciLow: value === null ? null : 0.8, ciHigh: value === null ? null : 1,
    floor, computedAt: '2026-11-12T09:00:00Z',
  };
}

describe('affichage des jauges', () => {
  it('sous l\'effectif minimal, affiche « pas assez de recul » et pas un pourcentage', () => {
    const view = gaugeView(row('exactitude', null, 2));
    expect(view.status).toBe('pas_assez_de_recul');
    expect(view.value).toBeNull();
    expect(view.label).toBe('—');
    expect(view.motif).toContain('pas assez de recul');
  });

  it('sous le plancher, porte le mot ET le motif', () => {
    const view = gaugeView(row('exactitude', 0.5));
    expect(view.status).toBe('sous_plancher');
    expect(view.motif).toContain('plancher');
    expect(view.motif).toContain('10 cas');
  });

  it('au-dessus du plancher, affiche la fourchette', () => {
    const view = gaugeView(row('fondation', 0.95));
    expect(view.status).toBe('ok');
    expect(view.interval).toContain('80 %');
  });

  it('une jauge non calibrée est marquée comme telle', () => {
    const view = gaugeView(row('exactitude', 0.95), false);
    expect(view.status).toBe('non_calibrée');
  });

  it('repère les jauges en rouge', () => {
    const views = failingGauges([row('exactitude', 0.5), row('fondation', 0.95)]);
    expect(views).toHaveLength(1);
    expect(views[0]?.gauge).toBe('exactitude');
  });

  it('détermine le statut global', () => {
    expect(scorecardStatus([row('exactitude', 0.95)])).toBe('vert');
    expect(scorecardStatus([row('exactitude', 0.5)])).toBe('rouge');
    expect(scorecardStatus([row('exactitude', null, 1)])).toBe('insuffisant');
  });

  it('formate un pourcentage', () => {
    expect(percent(0.9)).toBe('90 %');
    expect(percent(null)).toBe('—');
  });
});
