// src/db/schema.ts — assemblage du schéma Forge SQL du banc d'essai d'agents.
// Le DDL vit dans schema-tables.ts (16 CREATE TABLE) et schema-indexes.ts
// (CREATE INDEX) pour rester sous la limite de 500 lignes par fichier.
// Confidentialité encodée dans le DDL : `pass` ne stocke que answer_ref +
// answer_hash (jamais le texte de la réponse), `scorecard` aucune colonne de
// texte libre, et `case.space_key` confine chaque cas à l'espace du banc.
import { SCHEMA, TABLES, assertSchemaComplete, tableOf } from './schema-tables.js';
import { INDEXES } from './schema-indexes.js';

/** SCHEMA puis INDEXES, dans cet ordre. */
export const DDL: readonly string[] = SCHEMA.concat(INDEXES);

export { INDEXES, SCHEMA, TABLES, assertSchemaComplete, tableOf };
