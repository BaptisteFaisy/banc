/**
 * Screen 2 — la scorecard d'une version (§20).
 *
 * Les huit jauges, chacune avec son effectif, sa fourchette et son plancher,
 * puis les écarts au témoin. Les deux modes d'essai ne sont jamais fusionnés :
 * le banc les rapporte séparément (§12), et l'écran le dit.
 */
import type { Scorecard } from '../../domain/vocabulary.js';
import { GaugeList } from '../components/gauge.js';
import { scorecardGauges } from '../../actions/resolver.js';
import { Tag } from '../kit.js';

/** Ce que porte l'écran. */
export interface ScorecardScreenProps {
  readonly scorecard: Scorecard;
  readonly calibrated?: boolean;
}

/** Un écart au témoin, avec sa nature. */
function Delta({ gauge, delta, kind }: {
  readonly gauge: string; readonly delta: number | null; readonly kind: string;
}): JSX.Element {
  const label = delta === null ? '—' : `${delta > 0 ? '+' : ''}${Math.round(delta * 100)} pts`;
  const color = kind === 'regression' ? 'red' : kind === 'progress' ? 'green' : 'grey';
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <span>{gauge}</span>
      <Tag color={color} text={label} />
    </span>
  );
}

/** L'écran scorecard. */
export function ScorecardScreen({ scorecard, calibrated = true }: ScorecardScreenProps): JSX.Element {
  return (
    <section>
      <h2>Scorecard — {scorecard.agentVersionId}</h2>
      <p style={{ fontSize: 13, color: '#42526e' }}>
        mode {scorecard.mode} · suite {scorecard.suiteId}
        {scorecard.witnessVersionId ? ` · témoin ${scorecard.witnessVersionId}` : ''}
        {' '}· oracles morts : {Math.round(scorecard.deadOracleRate * 100)} %
      </p>
      <GaugeList rows={scorecard.rows} gauges={scorecardGauges()} />
      <h3>Écarts au témoin</h3>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {scorecard.deltas.map((delta) => (
          <Delta key={delta.gauge} gauge={delta.gauge} delta={delta.delta} kind={delta.kind} />
        ))}
      </div>
      {!calibrated && (
        <p style={{ fontSize: 13, color: '#42526e' }}>
          Attention : une jauge de cette scorecard n'est pas calibrée — le banc ne l'annonce pas comme telle.
        </p>
      )}
    </section>
  );
}
