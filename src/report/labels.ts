/**
 * Les libellés du rapport : le vocabulaire du domaine, dans la langue demandée.
 *
 * Le rapport doit parler la même langue que le produit, mot pour mot. Toute
 * chaîne visible passe par `t()`, et les correspondances jauge / verdict /
 * oracle / gravité / mode sont définies ICI une seule fois — le rendu
 * Markdown et le rendu Confluence les partagent.
 */
import type { DeadOracleReason, Gauge, Gravity, OracleType, VerdictKind } from '../domain/vocabulary.js';
import type { BenchMode } from '../domain/vocabulary.js';
import { t } from '../i18n/index.js';
import type { Locale } from '../i18n/index.js';
import type { GaugeStatus } from './types.js';

/** La clé i18n d'une jauge. */
function gaugeKey(gauge: Gauge): string {
  const keys: Record<Gauge, string> = {
    exactitude: 'gauge.exactitude',
    fondation: 'gauge.fondation',
    citation_vivante: 'gauge.citation_vivante',
    exactitude_de_règle: 'gauge.exactitude_de_regle',
    refus_correct: 'gauge.refus_correct',
    complétude: 'gauge.completude',
    stabilité: 'gauge.stabilite',
    coût: 'gauge.cout',
  };
  return keys[gauge];
}

/** La clé i18n d'une forme d'oracle. */
function oracleKey(type: OracleType): string {
  return type === 'valeur_dérivée' ? 'oracle.derived'
    : type === 'règle_vivante' ? 'oracle.rule' : 'oracle.refusal';
}

/** La clé i18n d'une gravité. */
function gravityKey(gravity: Gravity): string {
  return gravity === 'bloquant' ? 'gravity.bloquant' : 'gravity.souhaitable';
}

/** La clé i18n d'un motif d'oracle mort. */
function deadKey(reason: DeadOracleReason): string {
  const keys: Record<DeadOracleReason, string> = {
    source_absente: 'oracle.dead.source_absente',
    droit_manquant: 'oracle.dead.droit_manquant',
    'système_non_branché': 'oracle.dead.système_non_branché',
    'règle_non_expressible': 'oracle.dead.règle_non_expressible',
  };
  return keys[reason];
}

/** La clé i18n d'un verdict. */
function verdictKey(kind: VerdictKind): string {
  // L'enum du domaine écrit « invérifiable » ; la clé i18n n'a pas d'accent.
  const key = kind === 'invérifiable' ? 'inverifiable' : kind;
  return `verdict.${key}`;
}

/** La clé i18n d'un motif de porte (§11). */
function gateRuleKey(rule: string): string {
  const keys: Record<string, string> = {
    'aucun_cas_bloquant_ne_régresse': 'gate.rule.no_blocking_regression',
    'aucune_jauge_sous_son_plancher': 'gate.rule.no_gauge_below_floor',
    'stabilité_au_dessus_du_plancher': 'gate.rule.stability_above_floor',
    'coût_dans_le_budget': 'gate.rule.cost_within_budget',
    'aucune_amorce_ne_passe': 'gate.rule.no_amorce_passes',
  };
  return keys[rule] ?? rule;
}

/** Libelle un statut de jauge (§8). */
export function statusLabel(locale: Locale, status: GaugeStatus): string {
  const keys: Record<GaugeStatus, string> = {
    'au-dessus_du_plancher': 'report.status.above_floor',
    'sous_le_plancher': 'report.status.below_floor',
    'pas_assez_de_recul': 'report.status.undecided',
  };
  return t(locale, keys[status]);
}

/** Le libellé d'une jauge. */
export function gaugeLabel(locale: Locale, gauge: Gauge): string {
  return t(locale, gaugeKey(gauge));
}

/** Le libellé d'une forme d'oracle. */
export function oracleTypeLabel(locale: Locale, type: OracleType): string {
  return t(locale, oracleKey(type));
}

/** Le libellé d'une gravité. */
export function gravityLabel(locale: Locale, gravity: Gravity): string {
  return t(locale, gravityKey(gravity));
}

/** Le libellé d'un motif d'oracle mort. */
export function deadReasonLabel(locale: Locale, reason: DeadOracleReason): string {
  return t(locale, deadKey(reason));
}

/** Le libellé d'un verdict. */
export function verdictLabel(locale: Locale, kind: VerdictKind): string {
  return t(locale, verdictKey(kind));
}

/** Le libellé d'un motif de porte. */
export function gateRuleLabel(locale: Locale, rule: string): string {
  return t(locale, gateRuleKey(rule));
}

/** Le libellé d'un mode d'essai. */
export function modeLabel(locale: Locale, mode: BenchMode): string {
  return t(locale, mode === 'blanc' ? 'mode.blanc' : 'mode.noir');
}

/** Le libellé d'une attribution de fissure (§9). */
export function attributionLabel(locale: Locale, attribution: string): string {
  const keys: Record<string, string> = {
    'cas_mal_écrit': 'report.attribution.cas_mal_ecrit',
    'agent_instable': 'report.attribution.agent_instable',
    'indéterminé': 'report.attribution.indetermine',
  };
  return t(locale, keys[attribution] ?? attribution);
}