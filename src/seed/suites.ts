/**
 * Les quatre suites (§10, §14, §17).
 *
 *   lot d'or     les cas bloquants : le strict minimum qui autorise une mise en
 *                production. Court — une vingtaine de cas — pour tenir dans un
 *                banc de fumée de moins de deux minutes, et revu à la main au
 *                moins une fois par trimestre (§10) ;
 *   banc de fumée  sous-ensemble rapide, exécutable en continu d'intégration ;
 *   batterie     les amorces hostiles, versionnées avec le lot d'or (§14) ;
 *   suite complète  tous les cas × 3 passages, la nuit, par tranches de 900 s.
 */
import type { BancCase, Suite } from '../domain/vocabulary.js';
import { GOLD_SUITE_TARGET, SMOKE_BUDGET_SECONDS } from '../domain/vocabulary.js';

/** Identifiants des quatre suites. */
export const SUITE_IDS = {
  gold: 'suite-gold', smoke: 'suite-smoke', battery: 'suite-battery', full: 'suite-full',
} as const;

/**
 * Le lot d'or, curated À LA MAIN (§10).
 *
 * Le lot d'or n'est pas « tous les cas bloquants » : c'est une sélection
 * courte — une vingtaine de cas — qui couvre les questions que
 * l'organisation ne peut pas se permettre de rater. La curation est
 * explicite et versionnée avec le lot d'or, parce qu'un lot d'or vieillissant
 * devient une contrainte fausse (§10).
 *
 * Composition retenue (20 cas, 20 appels en fumée ≈ 2 min, §17) :
 *   les 7 amorces      — bloquantes par nature (§14) ;
 *   les 5 refus bloquants — un banc qui ne mesure pas le refus récompense
 *                         l'hallucination (§6.3) ;
 *   les 5 règles les plus critiques — dont R-04, l'exemple du §6.2 ;
 *   les 3 valeurs dérivées les plus parlantes — propriétaire, plus ancien
 *                         ticket bloquant, gel actif.
 */
export const GOLD_CASE_IDS: readonly string[] = [
  'A-01', 'A-02', 'A-03', 'A-04', 'A-05', 'A-06', 'A-07',
  'F-01', 'F-02', 'F-03', 'F-05', 'F-06',
  'R-04', 'R-01', 'R-02', 'R-07', 'R-09',
  'D-01', 'D-02', 'D-15',
];

/** Le lot d'or : la sélection curatée, dans l'ordre du corpus. */
export function goldCases(cases: readonly BancCase[]): readonly BancCase[] {
  const wanted = new Set(GOLD_CASE_IDS);
  return cases.filter((item) => wanted.has(item.id) && item.gravity === 'bloquant' && !item.disabledAt);
}

/** Amorces de la batterie hostile (§14). */
export function batteryCases(cases: readonly BancCase[]): readonly BancCase[] {
  return cases.filter((item) => item.amorce?.blocking === true);
}

/** Banc de fumée : le lot d'or tronqué à la cible de taille (§17). */
export function smokeCases(cases: readonly BancCase[], maxCases = GOLD_SUITE_TARGET): readonly BancCase[] {
  return goldCases(cases).slice(0, maxCases);
}

/** Le banc de fumée tient-il dans son budget de deux minutes ? */
export function smokeFitsBudget(caseCount: number, secondsPerCall: number): boolean {
  return caseCount * secondsPerCall <= SMOKE_BUDGET_SECONDS;
}

/** Construit les quatre suites à partir du corpus. */
export function buildSuites(cases: readonly BancCase[], updatedAt: string, version = 1): readonly Suite[] {
  const enabled = cases.filter((item) => !item.disabledAt);
  const gold = goldCases(enabled);
  return [
    {
      id: SUITE_IDS.gold, name: 'Lot d’or', kind: 'gold',
      caseIds: gold.map((item) => item.id), version, updatedAt,
    },
    {
      id: SUITE_IDS.smoke, name: 'Banc de fumée', kind: 'smoke',
      caseIds: smokeCases(enabled).map((item) => item.id), version, updatedAt,
    },
    {
      id: SUITE_IDS.battery, name: 'Batterie d’amorces', kind: 'battery',
      caseIds: batteryCases(enabled).map((item) => item.id), version, updatedAt,
    },
    { id: SUITE_IDS.full, name: 'Suite complète', kind: 'full',
      caseIds: enabled.map((item) => item.id), version, updatedAt },
  ];
}

/** Suite par identifiant ou par genre. */
export function suiteOf(suites: readonly Suite[], idOrKind: string): Suite | undefined {
  return suites.find((suite) => suite.id === idOrKind || suite.kind === idOrKind);
}

/** Le lot d'or respecte-t-il sa cible de taille (§10) ? */
export function goldSizeVerdict(gold: readonly BancCase[]): { ok: boolean; motive: string } {
  if (gold.length === 0) return { ok: false, motive: 'lot d’or vide : aucune promotion ne peut être décidée' };
  if (gold.length > GOLD_SUITE_TARGET + 5) {
    return { ok: false, motive: `lot d’or trop long (${gold.length} cas) : le banc de fumée ne tiendra pas 2 min` };
  }
  return { ok: true, motive: `lot d’or de ${gold.length} cas, dans la cible de ${GOLD_SUITE_TARGET}` };
}
