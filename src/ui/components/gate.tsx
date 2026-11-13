/**
 * Le filet — la porte de promotion (§11, §20).
 *
 * La porte est tendue entre deux montants, rouge ou verte. Elle ne refuse
 * **jamais** en silence : chaque règle a un motif lisible, et c'est ce qui
 * fait qu'un ticket bloqué se travaille au lieu d'être contourné.
 */
import type { PromotionMotive, PromotionVerdict } from '../../domain/vocabulary.js';
import { Tag } from '../kit.js';

/** Ce que porte la porte à l'écran. */
export interface GateProps {
  readonly verdict: PromotionVerdict;
}

/** Un motif de règle, avec son état et sa raison. */
function Motive({ motive }: { readonly motive: PromotionMotive }): JSX.Element {
  return (
    <li style={{ listStyle: 'none', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Tag color={motive.passed ? 'green' : 'red'} text={motive.passed ? 'OK' : 'REFUS'} />
        <strong>{motive.rule}</strong>
      </div>
      <div style={{ fontSize: 13, color: '#42526e', marginLeft: 8 }}>{motive.detail}</div>
    </li>
  );
}

/** La porte, ses règles et ses motifs. */
export function Gate({ verdict }: GateProps): JSX.Element {
  return (
    <section style={{ border: `2px solid ${verdict.allowed ? '#00875A' : '#DE350B'}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ margin: 0 }}>
          {verdict.allowed ? 'Filet levé — promotion possible' : 'Filet tendu — promotion refusée'}
        </h3>
        <Tag color={verdict.allowed ? 'green' : 'red'} text={verdict.allowed ? 'PORTE VERTE' : 'PORTE ROUGE'} />
      </div>
      <p style={{ fontSize: 13, color: '#42526e' }}>
        version candidate : {verdict.candidateVersion}
        {verdict.witnessVersion ? ` · témoin : ${verdict.witnessVersion}` : ''}
      </p>
      <ul style={{ margin: 0, padding: 0 }}>
        {verdict.motives.map((motive) => (
          <Motive key={motive.rule} motive={motive} />
        ))}
      </ul>
    </section>
  );
}
