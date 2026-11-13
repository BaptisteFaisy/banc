/**
 * Corpus de démonstration — les 15 cas « valeur dérivée » (§6.1, §29).
 *
 * La réponse existe déjà dans les systèmes de l'organisation, sous une forme
 * calculable. L'oracle n'est pas tapé : il est recalculé à chaque essai depuis
 * la source. L'agent doit retrouver cette valeur par lui-même ; le banc mesure
 * s'il y arrive, s'il la source correctement, et s'il ne l'invente pas.
 *
 * Tout le corpus est FICTIF : aucun nom réel, aucune donnée de production,
 * aucun secret. L'espace est `BENCH`, jamais un espace de production (§16).
 */
import type { BancCase, DerivedOracleSpec } from '../domain/vocabulary.js';
import { BENCH_SPACE } from '../mcp/guard.js';

/** Fabrique un cas à valeur dérivée, pour éviter de répéter la structure. */
function derived(
  id: string, question: string, spec: Omit<DerivedOracleSpec, 'type'>,
  gravity: BancCase['gravity'], tags: readonly string[],
): BancCase {
  return {
    id, spaceKey: BENCH_SPACE, question, oracleType: 'valeur_dérivée',
    oracleSpec: { type: 'valeur_dérivée', ...spec },
    gravity, tags, createdAt: '2026-11-01T09:00:00Z', createdByRef: 'banc-seed',
    originRef: 'seed:demonstration',
  };
}

/** Les 15 cas à valeur dérivée du banc de démonstration. */
export const DERIVED_CASES: readonly BancCase[] = [
  derived('D-01', 'Qui est le propriétaire du service paiements ?',
    { source: 'graph', query: 'service:paiements.owner', path: 'owner.name', unit: 'nom' },
    'bloquant', ['compass', 'propriété']),
  derived('D-02', 'Quel est le ticket bloquant le plus ancien du sprint en cours ?',
    { source: 'jira', query: 'jql:oldest-blocker-current-sprint', path: 'issue.key', unit: 'clé' },
    'bloquant', ['jira', 'sprint']),
  derived('D-03', 'La page de rotation des clés a-t-elle été modifiée cette semaine ?',
    { source: 'confluence', query: 'page:rotation-cles.version.thisWeek', path: 'modified', unit: 'booléen' },
    'souhaitable', ['confluence', 'version']),
  derived('D-04', 'Y a-t-il un incident ouvert sur le service facturation ?',
    { source: 'jsm', query: 'jsm:open-incidents:facturation', path: 'count', unit: 'entier',
      tolerance: { numeric: 0 } },
    'bloquant', ['jsm', 'incident']),
  derived('D-05', 'Quel plan de test couvre le critère d’acceptation AC-3 du ticket PAY-42 ?',
    { source: 'graph', query: 'test-plan:covering:PAY-42:AC-3', path: 'plan.name' },
    'souhaitable', ['graphe', 'test']),
  derived('D-06', 'Combien de déploiements ont eu lieu sur l’environnement production cette semaine ?',
    { source: 'graph', query: 'deployments:production:thisWeek', path: 'count', unit: 'entier',
      tolerance: { numeric: 0 } },
    'souhaitable', ['déploiement']),
  derived('D-07', 'Quelle équipe est responsable du service authentification ?',
    { source: 'graph', query: 'service:authentification.team', path: 'team.name' },
    'bloquant', ['compass', 'équipe']),
  derived('D-08', 'Quel est le statut du dernier test-run du plan de test TP-17 ?',
    { source: 'graph', query: 'test-run:TP-17:latest.status', path: 'status' },
    'souhaitable', ['test']),
  derived('D-09', 'Combien de pull-requests ouvertes sur le dépôt paiements-service ?',
    { source: 'graph', query: 'pull-requests:open:paiements-service', path: 'count', unit: 'entier',
      tolerance: { numeric: 0 } },
    'souhaitable', ['code']),
  derived('D-10', 'Quelle est la date du dernier déploiement réussi du service facturation ?',
    { source: 'graph', query: 'deployment:facturation:lastSuccess', path: 'at', unit: 'date',
      tolerance: { dateGranularity: 'day' } },
    'bloquant', ['déploiement', 'date']),
  derived('D-11', 'Quels sont les trois services sans propriétaire déclaré dans Compass ?',
    { source: 'graph', query: 'services:without-owner', path: 'names',
      tolerance: { listOrderInsensitive: true } },
    'souhaitable', ['compass', 'liste']),
  derived('D-12', 'Le ticket PAY-42 a-t-il tous ses critères d’acceptation liés à un test ?',
    { source: 'jira', query: 'jql:PAY-42.ac-all-covered', path: 'covered', unit: 'booléen' },
    'bloquant', ['jira', 'critères']),
  derived('D-13', 'Combien d’incidents critiques ont été ouverts sur les 7 derniers jours ?',
    { source: 'jsm', query: 'jsm:critical:7d', path: 'count', unit: 'entier', tolerance: { numeric: 0 } },
    'bloquant', ['jsm', 'incident']),
  derived('D-14', 'Quelle page Confluence décrit la procédure de restauration de la base paiements ?',
    { source: 'confluence', query: 'page:restauration-paiements', path: 'title' },
    'souhaitable', ['confluence', 'runbook']),
  derived('D-15', 'Y a-t-il un gel actif sur l’environnement de production ?',
    { source: 'jira', query: 'jql:active-freeze:production', path: 'active', unit: 'booléen' },
    'bloquant', ['gel', 'production']),
];

/** Nombre attendu de cas à valeur dérivée dans le corpus de démonstration (§29). */
export const DERIVED_COUNT = 15;
