/**
 * Le modèle de données (§22) : 16 tables, et deux règles de confidentialité
 * que le schéma doit rendre visibles par leur forme même.
 */
import { describe, it, expect } from 'vitest';
import { TABLES, SCHEMA, INDEXES, DDL, tableOf, assertSchemaComplete } from '../../src/db/schema.js';

/** Les seize tables du §22, dans l'ordre. */
const SPEC_TABLES = [
  'agent', 'agent_version', 'case', 'oracle_state', 'condition', 'suite', 'run', 'pass',
  'verdict', 'scorecard', 'regression', 'fissure', 'judgment', 'calibration', 'amorce', 'budget',
];

describe('modèle de données (§22)', () => {
  it('déclare exactement les seize tables attendues', () => {
    expect(TABLES).toEqual(SPEC_TABLES);
    expect(new Set(TABLES).size).toBe(16);
  });

  it('une instruction CREATE par table, syntaxiquement complète', () => {
    expect(SCHEMA.length).toBe(16);
    for (const statement of SCHEMA) {
      expect(statement.startsWith('CREATE TABLE IF NOT EXISTS')).toBe(true);
      expect(statement.trimEnd().endsWith(')')).toBe(true);
    }
  });

  it('chaque table a une clé primaire', () => {
    for (const name of TABLES) {
      const ddl = tableOf(name) ?? '';
      expect(ddl, `clé primaire de ${name}`).toContain('PRIMARY KEY');
    }
  });

  it('les clés composites sont composites', () => {
    expect(tableOf('oracle_state')).toContain('case_id, version_no');
    expect(tableOf('calibration')).toContain('scope, gauge');
    expect(tableOf('budget')).toContain('scope, period');
  });

  it('indexe les colonnes de recherche', () => {
    const joined = INDEXES.join('\n');
    for (const column of ['case_id', 'run_id', 'agent_version_id', 'gauge', 'suite_id', 'space_key']) {
      expect(joined, `index sur ${column}`).toContain(column);
    }
  });

  it('DDL = SCHEMA puis INDEXES', () => {
    expect(DDL.length).toBe(SCHEMA.length + INDEXES.length);
    expect(DDL.slice(0, SCHEMA.length)).toEqual(SCHEMA);
  });

  it('tableOf renvoie le DDL d\'une table, undefined pour une table inconnue', () => {
    expect(tableOf('case')).toContain('space_key');
    expect(tableOf('table_inconnue')).toBeUndefined();
  });

  it('le schéma est complet', () => {
    expect(assertSchemaComplete()).toEqual([]);
  });

  it('la table pass porte une RÉFÉRENCE et une EMPREINTE, jamais le texte de la réponse', () => {
    const ddl = tableOf('pass') ?? '';
    expect(ddl).toContain('answer_ref');
    expect(ddl).toContain('answer_hash');
    expect(ddl).not.toContain('answer_text');
    expect(ddl).not.toMatch(/\banswer\s/);
    expect(ddl).not.toContain('response');
  });

  it('la table scorecard ne contient aucun texte libre', () => {
    const ddl = tableOf('scorecard') ?? '';
    for (const forbidden of ['notes', 'answer', 'question', 'text']) {
      expect(ddl, `colonne interdite ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('la table case porte l\'espace du banc', () => {
    expect(tableOf('case')).toContain('space_key');
  });
});
