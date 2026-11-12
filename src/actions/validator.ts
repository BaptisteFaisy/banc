/**
 * Le verrou de workflow (§11) : la porte de promotion sur la transition vers
 * « approuvé ».
 *
 * C'est ce qui fait passer le produit d'une curiosité à une infrastructure :
 * la mesure devient une condition, pas une information. Le ticket de la
 * nouvelle version ne passe pas en « approuvé » si la porte est rouge.
 *
 * Le motif du refus est toujours explicite : un ticket bloqué sans raison
 * lisible est un ticket que l'on contourne.
 */
import type { PromotionVerdict } from '../domain/vocabulary.js';
import { promotionSummary } from '../score/promotion.js';

/** Ce que la plateforme attend d'un validateur de workflow. */
export interface ValidationResult {
  readonly valid: boolean;
  readonly message: string;
}

/** Message affiché dans Jira quand la porte refuse. */
export function refusalMessage(verdict: PromotionVerdict): string {
  const refusals = verdict.motives.filter((motive) => !motive.passed);
  const lines = refusals.map((motive) => `• ${motive.detail}`);
  return [
    `Porte de promotion rouge — la version ${verdict.candidateVersion} n'est pas promouvable.`,
    ...lines,
    'La porte se rejoue au prochain essai : le motif ci-dessus nomme ce qui doit changer.',
  ].join('\n');
}

/** Message affiché quand la porte est verte. */
export function acceptanceMessage(verdict: PromotionVerdict): string {
  return [
    `Porte de promotion verte — la version ${verdict.candidateVersion} peut être promue.`,
    ...verdict.motives.map((motive) => `• ${motive.detail}`),
  ].join('\n');
}

/**
 * Valide la transition vers « approuvé ».
 *
 * Sans mesure disponible, la validation **échoue** et le dit : laisser
 * passer faute de mesure serait laisser passer par défaut, et une porte qui
 * s'ouvre quand elle ne sait rien n'est pas une porte.
 */
export function validatePromotion(verdict: PromotionVerdict | undefined): ValidationResult {
  if (!verdict) {
    return {
      valid: false,
      message: 'Porte de promotion : aucune mesure disponible pour cette version. '
        + 'Lancez le lot d’or avant de promouvoir.',
    };
  }
  if (!verdict.allowed) return { valid: false, message: refusalMessage(verdict) };
  return { valid: true, message: acceptanceMessage(verdict) };
}

/** Le résumé court affiché en commentaire de ticket. */
export function summaryComment(verdict: PromotionVerdict): string {
  return promotionSummary(verdict);
}
