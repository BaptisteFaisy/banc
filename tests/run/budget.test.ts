// Tests du budget et des effets de bord : le budget est affiché et respecté,
// l'agent qui écrit est disqualifié avec la trace, l'échec trivial ne se
// rejoue pas k fois.
import { describe, it, expect } from 'vitest';
import {
  emptyBudget,
  chargeBudget,
  budgetExhausted,
  whichLimitReached,
  budgetRemaining,
  fitsBudget,
  budgetLabel,
} from '../../src/run/budget.js';
import {
  detectSideEffects,
  disqualifiedBySideEffect,
  isTrivialFailure,
  trivialFailureReason,
} from '../../src/run/sideeffects.js';
import type { AgentAnswer, SideEffect } from '../../src/domain/vocabulary.js';

/** Fabrique une réponse d'agent complète (toutes les propriétés obligatoires). */
function makeAnswer(overrides: Partial<AgentAnswer> = {}): AgentAnswer {
  return {
    text: 'réponse normale',
    citations: [],
    latencyMs: 120,
    tokens: 50,
    costEstimate: 0.01,
    toolCalls: [],
    sideEffects: [],
    ...overrides,
  };
}

/** Un effet de bord typique : écriture en production pendant l'évaluation. */
function effet(kind: SideEffect['kind'], targetId: string): SideEffect {
  return { kind, targetType: 'ticket', targetId, observedAt: '2026-11-12T10:00:00Z' };
}

describe('emptyBudget', () => {
  it('part à zéro avec les trois limites', () => {
    const budget = emptyBudget(60, 20000, 2);
    expect(budget.calls).toBe(0);
    expect(budget.tokens).toBe(0);
    expect(budget.costEstimate).toBe(0);
    expect(budget.limitCalls).toBe(60);
    expect(budget.limitTokens).toBe(20000);
    expect(budget.limitCost).toBe(2);
    expect(budget.exhausted).toBe(false);
  });
});

describe('chargeBudget', () => {
  it('additionne appels, jetons et coût', () => {
    const budget = chargeBudget(emptyBudget(60, 20000, 2), 3, 500, 0.2);
    const cumule = chargeBudget(budget, 2, 250, 0.1);
    expect(cumule.calls).toBe(5);
    expect(cumule.tokens).toBe(750);
    expect(cumule.costEstimate).toBeCloseTo(0.3, 10);
  });

  it('une charge négative ne fait pas reculer le budget', () => {
    const budget = chargeBudget(emptyBudget(60, 20000, 2), 10, 1000, 0.5);
    const apres = chargeBudget(budget, -5, -500, -0.3);
    expect(apres.calls).toBe(10);
    expect(apres.tokens).toBe(1000);
    expect(apres.costEstimate).toBeCloseTo(0.5, 10);
  });
});

describe('budgetExhausted', () => {
  it('vrai quand la limite d\'appels est atteinte', () => {
    expect(budgetExhausted(chargeBudget(emptyBudget(10, 100000, 100), 10, 0, 0))).toBe(true);
  });

  it('vrai quand la limite de jetons est atteinte', () => {
    expect(budgetExhausted(chargeBudget(emptyBudget(1000, 5000, 100), 0, 5000, 0))).toBe(true);
  });

  it('vrai quand la limite de coût est atteinte', () => {
    expect(budgetExhausted(chargeBudget(emptyBudget(1000, 100000, 5), 0, 0, 5))).toBe(true);
  });
});

describe('whichLimitReached', () => {
  it('nomme la bonne limite', () => {
    const budget = chargeBudget(emptyBudget(10, 5000, 5), 10, 0, 0);
    expect(whichLimitReached(budget)).toEqual(['calls']);
  });

  it('nomme plusieurs limites à la fois quand c\'est le cas', () => {
    const budget = chargeBudget(emptyBudget(10, 5000, 5), 10, 5000, 0);
    expect(whichLimitReached(budget)).toEqual(['calls', 'tokens']);
  });

  it('reste vide quand aucune limite n\'est atteinte', () => {
    expect(whichLimitReached(emptyBudget(10, 5000, 5))).toEqual([]);
  });
});

