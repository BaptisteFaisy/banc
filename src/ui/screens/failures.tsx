/**
 * Screen 3 — l'explorateur d'échecs (§20).
 *
 * Pour chaque cas en échec : la réponse de l'agent, l'oracle, les sources, et
 * le verdict **par jauge** — pas une note globale. C'est le diagnostic : «
 * exact mais infondé » et « faux mais fondé » ne se réparent pas de la même
 * façon.
 */
import type { Verdict } from '../../domain/vocabulary.js';
import { VerdictBadge } from '../components/verdict-badge.js';
import { Tag } from '../kit.js';

/** Un cas en échec, avec sa réponse et son oracle. */
export interface FailureCase {
  readonly caseId: string;
  readonly question: string;
  readonly answer: string;
  readonly oracle: string;
  readonly sources: readonly string[];
  readonly verdicts: readonly Verdict[];
  readonly kind?: 'regression' | 'truth_drift' | 'fissure';
}

/** Ce que porte l'écran. */
export interface FailuresScreenProps {
  readonly failures: readonly FailureCase[];
}

/** Un cas, avec son détail. */
function Failure({ item }: { readonly item: FailureCase }): JSX.Element {
  return (
    <article style={{ border: '1px solid #dfe1e6', borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <header style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong>{item.caseId}</strong>
        {item.kind && <Tag color={item.kind === 'truth_drift' ? 'yellow' : 'red'} text={item.kind} />}
      </header>
      <p style={{ fontSize: 13 }}>{item.question}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <h4>Réponse de l’agent</h4>
          <p style={{ fontSize: 13 }}>{item.answer}</p>
        </div>
        <div>
          <h4>Oracle</h4>
          <p style={{ fontSize: 13 }}>{item.oracle}</p>
        </div>
      </div>
      {item.sources.length > 0 && (
        <p style={{ fontSize: 12, color: '#42526e' }}>Sources : {item.sources.join(' · ')}</p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {item.verdicts.map((verdict) => (
          <VerdictBadge key={`${verdict.gauge}:${verdict.id}`} kind={verdict.kind} detail={verdict.gauge} />
        ))}
      </div>
    </article>
  );
}

/** L'écran d'exploration des échecs. */
export function FailuresScreen({ failures }: FailuresScreenProps): JSX.Element {
  if (failures.length === 0) {
    return (
      <section>
        <h2>Explorateur d’échecs</h2>
        <p style={{ fontSize: 13, color: '#42526e' }}>Aucun cas en échec pour cette version.</p>
      </section>
    );
  }
  return (
    <section>
      <h2>Explorateur d’échecs — {failures.length} cas</h2>
      {failures.map((item) => (
        <Failure key={item.caseId} item={item} />
      ))}
    </section>
  );
}
