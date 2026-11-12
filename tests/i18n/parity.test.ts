/**
 * Parité fr/en de l'interface (§25).
 *
 * « L'interface en anglais et en français » est une exigence, pas un souhait :
 * une clé absente d'une langue casse l'interface dans cette langue, et rien ne
 * le signalerait. Ce test le rend visible dès la CI.
 */
import { describe, it, expect } from 'vitest';
import { FR } from '../../src/i18n/fr.js';
import { EN } from '../../src/i18n/en.js';
import { missingKeys, resolveLocale, t, hasKey, LOCALES } from '../../src/i18n/index.js';

describe('parité des messages (§25)', () => {
  it('les deux langues ont exactement le même jeu de clés', () => {
    expect(missingKeys('fr')).toEqual([]);
    expect(missingKeys('en')).toEqual([]);
    expect(Object.keys(FR).sort()).toEqual(Object.keys(EN).sort());
  });

  it('couvre les huit jauges, les neuf verdicts et les douze écrans', () => {
    const gauges = ['exactitude', 'fondation', 'citation_vivante', 'exactitude_de_regle',
      'refus_correct', 'completude', 'stabilite', 'cout'];
    for (const gauge of gauges) expect(FR[`gauge.${gauge}`]).toBeTruthy();
    const verdicts = ['exact', 'concordant', 'fonde', 'refus', 'infonde', 'inverifiable', 'faux', 'fissure', 'incident'];
    for (const verdict of verdicts) expect(FR[`verdict.${verdict}`]).toBeTruthy();
    const screens = ['bench', 'scorecard', 'failures', 'case', 'run', 'gate', 'witness',
      'oracle_health', 'jury', 'battery', 'budget', 'curator'];
    for (const screen of screens) expect(FR[`screen.${screen}`]).toBeTruthy();
  });

  it('distingue les quatre raisons d\'oracle mort', () => {
    expect(FR['oracle.dead.source_absente']).not.toBe(FR['oracle.dead.droit_manquant']);
    expect(EN['oracle.dead.source_absente']).not.toBe(EN['oracle.dead.droit_manquant']);
  });

  it('interpole les paramètres et laisse le marqueur visible si le paramètre manque', () => {
    expect(t('fr', 'honesty.n_of_total', { n: 3, total: 40 })).toContain('3');
    expect(t('fr', 'honesty.n_of_total', { n: 3 })).toContain('{total}');
  });

  it('rend la clé elle-même pour une clé inconnue, jamais une chaîne vide', () => {
    expect(t('fr', 'cle.inconnue')).toBe('cle.inconnue');
    expect(hasKey('fr', 'cle.inconnue')).toBe(false);
  });

  it('résout une langue inconnue vers la langue par défaut, sans exception', () => {
    expect(resolveLocale('fr')).toBe('fr');
    expect(resolveLocale('de')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
    expect(LOCALES).toContain('fr');
    expect(LOCALES).toContain('en');
  });

  it('donne à chaque mot de la discipline une définition distincte', () => {
    const words = ['exact', 'concordant', 'fonde', 'infonde', 'inverifiable'];
    const helps = words.map((word) => FR[`verdict.${word}.help`]);
    for (const help of helps) expect(help).toBeTruthy();
    expect(new Set(helps).size).toBe(words.length);
  });
});
