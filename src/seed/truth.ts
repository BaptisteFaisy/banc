/**
 * L'état de vérité semé (§29, §7).
 *
 * Ce module contient les valeurs que les sources du banc de démonstration
 * rendent. C'est ce qui rend le banc **rejouable** : deux versions d'agent
 * testées à dix minutes d'intervalle reçoivent le même monde (§16).
 *
 * Il contient aussi une **dérive de vérité datée** : la vérité a changé mardi.
 * Sans elle, la distinction centrale du produit (§7) ne serait pas
 * démontrable — et c'est précisément cette distinction qui évite de passer
 * trois jours à déboguer un prompt alors que c'est l'organisation qui a
 * changé.
 *
 * Tout est fictif : aucune donnée réelle, aucun secret.
 */

/** Données rendues par le graphe (Teamwork Graph). */
export const GRAPH_TRUTH: Readonly<Record<string, unknown>> = {
  'service:paiements.owner': { owner: { name: 'Équipe Paiements', id: 'team-paiements' } },
  'service:authentification.team': { team: { name: 'Équipe Identité', id: 'team-identite' } },
  'test-plan:covering:PAY-42:AC-3': { plan: { name: 'TP-17 — couverture AC-3', id: 'TP-17' } },
  'test-run:TP-17:latest.status': { status: 'passed' },
  'test-run:PAY-42:AC-3:latest.status': { status: 'passed' },
  'deployments:production:thisWeek': { count: 3 },
  'deployment:facturation:lastSuccess': { at: '2026-11-10T04:12:00Z' },
  'pull-requests:open:paiements-service': { count: 4 },
  'pull-request:PAY-118.ci': { status: 'green' },
  'pull-request:PAY-118.reviews': { approved: 2 },
  'pull-request:PAY-118.mergeable': { mergeable: true },
  'services:without-owner': { names: ['service-legacy-facturation', 'service-notifications', 'service-rapports'] },
  'metrics:facturation:rps': { rps: 22 },
  'bench:oracle-dead-rate': { rate: 0.05 },
  'bench:stability:v6': { rate: 0.62 },
  'bench:regressions:open:paiements': { count: 0 },
  'bench:oracle-drift:thisMonth': { count: 1 },
  'bench:oracle-drift:blocking': { count: 1 },
};

/** Données rendues par Jira (JQL). */
export const JIRA_TRUTH: Readonly<Record<string, unknown>> = {
  'jql:oldest-blocker-current-sprint': { issue: { key: 'PAY-87', summary: 'Migration du schéma paiements' } },
  'jql:PAY-42.ac-all-covered': { covered: true },
  'jql:active-freeze:production': { active: false },
  'jql:REL-2026-11.ac-all-proven': { proven: true },
  'jql:PAY-integrity-check': { failed: false },
  'jql:refund-scope': { inScope: true },
  'jql:refund-amount': { amount: 145 },
};

/** Données rendues par Confluence. */
export const CONFLUENCE_TRUTH: Readonly<Record<string, unknown>> = {
  'page:rotation-cles.version.thisWeek': { modified: true },
  'page:rotation-cles.lastRotationAgeDays': { days: 41 },
  'page:rotation-cles.plannedThisWeek': { planned: true },
  'page:restauration-paiements': { title: 'Procédure de restauration — base paiements' },
  'page:INC-2291.rootCause': { documented: true },
};

/** Données rendues par JSM (incidents). */
export const JSM_TRUTH: Readonly<Record<string, unknown>> = {
  'jsm:open-incidents:facturation': { count: 1 },
  'jsm:critical:open:paiements': { count: 0 },
  'jsm:critical:7d': { count: 2 },
};

/**
 * Dérive de vérité semée (§7) : la vérité a changé mardi.
 *
 * Le cas D-13 (incidents critiques sur 7 jours) est passé de 0 à 2. Ce n'est
 * PAS une régression de l'agent : le monde a bougé. Le banc doit le dire, et
 * la régression éventuelle doit être close en dérive avec cette preuve.
 */
export const SEEDED_DRIFT = {
  caseId: 'D-13',
  at: '2026-11-10T06:00:00Z',
  from: '0',
  to: '2',
  motive: 'deux incidents critiques ouverts mardi : la vérité a changé, l’agent n’est pas en cause',
} as const;

/** Valeur du cas D-13 avant la dérive (lundi) et après (mardi). */
export const DRIFT_BEFORE: Readonly<Record<string, unknown>> = {
  ...JSM_TRUTH, 'jsm:critical:7d': { count: 0 },
};

/** Verdict attendu sur R-04 avec la vérité semée : les trois facteurs sont bons. */
export const R04_EXPECTED = {
  satisfied: true,
  expectedAnswer: 'oui, livrable',
  motives: [
    'Aucun gel actif sur l’environnement',
    'Aucun incident critique ouvert sur le service',
    'Tous les critères d’acceptation du ticket de release sont prouvés',
  ],
} as const;

/** Ce que les cas à refus attendu doivent constater comme absent. */
export const UNBRANCHED_SOURCES: readonly string[] = [
  'facturation', 'données RH', 'veille concurrentielle', 'enquêtes de satisfaction',
  'comptes rendus de réunion', 'plan commercial',
];
