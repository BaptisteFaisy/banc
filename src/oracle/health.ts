/**
 * Santé des oracles (§6.4, §20 écran 8, §28 BE-28).
 *
 * Un banc dont un tiers des oracles est mort ne vaut rien — le produit le dit
 * en face. Cet écran distingue aussi « pas de droit » de « pas de données » :
 * la plateforme vide un résultat sans erreur quand un droit manque (§21), et
 * sans cette distinction un administrateur cherche une panne de données là où
 * il manque une autorisation.
 */
import type {
  BancCase,
  DeadOracleReason,
  OracleHealth,
  OracleState,
  OracleType,
} from '../domain/vocabulary.js';
import { driftedSince } from './drift.js';

/** Les quatre raisons de mort, dans l'ordre d'affichage. */
const DEAD_REASONS: readonly DeadOracleReason[] = [
  'source_absente',
  'droit_manquant',
  'système_non_branché',
  'règle_non_expressible',
];

/** Compte des morts par raison, toutes les raisons présentes (0 inclus). */
function countDeadReasons(states: readonly OracleState[]): Record<DeadOracleReason, number> {
  const counts = {
    'source_absente': 0,
    'droit_manquant': 0,
    'système_non_branché': 0,
    'règle_non_expressible': 0,
  } as Record<DeadOracleReason, number>;
  for (const state of states) {
    if (state.alive) continue;
    const reason = state.deadReason ?? 'source_absente';
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return counts;
}

/** Couverture du corpus par forme d'oracle : sait-on tester les trois ? */
function coverageOf(cases: readonly BancCase[]): Record<OracleType, number> {
  const coverage = {
    'valeur_dérivée': 0,
    'règle_vivante': 0,
    'refus_attendu': 0,
  } as Record<OracleType, number>;
  for (const item of cases) coverage[item.oracleType] += 1;
  return coverage;
}

/** Taux d'oracles morts, dans [0, 1] ; 0 quand il n'y a aucun cas. */
export function deadRate(states: readonly OracleState[]): number {
  if (states.length === 0) return 0;
  const dead = states.filter((state) => !state.alive).length;
  return dead / states.length;
}

/** Le banc est-il fiable ? Au-delà d'un tiers d'oracles morts, il ne vaut rien. */
export function deadRateVerdict(rate: number): 'sain' | 'dégradé' | 'inexploitable' {
  if (rate <= 0.1) return 'sain';
  return rate <= 1 / 3 ? 'dégradé' : 'inexploitable';
}

/**
 * Bilan de santé du référentiel.
 *
 * `histories` porte l'historique de vérité par cas : c'est ce qui permet de
 * lister les dérives récentes, et donc de prévenir le responsable de données
 * que la vérité a changé — pour ne pas accuser l'agent à tort (§3).
 */
export function oracleHealth(
  states: readonly OracleState[],
  cases: readonly BancCase[],
  scope: string,
  histories: Readonly<Record<string, readonly OracleState[]>> = {},
  opts: { since?: string; now?: string } = {},
): OracleHealth {
  const now = opts.now ?? new Date().toISOString();
  const since = opts.since ?? monthAgo(now);
  const drifted = Object.entries(histories)
    .filter(([, history]) => driftedSince(history, since))
    .map(([caseId, history]) => ({ caseId, at: lastDriftAt(history) ?? now }));
  return {
    scope,
    total: cases.length,
    dead: states.filter((state) => !state.alive).length,
    deadRate: deadRate(states),
    deadByReason: countDeadReasons(states),
    driftedRecently: drifted,
    coverage: coverageOf(cases),
    computedAt: now,
  };
}

/** Il y a un mois, en ISO : fenêtre par défaut de la veille de dérive. */
export function monthAgo(now: string): string {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) return now;
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString();
}

/** Instant de la dernière dérive d'un historique, si elle existe. */
export function lastDriftAt(history: readonly OracleState[]): string | undefined {
  const ordered = [...history].sort((a, b) => a.versionNo - b.versionNo);
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    if (ordered[index].valueHash !== ordered[index - 1].valueHash) {
      return ordered[index].computedAt;
    }
  }
  return undefined;
}

/** Raisons de mort dans l'ordre d'affichage (pour les écrans et rapports). */
export function deadReasonOrder(): readonly DeadOracleReason[] {
  return DEAD_REASONS;
}
