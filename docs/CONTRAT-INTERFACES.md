# Points d'entrée inter-modules — signatures figées

Le domaine (`src/domain/vocabulary.ts`) fixe les **types**. Ce fichier fixe les
**fonctions** que les modules se fournissent entre eux. Elles sont écrites ici
pour que le travail soit parallélisable sans collision : chaque module
implémente exactement ces signatures, et n'en appelle pas d'autres que celles-ci.

Règle : un module n'importe d'un autre module **que** ce qui est écrit ici.
Tout besoin supplémentaire passe en PR avec la signature proposée.

Conventions communes :

- imports relatifs terminés par `.js` ;
- types importés depuis `../domain/vocabulary.js` ;
- aucune fonction au-delà de 50 lignes, aucun fichier au-delà de 500 lignes ;
- l'impur (réseau, SQL, LLM) est injecté, jamais appelé directement : les
  fonctions pures reçoivent leurs données et rendent un verdict.

---

## `src/collect/` — lecture des sources (impur, isolé)

```ts
// src/collect/registry.ts
export interface SourceRegistry {
  get(name: 'graph' | 'jira' | 'confluence' | 'jsm'): SourceAdapter | undefined;
  names(): readonly string[];
}
export function createRegistry(adapters: readonly SourceAdapter[]): SourceRegistry;

// src/collect/graph.ts, jira.ts, confluence.ts : un adaptateur par source
export function createGraphAdapter(deps: GraphDeps): SourceAdapter;
export function createJiraAdapter(deps: JiraDeps): SourceAdapter;
export function createConfluenceAdapter(deps: ConfluenceDeps): SourceAdapter;

// src/collect/path.ts — lecture d'un chemin dans une réponse (`a.b[0].c`)
export function readPath(value: unknown, path: string): unknown;

// src/collect/cache.ts — cache par empreinte de contenu (§23 problemes-caches)
export interface OracleCache {
  get(key: string): Promise<unknown | undefined>;
  put(key: string, value: unknown): Promise<void>;
}
export function createCache(backend: CacheBackend): OracleCache;

// src/collect/llm.ts — LLM hébergé : implication d'une citation, proposition de cas
export interface ImplicationDeps { ask(prompt: string, text: string): Promise<string> }
export function checkImplication(deps: ImplicationDeps, passage: string, claim: string): Promise<boolean>;
export function proposeCase(deps: ImplicationDeps, issueKey: string, raw: string): Promise<ProposedCase>;
```

`ProposedCase` est défini **dans `src/collect/llm.ts`** (seul endroit) :
`{ question, oracleType, oracleSpec, gravity, confidence, needsHumanReview: true }`.

---

## `src/oracle/` — la vérité, recalculée (pur sauf lecture de sources)

```ts
// src/oracle/recompute.ts — oracle « valeur dérivée » (§6.1)
export async function recomputeOracle(
  kase: BancCase, registry: SourceRegistry, cache?: OracleCache,
): Promise<OracleState>;

// src/oracle/rule.ts — oracle « règle vivante » (§6.2)
export async function evaluateRule(
  spec: RuleOracleSpec, registry: SourceRegistry,
): Promise<{ outcome: RuleOutcome | null; alive: boolean; deadReason?: DeadOracleReason }>;

// src/oracle/refusal.ts — oracle « refus attendu » (§6.3)
export function classifyRefusal(
  spec: RefusalOracleSpec, answer: AgentAnswer,
): { refused: boolean; namedMissing: readonly string[]; missingNotNamed: readonly string[]; partial: boolean };

// src/oracle/hash.ts — empreinte de valeur et de spécification (SHA-256)
export function hashValue(value: unknown): string;
export function hashSpec(spec: SpecFingerprint): string;

// src/oracle/normalise.ts — comparaison normalisée avec tolérances déclarées (§8)
export function normalise(value: unknown, tolerance?: Tolerance): string;
export function valuesEqual(a: unknown, b: unknown, tolerance?: Tolerance): boolean;

// src/oracle/drift.ts — historique de vérité : dérive ≠ régression (§7)
export function detectDrift(
  previous: OracleState | undefined, current: OracleState,
): { drifted: boolean; from?: string; to?: string; at: string };

// src/oracle/health.ts — morts, dérives, couverture (§6.4)
export function oracleHealth(
  states: readonly OracleState[], cases: readonly BancCase[], scope: string,
): OracleHealth;
```

---

