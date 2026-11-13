/**
 * Les constantes de la démonstration.
 *
 * Ce fichier ne contient AUCUNE mesure. Les scorecards, les portes, les
 * régressions, la dérive et la fissure sont CALCULÉS par le vrai moteur au
 * chargement de la page (voir `demo-context.tsx` et `demo-facts.ts`) : le site
 * ne peut plus dériver du banc qu'il décrit.
 *
 * Ce qui reste ici, ce sont les faits stables : les seuils importés du
 * produit lui-même, la composition du corpus, et le libellé des versions.
 */
import { GAUGE_CEILINGS, GAUGE_FLOORS, PROMOTION_STABILITY_FLOOR } from '../../src/score/floors.js';
import { DEFAULT_PASSES, MIN_SAMPLE } from '../../src/domain/reporting.js';
import type { BudgetUsage } from '../../src/domain/vocabulary.js';

/** La suite jouée par la démonstration. */
export const DEMO_SUITE_ID = 'suite-gold';

/** Le mode d'essai : livre ouvert — l'agent cherche lui-même (§12). */
export const DEMO_MODE = 'noir' as const;

/** L'instant de la mesure affichée. */
export const COMPUTED_AT = '2026-11-12T09:00:00Z';

/** Effectif minimal sous lequel une jauge affiche « pas assez de recul » (§8). */
export const SAMPLE_MINIMUM = MIN_SAMPLE;

/** Passages joués par cas : on ne juge jamais sur une réponse isolée (§9). */
export const PASSES = DEFAULT_PASSES;

/** La barre de stabilité à la promotion : plus stricte que le plancher (§9). */
export const GATE_STABILITY_FLOOR = PROMOTION_STABILITY_FLOOR;

/** Le plafond de coût affiché. */
export const COST_CEILING = GAUGE_CEILINGS['coût'] ?? 1;

/** Les planchers des jauges, venus du produit. */
export { GAUGE_FLOORS };

/** Une version de démonstration, décrite pour le lecteur. */
export interface VersionInfo {
  readonly id: string;
  readonly label: string;
  readonly role: string;
  readonly temperature: number;
  readonly headline: string;
  readonly changes: string;
}

/** Les trois versions semées : le témoin et deux candidats (§29). */
export const VERSIONS: readonly VersionInfo[] = [
  {
    id: 'v4',
    label: 'v4',
    role: 'Witness — the frozen reference',
    temperature: 0.2,
    headline: 'The reference version. Every other version is compared to it.',
    changes: 'Prompt asks for sources and for what is missing. Skill before-promoting-an-agent v4.',
  },
  {
    id: 'v5',
    label: 'v5',
    role: 'Candidate',
    temperature: 0.2,
    headline: 'Breaks 2 blocking cases, loses grounding.',
    changes: 'The prompt was shortened: the "cite every claim" instruction is gone. Skill unchanged.',
  },
  {
    id: 'v6',
    label: 'v6',
    role: 'Candidate',
    temperature: 0.9,
    headline: 'Repairs grounding, breaks stability.',
    changes: 'Prompt back to the v4 wording, skill moves to v6 — and the temperature goes from 0.2 to 0.9.',
  },
];

/** Budget de l'essai de démonstration : affiché, plafonné, jamais muet (§17). */
export const DEMO_BUDGET: BudgetUsage = {
  calls: 120,
  tokens: 412_000,
  costEstimate: 6.4,
  limitCalls: 120,
  limitTokens: 420_000,
  limitCost: 7,
  exhausted: false,
};
