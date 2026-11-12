/**
 * La démonstration, calculée par le banc, dans le navigateur.
 *
 * Le site ne recopie aucun chiffre : il exécute le vrai moteur — recalcul des
 * oracles, trois passages par cas, les huit jauges, les fissures, la
 * scorecard, la porte de promotion — sur le vrai corpus de 40 cas. Ce que
 * l'écran affiche est la sortie du produit, pas une illustration.
 *
 * Le calcul est fait UNE fois, au montage, et partagé par toutes les sections
 * qui parlent de mesure.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { runDemo } from '../../src/demo/run.js';
import { factsFrom } from './demo-facts.js';
import type { DemoFacts } from './demo-facts.js';

/** L'état de la démonstration dans le navigateur. */
export interface DemoState {
  readonly facts: DemoFacts | null;
  readonly loading: boolean;
  readonly error: string | null;
}

/** La démonstration partagée par toutes les sections. */
const DemoContext = createContext<DemoState>({ facts: null, loading: true, error: null });

/** Fournit la démonstration à l'arbre des sections. */
export function DemoProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [state, setState] = useState<DemoState>({ facts: null, loading: true, error: null });
  useEffect(() => {
    let annule = false;
    runDemo()
      .then((demo) => {
        if (!annule) setState({ facts: factsFrom(demo), loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!annule) {
          setState({ facts: null, loading: false, error: error instanceof Error ? error.message : 'échec du calcul' });
        }
      });
    return () => { annule = true; };
  }, []);
  const value = useMemo(() => state, [state]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** La démonstration courante : les faits, ou `null` pendant le calcul. */
export function useDemo(): DemoState {
  return useContext(DemoContext);
}

/** Les faits, ou `null` : les sections doivent savoir distinguer « vide » de « pas encore calculé ». */
export function useDemoFacts(): DemoFacts | null {
  return useContext(DemoContext).facts;
}