## `src/judge/` — les huit jauges (§8), une par fichier, fonctions pures

```ts
// src/judge/index.ts — le seul point d'entrée du module
export interface JudgeInput {
  kase: BancCase;
  passage: Passage;
  oracle: OracleState;
  mode: BenchMode;
  citationsResolved: readonly AgentCitation[];
  implication?: (passage: string, claim: string) => Promise<boolean>;
}
export async function judgePassage(input: JudgeInput): Promise<readonly Verdict[]>;

// les huit implémentations, chacune retournant un Verdict (ou null si non applicable)
export function judgeExactitude(i: JudgeInput): Verdict | null;      // exactitude.ts
export function judgeFondation(i: JudgeInput): Verdict | null;       // fondation.ts
export async function judgeCitationVivante(i: JudgeInput): Promise<Verdict | null>; // citation.ts
export function judgeRule(i: JudgeInput): Verdict | null;            // rule.ts
export function judgeRefus(i: JudgeInput): Verdict | null;           // refusal.ts
export function judgeCompletude(i: JudgeInput): Verdict | null;      // completeness.ts
export function judgeCout(i: JudgeInput): Verdict | null;            // cost.ts
// la stabilité est calculée sur l'ensemble des passages, pas sur un passage :
export function judgeStabilite(passages: readonly Passage[], verdicts: readonly Verdict[]): Fissure | null; // stability.ts
```

Règles du jugement (§8, §26) : une jauge non applicable à la forme d'oracle du
cas rend `null` et n'entre pas dans le score ; un oracle mort rend `null` avec
le motif « invérifiable », **jamais** un échec ; répondre à un cas à refus est
pénalisé plus lourdement que répondre mal.

---

## `src/run/` — le moteur d'essai (§9, §12, §13, §16, §17)

```ts
// src/run/runner.ts — une tranche d'essai (900 s max, avec curseur)
export interface RunDeps {
  agent: AgentUnderTest;
  registry: SourceRegistry;
  conditions: ConditionStore;
  clock: () => string;
}
export async function runSlice(run: Run, cases: readonly BancCase[], deps: RunDeps): Promise<SliceResult>;
// SliceResult = { passages, verdicts, fissures, budget, state, cursor, invalidatedReason? }

// src/run/passes.ts — k passages, rejet précoce d'un échec trivial (§17)
export async function playPasses(kase: BancCase, k: number, agent: AgentUnderTest,
  mode: BenchMode, condition?: TestCondition): Promise<readonly Passage[]>;

// src/run/fissure.ts — fissure et attribution (§9)
export function detectFissure(caseId: string, versionId: string,
  passages: readonly Passage[], verdicts: readonly Verdict[], oracleStable: boolean): Fissure | null;

// src/run/condition.ts — instantané figé et horodaté (§12, §16)
export interface ConditionStore {
  capture(caseId: string, mode: BenchMode, registry: SourceRegistry): Promise<TestCondition>;
  load(id: string): Promise<TestCondition | undefined>;
}
export function createConditionStore(backend: KvBackend, clock: () => string): ConditionStore;

// src/run/fingerprint.ts — empreinte et invalidation en cours d'essai (§13)
export function checkFingerprintDrift(start: SpecFingerprint, end: SpecFingerprint):
  { drifted: boolean; reason?: string };

// src/run/budget.ts — budget affiché et respecté (§17)
export function chargeBudget(used: BudgetUsage, calls: number, tokens: number, cost: number): BudgetUsage;
export function budgetExhausted(used: BudgetUsage): boolean;

// src/run/sideeffects.ts — surveillance des écritures (§16)
export function detectSideEffects(answer: AgentAnswer): readonly SideEffect[];
export function disqualifiedBySideEffect(answer: AgentAnswer): boolean;

// src/run/log.ts — journal rejouable (§4, §18)
export function runLogEntry(run: Run, event: string, detail: Record<string, unknown>): RunLogEntry;
```

`RunLogEntry`, `SliceResult`, `KvBackend` sont définis dans `src/run/log.ts`,
`src/run/runner.ts` et `src/run/condition.ts` respectivement — un seul endroit.

---

## `src/score/` — ce que le banc annonce (§7, §8, §11, §15)

