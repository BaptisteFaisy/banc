/**
 * Corpus de démonstration — les 10 cas « règle vivante » (§6.2, §29).
 *
 * La réponse n'est pas une valeur mais un PRÉDICAT sur l'état courant. L'agent
 * n'a pas à connaître la règle : il doit la redécouvrir. Le banc mesure
 * l'exactitude du verdict ET la qualité des motifs cités — c'est le type de cas
 * qui casse les agents, et celui qu'un test classique ne sait pas évaluer.
 *
 * Le cas R-04 est repris mot pour mot du §6.2 : c'est l'exemple du cahier des
 * charges, et la vidéo de soumission s'appuie dessus (§28).
 */
import type { BancCase, RuleAtom, RuleOracleSpec } from '../domain/vocabulary.js';
import { BENCH_SPACE } from '../mcp/guard.js';

/** Fabrique un atome de règle. */
function atom(
  id: string, label: string, source: RuleAtom['source'], query: string, path: string,
  op: RuleAtom['op'], expected?: RuleAtom['expected'],
): RuleAtom {
  return expected === undefined
    ? { id, label, source, query, path, op }
    : { id, label, source, query, path, op, expected };
}

/** Fabrique un cas à règle vivante. */
function rule(
  id: string, question: string, atoms: readonly RuleAtom[],
  combinator: RuleOracleSpec['combinator'], expectedWhenTrue: string, expectedWhenFalse: string,
  gravity: BancCase['gravity'], tags: readonly string[], requireAllMotives = true,
): BancCase {
  return {
    id, spaceKey: BENCH_SPACE, question, oracleType: 'règle_vivante',
    oracleSpec: { type: 'règle_vivante', atoms, combinator, expectedWhenTrue, expectedWhenFalse, requireAllMotives },
    gravity, tags, createdAt: '2026-11-01T09:00:00Z', createdByRef: 'banc-seed',
    originRef: 'seed:demonstration',
  };
}

