/**
 * Les douze outils MCP exposés par `rovo:mcp` (§19).
 *
 * Cette table est la source unique : le manifeste Forge la reflète, et un test
 * de contrat vérifie que les douze clés, leurs verbes et leurs entrées sont
 * exactement ceux du cahier des charges. Un outil ajouté ici sans être au §19
 * est une dérive du produit.
 *
 * Règle de sécurité (§19, dernière ligne) : aucun outil n'expose le contenu
 * d'un cas à un agent non autorisé. Le filtrage est appliqué dans `guard.ts`,
 * avant tout accès aux données — jamais après.
 */

/** Verbe d'un outil : GET lit, CREATE écrit (§19). */
export type McpVerb = 'GET' | 'CREATE';

/** Une entrée d'outil, typée. */
export interface McpInput {
  readonly name: string;
  readonly type: 'string' | 'integer' | 'enum';
  readonly required: boolean;
  readonly values?: readonly string[];
  readonly description: string;
}

/** Définition d'un outil MCP. */
export interface McpToolDef {
  readonly key: string;
  readonly verb: McpVerb;
  readonly description: string;
  readonly inputs: readonly McpInput[];
  readonly returns: string;
}

/** Les douze outils, dans l'ordre du tableau du §19. */
export const MCP_TOOLS: readonly McpToolDef[] = [
  {
    key: 'run-bench', verb: 'CREATE',
    description: 'Lance un essai du banc sur une version d’agent. Un essai long est découpé en tranches de 900 s avec reprise : l’outil crée l’essai et rend sa progression, il ne le termine pas dans l’appel (une action Forge dure 55 s).',
    inputs: [
      { name: 'agentId', type: 'string', required: true, description: 'Agent sous test' },
      { name: 'suite', type: 'enum', required: true, values: ['smoke', 'full'], description: 'Banc de fumée ou suite complète' },
      { name: 'passes', type: 'integer', required: false, description: 'Passages par cas (3 par défaut)' },
    ],
    returns: 'Identifiant d’essai, progression, budget consommé',
  },
  {
    key: 'get-scorecard', verb: 'GET',
    description: 'Scorecard d’une version : les huit jauges, chacune avec son effectif, sa fourchette et son plancher, plus les écarts au témoin et le taux d’oracles morts.',
    inputs: [
      { name: 'agentId', type: 'string', required: true, description: 'Agent sous test' },
      { name: 'version', type: 'string', required: false, description: 'Version (défaut : la dernière)' },
    ],
    returns: 'Jauges, effectifs, fourchettes, écarts au témoin',
  },
  {
    key: 'list-regressions', verb: 'GET',
    description: 'Cas régressés entre deux versions, avec réponse, oracle et sources. Les dérives de vérité sont signalées séparément : la vérité a changé, l’agent n’est pas coupable.',
    inputs: [
      { name: 'agentId', type: 'string', required: true, description: 'Agent sous test' },
      { name: 'fromVersion', type: 'string', required: true, description: 'Version de référence' },
      { name: 'toVersion', type: 'string', required: true, description: 'Version candidate' },
    ],
    returns: 'Cas régressés, avec réponse, oracle et sources',
  },
  {
    key: 'compare-versions', verb: 'GET',
    description: 'Diff de verdicts entre deux versions, et cas fissurés en commun — ce qui distingue une régression d’un cas mal écrit.',
    inputs: [
      { name: 'agentId', type: 'string', required: true, description: 'Agent sous test' },
      { name: 'versionA', type: 'string', required: true, description: 'Première version' },
      { name: 'versionB', type: 'string', required: true, description: 'Seconde version' },
    ],
    returns: 'Diff de verdicts, cas fissurés en commun',
  },
  {
    key: 'get-case', verb: 'GET',
    description: 'La plaque d’un cas : question, oracle, gravité, historique de vérité.',
    inputs: [{ name: 'caseId', type: 'string', required: true, description: 'Identifiant du cas' }],
    returns: 'Question, oracle, gravité, historique de vérité',
  },
  {
    key: 'list-cases', verb: 'GET',
    description: 'Corpus filtré. Les cas sont filtrés par l’espace du banc et par les droits du lecteur : un lecteur non autorisé n’obtient aucun contenu.',
    inputs: [
      { name: 'suite', type: 'enum', required: false, values: ['gold', 'smoke', 'battery', 'full'], description: 'Suite' },
      { name: 'gravity', type: 'enum', required: false, values: ['bloquant', 'souhaitable'], description: 'Gravité' },
      { name: 'tag', type: 'string', required: false, description: 'Étiquette' },
      { name: 'oracleType', type: 'enum', required: false, values: ['valeur_dérivée', 'règle_vivante', 'refus_attendu'], description: 'Forme d’oracle' },
    ],
    returns: 'Corpus filtré',
  },
  {
    key: 'check-promotion', verb: 'GET',
    description: 'Verdict de la porte de promotion et motifs du refus. La porte refuse en nommant le motif : cas bloquant régressé, jauge sous son plancher, stabilité insuffisante, coût hors budget, amorce suivie.',
    inputs: [
      { name: 'agentId', type: 'string', required: true, description: 'Agent sous test' },
      { name: 'candidateVersion', type: 'string', required: true, description: 'Version candidate' },
    ],
    returns: 'Verdict de la porte, motifs du refus',
  },
  {
    key: 'get-stability', verb: 'GET',
    description: 'Taux de fissures et cas instables, avec l’attribution : cas mal écrit ou agent non stable. Sous l’effectif minimal, le banc dit « pas assez de recul ».',
    inputs: [
      { name: 'agentId', type: 'string', required: true, description: 'Agent sous test' },
      { name: 'version', type: 'string', required: false, description: 'Version (défaut : la dernière)' },
    ],
    returns: 'Taux de fissures, cas instables',
  },
  {
    key: 'get-oracle-health', verb: 'GET',
    description: 'Oracles morts, dérives récentes, couverture du corpus. Distingue « pas de droit » de « pas de données » : un banc dont un tiers des oracles est mort ne vaut rien, et le produit le dit en face.',
    inputs: [{ name: 'scope', type: 'string', required: false, description: 'Périmètre (espace, projet)' }],
    returns: 'Oracles morts, dérives récentes, couverture du corpus',
  },
  {
    key: 'propose-case', verb: 'CREATE',
    description: 'Propose un cas depuis un ticket réel ou une question. L’oracle candidat est toujours à valider à la main : le banc ne décide pas seul de la vérité.',
    inputs: [
      { name: 'issueKey', type: 'string', required: false, description: 'Ticket source' },
      { name: 'question', type: 'string', required: false, description: 'Question libre' },
    ],
    returns: 'Cas proposé avec oracle candidat, à valider',
  },
  {
    key: 'record-judgment', verb: 'CREATE',
    description: 'Vote humain du jury. L’agent sous test ne peut ni s’auto-évaluer ni attester : le jury humain est la seule autorité de recours.',
    inputs: [
      { name: 'caseId', type: 'string', required: true, description: 'Cas jugé' },
      { name: 'verdict', type: 'enum', required: true, values: ['exact', 'concordant', 'fonde', 'refus', 'infonde', 'invérifiable', 'faux'], description: 'Verdict humain' },
      { name: 'notes', type: 'string', required: true, description: 'Motivation du vote' },
    ],
    returns: 'Vote du jury enregistré, avec accord inter-notateurs',
  },
  {
    key: 'get-run-log', verb: 'GET',
    description: 'Journal d’essai complet et rejouable : conditions, versions, horodatages, arrêts et invalidations. C’est la piste d’essais opposable attendue par la conformité.',
    inputs: [{ name: 'runId', type: 'string', required: true, description: 'Identifiant d’essai' }],
    returns: 'Journal d’essai rejouable',
  },
];

/** Clés des douze outils, pour les gardes de contrat. */
export const MCP_TOOL_KEYS: readonly string[] = MCP_TOOLS.map((tool) => tool.key);

/** Les outils qui écrivent : les deux seuls verbes CREATE du §19. */
export const WRITING_TOOLS: readonly string[] = MCP_TOOLS.filter((tool) => tool.verb === 'CREATE').map((tool) => tool.key);

/** Définition d'un outil par sa clé. */
export function toolDef(key: string): McpToolDef | undefined {
  return MCP_TOOLS.find((tool) => tool.key === key);
}
