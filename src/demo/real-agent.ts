/**
 * L'agent réel : un vrai LLM, appelé et mesuré pour de bon.
 *
 * C'est le banc en environnement proche du réel (§21 : l'appel à un agent
 * passe par une action). Ici l'action est un appel HTTP OpenAI-compatible à
 * InferHub (`combo/cheap`) ; en production ce serait une action Rovo de 55 s.
 * Ce qui change par rapport à l'agent simulé : la latence, les jetons et le
 * coût sont MESURÉS, et la réponse est NON DÉTERMINISTE — c'est cela qui rend
 * les fissures et la stabilité réelles.
 *
 * La clé ne vit jamais ici : elle vient de l'environnement (`INFERHUB_API_KEY`),
 * lue par le CLI, et la sortie enregistrée ne contient que des réponses et
 * des mesures — pas la clé.
 */
import type {
  AgentAnswer, AgentCitation, AgentUnderTest, BancCase, BenchMode, OracleState,
} from '../domain/vocabulary.js';
import type { SourceRegistry } from '../oracle/deps.js';
import { hashValue } from '../oracle/hash.js';
import { systemClock } from '../oracle/deps.js';

/** Ce qu'un client de chat OpenAI-compatible doit faire. */
export interface ChatClient {
  complete(input: {
    readonly system: string;
    readonly user: string;
  }): Promise<{ text: string; tokens: number }>;
}

/** Client InferHub, sans dépendance externe (fetch natif, Node >= 18). */
export function createHttpChatClient(
  baseUrl: string, apiKey: string, model: string,
): ChatClient {
  return {
    complete: async ({ system, user }) => {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0,
        }),
      });
      const body = (await response.json()) as {
        choices?: readonly { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
      };
      if (!response.ok) {
        throw new Error(`LLM ${response.status} : ${JSON.stringify(body).slice(0, 120)}`);
      }
      const text = body.choices?.[0]?.message?.content ?? '';
      const tokens = body.usage?.total_tokens ?? 0;
      return { text, tokens };
    },
  };
}

/** Tarif déclaré : le coût est une estimation affichée, jamais muette (§17). */
export interface PriceModel {
  /** Coût pour 1000 jetons, affiché et commenté. */
  readonly usdPerThousandTokens: number;
}

/** Détecte les citations que l'agent a réellement émises, s'il les structure. */
const CITATION_PATTERN = /(?:source|ref|ticket|page|doc)[\s:]*[:=]?\s*[\[«(]?([A-Za-z0-9][A-Za-z0-9._/\-]{2,})/gi;

/** Extrait les citations de la réponse ; vide si l'agent n'en structure pas. */
function extractCitations(text: string): readonly AgentCitation[] {
  const found: AgentCitation[] = [];
  const seen = new Set<string>();
  let match = CITATION_PATTERN.exec(text);
  while (match !== null) {
    const raw = match[1] ?? '';
    // Le corps de réponse peut contenir « source : » sans qu'un identifiant
    // réel suive : on ne garde que ce qui ressemble à un identifiant.
    if (raw && !seen.has(raw.toLowerCase())) {
      seen.add(raw.toLowerCase());
      found.push({ raw, resolved: null, alive: false });
    }
    if (match[0] === '') CITATION_PATTERN.lastIndex += 1;
    match = CITATION_PATTERN.exec(text);
  }
  CITATION_PATTERN.lastIndex = 0;
  return found;
}

/** Ce qui sera fourni en contexte « livre ouvert » (mode noir). */
function contextOf(kase: BancCase, oracle: OracleState, registry: SourceRegistry): string {
  const kinds = kase.oracleSpec.type === 'règle_vivante'
    ? kase.oracleSpec.atoms.map((atom) => atom.query)
    : kase.oracleSpec.type === 'valeur_dérivée' ? [kase.oracleSpec.query] : [];
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const query of kinds) {
    for (const name of ['graph', 'jira', 'confluence', 'jsm'] as const) {
      const adapter = registry.get(name);
      if (!adapter) continue;
      if (seen.has(`${name}:${query}`)) continue;
      seen.add(`${name}:${query}`);
      lines.push(`  [${name}] ${query} → ${JSON.stringify(oracle.value)}`);
    }
  }
  if (lines.length === 0) return '';
  return lines.join('\n');
}

/** Options de l'agent réel. */
export interface RealAgentOptions {
  readonly chat: ChatClient;
  readonly price: PriceModel;
  readonly cases: readonly BancCase[];
  readonly oracles: Readonly<Record<string, OracleState>>;
  readonly registry: SourceRegistry;
  /** Horloge injectée, pour la reproductibilité des journaux. */
  readonly clock?: () => string;
}

/** Construit l'agent réel, au contrat `AgentUnderTest` du banc. */
export function createRealAgent(options: RealAgentOptions): AgentUnderTest {
  const byId = new Map(options.cases.map((item) => [item.id, item]));
  const clock = options.clock ?? systemClock;
  const counters = new Map<string, number>();
  return {
    versionId: 'réel',
    fingerprint: async () => ({
      specHash: hashValue('réel'), promptHash: hashValue('réel'), skills: [], actions: [],
      tools: ['llm:inferhub'], model: 'réel', temperature: 0, capturedAt: clock(),
    }),
    ask: async (question: string, mode: BenchMode): Promise<AgentAnswer> => {
      const started = Date.now();
      const kase = [...byId.values()].find((item) => item.question === question);
      if (!kase) {
        return { text: '', citations: [], latencyMs: 0, tokens: 0, costEstimate: 0, toolCalls: [], sideEffects: [] };
      }
      const oracle = options.oracles[kase.id];
      const passageNo = (counters.get(kase.id) ?? 0) + 1;
      counters.set(kase.id, passageNo);
      const system = [
        'Tu es l\'agent support interne d\'une organisation.',
        'Réponds uniquement à partir des sources fournies ; cite la source de chaque affirmation',
        'au format [source: identifiant]. Si la réponse n\'est pas dans les sources, dis ce qui manque.',
        ...(mode === 'noir' && oracle ? [contextOf(kase, oracle, options.registry)].filter((s) => s) : []),
      ].join(' ');
      const { text, tokens } = await options.chat.complete({ system, user: question });
      const latencyMs = Date.now() - started;
      const costEstimate = (tokens / 1000) * options.price.usdPerThousandTokens;
      return {
        text,
        citations: extractCitations(text),
        latencyMs,
        tokens,
        costEstimate,
        toolCalls: [{ name: 'llm:inferhub', ok: true }],
        sideEffects: [],
      };
    },
  };
}
