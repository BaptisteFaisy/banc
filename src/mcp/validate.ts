/**
 * Validation des entrées des outils MCP (§19).
 *
 * Un payload invalide est refusé AVANT tout accès aux données : une requête
 * malformée ne doit jamais déclencher de lecture sur les systèmes de
 * l'organisation, ni produire un résultat vide qui passerait pour une réponse.
 */
import type { McpInput, McpToolDef } from './tools.js';

/** Une erreur de validation, avec le champ en cause. */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
}

/** Résultat de validation : les entrées typées, ou les erreurs. */
export type ValidationResult =
  | { readonly ok: true; readonly values: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

/** Vérifie une entrée déclarée. */
function checkInput(input: McpInput, payload: Record<string, unknown>): ValidationError | null {
  const value = payload[input.name];
  if (value === undefined || value === null || value === '') {
    return input.required ? { field: input.name, message: `${input.name} est obligatoire` } : null;
  }
  if (input.type === 'integer') {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) return { field: input.name, message: `${input.name} doit être un entier` };
    if (numeric < 1) return { field: input.name, message: `${input.name} doit valoir au moins 1` };
    return null;
  }
  if (input.type === 'enum' && input.values && !input.values.includes(String(value))) {
    return { field: input.name, message: `${input.name} doit valoir l'un de : ${input.values.join(', ')}` };
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return { field: input.name, message: `${input.name} doit être une chaîne` };
  }
  return null;
}

/** Valide un payload contre la définition d'un outil. */
export function validatePayload(def: McpToolDef, payload: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  for (const input of def.inputs) {
    const error = checkInput(input, payload);
    if (error) errors.push(error);
  }
  // `propose-case` accepte `issueKey` OU `question` : au moins un des deux.
  if (def.key === 'propose-case' && !payload.issueKey && !payload.question) {
    errors.push({ field: 'issueKey', message: 'issueKey ou question est obligatoire' });
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, values: keepDeclared(def, payload) };
}

/** Ne conserve que les entrées déclarées : le reste est ignoré, pas deviné. */
function keepDeclared(def: McpToolDef, payload: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const input of def.inputs) {
    if (payload[input.name] !== undefined) values[input.name] = payload[input.name];
  }
  return values;
}

/** Message d'erreur lisible, pour un commentaire de PR ou un écran. */
export function describeErrors(errors: readonly ValidationError[]): string {
  return errors.map((error) => `${error.field} : ${error.message}`).join(' · ');
}
