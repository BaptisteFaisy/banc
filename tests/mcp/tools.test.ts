/**
 * Test de contrat des douze outils MCP (§19).
 *
 * La table du §19 fait autorité. Ce test échoue si la table du code et celle du
 * cahier des charges divergent : c'est la seule garantie que le manifeste, les
 * handlers et la documentation parlent bien des mêmes douze outils.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MCP_TOOLS, MCP_TOOL_KEYS, WRITING_TOOLS, toolDef } from '../../src/mcp/tools.js';
import { validatePayload } from '../../src/mcp/validate.js';
import { assertCanReadBench, demoCaller, filterCases, BENCH_SPACE } from '../../src/mcp/guard.js';
import { createMcpHandlers } from '../../src/mcp/handlers.js';

/** Les douze clés du §19, dans l'ordre du cahier des charges. */
const SPEC_KEYS = [
  'run-bench', 'get-scorecard', 'list-regressions', 'compare-versions', 'get-case', 'list-cases',
  'check-promotion', 'get-stability', 'get-oracle-health', 'propose-case', 'record-judgment', 'get-run-log',
];

describe('contrat des outils MCP (§19)', () => {
  it('expose exactement les douze outils du cahier des charges', () => {
    expect(MCP_TOOL_KEYS).toEqual(SPEC_KEYS);
    expect(MCP_TOOLS.length).toBe(12);
  });

  it('respecte les verbes du §19 : trois CREATE, le reste GET', () => {
    // Le tableau du §19 fait foi : `run-bench`, `propose-case` ET
    // `record-judgment` sont des CREATE — le vote du jury s'écrit.
    expect([...WRITING_TOOLS].sort()).toEqual(['propose-case', 'record-judgment', 'run-bench']);
    for (const tool of MCP_TOOLS) {
      const creating = ['run-bench', 'propose-case', 'record-judgment'].includes(tool.key);
      expect(tool.verb).toBe(creating ? 'CREATE' : 'GET');
    }
  });

  it('déclare les entrées obligatoires du §19', () => {
    const required: Record<string, string[]> = {
      'run-bench': ['agentId', 'suite'],
      'get-scorecard': ['agentId'],
      'list-regressions': ['agentId', 'fromVersion', 'toVersion'],
      'compare-versions': ['agentId', 'versionA', 'versionB'],
      'get-case': ['caseId'],
      'check-promotion': ['agentId', 'candidateVersion'],
      'get-stability': ['agentId'],
      'record-judgment': ['caseId', 'verdict', 'notes'],
      'get-run-log': ['runId'],
    };
    for (const [key, names] of Object.entries(required)) {
      const tool = toolDef(key);
      expect(tool, `outil ${key} absent`).toBeDefined();
      const declared = tool?.inputs.filter((input) => input.required).map((input) => input.name) ?? [];
      expect(declared.sort(), `obligatoires de ${key}`).toEqual(names.sort());
    }
  });

  it('refuse un payload invalide avant tout accès aux données', () => {
    const def = toolDef('get-case');
    if (!def) throw new Error('outil absent');
    const result = validatePayload(def, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.field).toBe('caseId');
  });

  it('refuse un enum hors liste', () => {
    const def = toolDef('run-bench');
    if (!def) throw new Error('outil absent');
    const result = validatePayload(def, { agentId: 'a', suite: 'inexistant' });
    expect(result.ok).toBe(false);
  });

  it('exige issueKey OU question pour propose-case', () => {
    const def = toolDef('propose-case');
    if (!def) throw new Error('outil absent');
    expect(validatePayload(def, {}).ok).toBe(false);
    expect(validatePayload(def, { question: 'une question' }).ok).toBe(true);
  });

  it('refuse l\'accès à un lecteur non autorisé, avec une erreur explicite', () => {
    expect(() => assertCanReadBench(undefined)).toThrow(/accès refusé/);
    expect(() => assertCanReadBench({ accountId: 'x', allowedSpaces: ['AUTRE'] })).toThrow(/accès refusé/);
    expect(() => assertCanReadBench({ accountId: 'x', allowedSpaces: [BENCH_SPACE], isAgentUnderTest: true }))
      .toThrow(/ne peut pas lire/);
    expect(() => assertCanReadBench(demoCaller())).not.toThrow();
  });

  it('ne rend aucun cas d\'un espace non autorisé', () => {
    const cases = [{ spaceKey: 'BENCH' }, { spaceKey: 'PROD' }];
    expect(filterCases(demoCaller(), cases)).toHaveLength(1);
    expect(filterCases(undefined, cases)).toHaveLength(0);
  });

  it('câble les douze outils', () => {
    const handlers = createMcpHandlers({ store: {} as never, caller: demoCaller() });
    expect(Object.keys(handlers).sort()).toEqual([...SPEC_KEYS].sort());
  });

  it('le manifeste déclare les mêmes douze outils que le code', () => {
    const manifest = readFileSync('manifest.yml', 'utf-8');
    for (const key of SPEC_KEYS) expect(manifest).toContain(`key: ${key}`);
  });
});
