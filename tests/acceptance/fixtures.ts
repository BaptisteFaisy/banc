/**
 * Fixtures partagées de la recette (§27).
 *
 * Tout est fabriqué en mémoire : aucun réseau, aucun secret, aucune écriture
 * réelle. Les cas viennent du corpus de démonstration (§29), et les réponses
 * d'agent sont des textes déterministes.
 */
import type {
  AgentAnswer, AgentCitation, BancCase, OracleState, Passage, SourceAdapter, SourceRead, Verdict,
} from '../../src/domain/vocabulary.js';
import { DERIVED_CASES } from '../../src/seed/cases-derived.js';
import { RULE_CASES } from '../../src/seed/cases-rule.js';
import { REFUSAL_CASES } from '../../src/seed/cases-refusal.js';
import { AMORCE_CASES } from '../../src/seed/cases-amorce.js';
import { hashValue } from '../../src/oracle/hash.js';

/** Un cas du corpus par identifiant. */
export function caseOf(id: string): BancCase {
  const found = [...DERIVED_CASES, ...RULE_CASES, ...REFUSAL_CASES, ...AMORCE_CASES]
    .find((item) => item.id === id);
  if (!found) throw new Error(`cas de recette inconnu : ${id}`);
  return found;
}

/** Un état de vérité vivant, avec une valeur et ses sources. */
export function oracleOf(caseId: string, value: unknown, alive = true): OracleState {
  return {
    caseId, versionNo: 1, valueHash: hashValue(value),
    value: value as OracleState['value'], computedAt: '2026-11-12T09:00:00Z',
    sourceRefs: [{ kind: 'graph', id: `src:${caseId}`, label: 'source de recette' }],
    alive, ...(alive ? {} : { deadReason: 'source_absente' as const }),
  };
}

/** Une réponse d'agent minimale. */
export function answer(text: string, extra: Partial<AgentAnswer> = {}): AgentAnswer {
  return {
    text, citations: [], latencyMs: 1200, tokens: 480, costEstimate: 0.0048,
    toolCalls: [], sideEffects: [], ...extra,
  };
}

/** Une citation résolue vers un document réel. */
export function citation(raw: string, alive = true): AgentCitation {
  return {
    raw,
    resolved: alive ? { kind: 'document', id: `doc:${raw}`, label: raw } : null,
    alive,
  };
}

/** Un passage fabriqué. */
export function passageOf(caseId: string, text: string, passageNo = 1, extra: Partial<AgentAnswer> = {}): Passage {
  const ans = answer(text, extra);
  return {
    id: `pass:${caseId}:${passageNo}`, runId: 'run-recette', caseId, passageNo,
    answerHash: hashValue(text), answerRef: `answer:${caseId}:${passageNo}`, answer: ans,
    latencyMs: ans.latencyMs, tokens: ans.tokens, costEstimate: ans.costEstimate,
  };
}

/** Un adaptateur de source en mémoire, avec compteur d'appels. */
export function fixtureAdapter(
  name: SourceAdapter['name'],
  fixtures: Readonly<Record<string, unknown>>,
): SourceAdapter & { calls: number } {
  const adapter = {
    name,
    calls: 0,
    read: async (query: string): Promise<SourceRead> => {
      adapter.calls += 1;
      if (!(query in fixtures)) {
        return { ok: true, value: null, denied: false, sourceRefs: [], readAt: '2026-11-12T09:00:00Z' };
      }
      return {
        ok: true, value: fixtures[query], denied: false,
        sourceRefs: [{ kind: name, id: query, label: query }], readAt: '2026-11-12T09:00:00Z',
      };
    },
    resolve: async (ref: { id: string; kind: string }): Promise<SourceRead> => ({
      ok: true, value: fixtures[ref.id] ?? null, denied: false, sourceRefs: [ref],
      readAt: '2026-11-12T09:00:00Z',
    }),
  };
  return adapter;
}

/** Un adaptateur qui simule un droit manquant : résultat vidé sans erreur. */
export function deniedAdapter(name: SourceAdapter['name']): SourceAdapter {
  return {
    name,
    read: async (): Promise<SourceRead> => ({
      ok: false, value: null, denied: true, sourceRefs: [], readAt: '2026-11-12T09:00:00Z',
      error: 'droit manquant',
    }),
    resolve: async (): Promise<SourceRead> => ({
      ok: false, value: null, denied: true, sourceRefs: [], readAt: '2026-11-12T09:00:00Z',
      error: 'droit manquant',
    }),
  };
}

/** Un verdict fabriqué, pour les tests de score. */
export function verdictOf(caseId: string, gauge: Verdict['gauge'], kind: Verdict['kind'], value: number | null): Verdict {
  return {
    id: `v:${caseId}:${gauge}`, passageId: `pass:${caseId}:1`, caseId, gauge, kind, value,
    detail: {}, evidence: { answer: 'réponse', oracle: 'oracle' }, computedAt: '2026-11-12T09:00:00Z',
  };
}
