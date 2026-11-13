/**
 * tests/oracle/hash.test.ts — Tests Vitest des empreintes SHA-256 stables.
 */

import { describe, it, expect } from 'vitest';

import { hashValue, hashSpec, serialiseStable, shortHash } from '../../src/oracle/hash.js';

interface Skill {
  readonly key: string;
  readonly hash: string;
}

interface TestSpec {
  readonly specHash: string;
  readonly promptHash: string;
  readonly skills: readonly Skill[];
  readonly actions: readonly string[];
  readonly tools: readonly string[];
  readonly model: string;
  readonly temperature: number;
  readonly capturedAt: string;
}

function makeSpec(overrides: Partial<TestSpec> = {}): TestSpec {
  return {
    specHash: '',
    promptHash: 'prompt-1',
    skills: [
      { key: 'alpha', hash: 'h-a' },
      { key: 'beta', hash: 'h-b' },
    ],
    actions: ['write', 'read'],
    tools: ['shell', 'file_read'],
    model: 'model-x',
    temperature: 0.2,
    capturedAt: '2026-11-12T00:00:00Z',
    ...overrides,
  };
}

describe('serialiseStable', () => {
  it('même objet, ordre de clés différent → même sérialisation', () => {
    expect(serialiseStable({ a: 1, b: 2 })).toBe(serialiseStable({ b: 2, a: 1 }));
  });

  it('objet imbriqué, ordre de clés différent en profondeur → même sérialisation', () => {
    const first = { outer: { x: 1, y: { p: true, q: null } }, k: 'v' };
    const second = { k: 'v', outer: { y: { q: null, p: true }, x: 1 } };
    expect(serialiseStable(first)).toBe(serialiseStable(second));
  });

  it('ignore undefined et fonctions dans les objets', () => {
    const withExtras: Record<string, unknown> = { a: 1, u: undefined, f: () => 0 };
    expect(serialiseStable(withExtras)).toBe(serialiseStable({ a: 1 }));
  });
});

describe('hashValue', () => {
  it('même objet, ordre de clés différent → même empreinte', () => {
    expect(hashValue({ a: 1, b: [2, 3] })).toBe(hashValue({ b: [2, 3], a: 1 }));
  });

  it('objet imbriqué, ordre de clés différent en profondeur → même empreinte', () => {
    expect(hashValue({ x: { b: { d: 4, c: 3 }, a: 1 }, k: 'v' })).toBe(
      hashValue({ k: 'v', x: { a: 1, b: { c: 3, d: 4 } } }),
    );
  });

  it('valeur différente → empreinte différente', () => {
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
  });

  it('tableau : l’ordre compte', () => {
    expect(hashValue([1, 2])).not.toBe(hashValue([2, 1]));
  });

  it('empreinte = 64 caractères hexadécimaux', () => {
    expect(hashValue({ anything: true })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hashSpec', () => {
  it('insensible à l’ordre de skills, actions et tools', () => {
    const base = makeSpec();
    const shuffled = makeSpec({
      skills: [
        { key: 'beta', hash: 'h-b' },
        { key: 'alpha', hash: 'h-a' },
      ],
      actions: ['read', 'write'],
      tools: ['file_read', 'shell'],
    });
    expect(hashSpec(base)).toBe(hashSpec(shuffled));
  });

  it('sensible au model', () => {
    expect(hashSpec(makeSpec())).not.toBe(hashSpec(makeSpec({ model: 'model-y' })));
  });

  it('sensible à temperature', () => {
    expect(hashSpec(makeSpec())).not.toBe(hashSpec(makeSpec({ temperature: 0.9 })));
  });

  it('sensible au promptHash', () => {
    expect(hashSpec(makeSpec())).not.toBe(hashSpec(makeSpec({ promptHash: 'prompt-2' })));
  });

  it('empreinte de spec = 64 caractères hexadécimaux', () => {
    expect(hashSpec(makeSpec())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('shortHash', () => {
  it('par défaut = 12 caractères et préfixe de hashValue', () => {
    const value = { a: 1, b: 'x' };
    const short = shortHash(value);
    expect(short).toHaveLength(12);
    expect(hashValue(value).startsWith(short)).toBe(true);
  });

  it('longueur personnalisée respectée', () => {
    expect(shortHash({ a: 1 }, 8)).toHaveLength(8);
  });
});
