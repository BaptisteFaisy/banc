/**
 * L'intégrité du rapport : une empreinte du corps, pas de la page (§18).
 *
 * Un rapport d'essai est une pièce d'audit : s'il est modifiable sans que
 * rien ne le signale, il ne vaut rien. Le digest est donc calculé sur une
 * sérialisation CANONIQUE du corps (clés triées récursivement) : le même
 * contenu produit la même empreinte, et la moindre retouche produit une
 * autre. La clé est celle du dépôt (`src/oracle/sha256.ts`) — pas de
 * seconde implémentation de SHA-256 dans le projet.
 */
import { sha256Hex } from '../oracle/sha256.js';

/** Sérialise une valeur de façon canonique : clés triées, ordre stable. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const body = entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',');
  return `{${body}}`;
}

/** L'empreinte SHA-256 d'un corps, en hexadécimal. */
export function digestOf(body: unknown): string {
  return sha256Hex(new TextEncoder().encode(canonicalJson(body)));
}
