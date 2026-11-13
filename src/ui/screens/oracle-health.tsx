/**
 * Screen 8 — la santé des oracles (§6.4, §20).
 *
 * Un banc dont un tiers des oracles est mort ne vaut rien : le produit le dit
 * en face. L'écran distingue « pas de données » de « pas de droit » — la
 * plateforme vide un résultat sans erreur quand un droit manque (§21), et
 * sans cette distinction un administrateur cherche une panne de données là où
 * il manque une autorisation.
 */
import type { OracleHealth } from '../../domain/vocabulary.js';
import { Tag } from '../kit.js';

/** Ce que porte l'écran. */
export interface OracleHealthScreenProps {
  readonly health: OracleHealth;
}

/** Les raisons de mort, avec leur effectif. */
const REASON_LABELS: Record<string, string> = {
  source_absente: 'Pas de données',
  droit_manquant: 'Pas de droit',
  'système_non_branché': 'Système non branché',
  'règle_non_expressible': 'Règle non exprimable',
};

/** L'écran de santé des oracles. */
export function OracleHealthScreen({ health }: OracleHealthScreenProps): JSX.Element {
  const dead = health.deadRate > 1 / 3;
  return (
    <section>
      <h2>Santé des oracles — {health.scope}</h2>
      <p style={{ fontSize: 13, color: '#42526e' }}>
        {health.total} cas · {health.dead} oracles morts ({Math.round(health.deadRate * 100)} %)
        {dead ? ' — au-delà d\'un tiers, ce banc ne vaut rien' : ''}
      </p>
      <table style={{ width: '100%', fontSize: 13 }}>
        <thead>
          <tr><th>Cause</th><th>Cas</th></tr>
        </thead>
        <tbody>
          {Object.entries(health.deadByReason).map(([reason, count]) => (
            <tr key={reason}>
              <td>{REASON_LABELS[reason] ?? reason}</td>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Dérives récentes</h3>
      {health.driftedRecently.length === 0
        ? <p style={{ fontSize: 13, color: '#42526e' }}>Aucune dérive sur la période.</p>
        : (
          <ul>
            {health.driftedRecently.map((drift) => (
              <li key={drift.caseId}>
                <Tag color="yellow" text="dérive de vérité" /> {drift.caseId} — {drift.at}
              </li>
            ))}
          </ul>
        )}
      <h3>Couverture du corpus</h3>
      <ul style={{ fontSize: 13 }}>
        <li>valeurs dérivées : {health.coverage['valeur_dérivée']}</li>
        <li>règles vivantes : {health.coverage['règle_vivante']}</li>
        <li>refus attendus : {health.coverage['refus_attendu']}</li>
      </ul>
    </section>
  );
}
