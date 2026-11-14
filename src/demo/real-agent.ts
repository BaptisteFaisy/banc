/**
 * L'agent réel : un vrai modèle, qui LIT les sources, appelé et mesuré pour bon.
 *
 * C'est la correction du script. L'ancienne version injectait la valeur de
 * l'oracle dans le prompt (`contextOf` poussait `JSON.stringify(oracle.value)`
 * sur quatre adaptateurs) : d'où 100 % d'exactitude sans mérite, et 0 % de
 * fondation décrété en dur (`resolved: null, alive: false`), donc deux jauges
 * fausses par construction. Le banc qui existe pour attraper les agents qui
 * récitait récitait lui-même.
 *
 * Maintenant : l'agent passe par le circuit de retrieval (`retrieval.ts`) —
 * index des documents réels, demande de fichiers, lecture du corpus scellé,
 * réponse citée. Les citations sont RÉSOLUES contre le corpus : une citation
 * qui ne pointe aucun document réel rend « infondé », une citation vers un
 * document qui ne dit pas la valeur rend « citation non vivante » (§8, jugé
 * par `src/judge/citation.ts`, qui avait déjà la logique — on la lui rend).
 *
 * Ce qui est mesuré, et jamais inventé : latence par tour, jetons par tour,
 * nombre de tours, documents lus, et le FOURNISSEUR qui a réellement servi
 * l'appel (`combo/cheap` est un méta-routeur : il change de modèle d'un appel
 * à l'autre, et c'est une fissure légitime à tracer, pas à cacher).
 *
 * La clé ne vit jamais ici : elle vient de l'environnement (`INFERHUB_API_KEY`)
 * ou du proxy côté navigateur ; la sortie enregistrée ne contient que des
 * réponses et des mesures.
 */
import type {
  AgentAnswer, AgentCitation, AgentUnderTest, BancCase, BenchMode, OracleState, SourceRef,
} from '../domain/vocabulary.js';
import type { SourceRegistry } from '../oracle/deps.js';
import { hashValue } from '../oracle/hash.js';
import { systemClock } from '../oracle/deps.js';
import type { RealCorpus } from '../real/corpus.js';
import { REAL_CORPUS, lireDocument } from '../real/corpus.js';
import type { AgentFactory } from './real-bench.js';
import { withProxyFallback, type ProxyCandidate } from './proxy-endpoint.js';
import { jouerCas, systemeAgent } from './retrieval.js';
import { indexDesSources } from '../real/corpus.js';

/** Plafond d'un passage cité : au-delà, la vérification dit « lecture partielle ». */
export const LIMITE_PASSAGE = 20_000;

/**
 * Délai maximal d'un appel au modèle, en millisecondes.
 *
 * Un méta-routeur peut pendre : sans délai, le run meurt d'un `UND_ERR_HEADERS_TIMEOUT`
 * au bout de dix minutes et la mesure n'existe plus. Avec un délai, l'appel échoue
 * vite, le cas est marqué INCIDENT d'essai (exclu du score, non rejoué k fois) —
 * la panne est attribuée à l'infrastructure, jamais à l'agent (§17).
 */
export const DELAI_APPEL_MS = 90_000;

/** Ce qu'un client de chat OpenAI-compatible doit rendre. */
export interface ChatReply {
  readonly text: string;
  readonly tokens: number;
  /** Latence mesurée de l'appel, en millisecondes. */
  readonly latencyMs?: number;
  /** Le modèle réellement servi par le méta-routeur, s'il est connu. */
  readonly modeleServi?: string;
}

/** Ce qu'un client de chat OpenAI-compatible doit faire. */
export interface ChatClient {
  complete(input: {
    readonly system: string;
    readonly user: string;
  }): Promise<ChatReply>;
}

