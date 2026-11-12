/**
 * L'application : navigation entre les écrans du banc (§20).
 *
 * La navigation porte des MOTS, pas seulement des icônes : chaque écran a un
 * titre lisible, et l'état de la porte est annoncé en toutes lettres (§25,
 * accessibilité).
 */
import type { PromotionVerdict, Scorecard } from '../domain/vocabulary.js';
import { ScorecardScreen } from './screens/scorecard.js';
import { FailuresScreen } from './screens/failures.js';
import type { FailureCase } from './screens/failures.js';
import { OracleHealthScreen } from './screens/oracle-health.js';
import { Gate } from './components/gate.js';

/** Les onglets du banc. */
export type BenchTab = 'scorecard' | 'failures' | 'gate' | 'oracleHealth';

/** Ce que porte l'application. */
export interface BenchAppProps {
  readonly scorecard?: Scorecard;
  readonly failures?: readonly FailureCase[];
  readonly promotion?: PromotionVerdict;
  readonly oracleHealth?: Parameters<typeof OracleHealthScreen>[0]['health'];
  readonly initialTab?: BenchTab;
}

/** L'application. */
export function BenchApp(props: BenchAppProps): JSX.Element {
  const tabs: readonly { id: BenchTab; label: string }[] = [
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'failures', label: 'Explorateur d’échecs' },
    { id: 'gate', label: 'Porte de promotion' },
    { id: 'oracleHealth', label: 'Santé des oracles' },
  ];
  const current = props.initialTab ?? 'scorecard';
  return (
    <div>
      <nav aria-label="Écrans du banc" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={tab.id === current ? 'page' : undefined}
            style={{
              padding: '6px 10px', cursor: 'pointer',
              border: tab.id === current ? '2px solid #0052CC' : '1px solid #dfe1e6',
              borderRadius: 4, background: 'transparent', fontWeight: tab.id === current ? 700 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {current === 'scorecard' && props.scorecard && <ScorecardScreen scorecard={props.scorecard} />}
      {current === 'failures' && <FailuresScreen failures={props.failures ?? []} />}
      {current === 'gate' && (props.promotion
        ? <Gate verdict={props.promotion} />
        : <p style={{ fontSize: 13 }}>Aucune mesure : la porte ne peut pas conclure.</p>)}
      {current === 'oracleHealth' && props.oracleHealth && <OracleHealthScreen health={props.oracleHealth} />}
    </div>
  );
}
