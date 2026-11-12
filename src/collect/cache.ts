/**
 * Cache par empreinte de contenu (§23, réutilisation de `problemes-caches`).
 *
 * Les oracles recalculés coûtent des lectures réseau, et la plateforme limite
 * les sorties à 100 requêtes/min par runtime (§24). Le cache n'est donc pas
 * une optimisation de confort : sans lui, un essai complet ne passe pas.
 *
 * Règle de sécurité : un oracle MORT n'est jamais mis en cache. Une source
 * absente aujourd'hui peut être branchée demain, et un banc qui met en cache
 * son ignorance afficherait un oracle mort indéfiniment.
 */
import type { CachePort } from '../oracle/deps.js';
import { hashValue } from '../oracle/hash.js';

/** Backend de cache : Forge KVS en production, mémoire en test. */
export interface CacheBackend {
  read(key: string): Promise<string | undefined>;
  write(key: string, value: string): Promise<void>;
}

/** Backend mémoire. */
export function createMemoryCacheBackend(): CacheBackend {
  const store = new Map<string, string>();
  return {
    read: async (key) => store.get(key),
    write: async (key, value) => {
      store.set(key, value);
    },
  };
}

/** Statistiques de cache : le banc affiche ce qu'il économise (§17). */
export interface CacheStats {
  hits: number;
  misses: number;
  skippedDead: number;
}

/** Cache avec empreinte de contenu et statistiques. */
export interface ContentCache extends CachePort {
  stats(): CacheStats;
  /** Ne met en cache que si la valeur est vivante. */
  putIfAlive(key: string, value: unknown, alive: boolean): Promise<void>;
}

/** Crée un cache par empreinte de contenu. */
export function createCache(backend: CacheBackend = createMemoryCacheBackend()): ContentCache {
  const store = new Map<string, unknown>();
  const stats: CacheStats = { hits: 0, misses: 0, skippedDead: 0 };
  return {
    get: async (key) => {
      const direct = store.get(key);
      if (direct !== undefined) {
        stats.hits += 1;
        return direct;
      }
      const raw = await backend.read(key);
      if (raw === undefined) {
        stats.misses += 1;
        return undefined;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        store.set(key, parsed);
        stats.hits += 1;
        return parsed;
      } catch {
        stats.misses += 1;
        return undefined;
      }
    },
    put: async (key, value) => {
      store.set(key, value);
      await backend.write(key, JSON.stringify(value));
    },
    putIfAlive: async (key, value, alive) => {
      if (!alive) {
        stats.skippedDead += 1;
        return; // un oracle mort n'est jamais mis en cache
      }
      store.set(key, value);
      await backend.write(key, JSON.stringify(value));
    },
    stats: () => ({ ...stats }),
  };
}

/** Clé de cache d'un oracle : empreinte de ce qui le définit. */
export function oracleCacheKey(parts: Record<string, unknown>): string {
  return `oracle:${hashValue(parts)}`;
}

/** Clé de cache d'une vérification d'implication (LLM, §24). */
export function implicationCacheKey(passage: string, claim: string): string {
  return `implication:${hashValue({ passage, claim })}`;
}