/** Client InferHub, sans dépendance externe (fetch natif, Node >= 18). */
export function createHttpChatClient(
  baseUrl: string, apiKey: string, model: string,
): ChatClient {
  return {
    complete: async ({ system, user }) => {
      const started = Date.now();
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          temperature: 0,
        }),
        signal: AbortSignal.timeout(DELAI_APPEL_MS),
      });
      const body = await response.json() as {
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number }; model?: string;
      };
      if (!response.ok) {
        throw new Error(`LLM ${response.status} : ${JSON.stringify(body).slice(0, 120)}`);
      }
      return {
        text: body.choices?.[0]?.message?.content ?? '',
        tokens: body.usage?.total_tokens ?? 0,
        latencyMs: Date.now() - started,
        modeleServi: body.model,
      };
    },
  };
}

/**
 * Client qui passe par le proxy (mode direct navigateur) : aucune clé ici.
 *
 * L'URL du proxy est éphémère (tunnel Cloudflare) : le client reçoit une liste
 * ordonnée de candidates et, à CHAQUE appel, prend la première qui répond.
 */
export function createProxyChatClient(candidates: readonly ProxyCandidate[]): ChatClient {
  return {
    complete: async ({ system, user }) => withProxyFallback(candidates, async (base) => {
      const started = Date.now();
      const response = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, user }),
        signal: AbortSignal.timeout(DELAI_APPEL_MS),
      });
      if (!response.ok) {
        throw new Error(`proxy ${response.status} : ${await response.text().catch(() => '')}`);
      }
      const body = (await response.json()) as {
        text?: string; tokens?: number; modeleServi?: string;
      };
      return {
        text: body.text ?? '', tokens: body.tokens ?? 0,
        latencyMs: Date.now() - started, modeleServi: body.modeleServi,
      };
    }),
  };
}

/** Fabrique d'agent pour la ligne serveur (clé en environnement). */
export function httpAgentFactory(input: {
  readonly baseUrl: string; readonly apiKey: string; readonly model: string;
  readonly price: PriceModel; readonly registry: SourceRegistry;
}): AgentFactory {
  return ({ cases, oracles, registry, trace }) => createRealAgent({
    chat: createHttpChatClient(input.baseUrl, input.apiKey, input.model),
    price: input.price, cases, oracles, registry, trace,
  });
}

/** Fabrique d'agent pour le mode direct navigateur (via proxy). */
export function proxyAgentFactory(input: {
  readonly candidates: readonly ProxyCandidate[];
  readonly price: PriceModel;
}): AgentFactory {
  return ({ cases, oracles, registry, trace }) => createRealAgent({
    chat: createProxyChatClient(input.candidates),
    price: input.price, cases, oracles, registry, trace,
  });
}

/** Tarif déclaré : le coût est une estimation affichée, jamais muette (§17). */
export interface PriceModel {
  /** Coût pour 1000 jetons, affiché et commenté. */
  readonly usdPerThousandTokens: number;
}

/** Détecte les citations que l'agent a réellement émises, s'il les structure. */
const CITATION_PATTERN = /\[source:\s*([^\]\s][^\]]*?)\]/gi;

/** Les identifiants cités dans une réponse, sans doublon, dans l'ordre. */
export function citationsBrutes(texte: string): readonly string[] {
  const trouvés: string[] = [];
  for (const match of texte.matchAll(CITATION_PATTERN)) {
    const brut = (match[1] ?? '').trim().replace(/[.,;:]+$/, '');
    if (brut && !trouvés.some((t) => t.toLowerCase() === brut.toLowerCase())) trouvés.push(brut);
  }
  return trouvés;
}

/**
 * Résout une citation contre le corpus RÉEL : le document existe-t-il, et dit-il
 * ce que l'agent avance ? `resolved` porte la référence lue par le juge,
 * `passage` le texte cité, `alive` l'existence du document — l'implication
 * elle-même est tranchée par `src/judge/citation.ts`, pas ici.
 */
export function resoudreCitation(
  brut: string, corpus: RealCorpus,
): AgentCitation {
  const chemin = brut.replace(/^`|`$/g, '');
  const contenu = lireDocument(chemin, corpus);
  if (contenu === undefined) return { raw: brut, resolved: null, alive: false };
  const ref: SourceRef = { kind: 'repo', id: chemin, label: chemin, passage: contenu };
  return {
    raw: brut, resolved: ref, alive: true,
    passage: contenu.slice(0, LIMITE_PASSAGE),
  };
}

