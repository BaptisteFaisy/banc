/**
 * Vocabulaire du produit — baril du domaine.
 *
 * Tout le dépôt importe ses types d'ici : `import type { BancCase } from
 * '../domain/vocabulary.js'`. Le baril ré-exporte les cinq modules du
 * domaine, découpés pour tenir la garde des 500 lignes par fichier :
 *
 * | Module        | Contenu                                                        |
 * |---------------|----------------------------------------------------------------|
 * | `kinds.ts`    | énumérations primitives, sans dépendance (§4)                  |
 * | `oracles.ts`  | les trois formes d'oracle et l'état de vérité (§6, §7)         |
 * | `entities.ts` | cas, condition, suite, empreinte, agent, version (§4, §10, §13)|
 * | `results.ts`  | réponses, passages, verdicts, fissures, essai (§9, §16, §17)   |
 * | `reporting.ts`| scorecards, porte, jury, calibrage, sources (§8, §11, §15)     |
 *
 * Un concept a exactement UN type et un seul module le définit. Ajouter un
 * type ailleurs que dans le domaine, ou en redéfinir un ici, casse le contrat
 * partagé : les écrans, les outils MCP et le moteur parlent la même langue
 * précisément parce qu'ils partagent ces définitions.
 */
export * from './kinds.js';
export * from './oracles.js';
export * from './entities.js';
export * from './results.js';
export * from './reporting.js';
