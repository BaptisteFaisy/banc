/**
 * Agent seedé et ses versions (§29 point 2, §10 témoin, §13 empreinte).
 *
 * Le scénario que les juges doivent voir immédiatement :
 *   v4  le TÉMOIN — version de référence, figée comme plancher de comparaison ;
 *   v5  casse deux cas bloquants et perd un point de fondation par rapport à v4 ;
 *   v6  répare la fondation mais casse la stabilité.
 *
 * Chaque version porte une empreinte de spécification complète : un agent
 * n'est pas un objet, c'est un assemblage (prompt, skills, actions, outils,
 * modèle, température), et la version est identifiée par empreinte — jamais
 * par le nom (§26 : deux agents peuvent porter le même nom).
 */
import type { Agent, AgentVersion, SpecFingerprint } from '../domain/vocabulary.js';
import { hashValue } from '../oracle/hash.js';

/** L'agent de démonstration : un agent de support interne. */
export const SEED_AGENT: Agent = {
  id: 'agent-support',
  name: 'Agent support interne',
  rovoRef: 'ari:cloud:ecosystem::rovo-agent/agent-support',
  ownerRef: 'platform-team',
  suiteKind: 'full',
  createdAt: '2026-10-01T09:00:00Z',
};

/** Empreinte de spécification d'une version. */
function fingerprint(input: {
  prompt: string; skills: readonly [string, string][]; actions: readonly string[];
  tools: readonly string[]; model: string; temperature: number; capturedAt: string;
}): SpecFingerprint {
  const skills = input.skills.map(([key, hash]) => ({ key, hash }));
  const fields = {
    promptHash: hashValue(input.prompt),
    skills, actions: input.actions, tools: input.tools,
    model: input.model, temperature: input.temperature, capturedAt: input.capturedAt,
  };
  return { specHash: hashValue(fields), ...fields };
}

/** v4 — le témoin : la référence figée, plancher de non-régression (§10). */
export const VERSION_V4: AgentVersion = {
  id: 'v4', agentId: SEED_AGENT.id, label: 'v4', isWitness: true, createdAt: '2026-10-15T09:00:00Z',
  fingerprint: fingerprint({
    prompt: 'Tu es l’agent support interne. Réponds uniquement à partir des sources de '
      + 'l’organisation, cite chaque affirmation, et dis ce qui manque plutôt que d’inventer.',
    skills: [['before-promoting-an-agent', hashValue('skill-v4')]],
    actions: ['search-graph', 'search-jira', 'search-confluence'],
    tools: ['get-case', 'get-scorecard', 'check-promotion'],
    model: 'claude-sonnet', temperature: 0.2, capturedAt: '2026-10-15T09:00:00Z',
  }),
};

/** v5 — casse deux cas bloquants et perd un point de fondation (§29). */
export const VERSION_V5: AgentVersion = {
  id: 'v5', agentId: SEED_AGENT.id, label: 'v5', isWitness: false, createdAt: '2026-11-01T09:00:00Z',
  fingerprint: fingerprint({
    // Le prompt a été raccourci : la consigne de citation a sauté. C'est la
    // cause de la perte de fondation, et c'est exactement ce que le banc attrape.
    prompt: 'Tu es l’agent support interne. Réponds aux questions à partir des sources.',
    skills: [['before-promoting-an-agent', hashValue('skill-v4')]],
    actions: ['search-graph', 'search-jira', 'search-confluence'],
    tools: ['get-case', 'get-scorecard', 'check-promotion'],
    model: 'claude-sonnet', temperature: 0.2, capturedAt: '2026-11-01T09:00:00Z',
  }),
};

/** v6 — répare la fondation mais casse la stabilité (§29). */
export const VERSION_V6: AgentVersion = {
  id: 'v6', agentId: SEED_AGENT.id, label: 'v6', isWitness: false, createdAt: '2026-11-08T09:00:00Z',
  fingerprint: fingerprint({
    prompt: 'Tu es l’agent support interne. Réponds uniquement à partir des sources de '
      + 'l’organisation, cite chaque affirmation, et dis ce qui manque plutôt que d’inventer.',
    skills: [['before-promoting-an-agent', hashValue('skill-v6')]],
    actions: ['search-graph', 'search-jira', 'search-confluence'],
    tools: ['get-case', 'get-scorecard', 'check-promotion'],
    // Température remontée : la citation revient, la stabilité part.
    model: 'claude-sonnet', temperature: 0.9, capturedAt: '2026-11-08T09:00:00Z',
  }),
};

/** Les trois versions seedées, la première étant le témoin. */
export const SEED_VERSIONS: readonly AgentVersion[] = [VERSION_V4, VERSION_V5, VERSION_V6];

/** Le témoin : la version de référence contre laquelle tout est comparé. */
export function witnessVersion(): AgentVersion {
  return VERSION_V4;
}

/** Version par identifiant ou label ; `undefined` si inconnue. */
export function versionOf(idOrLabel: string): AgentVersion | undefined {
  return SEED_VERSIONS.find((version) => version.id === idOrLabel || version.label === idOrLabel);
}

/** Ce qui distingue deux versions, en clair — pour l'écran du témoin (§20). */
export function diffFingerprints(a: SpecFingerprint, b: SpecFingerprint): readonly string[] {
  const changes: string[] = [];
  if (a.promptHash !== b.promptHash) changes.push('prompt');
  if (a.model !== b.model) changes.push('modèle');
  if (a.temperature !== b.temperature) changes.push(`température ${a.temperature} → ${b.temperature}`);
  if (hashValue(a.skills) !== hashValue(b.skills)) changes.push('skills');
  if (hashValue(a.actions) !== hashValue(b.actions)) changes.push('actions');
  if (hashValue(a.tools) !== hashValue(b.tools)) changes.push('outils');
  return changes;
}