/** Les citations d'une réponse, résolues contre le corpus scellé. */
export function citationsRésolues(texte: string, corpus: RealCorpus): readonly AgentCitation[] {
  return citationsBrutes(texte).map((brut) => resoudreCitation(brut, corpus));
}

/** Options de l'agent réel. */
export interface RealAgentOptions {
  readonly chat: ChatClient;
  readonly price: PriceModel;
  readonly cases: readonly BancCase[];
  readonly oracles: Readonly<Record<string, OracleState>>;
  readonly registry: SourceRegistry;
  /** Le corpus réel lu par l'agent ; le corpus capturé par défaut. */
  readonly corpus?: RealCorpus;
  /** Trace de tour : appelé après chaque cas, pour consigner le fournisseur réel. */
  readonly trace?: (caseId: string, tour: TraceTour) => void;
  /** Horloge injectée, pour la reproductibilité des journaux. */
  readonly clock?: () => string;
}

/** Ce qu'un tour d'agent laisse comme trace. */
export interface TraceTour {
  readonly modeleServi?: string;
  readonly tours: number;
  readonly docsLus: readonly string[];
}

/** Construit l'agent réel, au contrat `AgentUnderTest` du banc. */
export function createRealAgent(options: RealAgentOptions): AgentUnderTest {
  const byId = new Map(options.cases.map((item) => [item.id, item]));
  const clock = options.clock ?? systemClock;
  const corpus = options.corpus ?? REAL_CORPUS;
  const base = systemeAgent(indexDesSources(corpus));
  const traces = new Map<string, TraceTour>();
  return {
    versionId: 'réel',
    fingerprint: async () => ({
      specHash: hashValue('réel'), promptHash: hashValue(base), skills: [], actions: [],
      tools: ['llm:inferhub', 'corpus:repo-reel'], model: 'réel', temperature: 0, capturedAt: clock(),
    }),
    ask: async (question: string, mode: BenchMode): Promise<AgentAnswer> => {
      const started = Date.now();
      const kase = [...byId.values()].find((item) => item.question === question);
      if (!kase) {
        return { text: '', citations: [], latencyMs: 0, tokens: 0, costEstimate: 0, toolCalls: [], sideEffects: [] };
      }
      const joué = await jouerCas(options.chat, kase, corpus, mode === 'noir' ? 'noir' : 'blanc', base);
      if (joué.échec) {
        // Un échec de transport est un INCIDENT D'ESSAI : réponse vide, raison
        // déclarée, exclu du score et non rejoué (§17). Jamais un « faux » imputé
        // à l'agent, jamais un chiffre inventé pour que la démo continue.
        return {
          text: '', citations: [], latencyMs: joué.latencyMs, tokens: joué.tokens,
          costEstimate: 0, toolCalls: joué.docsLus.map((doc) => ({ name: `read:${doc}`, ok: false })),
          sideEffects: [], trivialFailure: joué.échec,
        };
      }
      const citations = citationsRésolues(joué.texte, corpus);
      traces.set(kase.id, { modeleServi: joué.modeleServi, tours: joué.tours, docsLus: joué.docsLus });
      options.trace?.(kase.id, traces.get(kase.id) as TraceTour);
      const costEstimate = (joué.tokens / 1000) * options.price.usdPerThousandTokens;
      return {
        text: joué.texte, citations,
        latencyMs: Date.now() - started, tokens: joué.tokens, costEstimate,
        toolCalls: joué.docsLus.map((doc) => ({ name: `read:${doc}`, ok: true })), sideEffects: [],
      };
    },
  };
}

/** Le fournisseur réellement servi au dernier tour d'un cas, s'il est consigné. */
export function modeleDeLaTrace(traces: ReadonlyMap<string, TraceTour>, caseId: string): string | undefined {
  return traces.get(caseId)?.modeleServi;
}
