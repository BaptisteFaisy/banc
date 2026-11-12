/**
 * Point d'entrée des actions Forge (§21).
 *
 * Une action dure 55 s : elle ne fait jamais un essai entier, elle crée
 * l'essai, en joue une tranche, et rend la progression. La suite passe par le
 * `consumer` (900 s par tranche, avec curseur).
 *
 * Les quatre entrées appelées par le manifeste :
 *   `main`         l'action générique des outils MCP ;
 *   `resolver`     le resolver UI Kit 2 des douze écrans ;
 *   `consumeRunSlice` le consommateur d'essais longs ;
 *   `ciSmoke`      le point d'entrée externe (CI, hooks d'agents).
 */
import type { BenchMode } from '../domain/vocabulary.js';
import { screenData, emptyScreen } from './resolver.js';
import type { ScreenId } from './resolver.js';
import { runSmoke } from './triggers.js';
import { nextSlice } from './consumer.js';

/** Ce qu'une action reçoit de la plateforme. */
export interface ActionInput {
  readonly screen?: string;
  readonly agentId?: string;
  readonly version?: string;
  readonly caseId?: string;
  readonly runId?: string;
  readonly mode?: BenchMode;
  readonly suite?: string;
  readonly passes?: number;
}

/** Ce qu'une action rend. */
export interface ActionOutput {
  readonly ok: boolean;
  readonly data: Readonly<Record<string, unknown>>;
}

/** L'action générique : elle lit, elle ne calcule rien. */
export async function main(input: ActionInput): Promise<ActionOutput> {
  const screen = (input.screen ?? 'bench') as ScreenId;
  if (!input.agentId && !input.caseId && !input.runId) {
    return { ok: false, data: { ...emptyScreen(screen, 'aucun agent, cas ni essai identifié') } };
  }
  return { ok: true, data: { ...screenData(screen, { agentId: input.agentId ?? null, version: input.version ?? null }) } };
}

/** Le resolver UI : les définitions des écrans (§20). */
export async function resolver(input: ActionInput): Promise<ActionOutput> {
  return main(input);
}

/** Le consommateur d'essais longs : une tranche de 900 s, avec curseur (§17). */
export async function consumeRunSlice(input: ActionInput & { totalCases?: number }): Promise<ActionOutput> {
  const total = input.totalCases ?? 0;
  const slice = nextSlice({
    run: {
      id: input.runId ?? 'run-inconnu', agentVersionId: input.agentId ?? '', suiteId: input.suite ?? '',
      mode: input.mode ?? 'blanc', passes: input.passes ?? 3, startedAt: new Date().toISOString(),
      state: 'sliced', budget: { calls: 0, tokens: 0, costEstimate: 0, limitCalls: 0, limitTokens: 0, limitCost: 0, exhausted: false },
      conditionHash: '',
    },
    suite: { id: input.suite ?? '', name: '', kind: 'full', caseIds: [], version: 1, updatedAt: '' },
    mode: input.mode ?? 'blanc',
  }, total);
  return {
    ok: true,
    data: {
      from: slice.from, to: slice.to, finished: slice.finished,
      // Une tranche est un segment : le consumer est rappelé sur la suite.
      resume: slice.finished ? null : 'consumer',
    },
  };
}

/** Le point d'entrée externe : la fumée, pour la CI et les hooks d'agents (§21). */
export async function ciSmoke(input: ActionInput): Promise<ActionOutput> {
  const decision = runSmoke({ ...(input.agentId ? { agentId: input.agentId } : {}), ...(input.version ? { version: input.version } : {}) });
  return { ok: decision.runSuite !== 'none', data: { ...decision } };
}

export { onCaseCreated, onIssueLinked, onAgentVersionChanged, runSmoke, runFullSuite, watchOracleHealth } from './triggers.js';
export { validatePromotion, refusalMessage, acceptanceMessage } from './validator.js';
export { SCREENS, screenTitle, screenData, emptyScreen, scorecardGauges } from './resolver.js';
export { nextSlice, stopReason, sliceSeconds } from './consumer.js';