```ts
// src/score/interval.ts — effectif et fourchette ; sous MIN_SAMPLE : null
export function wilsonInterval(successes: number, n: number): { low: number; high: number } | null;
export function enoughData(n: number): boolean;

// src/score/scorecard.ts — scorecard d'une version (§20 écran 2)
export function buildScorecard(input: {
  agentVersionId: string; suiteId: string; mode: BenchMode;
  verdicts: readonly Verdict[]; oracleStates: readonly OracleState[];
  witness?: { versionId: string; rows: readonly ScorecardRow[] };
  budget: BudgetUsage; floors: Readonly<Record<Gauge, number>>;
}): Scorecard;

// src/score/regression.ts — régression de l'agent OU dérive de vérité (§7)
export function classifyDelta(input: {
  caseId: string; gauge: Gauge; candidate: number; baseline: number;
  oracleDrifted: boolean; driftEvidence?: { from: string; to: string; at: string };
}): Regression | null;

// src/score/promotion.ts — la porte (§11) : quatre règles, motifs explicites
export function checkPromotion(input: {
  agentId: string; candidateVersion: string; scorecard: Scorecard;
  witnessScorecard?: Scorecard; regressions: readonly Regression[];
  blockingCases: readonly BancCase[]; amorcesFailed: readonly string[];
  floors: Readonly<Record<Gauge, number>>; budget: BudgetUsage;
}): PromotionVerdict;

// src/score/calibration.ts — accord auto/humain (§15)
export function agreement(pairs: readonly { auto: VerdictKind; human: VerdictKind }[]): number | null;
export function calibrate(input: { scope: string; gauge: Gauge;
  pairs: readonly { auto: VerdictKind; human: VerdictKind }[];
  interJudge?: readonly { a: VerdictKind; b: VerdictKind }[];
  threshold?: number }): Calibration;

// src/score/jury.ts — échantillon tiré au sort (§15), tirage reproductible
export function sampleForJury(cases: readonly BancCase[], size: number, seed: string): readonly BancCase[];

// src/score/stability.ts — stabilité d'une version (§9)
export function stabilityRate(fissures: readonly Fissure[], caseCount: number): { rate: number | null; n: number };

// src/score/floors.ts — planchers par jauge, une seule source
export const GAUGE_FLOORS: Readonly<Record<Gauge, number>>;
```

---

## `src/db/` — Forge SQL (§22), un fichier par table

```ts
// src/db/sql-client.ts — interface ; src/db/stub.ts — stub mémoire pour les tests
export interface SqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
}
export function createStubSql(schema?: readonly string[]): SqlClient;   // src/db/stub.ts

// src/db/schema.ts — les 16 tables du §22, en DDL Forge SQL
export const SCHEMA: readonly string[];

// src/db/repo.ts — le seul point d'accès aux données pour les autres modules
export interface BancRepo {
  cases: CaseRepo; agents: AgentRepo; versions: VersionRepo; runs: RunRepo;
  verdicts: VerdictRepo; oracles: OracleRepo; suites: SuiteRepo;
  judgments: JudgmentRepo; budgets: BudgetRepo; regressions: RegressionRepo;
}
export function createRepo(sql: SqlClient): BancRepo;
```

Chaque `*Repo` est défini dans son fichier `src/db/<table>.ts` et ré-exporté par
`src/db/repo.ts`. Le mapping ligne SQL ↔ type du domaine vit dans
`src/db/mapping*.ts` (un par famille), jamais dans les requêtes.

---

## `src/mcp/` — les 12 outils (§19)

```ts
// src/mcp/tools.ts — définitions (clé, verbe, entrées, retour) lues par le manifeste
export const MCP_TOOLS: readonly McpToolDef[];
// src/mcp/handlers.ts — baril ; un fichier par outil : src/mcp/<clé>.ts
export function createMcpHandlers(repo: BancRepo, deps: McpDeps): Record<string, McpHandler>;
export type McpHandler = (payload: Record<string, unknown>) => Promise<unknown>;
```

Un outil **ne calcule rien** : il lit le dépôt et appelle `src/score/` ou
`src/run/`. Aucun outil n'expose le contenu d'un cas à un agent non autorisé
(filtrage par espace du banc et droits du lecteur).

---

## `src/i18n/` — français et anglais (§25)

```ts
export type Locale = 'fr' | 'en';
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string;
```

Un seul fichier de clés par langue (`fr.ts`, `en.ts`) + un fichier par famille
(`gauges.ts`, `verdicts.ts`, `ui.ts`) si le volume l'exige. Toute chaîne visible
par un utilisateur passe par `t()`.
