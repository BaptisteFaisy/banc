/**
 * Le banc réel exécuté EN DIRECT dans le navigateur.
 *
 * La clé ne quitte jamais le serveur : le navigateur appelle le proxy
 * (r630 derrière le tunnel), et c'est le proxy qui appelle InferHub avec la
 * clé. Le navigateur ne voit que des réponses et des mesures.
 *
 * L'URL du tunnel est éphémère, donc elle est **découverte** (source fraîche,
 * cache, URL cuite) puis **sondée** avant le premier appel, et chaque appel
 * garde la liste des candidates : un tunnel refait en cours de run ne casse
 * pas la mesure. Ce module n'affiche rien : il orchestre `runRealBench`,
 * rapporte la progression, et rend le résultat quand le banc a fini.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { runRealBench } from '../../src/demo/real-bench.js';
import type { RealRunRecord } from '../../src/demo/real-bench.js';
import { proxyAgentFactory } from '../../src/demo/real-agent.js';
import type { ProxyCandidate } from '../../src/demo/proxy-endpoint.js';
import { seededRegistry } from '../../src/demo/sources.js';
import { SEED_CASES } from '../../src/seed/index.js';
import { DEMO_CASE_IDS } from '../../src/demo/real-bench.js';
import { candidatesDuProxy, sonderCandidates, proxyVivant } from './proxy-resolve';

/** État de la découverte du proxy, affiché tel quel (jamais la couleur seule). */
export type EtatProxy = 'inconnu' | 'en-ligne' | 'hors-ligne';

/** Ce que le visiteur doit savoir avant de cliquer : le proxy répond-il ? */
export interface ProxyDiscovery {
  readonly status: EtatProxy;
  readonly url: string | null;
  readonly candidates: readonly ProxyCandidate[];
  readonly refresh: () => Promise<void>;
}

/** Découvre le proxy vivant : sources, ordre, sonde de santé. */
export function useProxyDiscovery(): ProxyDiscovery {
  const [status, setStatus] = useState<EtatProxy>('inconnu');
  const [url, setUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<readonly ProxyCandidate[]>([]);

  const refresh = useCallback(async () => {
    const candidats = await candidatesDuProxy();
    setCandidates(candidats);
    const vivante = await sonderCandidates(candidats);
    setStatus(vivante ? 'en-ligne' : 'hors-ligne');
    setUrl(vivante ? vivante.url : null);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { status, url, candidates, refresh };
}

/** État du banc direct. */
export interface LiveRunState {
  readonly running: boolean;
  readonly progress: { readonly done: number; readonly total: number; readonly caseId: string } | null;
  readonly result: RealRunRecord | null;
  readonly error: string | null;
  readonly proxy: ProxyDiscovery;
}

/** Les cas du banc, dans l'ordre du corpus semé. */
function casDuBanc() {
  return SEED_CASES.filter((item) => (DEMO_CASE_IDS as readonly string[]).includes(item.id));
}

/** Les candidates à utiliser : on resonde si la découverte a échoué. */
async function candidatsPourLeRun(proxy: ProxyDiscovery): Promise<readonly ProxyCandidate[]> {
  if (proxy.candidates.length === 0) {
    const vivante = await proxyVivant();
    if (!vivante) throw new Error('proxy introuvable — aucune URL publiée, ni fraîche ni cuite');
    return [vivante];
  }
  if (proxy.status !== 'hors-ligne') return proxy.candidates;
  const vivante = await proxyVivant();
  if (!vivante) throw new Error('proxy hors ligne — le tunnel du serveur ne répond plus');
  return proxy.candidates;
}

/** Exécute le banc réel en direct, cas après cas. */
export function useLiveRun(): LiveRunState & { start: () => Promise<void> } {
  const proxy = useProxyDiscovery();
  const [state, setState] = useState<Omit<LiveRunState, 'proxy'>>({
    running: false, progress: null, result: null, error: null,
  });
  const enCours = useRef(false);

  const start = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    setState({ running: true, progress: null, result: null, error: null });
    try {
      const candidats = await candidatsPourLeRun(proxy);
      const result = await runRealBench(
        {
          cases: casDuBanc(), registry: seededRegistry(), priceUsdPerThousandTokens: 0.0003,
          model: 'combo/cheap', provider: 'inferhub.dev (via proxy)', passes: 3, mode: 'noir',
          onCasePlayed: (caseId, done, total) => setState((a) => ({ ...a, progress: { done, total, caseId } })),
        },
        proxyAgentFactory({ candidates: candidats, price: { usdPerThousandTokens: 0.0003 } }),
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
  }, [proxy]);

  return { ...state, proxy, start };
}
