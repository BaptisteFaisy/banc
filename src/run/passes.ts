/**
 * Passages (§9) et rejets précoces (§17).
 *
 * Un agent n'est pas déterministe : la même question, deux fois, ne donne pas
 * toujours la même réponse. Le banc pose donc chaque cas k fois (3 par défaut)
 * et ne juge jamais sur une réponse isolée.
 *
 * Deux économies imposées par §17 :
 *   - rejet précoce : un cas qui échoue de façon triviale (réponse vide,
 *     erreur d'outil) n'est pas rejoué k fois, il est signalé immédiatement ;
 *   - un agent qui écrit pendant l'essai est disqualifié pour ce cas, avec la
 *     trace (§16) — inutile de payer k passages pour un cas déjà disqualifié.
 */
import type { AgentUnderTest, BancCase, BenchMode, Passage, TestCondition } from '../domain/vocabulary.js';
import { DEFAULT_PASSES } from '../domain/vocabulary.js';
import { hashValue } from '../oracle/hash.js';
import { isTrivialFailure, disqualifiedBySideEffect } from './sideeffects.js';

/** Coût estimé d'un passage, à partir des jetons consommés. */
export interface PriceModel {
  readonly costPerThousandTokens: number;
}

/** Tarif par défaut, affiché et modifiable : le coût est toujours déclaré. */
export const DEFAULT_PRICE: PriceModel = { costPerThousandTokens: 0.01 };

/** Un passage exécuté, avec son empreinte de réponse. */
function toPassage(
  runId: string,
  kase: BancCase,
  passageNo: number,
  answer: Awaited<ReturnType<AgentUnderTest['ask']>>,
  price: PriceModel,
): Passage {
  const tokens = answer.tokens;
  const costEstimate = Number.isFinite(answer.costEstimate) && answer.costEstimate > 0
    ? answer.costEstimate
    : (tokens / 1000) * price.costPerThousandTokens;
  return {
    id: `pass:${runId}:${kase.id}:${passageNo}`,
    runId,
    caseId: kase.id,
    passageNo,
    answerHash: hashValue(answer.text),
    answerRef: `answer:${runId}:${kase.id}:${passageNo}`,
    answer,
    latencyMs: answer.latencyMs,
    tokens,
    costEstimate,
  };
}

/** Options de jeu : identifiant d'essai, mode, condition, tarif, horloge. */
export interface PlayOptions {
  readonly runId: string;
  readonly mode: BenchMode;
  readonly condition?: TestCondition;
  readonly price?: PriceModel;
  readonly maxPasses?: number;
}

/**
 * Pose un cas k fois.
 *
 * S'arrête avant la fin si un passage est un échec trivial ou si un effet de
 * bord est détecté : dans les deux cas le sort du cas est déjà scellé, et
 * rejouer coûterait du budget pour aucune information. Le nombre de passages
 * réellement joués est visible dans le résultat, donc l'arrêt n'est jamais
 * silencieux.
 */
export async function playPasses(
  kase: BancCase,
  passes: number,
  agent: AgentUnderTest,
  options: PlayOptions,
): Promise<{ passages: readonly Passage[]; stoppedEarly: string | null; calls: number }> {
  const wanted = clampPasses(passes, options.maxPasses);
  const price = options.price ?? DEFAULT_PRICE;
  const passages: Passage[] = [];
  let calls = 0;
  for (let index = 1; index <= wanted; index += 1) {
    const answer = await agent.ask(kase.question, options.mode, options.condition);
    calls += 1;
    passages.push(toPassage(options.runId, kase, index, answer, price));
    const stop = stopReason(answer);
    if (stop) return { passages, stoppedEarly: stop, calls };
  }
  return { passages, stoppedEarly: null, calls };
}

/** Raison d'arrêt précoce, ou `null` si le jeu doit continuer. */
function stopReason(answer: Awaited<ReturnType<AgentUnderTest['ask']>>): string | null {
  if (isTrivialFailure(answer)) return 'échec trivial : pas de rejeu (§17)';
  if (disqualifiedBySideEffect(answer)) return 'effet de bord détecté : cas disqualifié (§16)';
  return null;
}

/** Nombre de passages borné : au moins 1, au plus la limite déclarée. */
export function clampPasses(passes: number, max: number = DEFAULT_PASSES * 3): number {
  if (!Number.isFinite(passes) || passes < 1) return DEFAULT_PASSES;
  return Math.min(Math.floor(passes), max);
}
