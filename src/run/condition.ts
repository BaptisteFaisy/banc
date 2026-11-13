/**
 * Condition d'essai (§12, §16) : l'instantané du contexte fourni à l'agent.
 *
 * Pour comparer honnêtement, il faut fixer le contexte. L'instantané est donc
 * figé et horodaté : deux versions de l'agent testées à dix minutes
 * d'intervalle reçoivent le MÊME instantané. Sans ça, le banc comparerait
 * deux agents sur deux mondes différents — exactement ce que §5 interdit.
 *
 * Deux modes, toujours rapportés séparément :
 *   blanc (livre fermé)  le banc fournit l'instantané, on mesure le raisonnement ;
 *   noir  (livre ouvert)  l'agent cherche lui-même, on mesure la chaîne complète.
 * L'écart entre les deux dit si le problème est la récupération ou le
 * raisonnement — un diagnostic que personne n'offre aujourd'hui.
 */
import type { BenchMode, TestCondition } from '../domain/vocabulary.js';
import { hashValue, serialiseStable } from '../oracle/hash.js';
import { systemClock } from '../oracle/deps.js';

/** Stockage clé/valeur injecté (Forge KVS en production, mémoire en test). */
export interface KvBackend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

/** Magasin de conditions d'essai. */
export interface ConditionStore {
  capture(caseId: string, mode: BenchMode, snapshot: unknown): Promise<TestCondition>;
  load(id: string): Promise<TestCondition | undefined>;
}

/** Backend mémoire, pour les tests et le banc de démonstration. */
export function createMemoryKv(): KvBackend {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key),
    set: async (key, value) => {
      store.set(key, value);
    },
  };
}

/** Clé déterministe : le même contenu au même mode donne la même clé. */
export function snapshotKey(caseId: string, mode: BenchMode): string {
  return `banc:condition:${mode}:${caseId}`;
}

/** Empreinte du contexte vide, en mode noir. */
const EMPTY_HASH = hashValue('');

/** Deux conditions portent-elles le même instantané ? */
export function sameCondition(a: TestCondition, b: TestCondition): boolean {
  return a.snapshotHash === b.snapshotHash && a.mode === b.mode;
}

/** Crée un magasin de conditions, horloge injectée pour la reproductibilité. */
export function createConditionStore(backend: KvBackend, clock: () => string = systemClock): ConditionStore {
  return {
    capture: async (caseId, mode, snapshot) => capture(backend, clock, caseId, mode, snapshot),
    load: async (id) => load(backend, id),
  };
}

/** Capture l'instantané : figé en mode blanc, absent en mode noir. */
async function capture(
  backend: KvBackend,
  clock: () => string,
  caseId: string,
  mode: BenchMode,
  snapshot: unknown,
): Promise<TestCondition> {
  if (mode === 'noir') {
    return {
      id: snapshotKey(caseId, mode),
      caseId,
      snapshotHash: EMPTY_HASH,
      snapshotRef: 'aucun_contexte_fourni',
      capturedAt: clock(),
      mode,
    };
  }
  const serialised = serialiseStable(snapshot ?? null);
  const hash = hashValue(serialised);
  const id = snapshotKey(caseId, mode);
  await backend.set(id, serialised);
  return { id, caseId, snapshotHash: hash, snapshotRef: id, capturedAt: clock(), mode };
}

/** Relit une condition capturée. */
async function load(backend: KvBackend, id: string): Promise<TestCondition | undefined> {
  const raw = await backend.get(id);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as TestCondition;
  } catch {
    return undefined;
  }
}
