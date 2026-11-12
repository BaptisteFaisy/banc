/**
 * oracle/hash.ts — Empreintes SHA-256 pour le banc d'essai d'agents.
 *
 * L'empreinte sert à deux choses :
 *  (a) détecter la dérive de vérité : si la sérialisation stable d'une valeur
 *      observée change, son empreinte change et la dérive est signalée ;
 *  (b) invalider un essai dont la configuration d'agent a changé en cours de
 *      route : l'empreinte de spécification (`hashSpec`) est insensible à
 *      l'ordre de déclaration (clés et listes triées) mais sensible au
 *      contenu — un modèle, une température ou un prompt différent produit
 *      une empreinte différente, ce qui invalide l'essai.
 *
 * La sérialisation est stable : les clés d'objet sont triées alphabétiquement
 * à tous les niveaux, les tableaux gardent leur ordre, `undefined` et les
 * fonctions sont ignorés dans les objets (et valent `null` dans les tableaux,
 * comme `JSON.stringify`).
 */

import { createHash } from 'node:crypto';

import type { SpecFingerprint } from '../domain/vocabulary.js';

/** Sérialise une valeur primitive de façon déterministe. */
function serialisePrimitive(value: string | number | boolean | null): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }
  return String(value);
}

/** Sérialise un tableau : l'ordre des éléments est préservé. */
function serialiseArray(value: readonly unknown[]): string {
  const items = value.map((item) =>
    item === undefined || typeof item === 'function' ? 'null' : serialiseStable(item),
  );
  return `[${items.join(',')}]`;
}

/** Sérialise un objet : clés triées alphabétiquement, undefined/fonctions ignorés. */
function serialiseObject(value: Record<string, unknown>): string {
  const entries: string[] = [];
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined || typeof item === 'function') {
      continue;
    }
    entries.push(`${JSON.stringify(key)}:${serialiseStable(item)}`);
  }
  return `{${entries.join(',')}}`;
}

/**
 * Sérialisation JSON stable : deux objets sémantiquement identiques mais
 * écrits dans un ordre de clés différent produisent exactement la même chaîne.
 */
export function serialiseStable(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (value === undefined || typeof value === 'function') {
      return 'null';
    }
    return serialisePrimitive(value as string | number | boolean);
  }
  if (Array.isArray(value)) {
    return serialiseArray(value);
  }
  return serialiseObject(value as Record<string, unknown>);
}

/** SHA-256 hexadécimal de la sérialisation stable d'une valeur. */
export function hashValue(value: unknown): string {
  return createHash('sha256').update(serialiseStable(value)).digest('hex');
}

/** Objet dérivé de l'empreinte de spécification, exactement les champs exigés. */
interface SpecHashPayload {
  readonly promptHash: string;
  readonly skills: readonly { readonly key: string; readonly hash: string }[];
  readonly actions: readonly string[];
  readonly tools: readonly string[];
  readonly model: string;
  readonly temperature: number;
}

/** Construit le contenu trié soumis à l'empreinte de spécification. */
function specPayload(spec: SpecFingerprint): SpecHashPayload {
  const skills = [...spec.skills]
    .map((skill) => ({ key: skill.key, hash: skill.hash }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    promptHash: spec.promptHash,
    skills,
    actions: [...spec.actions].sort(),
    tools: [...spec.tools].sort(),
    model: spec.model,
    temperature: spec.temperature,
  };
}

/**
 * SHA-256 hexadécimal de l'empreinte de spécification. Le tri des listes et
 * des clés rend l'empreinte insensible à l'ordre de déclaration.
 */
export function hashSpec(spec: SpecFingerprint): string {
  return hashValue(specPayload(spec));
}

/** Préfixe de `hashValue`, pour les affichages courts. */
export function shortHash(value: unknown, length = 12): string {
  return hashValue(value).slice(0, length);
}
