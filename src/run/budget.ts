// Budget d'un banc d'essai : il est AFFICHÉ et RESPECTÉ.
// Comportement produit exigé : au-delà de la limite, le banc s'arrête et le
// dit — il ne coupe jamais une mesure en silence, et le rapport nomme
// LAQUELLE des limites est atteinte, pas seulement « budget dépassé ».
import type { BudgetUsage } from '../domain/vocabulary.js';

/** Groupe les milliers avec des espaces normales (étiquette française lisible). */
function thousands(value: number): string {
  const entier = Math.trunc(Math.abs(value));
  const chiffres = String(entier);
  const groupes: string[] = [];
  for (let fin = chiffres.length; fin > 0; fin -= 3) {
    groupes.unshift(chiffres.slice(Math.max(0, fin - 3), fin));
  }
  return (value < 0 ? '-' : '') + groupes.join(' ');
}

/** Formate un coût en euros avec deux décimales et une virgule française. */
function euros(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/** Budget initial : tout à zéro, les trois limites posées. */
export function emptyBudget(limitCalls: number, limitTokens: number, limitCost: number): BudgetUsage {
  return {
    calls: 0,
    tokens: 0,
    costEstimate: 0,
    limitCalls,
    limitTokens,
    limitCost,
    exhausted: false,
  };
}

/**
 * Additionne une consommation au budget et recalcule `exhausted`.
 * Ne rend jamais de valeur négative : une entrée négative est ignorée,
 * pas soustraite — un budget ne recule pas.
 */
export function chargeBudget(used: BudgetUsage, calls: number, tokens: number, cost: number): BudgetUsage {
  const prochain: BudgetUsage = {
    ...used,
    calls: used.calls + Math.max(0, calls),
    tokens: used.tokens + Math.max(0, tokens),
    costEstimate: used.costEstimate + Math.max(0, cost),
    exhausted: false,
  };
  return { ...prochain, exhausted: budgetExhausted(prochain) };
}

/** Vrai dès qu'une des trois limites est atteinte (ou déjà marquée épuisée). */
export function budgetExhausted(used: BudgetUsage): boolean {
  return (
    used.calls >= used.limitCalls ||
    used.tokens >= used.limitTokens ||
    used.costEstimate >= used.limitCost ||
    used.exhausted
  );
}

/** Nomme la ou les limites atteintes : le rapport doit dire laquelle. */
export function whichLimitReached(used: BudgetUsage): readonly ('calls' | 'tokens' | 'cost')[] {
  const atteintes: ('calls' | 'tokens' | 'cost')[] = [];
  if (used.calls >= used.limitCalls) atteintes.push('calls');
  if (used.tokens >= used.limitTokens) atteintes.push('tokens');
  if (used.costEstimate >= used.limitCost) atteintes.push('cost');
  return atteintes;
}

/** Ce qui reste avant chaque limite, borné à 0 minimum. */
export function budgetRemaining(used: BudgetUsage): { calls: number; tokens: number; cost: number } {
  return {
    calls: Math.max(0, used.limitCalls - used.calls),
    tokens: Math.max(0, used.limitTokens - used.tokens),
    cost: Math.max(0, used.limitCost - used.costEstimate),
  };
}

/**
 * La prochaine mesure tient-elle encore dans le budget ?
 * Sert au rejet AVANT de lancer un appel coûteux ; bord inclusif.
 */
export function fitsBudget(used: BudgetUsage, calls: number, tokens: number, cost: number): boolean {
  if (budgetExhausted(used)) return false;
  const projete = chargeBudget(used, calls, tokens, cost);
  return (
    projete.calls <= used.limitCalls &&
    projete.tokens <= used.limitTokens &&
    projete.costEstimate <= used.limitCost
  );
}

/** Étiquette lisible en français : le budget est affiché, jamais implicite. */
export function budgetLabel(used: BudgetUsage): string {
  const appels = `${thousands(used.calls)} / ${thousands(used.limitCalls)} appels`;
  const jetons = `${thousands(used.tokens)} / ${thousands(used.limitTokens)} jetons`;
  const cout = `${euros(used.costEstimate)} € / ${euros(used.limitCost)} €`;
  return `« ${appels} · ${jetons} · ${cout} »`;
}
