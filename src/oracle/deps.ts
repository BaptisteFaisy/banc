/**
 * Ports d'injection du module oracle — le pur et l'impur sont séparés.
 *
 * Le recalcul des oracles lit les systèmes de l'organisation (graphe, Jira,
 * Confluence, JSM). Ces lectures sont impures : elles passent par des ports
 * injectés ici, avec des implémentations en mémoire pour les tests. Un test
 * du banc ne fait jamais d'appel réseau.
 *
 * Point de vigilance imposé par la plateforme (§21) : le graphe est lu au nom
 * d'un utilisateur et un droit manquant **vide le résultat sans erreur**.
 * `SourceRead.denied` existe pour que le banc distingue « pas de droit » de
 * « pas de données » au lieu d'afficher un oracle mort sans cause.
 */
import type { SourceAdapter } from '../domain/vocabulary.js';

/** Registre des adaptateurs de source disponibles sur ce site. */
export interface SourceRegistry {
  get(name: string): SourceAdapter | undefined;
  names(): readonly string[];
}

/** Lecteur de chemin : `readPath(value, 'a.b[0].c')`. */
export type PathReader = (value: unknown, path: string) => unknown;

/** Cache par empreinte de contenu (§23) : les oracles recalculés sont coûteux. */
export interface CachePort {
  get(key: string): Promise<unknown | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

/** Horloge injectée : un essai se rejoue à l'identique (§25 reproductibilité). */
export type Clock = () => string;

/** Construit un registre à partir d'une liste d'adaptateurs. */
export function createRegistry(adapters: readonly SourceAdapter[]): SourceRegistry {
  const byName = new Map<string, SourceAdapter>();
  for (const adapter of adapters) byName.set(adapter.name, adapter);
  return {
    get: (name) => byName.get(name),
    names: () => [...byName.keys()],
  };
}

/** Découpe un chemin en segments : `a.b[0].c` → ['a','b','0','c']. */
function pathSegments(path: string): readonly string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Lecture défensive d'un chemin : rend `undefined` quand le chemin est absent,
 * sans jamais lever. Distingue l'absence (`undefined`) du `null` explicite :
 * une source qui répond `null` a répondu, une source muette n'a pas répondu.
 */
export function readPathSimple(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const segment of pathSegments(path)) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Cache en mémoire, pour les tests et le banc de démonstration. */
export function createMemoryCache(): CachePort {
  const store = new Map<string, unknown>();
  return {
    get: async (key) => store.get(key),
    put: async (key, value) => {
      store.set(key, value);
    },
  };
}

/** Horloge système ; remplacée par une horloge fixe dans les tests. */
export const systemClock: Clock = () => new Date().toISOString();
