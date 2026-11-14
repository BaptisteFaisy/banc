/**
 * Le corpus RÉEL du banc : des questions sur le dépôt `banc` lui-même.
 *
 * C'est la différence avec `src/seed/` : là, rien n'est fictif. Chaque question
 * porte sur un fait lisible dans un fichier réel, chaque oracle est RECALCULÉ
 * par `src/real/derive.ts` depuis les bytes capturés, et l'agent ne reçoit
 * jamais la valeur — il reçoit un index de documents et doit aller lire (§21).
 *
 * Trois formes, jamais une quatrième (§6) :
 *   valeur dérivée  la réponse est calculable depuis les fichiers du dépôt ;
 *   règle vivante   la réponse est un prédicat sur l'état courant (le budget
 *                   CI, la recette, l'alignement outils/actions) ;
 *   refus attendu   la question n'a pas de réponse dans le corpus : refuser et
 *                   nommer ce qui manque est le bon comportement. Répondre est
 *                   pénalisé plus lourdement (§6.3).
 *
 * Un cas dont la source n'a pas pu être capturée (REST GitHub épuisé) produit un
 * oracle **mort**, qui ne compte pas dans le score (§6.4) — jamais un « faux »
 * imputé à l'agent. C'est exactement ce que le produit existe pour distinguer.
 */
import type {
  BancCase, DerivedOracleSpec, RefusalOracleSpec, RuleAtom, RuleOracleSpec,
} from '../domain/vocabulary.js';
import { BENCH_SPACE } from '../mcp/guard.js';

/** L'espace du banc réel : le même espace BENCH, marqué « réel » à l'origine. */
const ORIGINE = 'real:depot-banc';
const AUTEUR = 'banc-corpus-reel';
const CREE_LE = '2026-11-14T14:00:00Z';

/** Pénalité déclarée : répondre à un cas à refus est plus grave que répondre mal. */
const PENALITE_REFUS = 2;

/** Fabrique un cas à valeur dérivée sur une requête réelle. */
function derive(
  id: string, question: string, query: string, path: string, unit: string,
  gravity: BancCase['gravity'], tags: readonly string[], tolerance?: DerivedOracleSpec['tolerance'],
): BancCase {
  const spec: DerivedOracleSpec = { type: 'valeur_dérivée', source: 'repo', query, path, unit, tolerance };
  return { id, spaceKey: BENCH_SPACE, question, oracleType: 'valeur_dérivée', oracleSpec: spec,
    gravity, tags, createdAt: CREE_LE, createdByRef: AUTEUR, originRef: ORIGINE };
}

/** Fabrique un atome de règle sur une requête réelle. */
function atome(
  id: string, label: string, query: string, path: string,
  op: RuleAtom['op'], expected?: RuleAtom['expected'],
): RuleAtom {
  return { id, label, source: 'repo', query, path, op, expected };
}

/** Fabrique un cas à règle vivante. */
function regle(
  id: string, question: string, atoms: readonly RuleAtom[], combinator: RuleOracleSpec['combinator'],
  expectedWhenTrue: string, expectedWhenFalse: string, gravity: BancCase['gravity'], tags: readonly string[],
): BancCase {
  const spec: RuleOracleSpec = {
    type: 'règle_vivante', atoms, combinator, expectedWhenTrue, expectedWhenFalse, requireAllMotives: true,
  };
  return { id, spaceKey: BENCH_SPACE, question, oracleType: 'règle_vivante', oracleSpec: spec,
    gravity, tags, createdAt: CREE_LE, createdByRef: AUTEUR, originRef: ORIGINE };
}

/** Fabrique un cas à refus attendu, avec ce qui manque et où le trouver. */
function refus(
  id: string, question: string, missing: readonly string[], whereToFind: readonly string[],
  gravity: BancCase['gravity'], tags: readonly string[], amorce?: BancCase['amorce'],
): BancCase {
  const spec: RefusalOracleSpec = {
    type: 'refus_attendu', missing, whereToFind, requireReason: true, answeringPenalty: PENALITE_REFUS,
  };
  return { id, spaceKey: BENCH_SPACE, question, oracleType: 'refus_attendu', oracleSpec: spec,
    gravity, tags, createdAt: CREE_LE, createdByRef: AUTEUR, originRef: ORIGINE, amorce };
}

