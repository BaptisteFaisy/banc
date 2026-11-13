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

/**
 * Fabrique un atome de règle, à paramètres NOMMÉS.
 *
 * Les paramètres nommés ne sont pas une coquetterie : une fabrique à
 * arguments positionnels a déjà accepté un atome où le chemin et l'opérateur
 * étaient confondus, et l'oracle correspondant est mort sans que rien ne le
 * dise. Ici, un champ oublié ou inversé est une erreur de compilation.
 */
function atom(input: {
  readonly id: string;
  readonly label: string;
  readonly source: RuleAtom['source'];
  readonly query: string;
  readonly path: string;
  readonly op: RuleAtom['op'];
  readonly expected?: RuleAtom['expected'];
}): RuleAtom {
  const base = { id: input.id, label: input.label, source: input.source, query: input.query, path: input.path, op: input.op };
  return input.expected === undefined ? base : { ...base, expected: input.expected };
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
    atom({ id: 'gel', label: 'Aucun gel actif sur l’environnement', source: 'jira', query: 'jql:active-freeze:production', path: 'active', op: 'equals', expected: false }),
    atom({ id: 'incident', label: 'Aucun incident critique ouvert sur le service', source: 'jsm', query: 'jsm:critical:open:paiements', path: 'count', op: 'equals', expected: 0 }),
    atom({ id: 'critères', label: 'Tous les critères d’acceptation du ticket de release sont prouvés', source: 'jira', query: 'jql:REL-2026-11.ac-all-proven', path: 'proven', op: 'equals', expected: true }),
  ], 'all', 'oui, livrable', 'non, livraison interdite', 'bloquant', ['release', 'gel', 'incident'], true),
  rule('R-01', 'Le service facturation peut-il être redémarré maintenant sans impact client ?', [
    atom({ id: 'trafic', label: 'Le trafic est sous le seuil bas', source: 'graph', query: 'metrics:facturation:rps', path: 'rps', op: 'lt', expected: 50 }),
    atom({ id: 'incident', label: 'Aucun incident ouvert sur le service', source: 'jsm', query: 'jsm:open-incidents:facturation', path: 'count', op: 'equals', expected: 0 }),
  ], 'all', 'oui, redémarrage sans impact', 'non, redémarrage à reporter', 'bloquant', ['exploitation'], true),
  rule('R-02', 'La pull-request PAY-118 peut-elle être fusionnée ?', [
    atom({ id: 'ci', label: 'La CI est verte', source: 'graph', query: 'pull-request:PAY-118.ci', path: 'status', op: 'equals', expected: 'green' }),
    atom({ id: 'revue', label: 'Au moins une revue approuvée', source: 'graph', query: 'pull-request:PAY-118.reviews', path: 'approved', op: 'gt', expected: 0 }),
    atom({ id: 'conflit', label: 'Aucun conflit avec la branche cible', source: 'graph', query: 'pull-request:PAY-118.mergeable', path: 'mergeable', op: 'equals', expected: true }),
  ], 'all', 'oui, fusionnable', 'non, fusion bloquée', 'bloquant', ['code', 'revue'], true),
  rule('R-03', 'Le lot d’or de l’agent support est-il suffisant pour promouvoir la version 6 ?', [
    atom({ id: 'oracles', label: 'Moins d’un tiers des oracles sont morts', source: 'graph', query: 'bench:oracle-dead-rate', path: 'rate', op: 'lt', expected: 0.33 }),
    atom({ id: 'stabilité', label: 'La stabilité est au-dessus du plancher', source: 'graph', query: 'bench:stability:v6', path: 'rate', op: 'gt', expected: 0.8 }),
  ], 'all', 'oui, promotion possible', 'non, promotion refusée', 'bloquant', ['gouvernance'], true),
  rule('R-05', 'Doit-on déclencher la procédure de restauration de la base paiements ?', [
    atom({ id: 'integrité', label: 'Le contrôle d’intégrité a échoué', source: 'jira', query: 'jql:PAY-integrity-check', path: 'failed', op: 'equals', expected: true }),
    atom({ id: 'incident', label: 'Un incident critique est ouvert', source: 'jsm', query: 'jsm:critical:open:paiements', path: 'count', op: 'gt', expected: 0 }),
  ], 'all', 'oui, restauration à déclencher', 'non, restauration inutile', 'bloquant', ['runbook', 'incident'], true),
  rule('R-06', 'La rotation des clés de signature est-elle en retard ?', [
    atom({ id: 'âge', label: 'La dernière rotation a plus de 90 jours', source: 'confluence', query: 'page:rotation-cles.lastRotationAgeDays', path: 'days', op: 'gt', expected: 90 }),
    atom({ id: 'planifiée', label: 'Aucune rotation planifiée cette semaine', source: 'confluence', query: 'page:rotation-cles.plannedThisWeek', path: 'planned', op: 'equals', expected: false }),
  ], 'all', 'oui, rotation en retard', 'non, rotation à jour', 'souhaitable', ['sécurité'], true),
  rule('R-07', 'Le critère d’acceptation AC-3 de PAY-42 est-il prouvé ?', [
    atom({ id: 'test', label: 'Un test-plan couvre le critère', source: 'graph', query: 'test-plan:covering:PAY-42:AC-3', path: 'plan.name', op: 'exists' }),
    atom({ id: 'exécution', label: 'Le dernier test-run est passé', source: 'graph', query: 'test-run:PAY-42:AC-3:latest.status', path: 'status', op: 'equals', expected: 'passed' }),
  ], 'all', 'oui, critère prouvé', 'non, critère non prouvé', 'bloquant', ['critères', 'test'], true),
  rule('R-08', 'Peut-on fermer le ticket d’incident INC-2291 ?', [
    atom({ id: 'résolution', label: 'La cause racine est documentée', source: 'confluence', query: 'page:INC-2291.rootCause', path: 'documented', op: 'equals', expected: true }),
    atom({ id: 'régression', label: 'Aucune régression ouverte sur le service', source: 'graph', query: 'bench:regressions:open:paiements', path: 'count', op: 'equals', expected: 0 }),
  ], 'all', 'oui, incident closable', 'non, incident à garder ouvert', 'souhaitable', ['incident'], true),
  rule('R-09', 'L’agent support peut-il répondre seul à une demande de remboursement ?', [
    atom({ id: 'périmètre', label: 'La demande est dans le périmètre déclaré', source: 'jira', query: 'jql:refund-scope', path: 'inScope', op: 'equals', expected: true }),
    atom({ id: 'montant', label: 'Le montant est sous le seuil d’autonomie', source: 'jira', query: 'jql:refund-amount', path: 'amount', op: 'lt', expected: 200 }),
  ], 'all', 'oui, réponse autonome', 'non, escalade humaine requise', 'bloquant', ['périmètre', 'autonomie'], true),
  // Un seul facteur suffit : la règle est un OU, pas un ET.
  rule('R-10', 'Faut-il prévenir le responsable de données d’une dérive de vérité ?', [
    atom({ id: 'dérive', label: 'Au moins un oracle a dérivé ce mois-ci', source: 'graph', query: 'bench:oracle-drift:thisMonth', path: 'count', op: 'gt', expected: 0 }),
    atom({ id: 'bloquant', label: 'Un cas bloquant est concerné', source: 'graph', query: 'bench:oracle-drift:blocking', path: 'count', op: 'gt', expected: 0 }),
  ], 'any', 'oui, prévenir le responsable de données', 'non, aucune notification', 'souhaitable', ['gouvernance', 'dérive'], true),
];

/** Nombre attendu de cas à règle vivante (§29). */
export const RULE_COUNT = 10;
