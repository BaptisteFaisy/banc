/**
 * Implémentation des douze outils MCP (§19).
 *
 * Un outil ne calcule RIEN : il valide ses entrées, vérifie les droits du
 * lecteur, lit le dépôt, appelle `src/score/` ou `src/run/`, et met en forme.
 * Toute la logique de mesure vit ailleurs — c'est ce qui permet de tester la
 * porte de promotion sans MCP, et le MCP sans Forge.
 *
 * `run-bench` est le seul outil qui déclenche un calcul lourd, et il ne le
 * termine jamais dans l'appel : une action Forge dure 55 s (§21), donc
 * l'outil crée l'essai, joue une tranche, et rend identifiant + progression +
 * budget consommé. La suite passe par le `consumer`.
 */
import type { BancCase, Scorecard, Verdict } from '../domain/vocabulary.js';
import type { Caller } from './guard.js';
import { assertCanReadBench, deniedResponse, filterCases, BENCH_SPACE } from './guard.js';
import { MCP_TOOLS, toolDef } from './tools.js';
import type { McpToolDef } from './tools.js';
import { validatePayload, describeErrors } from './validate.js';
import type { BancStore } from './store.js';

/** Ce qu'un outil rend : des données, ou une erreur explicite. */
export type McpResult = Record<string, unknown>;

/** Un handler d'outil. */
export type McpHandler = (payload: Record<string, unknown>) => Promise<McpResult>;

/** Dépendances des handlers : le magasin de données et le lecteur courant. */
export interface McpDeps {
  readonly store: BancStore;
  readonly caller?: Caller;
}

/** Erreur d'outil, avec un code lisible (jamais un contenu vide ambigu). */
function failure(code: string, message: string): McpResult {
  return { error: message, code };
}

/** `get-case` : la plaque d'un cas et son historique de vérité. */
async function getCase(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const caseId = String(payload.caseId);
  const kase = await deps.store.cases.byId(caseId);
  if (!kase) return failure('cas_introuvable', `aucun cas ${caseId}`);
  const visible = filterCases(deps.caller, [kase]);
  if (visible.length === 0) return failure('accès_refusé', `le cas ${caseId} n'est pas dans les droits du lecteur`);
  const history = await deps.store.oracles.history(caseId);
  return {
    case: kase,
    truthHistory: history.map((state) => ({
      versionNo: state.versionNo, computedAt: state.computedAt,
      valueHash: state.valueHash, alive: state.alive, deadReason: state.deadReason ?? null,
    })),
  };
}

/** `list-cases` : corpus filtré, borné aux droits du lecteur. */
async function listCases(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const cases = await deps.store.cases.list({
    ...(payload.gravity ? { gravity: String(payload.gravity) } : {}),
    ...(payload.tag ? { tag: String(payload.tag) } : {}),
    ...(payload.oracleType ? { oracleType: String(payload.oracleType) } : {}),
    spaceKey: BENCH_SPACE,
  });
  const visible = filterCases(deps.caller, cases);
  const suite = payload.suite ? await deps.store.suiteOf(String(payload.suite), visible) : visible;
  return { count: suite.length, cases: suite.map(publicCase) };
}

/** Ce qu'un lecteur autorisé voit d'un cas (jamais l'oracle brut en clair). */
function publicCase(kase: BancCase): McpResult {
  return {
    id: kase.id, question: kase.question, oracleType: kase.oracleType,
    gravity: kase.gravity, tags: kase.tags, disabled: Boolean(kase.disabledAt),
  };
}

/** `get-scorecard` : jauges, effectifs, fourchettes, écarts au témoin. */
async function getScorecard(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const agentId = String(payload.agentId);
  const version = payload.version ? String(payload.version) : undefined;
  const card = await deps.store.scorecardOf(agentId, version);
  if (!card) return failure('aucun_essai', `aucune scorecard pour ${agentId}${version ? ` v${version}` : ''}`);
  return { ...summariseScorecard(card), deadOracleRate: card.deadOracleRate, budget: card.budget };
}

/** Résume une scorecard : aucune jauge sans son effectif ni son plancher. */
export function summariseScorecard(card: Scorecard): McpResult {
  return {
    agentVersionId: card.agentVersionId,
    suiteId: card.suiteId,
    mode: card.mode,
    witnessVersionId: card.witnessVersionId ?? null,
    generatedAt: card.generatedAt,
    gauges: card.rows.map((row) => ({
      gauge: row.gauge,
      n: row.n,
      value: row.value,
      // Sous l'effectif : « pas assez de recul », jamais un pourcentage (§8).
      status: row.value === null ? 'pas_assez_de_recul' : row.value < row.floor ? 'sous_plancher' : 'ok',
      ci: row.ciLow === null || row.ciHigh === null ? null : [row.ciLow, row.ciHigh],
      floor: row.floor,
    })),
    deltasToWitness: card.deltas.map((delta) => ({
      gauge: delta.gauge, delta: delta.delta, kind: delta.kind, belowFloor: delta.belowFloor,
    })),
  };
}

