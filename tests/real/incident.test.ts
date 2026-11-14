/**
 * Une panne d'infrastructure n'est pas une faute de l'agent (§17, §6.4).
 *
 * Le premier run du corpus réel est mort à dix minutes sur un appel pendu
 * (`UND_ERR_HEADERS_TIMEOUT`) : aucun délai n'était borné, donc la mesure
 * entière n'existait plus. Deux corrections, et elles se valsent :
 *
 *   1. chaque appel porte un délai (`DELAI_APPEL_MS`) — il échoue vite ;
 *   2. l'échec de transport rend une réponse vide AVEC raison déclarée, que le
 *      juge lit comme un INCIDENT d'essai : exclu du score, non rejoué k fois,
 *      et jamais compté comme une réponse fausse de l'agent.
 *
 * Un banc qui impute ses propres pannes à l'agent évalué produit des scores
 * plus bas que la vérité — exactement le défaut qu'il existe pour débusquer.
 */
import { describe, it, expect } from 'vitest';
import { recomputeOracle } from '../../src/oracle/recompute.js';
import { evaluateRuleForCase } from '../../src/oracle/rule.js';
import { createRealAgent, DELAI_APPEL_MS, type ChatClient } from '../../src/demo/real-agent.js';
import { playPasses } from '../../src/run/passes.js';
import { judgePassage } from '../../src/judge/index.js';
import { DEMO_CASES } from '../../src/demo/real-bench.js';
import { registreReel } from '../../src/real/adapter.js';
import type { BancCase, OracleState } from '../../src/domain/vocabulary.js';

/** Un client qui pend puis échoue : la panne du monde réel, reproduite. */
function clientEnPanne(erreur: string): ChatClient {
  return {
    complete: async () => { throw new Error(erreur); },
  };
}

/** L'oracle recalculé d'un cas réel. */
async function oracleDe(kase: BancCase): Promise<OracleState> {
  return recomputeOracle(kase, registreReel(), { ruleEvaluator: evaluateRuleForCase, versionNo: 1 });
}

describe('appel borné : un méta-routeur qui pend ne tue pas le run', () => {
  it('le délai est déclaré, fini, et raisonnable pour un vrai modèle', () => {
    expect(Number.isFinite(DELAI_APPEL_MS)).toBe(true);
    expect(DELAI_APPEL_MS).toBeGreaterThan(10_000);
    expect(DELAI_APPEL_MS).toBeLessThanOrEqual(180_000);
  });

  it('la panne remonte comme raison déclarée, jamais comme une réponse', async () => {
    const kase = DEMO_CASES.find((item) => item.id === 'RD-01') as BancCase;
    const oracle = await oracleDe(kase);
    const agent = createRealAgent({
      chat: clientEnPanne('Headers Timeout Error'), price: { usdPerThousandTokens: 0.0003 },
      cases: DEMO_CASES, oracles: { [kase.id]: oracle }, registry: registreReel(),
    });
    const réponse = await agent.ask(kase.question, 'noir');
    expect(réponse.text).toBe('');
    expect(réponse.trivialFailure).toMatch(/transport/);
    expect(réponse.tokens).toBe(0);
    expect(réponse.costEstimate).toBe(0);
  });

  it('le juge rend INCIDENT, pas FAUX : la panne n’est pas imputée à l’agent', async () => {
    const kase = DEMO_CASES.find((item) => item.id === 'RD-01') as BancCase;
    const oracle = await oracleDe(kase);
    const agent = createRealAgent({
      chat: clientEnPanne('Headers Timeout Error'), price: { usdPerThousandTokens: 0.0003 },
      cases: DEMO_CASES, oracles: { [kase.id]: oracle }, registry: registreReel(),
    });
    const joué = await playPasses(kase, 3, agent, { runId: 'test:panne', mode: 'noir' });
    const passage = joué.passages[0] as (typeof joué.passages)[number];
    const verdicts = (await judgePassage({
      kase, passage, oracle, mode: 'noir', citationsResolved: [],
    })).filter((verdict) => verdict.gauge === 'exactitude');
    expect(verdicts.map((verdict) => verdict.kind)).toContain('incident');
    expect(verdicts.map((verdict) => verdict.kind)).not.toContain('faux');
    // §17 : un échec trivial ne se rejoue pas trois fois — un seul passage, pas trois.
    expect(joué.passages).toHaveLength(1);
  });
});
