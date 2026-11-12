/**
 * Lecture des sources (§6.1, §21, §24) — la seule couche qui parle au monde.
 *
 * Trois contraintes de la plateforme structurent ce module :
 *   1. le Teamwork Graph est lu **au nom d'un utilisateur** : un droit manquant
 *      vide le résultat SANS erreur. `SourceRead.denied` existe pour que le
 *      banc distingue « pas de droit » de « pas de données », au lieu
 *      d'afficher un oracle mort sans cause (§21) ;
 *   2. les sorties réseau sont limitées (100 requêtes/min par runtime) : le
 *      cache par empreinte de contenu n'est pas une optimisation, c'est une
 *      nécessité (§23) ;
 *   3. un test du banc ne fait jamais d'appel réseau : les adaptateurs sont
 *      injectés, et des adaptateurs en mémoire sont fournis pour le banc de
 *      démonstration (§29).
 */
import type { SourceAdapter, SourceRead, SourceRef } from '../domain/vocabulary.js';
import { systemClock } from '../oracle/deps.js';
import type { Clock } from '../oracle/deps.js';

/** Dépendances d'un adaptateur : un client de lecture, rien d'autre. */
export interface SourceDeps {
  /** Rend le document/objet brut pour une requête, ou `undefined` si absent. */
  fetch?(query: string): Promise<unknown | undefined>;
  /** Les droits accordés à l'utilisateur courant, par type d'objet. */
  grantedScopes?: readonly string[];
  /** Types d'objet que la requête touche : sert à détecter un droit manquant. */
  scopesOf?: (query: string) => readonly string[];
  readonly clock?: Clock;
}

/** Une source factice : un dictionnaire requête → valeur. */
export type FixtureMap = Readonly<Record<string, unknown>>;

/** Résultat vide, avec la distinction droit manquant / pas de données. */
function denied(clock: Clock, scopes: readonly string[]): SourceRead {
  return { ok: false, value: null, denied: true, sourceRefs: [], readAt: clock(), error: `droit manquant : ${scopes.join(', ')}` };
}

/** Résultat « pas de données », distinct d'un droit manquant. */
function empty(clock: Clock): SourceRead {
  return { ok: true, value: null, denied: false, sourceRefs: [], readAt: clock() };
}

/**
 * Crée un adaptateur à partir d'un jeu de données fixe.
 *
 * C'est la forme utilisée par le banc de démonstration et par tous les tests :
 * les mêmes données pour toutes les versions testées, ce qui est exactement la
 * condition d'une comparaison honnête (§5).
 */
export function createFixtureAdapter(name: SourceAdapter['name'], fixtures: FixtureMap, deps: SourceDeps = {}): SourceAdapter {
  const clock = deps.clock ?? systemClock;
  return {
    name,
    read: async (query) => {
      const scopes = deps.scopesOf?.(query) ?? [];
      if (deps.grantedScopes && scopes.some((scope) => !deps.grantedScopes?.includes(scope))) {
        return denied(clock, scopes);
      }
      if (!(query in fixtures)) return empty(clock);
      const value = fixtures[query];
      return { ok: true, value, denied: false, sourceRefs: refsOf(name, query), readAt: clock() };
    },
    resolve: async (ref) => {
      const key = ref.id;
      if (!(key in fixtures)) {
        return { ok: false, value: null, denied: false, sourceRefs: [], readAt: clock(), error: 'source introuvable' };
      }
      return { ok: true, value: fixtures[key], denied: false, sourceRefs: [ref], readAt: clock() };
    },
  };
}

/** Références de source produites par une lecture : ce que la fondation cite. */
export function refsOf(name: SourceAdapter['name'], query: string): readonly SourceRef[] {
  return [{ kind: name, id: query, label: query }];
}

/** Registre d'adaptateurs : le banc ne connaît que cette interface. */
export function createSourceRegistry(adapters: readonly SourceAdapter[]): Map<string, SourceAdapter> {
  return new Map(adapters.map((adapter) => [adapter.name, adapter]));
}

/** Adaptateur de graphe (Teamwork Graph, lecture GraphQL Preview — §24). */
export function createGraphAdapter(fixtures: FixtureMap, deps: SourceDeps = {}): SourceAdapter {
  return createFixtureAdapter('graph', fixtures, deps);
}

/** Adaptateur Jira (JQL, `work-item`). */
export function createJiraAdapter(fixtures: FixtureMap, deps: SourceDeps = {}): SourceAdapter {
  return createFixtureAdapter('jira', fixtures, deps);
}

/** Adaptateur Confluence (`document`, date de version). */
export function createConfluenceAdapter(fixtures: FixtureMap, deps: SourceDeps = {}): SourceAdapter {
  return createFixtureAdapter('confluence', fixtures, deps);
}

/** Adaptateur JSM (incidents ouverts sur un service). */
export function createJsmAdapter(fixtures: FixtureMap, deps: SourceDeps = {}): SourceAdapter {
  return createFixtureAdapter('jsm', fixtures, deps);
}
