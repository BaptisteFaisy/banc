/**
 * Le banc réel exécuté EN DIRECT dans le navigateur.
 *
 * La clé ne quitte jamais le serveur : le navigateur appelle le proxy
 * (`banc-proxy.json` → r630 derrière le tunnel), et c'est le proxy qui appelle
 * InferHub avec la clé. Le navigateur ne voit que des réponses et des mesures.
 *
 * Ce hook n'affiche rien : il orchestre `runRealBench`, rapporte la
 * progression, et rend le résultat quand le banc a fini.
 */
import { useCallback, useRef, useState } from 'react';
import { runRealBench } from '../../src/demo/real-bench.js';
import type { RealRunRecord } from '../../src/demo/real-bench.js';
import { proxyAgentFactory } from '../../src/demo/real-agent.js';
import { seededRegistry } from '../../src/demo/sources.js';
import { SEED_CASES } from '../../src/seed/index.js';
import { DEMO_CASE_IDS } from '../../src/demo/real-bench.js';

/** État du banc direct. */
export interface LiveRunState {
  readonly running: boolean;
  readonly progress: { readonly done: number; readonly total: number; readonly caseId: string } | null;
  readonly result: RealRunRecord | null;
  readonly error: string | null;
}

/** Lit l'URL du proxy depuis `banc-proxy.json`, déployé avec le site. */
async function proxyUrl(): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}banc-proxy.json`);
  if (!response.ok) throw new Error(`banc-proxy.json ${response.status}`);
  const config = (await response.json()) as { url?: string };
  if (!config.url) throw new Error('banc-proxy.json sans URL');
  return config.url;
}

/** Exécute le banc réel en direct, cas après cas. */
export function useLiveRun(): LiveRunState & { start: () => Promise<void> } {
  const [state, setState] = useState<LiveRunState>({ running: false, progress: null, result: null, error: null });
  const enCours = useRef(false);

  const start = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    setState({ running: true, progress: null, result: null, error: null });
    try {
      const url = await proxyUrl();
      const cases = SEED_CASES.filter((item) => (DEMO_CASE_IDS as readonly string[]).includes(item.id));
      const result = await runRealBench(
        {
          cases, registry: seededRegistry(), priceUsdPerThousandTokens: 0.0003,
          model: 'combo/cheap', provider: 'inferhub.dev (via proxy)', passes: 3, mode: 'noir',
          onCasePlayed: (caseId, done, total) => setState((avant) => ({ ...avant, progress: { done, total, caseId } })),
        },
        proxyAgentFactory({ proxyUrl: url, price: { usdPerThousandTokens: 0.0003 } }),
      );
      setState({ running: false, progress: null, result, error: null });
    } catch (erreur) {
      setState({
        running: false, progress: null, result: null,
        error: erreur instanceof Error ? erreur.message : 'échec du banc direct',
      });
    } finally {
      enCours.current = false;
    }
  }, []);

  return { ...state, start };
}
