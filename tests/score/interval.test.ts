/**
 * tests/score/interval.test.ts — Vitest.
 *
 * Couvre Wilson, enoughData, measuredGauge (sous/au-dessus du plancher),
 * studentSpread (écart-type échantillonnal) et les planchers de floors.ts.
 *
 * Valeurs de référence vérifiées à la main :
 * - Wilson(5/5, z=1.96) → low ≈ 0.5655 (donc < 1), high = 1.
 * - Wilson(900/1000) → [0.8794 ; 0.9168], largeur ≈ 0.0374.
 * - studentSpread([2,4,4,4,5,5,7,9]) → mean 5, var = 32/7, stdev ≈ 2.13809.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_SAMPLE,
  enoughData,
  wilsonInterval,
  rate,
  measuredGauge,
  studentSpread,
} from '../../src/score/interval.js';
import {
  GAUGES,
  GAUGE_FLOORS,
  STABILITY_FLOOR,
  CALIBRATION_THRESHOLD,
  floorOf,
  floorsFor,
} from '../../src/score/floors.js';

describe('wilsonInterval', () => {
  it('n = 0 → null', () => {
    expect(wilsonInterval(0, 0)).toBeNull();
  });

  it('n négatif → null', () => {
    expect(wilsonInterval(1, -3)).toBeNull();
  });

  it('successes hors bornes → null', () => {
    expect(wilsonInterval(-1, 10)).toBeNull();
    expect(wilsonInterval(11, 10)).toBeNull();
  });

  it('petit effectif (5/5) → intervalle large dont low < 1', () => {
    const ci = wilsonInterval(5, 5);
    expect(ci).not.toBeNull();
    expect(ci!.low).toBeLessThan(1);
    expect(ci!.low).toBeCloseTo(0.5655, 3);
    expect(ci!.high).toBe(1);
    expect(ci!.high - ci!.low).toBeGreaterThan(0.3); // large : peu de recul
  });

  it('grand effectif (900/1000) → intervalle étroit centré sur 0.9', () => {
    const ci = wilsonInterval(900, 1000);
    expect(ci).not.toBeNull();
    expect(ci!.low).toBeCloseTo(0.8794, 3);
    expect(ci!.high).toBeCloseTo(0.9168, 3);
    expect(ci!.high - ci!.low).toBeLessThan(0.05); // étroit
    const milieu = (ci!.low + ci!.high) / 2;
    expect(Math.abs(milieu - 0.9)).toBeLessThan(0.02); // centré sur 0.9
  });

  it("l'intervalle contient toujours le taux observé", () => {
    const cas: ReadonlyArray<readonly [number, number]> = [
      [0, 5],
      [5, 5],
      [1, 7],
      [3, 10],
      [900, 1000],
      [13, 42],
    ];
    for (const [s, n] of cas) {
      const ci = wilsonInterval(s, n);
      const r = rate(s, n);
      expect(ci).not.toBeNull();
      expect(r).not.toBeNull();
      expect(ci!.low).toBeLessThanOrEqual(r!);
      expect(ci!.high).toBeGreaterThanOrEqual(r!);
    }
  });

  it('bornes toujours dans [0, 1]', () => {
    const cas: ReadonlyArray<readonly [number, number]> = [
      [0, 1],
      [1, 1],
      [0, 100],
      [100, 100],
      [2, 9],
    ];
    for (const [s, n] of cas) {
      const ci = wilsonInterval(s, n);
      expect(ci).not.toBeNull();
      expect(ci!.low).toBeGreaterThanOrEqual(0);
      expect(ci!.high).toBeLessThanOrEqual(1);
      expect(ci!.low).toBeLessThanOrEqual(ci!.high);
    }
  });

  it('MIN_SAMPLE vaut 5 (aligné sur src/domain)', () => {
    expect(MIN_SAMPLE).toBe(5);
  });
});

describe('enoughData', () => {
  it('n = 4 → false, n = 5 → true', () => {
    expect(enoughData(4)).toBe(false);
    expect(enoughData(5)).toBe(true);
  });

  it('min personnalisé', () => {
    expect(enoughData(9, 10)).toBe(false);
    expect(enoughData(10, 10)).toBe(true);
  });
});

describe('rate', () => {
  it('n <= 0 → null', () => {
    expect(rate(1, 0)).toBeNull();
  });

  it('taux observé exact', () => {
    expect(rate(3, 4)).toBe(0.75);
  });
});

describe('measuredGauge', () => {
  it("sous l'effectif : null partout, belowFloor false, motive non nul", () => {
    const g = measuredGauge(2, 4, 0.9);
    expect(g.n).toBe(4);
    expect(g.enoughData).toBe(false);
    expect(g.value).toBeNull();
    expect(g.ciLow).toBeNull();
    expect(g.ciHigh).toBeNull();
    expect(g.belowFloor).toBe(false); // on ne peut pas conclure
    expect(g.motive).not.toBeNull();
    expect(g.motive).toBe('pas assez de recul');
  });

  it('effectif suffisant sous le plancher → belowFloor true', () => {
    const g = measuredGauge(6, 10, 0.9); // 0.6 < 0.9
    expect(g.enoughData).toBe(true);
    expect(g.value).toBeCloseTo(0.6, 10);
    expect(g.ciLow).not.toBeNull();
    expect(g.ciHigh).not.toBeNull();
    expect(g.belowFloor).toBe(true);
    expect(g.motive).toBeNull();
  });

  it('au-dessus du plancher → belowFloor false, motive null', () => {
    const g = measuredGauge(10, 10, 0.9); // 1.0 >= 0.9
    expect(g.enoughData).toBe(true);
    expect(g.value).toBe(1);
    expect(g.belowFloor).toBe(false);
    expect(g.motive).toBeNull();
  });

  it('succès hors bornes avec effectif suffisant → ne conclut pas', () => {
    const g = measuredGauge(12, 10, 0.5);
    expect(g.value).toBeNull();
    expect(g.belowFloor).toBe(false);
    expect(g.motive).not.toBeNull();
  });
});

describe('studentSpread', () => {
  it('moins de 2 valeurs → null', () => {
    expect(studentSpread([])).toBeNull();
    expect(studentSpread([7])).toBeNull();
  });

  it('valeurs identiques → écart-type 0', () => {
    const s = studentSpread([3, 3, 3, 3]);
    expect(s).not.toBeNull();
    expect(s!.mean).toBe(3);
    expect(s!.stdev).toBe(0);
  });

  it('valeurs connues : [2,4,4,4,5,5,7,9] → mean 5, stdev ≈ 2.13809 (n-1)', () => {
    const s = studentSpread([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s).not.toBeNull();
    expect(s!.mean).toBe(5);
    // variance échantillonnale = 32/7 ; écart-type = sqrt(32/7)
    expect(s!.stdev).toBeCloseTo(Math.sqrt(32 / 7), 10);
    expect(s!.stdev).toBeCloseTo(2.13809, 4);
  });

  it("deux valeurs : [0, 2] → mean 1, stdev sqrt(2) (dénominateur n-1 = 1)", () => {
    const s = studentSpread([0, 2]);
    expect(s).not.toBeNull();
    expect(s!.mean).toBe(1);
    expect(s!.stdev).toBeCloseTo(Math.SQRT2, 10);
  });
});

describe('floors', () => {
  it('GAUGE_FLOORS a exactement huit entrées', () => {
    expect(Object.keys(GAUGE_FLOORS)).toHaveLength(8);
    expect(GAUGES).toHaveLength(8);
  });

  it('floorOf renvoie un nombre pour chacune des huit jauges', () => {
    for (const g of GAUGES) {
      const f = floorOf(g);
      expect(typeof f).toBe('number');
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('floorsFor ne renvoie que les jauges demandées, mêmes valeurs', () => {
    const sous = floorsFor(['exactitude', 'refus_correct']);
    expect(Object.keys(sous)).toHaveLength(2);
    expect(sous.exactitude).toBe(GAUGE_FLOORS.exactitude);
    expect(sous.refus_correct).toBe(GAUGE_FLOORS.refus_correct);
  });

  it('refus_correct est le plancher le plus sévère (0.95)', () => {
    expect(GAUGE_FLOORS.refus_correct).toBe(0.95);
    for (const g of GAUGES) {
      if (g === 'coût') continue; // plafond, pas plancher (asymétrie documentée)
      expect(GAUGE_FLOORS[g]).toBeLessThanOrEqual(0.95);
    }
  });

  it('seuils nommés : STABILITY_FLOOR et CALIBRATION_THRESHOLD = 0.65', () => {
    expect(typeof STABILITY_FLOOR).toBe('number');
    expect(STABILITY_FLOOR).toBeGreaterThan(GAUGE_FLOORS.stabilité);
    expect(CALIBRATION_THRESHOLD).toBe(0.65);
  });
});