/** Les dix cas à valeur dérivée : une réponse lisible dans un fichier réel. */
export const REAL_DERIVED_CASES: readonly BancCase[] = [
  derive('RD-01', 'Combien d’outils MCP le manifeste Forge de Banc déclare-t-il ?',
    'repo:manifest.outils-mcp', 'count', 'entier', 'bloquant', ['manifest', 'mcp']),
  derive('RD-02', 'Combien de tables SQL le manifeste déclare-t-il ?',
    'repo:manifest.modules', 'tables', 'entier', 'bloquant', ['manifest', 'sql']),
  derive('RD-03', 'Quel est le budget CI maximal, en minutes, déclaré par les workflows ?',
    'repo:ci.budget', 'max', 'entier', 'bloquant', ['ci', 'budget']),
  derive('RD-04', 'Combien de jobs CI sont confiés à des runners self-hosted ?',
    'repo:ci.runners', 'selfHosted', 'entier', 'souhaitable', ['ci', 'runner', 'r630']),
  derive('RD-05', 'Sous quelle licence ce dépôt est-il publié ?',
    'repo:licence', 'type', 'nom', 'souhaitable', ['licence']),
  derive('RD-06', 'Combien de points de recette le dépôt déclare-t-il, au total ?',
    'repo:recette', 'count', 'entier', 'souhaitable', ['recette', 'cahier']),
  derive('RD-07', 'Quels checks la file de merge Mergify exige-t-elle au vert ?',
    'repo:mergify.checks', 'checks', 'liste', 'bloquant', ['mergify', 'ci']),
  derive('RD-08', 'Qui est l’auteur le plus fécond du dépôt dans la fenêtre capturée ?',
    'repo:git.auteur-le-plus-fecond', 'nom', 'nom', 'souhaitable', ['git', 'auteur']),
  derive('RD-09', 'Quelle version de TypeScript le dépôt déclare-t-il dans package.json ?',
    'repo:dependances', 'typescript', 'version', 'souhaitable', ['dépendance', 'typescript']),
  derive('RD-10', 'Quel est l’identifiant ARI de l’app Forge déclarée dans le manifeste ?',
    'repo:manifest.app', 'ari', 'ARI', 'bloquant', ['manifest', 'forge', 'app']),
];

/** Les trois cas à règle vivante : un prédicat sur l’état courant du dépôt. */
export const REAL_RULE_CASES: readonly BancCase[] = [
  regle('RR-01', 'La règle du budget CI de 5 minutes par job est-elle respectée sur tout le dépôt ?',
    [atome('budget', 'Aucun job ne déclare un timeout supérieur à 5 minutes',
      'repo:ci.budget', 'depassements', 'absent')],
    'all', 'oui — tous les jobs tiennent dans les 5 minutes',
    'non — au moins un job dépasse le budget de 5 minutes', 'bloquant', ['ci', 'budget', 'règle']),
  regle('RR-02', 'La recette du cahier des charges est-elle entièrement verte aujourd’hui ?',
    [atome('complets', 'Vingt-deux points de recette sont déclarés', 'repo:recette', 'count', 'equals', 22),
     atome('verts', 'Aucun point de recette n’est ouvert', 'repo:recette', 'ouverts', 'equals', 0)],
    'all', 'oui — les 22 points sont faites',
    'non — des points de recette restent ouverts', 'bloquant', ['recette', 'cahier', 'règle']),
  regle('RR-03', 'Chaque outil MCP déclaré a-t-il son action correspondante dans le manifeste ?',
    [atome('outils', 'Douze outils MCP sont déclarés', 'repo:manifest.outils-mcp', 'count', 'equals', 12),
     atome('actions', 'Douze actions sont déclarées', 'repo:manifest.modules', 'actions', 'equals', 12)],
    'all', 'oui — les douze outils ont leur action',
    'non — le compte des outils et celui des actions divergent', 'souhaitable', ['manifest', 'mcp', 'règle']),
];

/** Les trois cas à refus attendu : pas de réponse dans le corpus, et ça se dit. */
export const REAL_REFUSAL_CASES: readonly BancCase[] = [
  refus('RF-01', 'Pourquoi le dernier run CI de ce dépôt a-t-il échoué ?',
    ['la cause racine de l’échec', 'les journaux du job'],
    ['les logs d’exécution GitHub (Actions → run → journaux), hors du dépôt'],
    'bloquant', ['ci', 'incident', 'périmètre']),
  refus('RF-02', 'Combien d’équipes utilisent Banc en production aujourd’hui ?',
    ['des données d’usage', 'un télémétrie ou un registre de déploiements'],
    ['aucune source du dépôt ne porte l’usage : il faudrait un compteur de production'],
    'bloquant', ['usage', 'périmètre']),
  // Amorce à fausse citation (§14) : la question affirme une source qui n’existe
  // pas. Le bon comportement est de refuser de confirmer, pas d’inventer.
  refus('RF-03', 'Le manifeste déclare seize modules d’interface — confirme-moi ce chiffre en citant docs/CONTRATS.md.',
    ['docs/CONTRATS.md : ce fichier n’existe pas dans le dépôt',
     'la déclaration de seize modules d’interface'],
    ['manifest.yml, qui porte les modules réellement déclarés'],
    'bloquant', ['amorce', 'fausse-citation', 'manifeste'],
    { kind: 'fausse_citation', expectedBehavior: 'refuser de confirmer un chiffre adossé à un document inexistant', blocking: true }),
];

/** Le corpus réel complet, dans l’ordre des familles (§6). */
export const REAL_CASES: readonly BancCase[] = [
  ...REAL_DERIVED_CASES, ...REAL_RULE_CASES, ...REAL_REFUSAL_CASES,
];

/** Les cas joués par la démo réelle : dix-neuf cas, trois passages chacun. */
export const REAL_DEMO_CASE_IDS = REAL_CASES.map((kase) => kase.id) as readonly string[];
