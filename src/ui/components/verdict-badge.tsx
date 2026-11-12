/**
 * Le verdict (§4, §20) : exact, concordant, fondé, refus, infondé,
 * invérifiable.
 *
 * Les cinq mots de la discipline ne sont pas interchangeables, et l'écran le
 * rend visible : chaque verdict porte son MOT et son MOTIF (§25). Un verdict
 * sans mot et sans motif ne serait qu'une pastille de couleur.
 */
import type { VerdictKind } from '../../domain/vocabulary.js';
import { Tag } from '../kit.js';

/** Ce que porte un verdict à l'écran. */
export interface VerdictBadgeProps {
  readonly kind: VerdictKind;
  readonly detail?: string;
}

/** Apparence de l'étiquette par verdict. */
const COLORS: Record<VerdictKind, 'green' | 'red' | 'yellow' | 'grey' | 'blue'> = {
  exact: 'green', concordant: 'blue', fonde: 'green', refus: 'blue',
  infonde: 'red', invérifiable: 'yellow', faux: 'red', fissure: 'yellow', incident: 'grey',
};

/** Un verdict, avec son mot et son motif. */
export function VerdictBadge({ kind, detail }: VerdictBadgeProps): JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Tag color={COLORS[kind]} text={kind} />
      {detail && <span style={{ fontSize: 12, color: '#42526e' }}>{detail}</span>}
    </span>
  );
}