/** Les 10 cas à règle vivante du banc de démonstration. */
export const RULE_CASES: readonly BancCase[] = [
  // R-04 : l'exemple du cahier des charges, repris mot pour mot (§6.2).
  rule('R-04', 'Peut-on livrer la version 2026.11 en production vendredi ?', [
    atom('gel', 'Aucun gel actif sur l’environnement', 'jira', 'jql:active-freeze:production', 'active', 'equals', false),
    atom('incident', 'Aucun incident critique ouvert sur le service', 'jsm', 'jsm:critical:open:paiements', 'count', 'equals', 0),
    atom('critères', 'Tous les critères d’acceptation du ticket de release sont prouvés', 'jira', 'jql:REL-2026-11.ac-all-proven', 'proven', 'equals', true),
  ], 'all', 'oui, livrable', 'non, livraison interdite', 'bloquant', ['release', 'gel', 'incident'], true),
  rule('R-01', 'Le service facturation peut-il être redémarré maintenant sans impact client ?', [
    atom('trafic', 'Le trafic est sous le seuil bas', 'graph', 'metrics:facturation:rps', 'rps', 'lt', 50),
    atom('incident', 'Aucun incident ouvert sur le service', 'jsm', 'jsm:open-incidents:facturation', 'count', 'equals', 0),
  ], 'all', 'oui, redémarrage sans impact', 'non, redémarrage à reporter', 'bloquant', ['exploitation'], true),
  rule('R-02', 'La pull-request PAY-118 peut-elle être fusionnée ?', [
    atom('ci', 'La CI est verte', 'graph', 'pull-request:PAY-118.ci', 'status', 'equals', 'green'),
    atom('revue', 'Au moins une revue approuvée', 'graph', 'pull-request:PAY-118.reviews', 'approved', 'gt', 0),
    atom('conflit', 'Aucun conflit avec la branche cible', 'graph', 'pull-request:PAY-118.mergeable', 'mergeable', 'equals', true),
  ], 'all', 'oui, fusionnable', 'non, fusion bloquée', 'bloquant', ['code', 'revue'], true),
  rule('R-03', 'Le lot d’or de l’agent support est-il suffisant pour promouvoir la version 6 ?', [
    atom('oracles', 'Moins d’un tiers des oracles sont morts', 'graph', 'bench:oracle-dead-rate', 'rate', 'lt', 0.33),
    atom('stabilité', 'La stabilité est au-dessus du plancher', 'graph', 'bench:stability:v6', 'rate', 'gt', 0.8),
  ], 'all', 'oui, promotion possible', 'non, promotion refusée', 'bloquant', ['gouvernance'], true),
  rule('R-05', 'Doit-on déclencher la procédure de restauration de la base paiements ?', [
    atom('integrité', 'Le contrôle d’intégrité a échoué', 'jira', 'jql:PAY-integrity-check', 'failed', 'equals', true),
    atom('incident', 'Un incident critique est ouvert', 'jsm', 'jsm:critical:open:paiements', 'count', 'gt', 0),
  ], 'all', 'oui, restauration à déclencher', 'non, restauration inutile', 'bloquant', ['runbook', 'incident'], true),
  rule('R-06', 'La rotation des clés de signature est-elle en retard ?', [
    atom('âge', 'La dernière rotation a plus de 90 jours', 'confluence', 'page:rotation-cles.lastRotationAgeDays', 'days', 'gt', 90),
    atom('planifiée', 'Aucune rotation planifiée cette semaine', 'confluence', 'page:rotation-cles.plannedThisWeek', 'planned', 'equals', false),
  ], 'all', 'oui, rotation en retard', 'non, rotation à jour', 'souhaitable', ['sécurité'], true),
  rule('R-07', 'Le critère d’acceptation AC-3 de PAY-42 est-il prouvé ?', [
    atom('test', 'Un test-plan couvre le critère', 'graph', 'test-plan:covering:PAY-42:AC-3', 'exists', 'exists'),
    atom('exécution', 'Le dernier test-run est passé', 'graph', 'test-run:PAY-42:AC-3:latest.status', 'status', 'equals', 'passed'),
  ], 'all', 'oui, critère prouvé', 'non, critère non prouvé', 'bloquant', ['critères', 'test'], true),
  rule('R-08', 'Peut-on fermer le ticket d’incident INC-2291 ?', [
    atom('résolution', 'La cause racine est documentée', 'confluence', 'page:INC-2291.rootCause', 'documented', 'equals', true),
    atom('régression', 'Aucune régression ouverte sur le service', 'graph', 'bench:regressions:open:paiements', 'count', 'equals', 0),
  ], 'all', 'oui, incident closable', 'non, incident à garder ouvert', 'souhaitable', ['incident'], true),
  rule('R-09', 'L’agent support peut-il répondre seul à une demande de remboursement ?', [
    atom('périmètre', 'La demande est dans le périmètre déclaré', 'jira', 'jql:refund-scope', 'inScope', 'equals', true),
    atom('montant', 'Le montant est sous le seuil d’autonomie', 'jira', 'jql:refund-amount', 'amount', 'lt', 200),
  ], 'all', 'oui, réponse autonome', 'non, escalade humaine requise', 'bloquant', ['périmètre', 'autonomie'], true),
  // Un seul facteur suffit : la règle est un OU, pas un ET.
  rule('R-10', 'Faut-il prévenir le responsable de données d’une dérive de vérité ?', [
    atom('dérive', 'Au moins un oracle a dérivé ce mois-ci', 'graph', 'bench:oracle-drift:thisMonth', 'count', 'gt', 0),
    atom('bloquant', 'Un cas bloquant est concerné', 'graph', 'bench:oracle-drift:blocking', 'count', 'gt', 0),
  ], 'any', 'oui, prévenir le responsable de données', 'non, aucune notification', 'souhaitable', ['gouvernance', 'dérive'], true),
];

/** Nombre attendu de cas à règle vivante (§29). */
export const RULE_COUNT = 10;
