/**
 * Le rapport d'essai exportable (BE-29, §18) — surface publique du module.
 *
 * Deux sorties, un seul modèle : `buildAuditReport` assemble le rapport à
 * partir de ce que le banc a mesuré, `toMarkdown` le sérialise pour un
 * auditeur, et `digestOf` scelle son corps. Aucune de ces fonctions ne
 * mesure : elles mettent en forme une mesure, jamais ne la fabriquent.
 */
export type {
  AuditReport, ReportCase, ReportConditions, ReportChange, ReportFissure,
  ReportGate, ReportGateMotif, ReportGauge, ReportHeader, ReportHonesty,
  ReportIntegrity, ReportOracleHealth, ReportVerdict, GaugeStatus,
} from './types.js';
export { buildAuditReport } from './build.js';
export type { ReportInput } from './build.js';
export { toMarkdown } from './markdown.js';
export { caseEvidence, ANSWER_EXCERPT } from './evidence.js';
export type { CaseEvidenceInput } from './evidence.js';
export { canonicalJson, digestOf } from './integrity.js';
export { casesOfVersion, reportOfVersion } from './from-demo.js';
export type { DemoReportSpec } from './from-demo.js';