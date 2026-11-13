/**
 * Le lot d'or SAM Vision est ENRACINÉ dans les sources réelles.
 *
 * Chaque cas du corpus porte une citation du code (fichier + ligne + extrait).
 * Ce test vérifie qu'une SIGNATURE dérivée de chaque citation est présente
 * dans l'extrait figé (`vision-sources.ts`) : la vérité est dérivée du code,
 * pas inventée. Si le corpus et les sources divergent, le test nomme le cas —
 * c'est le banc qui détecte la dérive de vérité (§7).
 */
import { describe, it, expect } from 'vitest';
import { VISION_GOLDEN, VISION_GOLDEN_COUNT } from '../../src/seed/vision-golden.js';
import { VISION_SOURCE_EXCERPT, VISION_SOURCE_SHA256 } from '../../src/seed/vision-sources.js';
import { sha256 } from '../../src/oracle/sha256.js';

/** Normalise pour une comparaison insensible à la casse et aux espaces. */
function norme(texte: string): string {
  return texte.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Signature d'une citation : le premier fragment entre guillemets ou constant. */
function signature(cas: { readonly quote: string }): string {
  const match = /"([^"]{4,})"/.exec(cas.quote);
  if (match && match[1]) return norme(match[1]);
  const ident = /([A-Z_]{4,}|\w+\s*=\s*\d+)/.exec(cas.quote);
  return norme(ident?.[1] ?? cas.quote);
}

describe('lot d\'or SAM Vision — grounding (§6.1)', () => {
  it('contient douze cas', () => {
    expect(VISION_GOLDEN_COUNT).toBe(12);
  });

  it('chaque cas porte une provenance fichier + une citation', () => {
    for (const cas of VISION_GOLDEN) {
      expect(cas.source.length).toBeGreaterThan(10);
      expect(cas.quote.length).toBeGreaterThan(4);
    }
  });

  it('chaque citation est présente dans les sources figées', () => {
    const extrait = norme(VISION_SOURCE_EXCERPT);
    for (const cas of VISION_GOLDEN) {
      const sig = signature(cas);
      // La signature peut être une phrase entière : on tolère qu'un morceau de
      // la citation soit présent, mais jamais rien.
      expect(extrait, `cas ${cas.id} : citation absente des sources`).toContain(sig);
    }
  });

  it('les identifiants sont uniques', () => {
    const ids = VISION_GOLDEN.map((cas) => cas.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("l'extrait figé porte la même empreinte que celle déclarée", () => {
    expect(sha256(VISION_SOURCE_EXCERPT)).toBe(VISION_SOURCE_SHA256);
  });

  it('les faits les plus durs sont bloquants', () => {
    const bloquants = VISION_GOLDEN.filter((cas) => cas.gravity === 'bloquant');
    expect(bloquants.length).toBeGreaterThanOrEqual(7);
  });
});
