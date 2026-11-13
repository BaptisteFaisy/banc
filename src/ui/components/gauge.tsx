/**
 * La jauge (§8, §20) : une métrique, avec sa graduation et son plancher
 * marqué.
 *
 * L'interface n'est jamais plus optimiste que la mesure : sous l'effectif
 * minimal, la jauge affiche « pas assez de recul » — pas un pourcentage de
 * zéro (§25). Et l'état ne repose **jamais sur la seule couleur** : chaque
 * état porte un mot et un motif (§25, accessibilité).
 */
import type { Gauge, ScorecardRow } from '../../domain/vocabulary.js';
import { gaugeView } from '../viewmodel/gauge.js';
import type { GaugeView } from '../viewmodel/gauge.js';
import { Tag } from '../kit.js';

/** Ce que porte une jauge à l'écran. */
export interface GaugeProps {
  readonly row: ScorecardRow;
  readonly calibrated?: boolean;
}

/** Étiquette de l'état : le mot, pour ne pas dépendre de la couleur. */
function StatusTag({ view }: { readonly view: GaugeView }): JSX.Element {
  const labels: Record<GaugeView['status'], string> = {
    ok: 'au-dessus du plancher',
    sous_plancher: 'SOUS LE PLANCHER',
    pas_assez_de_recul: 'pas assez de recul',
    non_calibrée: 'non calibrée',
  };
  const colors: Record<GaugeView['status'], 'green' | 'red' | 'yellow' | 'grey'> = {
    ok: 'green', sous_plancher: 'red', pas_assez_de_recul: 'yellow', non_calibrée: 'grey',
  };
  return (
    <Tag color={colors[view.status]} text={labels[view.status]} />
  );
}

/** Une jauge, avec sa graduation, son plancher et son motif. */
export function Gauge({ row, calibrated = true }: GaugeProps): JSX.Element {
  const view = gaugeView(row, calibrated);
  return (
    <div style={{ border: '1px solid #dfe1e6', borderRadius: 6, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{view.gauge}</strong>
        <StatusTag view={view} />
      </div>
      <div style={{ fontSize: 22, margin: '6px 0' }}>{view.label}</div>
      <div style={{ fontSize: 12, color: '#42526e' }}>{view.motif}</div>
      {view.interval && (
        <div style={{ fontSize: 12, color: '#42526e' }}>fourchette : {view.interval}</div>
      )}
    </div>
  );
}

/** Les jauges d'une scorecard, dans l'ordre du rapport. */
export function GaugeList({ rows, gauges }: {
  readonly rows: readonly ScorecardRow[];
  readonly gauges: readonly Gauge[];
}): JSX.Element {
  return (
    <div>
      {gauges.map((gauge) => {
        const row = rows.find((item) => item.gauge === gauge);
        return row ? <Gauge key={gauge} row={row} /> : null;
      })}
    </div>
  );
}
