/**
 * Mise en forme des jauges (§8, §25).
 *
 * Fonctions PURES : elles prennent des données et rendent une structure
 * affichable. C'est ce qui rend l'interface testable sans DOM, et ce qui
 * garantit qu'aucune décision de mesure ne se cache dans un composant.
 *
 * Règles d'honnêteté, appliquées ici et nowhere else :
 *   - sous l'effectif minimal, la jauge affiche « pas assez de recul », pas
 *     un pourcentage (§8) ;
 *   - une jauge sous son plancher porte le mot et le motif, pas seulement
 *     une couleur (§25) ;
 *   - une jauge non calibrée est marquée comme telle (§15).
 */
import type { Gauge, ScorecardRow } from '../../domain/vocabulary.js';

/** État affichable d'une jauge. */
export interface GaugeView {
  readonly gauge: Gauge;
  readonly n: number;
  /** `null` quand l'effectif est insuffisant : jamais un pourcentage de zéro. */
  readonly value: number | null;
  readonly label: string;
  readonly status: 'ok' | 'sous_plancher' | 'pas_assez_de_recul' | 'non_calibrée';
  readonly floor: number;
  readonly interval: string | null;
  /** Motif textuel : l'information ne repose jamais sur la seule couleur. */
  readonly motif: string;
}

/** Formate un taux en pourcentage lisible. */
export function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)} %`;
}

/** Construit la vue d'une ligne de scorecard. */
export function gaugeView(row: ScorecardRow, calibrated = true): GaugeView {
  if (row.value === null) {
    return {
      gauge: row.gauge, n: row.n, value: null, label: percent(null),
      status: 'pas_assez_de_recul', floor: row.floor, interval: null,
      motif: `pas assez de recul — ${row.n} cas mesurés, effectif minimal non atteint`,
    };
  }
  const below = row.value < row.floor;
  const interval = row.ciLow === null || row.ciHigh === null
    ? null : `${percent(row.ciLow)} – ${percent(row.ciHigh)}`;
  const status = below ? 'sous_plancher' : calibrated ? 'ok' : 'non_calibrée';
  return {
    gauge: row.gauge, n: row.n, value: row.value, label: percent(row.value),
    status, floor: row.floor, interval,
    motif: below
      ? `${percent(row.value)} sous le plancher de ${percent(row.floor)} (${row.n} cas)`
      : `${percent(row.value)} au-dessus du plancher de ${percent(row.floor)} (${row.n} cas)`,
  };
}

/** Les jauges en rouge d'une scorecard : ce que la vidéo montre en premier. */
export function failingGauges(rows: readonly ScorecardRow[]): readonly GaugeView[] {
  return rows.map((row) => gaugeView(row)).filter((view) => view.status === 'sous_plancher');
}

/** Le statut global d'une scorecard, pour l'en-tête d'écran. */
export function scorecardStatus(rows: readonly ScorecardRow[]): 'vert' | 'rouge' | 'insuffisant' {
  const views = rows.map((row) => gaugeView(row));
  if (views.some((view) => view.status === 'sous_plancher')) return 'rouge';
  if (views.every((view) => view.status === 'pas_assez_de_recul')) return 'insuffisant';
  return 'vert';
}
