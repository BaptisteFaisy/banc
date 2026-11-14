/**
 * Déclaration TypeScript du parseur YAML minimaliste (`mini-yaml.mjs`).
 *
 * Le garde du manifeste (`tools/check-manifest.mjs`) et les dérivations du
 * corpus réel (`src/real/derive.ts`) lisent le même YAML avec la même
 * implémentation : une seule source de vérité, jamais deux analyseurs qui
 * pourraient diverger sur le même fichier. D'où ce fichier de déclaration à
 * côté du JavaScript, plutôt qu'une réécriture en TypeScript.
 *
 * Limites (les mêmes que le parseur) : indentation par espaces, suites « - »,
 * scalaires simples ou quotés, blocs pliés/littéraux, listes en flux. Pas
 * d'ancres, pas d'alias, pas de documents multiples.
 */

/** Un jeton de ligne : son indentation, son texte, sa ligne brute. */
export interface YamlToken {
  readonly indent: number;
  readonly text: string;
  readonly raw: string;
}

/** Retire un commentaire « # … » hors guillemets. */
export function stripComment(line: string): string;
/** Découpe le texte en jetons, commentaires et lignes vides ôtés. */
export function tokenize(text: string): YamlToken[];
/** Enlève les guillemets simples ou doubles d'un scalaire. */
export function unquote(text: string): string;
/** Convertit un scalaire YAML (booléen, nombre, null, chaîne quotée). */
export function parseScalar(text: string): unknown;
/** Sépare `clé: valeur` ; `null` si la ligne n'est pas un mapping. */
export function splitKey(text: string): [string, string] | null;
/** Parse un document YAML complet : mapping, suite ou scalaire. */
export function parseMiniYaml(text: string): unknown;