describe('budgetRemaining', () => {
  it('ne descend jamais sous 0', () => {
    const budget = chargeBudget(emptyBudget(10, 5000, 5), 40, 9000, 8);
    const reste = budgetRemaining(budget);
    expect(reste.calls).toBe(0);
    expect(reste.tokens).toBe(0);
    expect(reste.cost).toBe(0);
  });

  it('rend ce qui reste avant chaque limite', () => {
    const reste = budgetRemaining(chargeBudget(emptyBudget(10, 5000, 5), 4, 1000, 1));
    expect(reste.calls).toBe(6);
    expect(reste.tokens).toBe(4000);
    expect(reste.cost).toBeCloseTo(4, 10);
  });
});

describe('fitsBudget', () => {
  it('refuse la mesure qui ferait dépasser', () => {
    const budget = chargeBudget(emptyBudget(10, 5000, 5), 9, 0, 0);
    expect(fitsBudget(budget, 2, 0, 0)).toBe(false);
  });

  it('accepte la mesure qui tient juste (bord inclusif)', () => {
    const budget = chargeBudget(emptyBudget(10, 5000, 5), 9, 0, 0);
    expect(fitsBudget(budget, 1, 0, 0)).toBe(true);
  });

  it('refuse tout quand le budget est déjà épuisé', () => {
    const budget = chargeBudget(emptyBudget(10, 5000, 5), 10, 0, 0);
    expect(fitsBudget(budget, 0, 0, 0)).toBe(false);
  });
});

describe('budgetLabel', () => {
  it('contient les trois comptes et leurs limites', () => {
    const budget = chargeBudget(emptyBudget(60, 2000, 2), 12, 900, 0.42);
    const etiquette = budgetLabel(budget);
    expect(etiquette).toContain('12 / 60');
    expect(etiquette).toContain('appels');
    expect(etiquette).toContain('900 / 2 000');
    expect(etiquette).toContain('jetons');
    expect(etiquette).toContain('0,42 € / 2,00 €');
  });
});

describe('detectSideEffects', () => {
  it('rend les effets de bord de la réponse', () => {
    const reponse = makeAnswer({ sideEffects: [effet('created', 'T-1'), effet('deleted', 'T-2')] });
    expect(detectSideEffects(reponse)).toHaveLength(2);
    expect(detectSideEffects(reponse)[0]?.targetId).toBe('T-1');
  });
});

describe('disqualifiedBySideEffect', () => {
  it('vrai avec un effet de bord', () => {
    expect(disqualifiedBySideEffect(makeAnswer({ sideEffects: [effet('updated', 'T-3')] }))).toBe(true);
  });

  it('faux sans effet de bord', () => {
    expect(disqualifiedBySideEffect(makeAnswer())).toBe(false);
  });
});

describe('isTrivialFailure', () => {
  it('vrai pour une réponse vide', () => {
    expect(isTrivialFailure(makeAnswer({ text: '   ' }))).toBe(true);
  });

  it('vrai pour un trivialFailure renseigné', () => {
    expect(isTrivialFailure(makeAnswer({ trivialFailure: 'modèle injoignable' }))).toBe(true);
  });

  it('vrai pour un toolCalls avec ok:false', () => {
    expect(isTrivialFailure(makeAnswer({ toolCalls: [{ name: 'search', ok: false }] }))).toBe(true);
  });

  it('faux pour une réponse normale', () => {
    expect(isTrivialFailure(makeAnswer())).toBe(false);
  });
});

describe('trivialFailureReason', () => {
  it('nomme la réponse vide', () => {
    expect(trivialFailureReason(makeAnswer({ text: '' }))).toBe('réponse vide');
  });

  it('nomme l\'erreur d\'outil avec son nom', () => {
    const raison = trivialFailureReason(makeAnswer({ toolCalls: [{ name: 'deploy', ok: false }] }));
    expect(raison).toBe('erreur d\'outil : deploy');
  });

  it('nomme l\'incident déclaré', () => {
    const raison = trivialFailureReason(makeAnswer({ trivialFailure: 'quota dépassé' }));
    expect(raison).toBe('incident déclaré : quota dépassé');
  });

  it('rend null sur une réponse saine', () => {
    expect(trivialFailureReason(makeAnswer())).toBeNull();
  });
});
