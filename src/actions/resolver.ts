/**
 * Résolveur UI Kit 2 : les douze écrans (§20).
 *
 * Un écran ne calcule rien : il met en forme ce que `src/mcp/` ou `src/score/`
 * ont calculé. Les définitions sont ici ; le rendu est dans `src/ui/`.
 *
 * La métaphore est celle de la métrologie : un banc, des éprouvettes, des
 * témoins, des calibres. Chaque élément encode une donnée — rien n'est
 * décoratif (§20).
 */
import type { BenchMode, Gauge } from '../domain/vocabulary.js';

/** Les douze écrans du §20. */
export const SCREENS = [
  'bench', 'scorecard', 'failures', 'case', 'run', 'gate',
  'witness', 'oracleHealth', 'jury', 'battery', 'budget', 'curator',
] as const;

/** Un écran du banc. */
export type ScreenId = typeof SCREENS[number];

/** Contexte d'un écran : ce que le resolver reçoit de la plateforme. */
export interface ResolverContext {
  readonly screen: ScreenId;
  readonly agentId?: string;
  readonly version?: string;
  readonly caseId?: string;
  readonly runId?: string;
  readonly mode?: BenchMode;
  readonly gauge?: Gauge;
}

/** Ce qu'un écran rend. */
export interface ScreenData {
  readonly screen: ScreenId;
  readonly title: string;
  readonly empty: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Titre lisible d'un écran. */
export function screenTitle(screen: ScreenId): string {
  const titles: Record<ScreenId, string> = {
    bench: 'Le banc', scorecard: 'Scorecard', failures: 'Explorateur d’échecs',
    case: 'Fiche cas', run: 'Exécution', gate: 'Porte de promotion', witness: 'Le témoin',
    oracleHealth: 'Santé des oracles', jury: 'Jury humain', battery: 'Batterie d’amorces',
    budget: 'Budget', curator: 'Curateur',
  };
  return titles[screen];
}

/** Un écran sans donnée : le vide est affiché comme un vide, pas comme un zéro. */
export function emptyScreen(screen: ScreenId, reason: string): ScreenData {
  return { screen, title: screenTitle(screen), empty: true, payload: { reason } };
}

/** Construit les données d'un écran. */
export function screenData(screen: ScreenId, payload: Readonly<Record<string, unknown>>): ScreenData {
  const isEmpty = Object.keys(payload).length === 0;
  return { screen, title: screenTitle(screen), empty: isEmpty, payload };
}

/** Les gauges affichées sur un écran de scorecard. */
export function scorecardGauges(): readonly Gauge[] {
  return [
    'exactitude', 'fondation', 'citation_vivante', 'exactitude_de_règle',
    'refus_correct', 'complétude', 'stabilité', 'coût',
  ];
}
