/**
 * Les sources semées du banc de démonstration, en registre.
 *
 * Ces données sont celles de `src/seed/truth.ts` : le même monde pour toutes
 * les versions testées — c'est la condition d'une comparaison honnête (§5).
 * Deux versions testées à dix minutes d'intervalle voient le même monde.
 *
 * Le registre est construit par `createRegistry()` (`src/oracle/deps.ts`) : le
 * banc ne connaît que cette interface, et un adaptateur réel de Teamwork
 * Graph se branche au même endroit.
 */
import type { SourceAdapter } from '../domain/vocabulary.js';
import { createRegistry } from '../oracle/deps.js';
import type { SourceRegistry } from '../oracle/deps.js';
import { createFixtureAdapter } from '../collect/registry.js';
import { CONFLUENCE_TRUTH, GRAPH_TRUTH, JIRA_TRUTH, JSM_TRUTH } from '../seed/truth.js';

/**
 * Types d'objets dont la lecture exige un droit (§21).
 *
 * La plateforme vide un résultat SANS erreur quand un droit manque : sans
 * cette table, l'écran de santé des oracles afficherait « pas de données » là
 * où il manque une autorisation.
 */
export const SCOPES_BY_SOURCE: Readonly<Record<string, readonly string[]>> = {
  graph: ['software-service', 'work-item', 'test-plan', 'test-run', 'pull-request', 'deployment'],
  jira: ['work-item'],
  confluence: ['document'],
  jsm: ['incident'],
};

/** Droits accordés au lecteur de démonstration. */
export const GRANTED_SCOPES: readonly string[] = [
  'software-service', 'work-item', 'test-plan', 'test-run', 'pull-request',
  'deployment', 'document', 'incident', 'user',
];

/** Le registre des sources semées. */
export function seededRegistry(): SourceRegistry {
  return createRegistry([
    createFixtureAdapter('graph', GRAPH_TRUTH, { grantedScopes: GRANTED_SCOPES, scopesOf: () => SCOPES_BY_SOURCE.graph ?? [] }),
    createFixtureAdapter('jira', JIRA_TRUTH, { grantedScopes: GRANTED_SCOPES, scopesOf: () => SCOPES_BY_SOURCE.jira ?? [] }),
    createFixtureAdapter('confluence', CONFLUENCE_TRUTH, { grantedScopes: GRANTED_SCOPES, scopesOf: () => SCOPES_BY_SOURCE.confluence ?? [] }),
    createFixtureAdapter('jsm', JSM_TRUTH, { grantedScopes: GRANTED_SCOPES, scopesOf: () => SCOPES_BY_SOURCE.jsm ?? [] }),
  ]);
}

/** Les adaptateurs bruts, pour un test qui veut les inspecter. */
export function seededAdapters(): readonly SourceAdapter[] {
  return [
    createFixtureAdapter('graph', GRAPH_TRUTH),
    createFixtureAdapter('jira', JIRA_TRUTH),
    createFixtureAdapter('confluence', CONFLUENCE_TRUTH),
    createFixtureAdapter('jsm', JSM_TRUTH),
  ];
}
