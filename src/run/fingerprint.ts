/**
 * Empreinte de spécification (§13) : savoir ce qu'on teste.
 *
 * Un agent n'est pas un objet, c'est un assemblage : prompt, skills, actions,
 * outils MCP, modèle, température. Tester « l'agent » sans dire lequel est un
 * non-sens. L'empreinte est donc stockée avec l'essai, et la version est
 * identifiée par empreinte — JAMAIS par le nom (§26 : deux agents peuvent
 * porter le même nom).
 *
 * Conséquence directe : si l'agent a changé PENDANT que le banc tournait,
 * l'essai est invalidé et aucun résultat n'est attribué à une version qui
 * n'était pas celle testée.
 */
import type { SpecFingerprint } from '../domain/vocabulary.js';
import { hashValue } from '../oracle/hash.js';

/** Ce qui change entre deux empreintes (l'horodatage n'en fait pas partie). */
export type FingerprintField = 'promptHash' | 'model' | 'temperature' | 'skills' | 'actions' | 'tools';

/** Champs comparés, dans l'ordre d'affichage du motif d'invalidation. */
const COMPARED_FIELDS: readonly FingerprintField[] = [
  'promptHash', 'model', 'temperature', 'skills', 'actions', 'tools',
];

/** Empreinte réduite aux champs qui caractérisent l'agent. */
export function fingerprintFields(f: SpecFingerprint): Readonly<Record<FingerprintField, string>> {
  return {
    promptHash: f.promptHash,
    model: f.model,
    temperature: String(f.temperature),
    // Listes triées : l'ordre de déclaration n'est pas une caractéristique.
    skills: hashValue([...f.skills].map((s) => `${s.key}:${s.hash}`).sort()),
    actions: hashValue([...f.actions].sort()),
    tools: hashValue([...f.tools].sort()),
  };
}

/** Empreinte canonique d'une version : deux empreintes égales = même version. */
export function canonicalHash(f: SpecFingerprint): string {
  return hashValue(fingerprintFields(f));
}

/** Même version d'agent, à l'horodatage de capture près. */
export function isSameVersion(a: SpecFingerprint, b: SpecFingerprint): boolean {
  return canonicalHash(a) === canonicalHash(b);
}

/** Résultat de la comparaison début/fin d'essai. */
export interface FingerprintDrift {
  readonly drifted: boolean;
  readonly changedFields: readonly FingerprintField[];
  readonly reason?: string;
}

/** Compare l'empreinte de début d'essai à celle de fin. */
export function checkFingerprintDrift(start: SpecFingerprint, end: SpecFingerprint): FingerprintDrift {
  const before = fingerprintFields(start);
  const after = fingerprintFields(end);
  const changed = COMPARED_FIELDS.filter((field) => before[field] !== after[field]);
  if (changed.length === 0) return { drifted: false, changedFields: [] };
  return {
    drifted: true,
    changedFields: changed,
    reason: `configuration modifiée en cours d'essai : ${changed.join(', ')}`,
  };
}

/** Motif d'invalidation d'un essai, ou `undefined` si l'empreinte n'a pas bougé. */
export function invalidateRunReason(drift: FingerprintDrift): string | undefined {
  return drift.drifted ? drift.reason ?? 'configuration modifiée en cours d\'essai' : undefined;
}