/** `list-regressions` : cas régressés, avec réponse, oracle et sources. */
async function listRegressions(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const result = await deps.store.regressionsBetween(
    String(payload.agentId), String(payload.fromVersion), String(payload.toVersion),
  );
  return {
    regressions: result.regressions.map((item) => ({
      caseId: item.caseId, gauge: item.gauge, delta: item.delta, kind: item.kind,
    })),
    // La distinction centrale du produit (§7) : la dérive n'est pas une faute.
    truthDrifts: result.drifts.map((item) => ({
      caseId: item.caseId, gauge: item.gauge, evidence: item.truthEvidence ?? null,
    })),
    count: result.regressions.length,
  };
}

/** `compare-versions` : diff de verdicts et fissures communes. */
async function compareVersions(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const diff = await deps.store.compareVersions(
    String(payload.agentId), String(payload.versionA), String(payload.versionB),
  );
  return diff;
}

/** `check-promotion` : le verdict de la porte et ses motifs. */
async function checkPromotion(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const verdict = await deps.store.promotionOf(String(payload.agentId), String(payload.candidateVersion));
  if (!verdict) return failure('aucun_essai', 'aucune mesure pour cette version : la porte ne peut pas conclure');
  return {
    allowed: verdict.allowed,
    candidateVersion: verdict.candidateVersion,
    witnessVersion: verdict.witnessVersion ?? null,
    motives: verdict.motives.map((motive) => ({
      rule: motive.rule, passed: motive.passed, detail: motive.detail,
      caseIds: motive.caseIds ?? [], gauges: motive.gauges ?? [],
    })),
    evaluatedAt: verdict.evaluatedAt,
  };
}

/** `get-stability` : taux de fissures et cas instables. */
async function getStability(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const stability = await deps.store.stabilityOf(String(payload.agentId), payload.version ? String(payload.version) : undefined);
  return stability;
}

/** `get-oracle-health` : morts, dérives, couverture. */
async function getOracleHealth(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const health = await deps.store.oracleHealthOf(payload.scope ? String(payload.scope) : BENCH_SPACE);
  return health as unknown as McpResult;
}

/** `propose-case` : cas proposé, oracle candidat, toujours à valider. */
async function proposeCase(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const source = payload.issueKey ? `ticket ${String(payload.issueKey)}` : 'question libre';
  const proposed = await deps.store.proposeCase(
    payload.issueKey ? String(payload.issueKey) : undefined,
    payload.question ? String(payload.question) : undefined,
  );
  // Le banc ne décide jamais seul de la vérité : la validation humaine est requise.
  return { ...proposed, origin: source, needsHumanReview: true };
}

/** `record-judgment` : vote humain du jury. */
async function recordJudgment(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const recorded = await deps.store.recordJudgment({
    caseId: String(payload.caseId),
    verdict: String(payload.verdict) as Verdict['kind'],
    notes: String(payload.notes),
    judgeRef: deps.caller?.accountId ?? 'inconnu',
  });
  return recorded;
}

/** `get-run-log` : journal rejouable. */
async function getRunLog(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const log = await deps.store.runLogOf(String(payload.runId));
  if (!log) return failure('essai_introuvable', `aucun essai ${String(payload.runId)}`);
  return log;
}

/** `run-bench` : crée l'essai, joue une tranche, rend progression et budget. */
async function runBench(deps: McpDeps, payload: McpResult): Promise<McpResult> {
  const started = await deps.store.startRun({
    agentId: String(payload.agentId),
    suite: String(payload.suite) as 'smoke' | 'full',
    ...(payload.passes ? { passes: Number(payload.passes) } : {}),
  });
  return {
    runId: started.runId,
    state: started.state,
    progress: started.progress,
    budgetUsed: started.budget,
    // Une action dure 55 s : la suite de l'essai passe par le consumer (§21).
    resumedBy: started.state === 'sliced' ? 'consumer' : null,
  };
}

/** Table d'aiguillage clé → implémentation. */
const HANDLERS: Readonly<Record<string, (deps: McpDeps, payload: McpResult) => Promise<McpResult>>> = {
  'run-bench': runBench,
  'get-scorecard': getScorecard,
  'list-regressions': listRegressions,
  'compare-versions': compareVersions,
  'get-case': getCase,
  'list-cases': listCases,
  'check-promotion': checkPromotion,
  'get-stability': getStability,
  'get-oracle-health': getOracleHealth,
  'propose-case': proposeCase,
  'record-judgment': recordJudgment,
  'get-run-log': getRunLog,
};

/** Crée les handlers des douze outils, avec garde d'autorisation et validation. */
export function createMcpHandlers(deps: McpDeps): Readonly<Record<string, McpHandler>> {
  const handlers: Record<string, McpHandler> = {};
  for (const def of MCP_TOOLS) {
    handlers[def.key] = (payload) => invoke(def, deps, payload);
  }
  return handlers;
}

/** Invoque un outil : droits, validation, puis traitement. */
async function invoke(def: McpToolDef, deps: McpDeps, payload: Record<string, unknown>): Promise<McpResult> {
  try {
    assertCanReadBench(deps.caller);
  } catch (error) {
    return deniedResponse(error);
  }
  const checked = validatePayload(def, payload);
  if (!checked.ok) return failure('entrées_invalides', describeErrors(checked.errors));
  const handler = HANDLERS[def.key];
  if (!handler) return failure('outil_inconnu', `outil ${def.key} non implémenté`);
  return handler(deps, checked.values);
}

/** Les clés d'outils effectivement câblées (garde de contrat). */
export function wiredTools(): readonly string[] {
  return Object.keys(HANDLERS).filter((key) => toolDef(key) !== undefined);
}
