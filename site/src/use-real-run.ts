/**
 * Charge la mesure d'un banc RÉEL, enregistrée côté serveur.
 *
 * La clé InferHub ne vit jamais dans le bundle : le banc a été joué côté
 * serveur (`npm run demo:real`) et c'est SA MESURE qui est publiée, dans
 * `site/public/real-run.json`. Ici, on ne fait que la charger et la servir —
 * aucune clé, aucun appel réseau vers le modèle.
 */
import { useEffect, useState } from 'react';
import type { RealRunRecord } from '../../src/demo/real-bench.js';

export type { RealRunRecord };

/** État du chargement de la mesure réelle. */
export interface RealRunState {
  readonly run: RealRunRecord | null;
  readonly loading: boolean;
  readonly error: string | null;
}

/** Charge une fois, au montage, la mesure réelle enregistrée. */
export function useRealRun(): RealRunState {
  const [state, setState] = useState<RealRunState>({ run: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}real-run.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<RealRunRecord>;
      })
      .then((run) => {
        if (!cancelled) setState({ run, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            run: null, loading: false,
            error: error instanceof Error ? error.message : 'mesure absente',
          });
        }
      });
    return () => { cancelled = true; };
  }, []);
  return state;
}
