/**
 * Le rapport d'essai en Markdown (BE-29, §18).
 *
 * Un rendu lisible partout : un dépôt, un PR, un message, un fichier que
 * l'auditeur garde. Il ne sérialise que le modèle du rapport — aucune mesure
 * n'est recalculée ici.
 */
import type { Locale } from '../i18n/index.js';
import { t } from '../i18n/index.js';
import { percent } from '../ui/viewmodel/gauge.js';
import {
  attributionLabel, deadReasonLabel, gaugeLabel, gateRuleLabel, gravityLabel,
  modeLabel, oracleTypeLabel, statusLabel, verdictLabel,
} from './labels.js';
import type { AuditReport, ReportCase, ReportGauge } from './types.js';

/** Échappe une cellule de tableau Markdown. */
function cell(text: string): string {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** La fourchette d'une jauge, ou un tiret quand elle n'existe pas. */
function interval(gauge: ReportGauge): string {
  if (gauge.ciLow === null || gauge.ciHigh === null) return '—';
  return `${percent(gauge.ciLow)} – ${percent(gauge.ciHigh)}`;
}

/** Une ligne de table Markdown. */
function row(cells: readonly string[]): string {
  return `| ${cells.map(cell).join(' | ')} |`;
}

/** Un tableau Markdown à partir de son en-tête et de ses lignes. */
function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return '';
  return [
    row(headers),
    row(headers.map(() => '---')),
    ...rows.map(row),
  ].join('\n');
}

/** L'identité de l'essai : ce qui a été testé, et quand. */
function identitySection(report: AuditReport, locale: Locale): string {
  const header = report.header;
  const lines: string[] = [
    `## ${t(locale, 'report.section.identity')}`,
    '',
    table(
      [t(locale, 'report.label.agent'), t(locale, 'common.version'), t(locale, 'report.label.suite'),
        t(locale, 'report.label.mode'), t(locale, 'common.run'), t(locale, 'report.label.passes'),
        t(locale, 'report.label.state')],
      [[
        `${header.agentId} / ${header.agentVersionId}`, header.agentVersionId, header.suiteId,
        modeLabel(locale, header.mode), header.runId, String(header.passes), header.state,
      ]],
    ),
    '',
    table(
      [t(locale, 'report.label.started'), t(locale, 'report.label.finished'),
        t(locale, 'report.label.condition_hash'), t(locale, 'report.label.config_hash')],
      [[
        header.startedAt, header.finishedAt ?? '—', header.conditionHash,
        header.configHashAtEnd ?? '—',
      ]],
    ),
  ];
  if (header.invalidatedReason) {
    lines.push('', `**${t(locale, 'honesty.run_invalidated')}** — ${header.invalidatedReason}`);
  }
  return lines.join('\n');
}

/** Les conditions de l'essai : ce qui rend la mesure reproductible. */
function conditionsSection(report: AuditReport, locale: Locale): string {
  const conditions = report.conditions;
  return [
    `## ${t(locale, 'report.section.conditions')}`,
    '',
    table(
      [t(locale, 'report.label.cases'), t(locale, 'report.label.passes'), t(locale, 'report.label.calls'),
        t(locale, 'report.label.tokens'), t(locale, 'report.label.cost'), t(locale, 'report.label.limit'),
        t(locale, 'report.label.witness')],
      [[
        String(conditions.cases), String(conditions.passages), String(conditions.calls),
        String(conditions.tokens), conditions.costEstimate.toFixed(4),
        `${conditions.limitCalls} / ${conditions.limitTokens} / ${conditions.limitCost}`,
        conditions.witnessVersionId ?? '—',
      ]],
    ),
  ].join('\n');
}

/** Les huit jauges : la mesure, son effectif, sa fourchette, son plancher. */
function gaugesSection(report: AuditReport, locale: Locale): string {
  const rows = report.gauges.map((gauge) => [
    gaugeLabel(locale, gauge.gauge),
    String(gauge.n),
    gauge.value === null ? '—' : percent(gauge.value),
    interval(gauge),
    percent(gauge.floor),
    statusLabel(locale, gauge.status),
    gauge.witness === null ? '—' : percent(gauge.witness),
    gauge.delta === null ? '—' : percent(gauge.delta),
  ]);
  return [
    `## ${t(locale, 'report.section.gauges')}`,
    '',
    table(
      [t(locale, 'report.label.gauge'), t(locale, 'report.label.n'), t(locale, 'report.label.value'),
        t(locale, 'report.label.interval'), t(locale, 'report.label.floor'),
        t(locale, 'report.label.state'), t(locale, 'report.label.witness'),
        t(locale, 'report.label.delta')],
      rows,
    ),
  ].join('\n');
}

/** La porte : les cinq motifs, et ce qu'elle refuse. */
function gateSection(report: AuditReport, locale: Locale): string {
  const lines = [
    `## ${t(locale, 'report.section.gate')}`,
    '',
    `**${report.gate.allowed ? t(locale, 'gate.allowed') : t(locale, 'gate.refused')}**`,
    '',
  ];
  for (const motive of report.gate.motives) {
    lines.push(`- ${motive.passed ? '✅' : '❌'} **${gateRuleLabel(locale, motive.rule)}** — ${motive.detail}`);
  }
  return lines.join('\n');
}

/** La mention d'une liste vide : un auditeur lit « aucun », pas du blanc. */
function emptyNote(locale: Locale): string {
  return t(locale, 'report.none');
}

/** Les fissures : l'instabilité, et à qui elle appartient. */
function fissuresSection(report: AuditReport, locale: Locale): string {
  if (report.fissures.length === 0) {
    return [`## ${t(locale, 'report.section.fissures')}`, '', emptyNote(locale)].join('\n');
  }
  const rows = report.fissures.map((crack) => [
    crack.caseId, attributionLabel(locale, crack.attribution), String(crack.passages),
    String(crack.distinctAnswers), crack.answerDistance.toFixed(2),
    crack.oracleStable ? 'oui' : 'non', crack.state,
  ]);
  return [
    `## ${t(locale, 'report.section.fissures')}`,
    '',
    table(
      [t(locale, 'common.case'), t(locale, 'report.label.attribution'), t(locale, 'report.label.passes'),
        t(locale, 'report.label.citations'), t(locale, 'report.label.value'), t(locale, 'report.label.floor'),
        t(locale, 'report.label.state')],
      rows,
    ),
  ].join('\n');
}

/** Les écarts au témoin : régressions d'un côté, dérives de l'autre. */
function changesSection(
  title: string, changes: readonly { caseId: string; gauge: string; delta: number; truthEvidence?: unknown }[],
  locale: Locale,
): string {
  if (changes.length === 0) return [title, '', emptyNote(locale)].join('\n');
  const rows = changes.map((change) => [
    change.caseId, gaugeLabel(locale, change.gauge as never), percent(change.delta),
    change.truthEvidence ? JSON.stringify(change.truthEvidence) : '—',
  ]);
  return [
    `## ${title}`,
    '',
    table(
      [t(locale, 'common.case'), t(locale, 'report.label.gauge'), t(locale, 'report.label.delta'),
        t(locale, 'report.label.evidence')],
      rows,
    ),
  ].join('\n');
}

/** La preuve, cas par cas : la réponse, l'oracle, les verdicts. */
function casesSection(report: AuditReport, locale: Locale): string {
  const lines = [`## ${t(locale, 'report.section.cases')}`, ''];
  for (const item of report.cases) lines.push(...caseBlock(item, locale));
  return lines.join('\n');
}

/** Le bloc de preuve d'un cas. */
function caseBlock(item: ReportCase, locale: Locale): readonly string[] {
  const lines: string[] = [
    `### ${item.caseId} — ${gravityLabel(locale, item.gravity)}`,
    '',
    `- ${t(locale, 'report.label.question')} : ${item.question}`,
    `- ${t(locale, 'common.oracle')} : ${oracleTypeLabel(locale, item.oracleType)} = ${item.oracleValue ?? '—'}`,
  ];
  if (!item.oracleAlive && item.oracleDeadReason) {
    lines.push(`- ${t(locale, 'oracle.dead')} : ${deadReasonLabel(locale, item.oracleDeadReason)}`);
  }
  lines.push(`- ${t(locale, 'common.answer')} : ${item.answer || '—'}`);
  lines.push(`- empreinte : \`${item.answerHash}\``);
  lines.push(`- ${t(locale, 'report.label.citations')} : ${item.citations.length}`);
  for (const verdict of item.verdicts) {
    const motifs = verdict.missingMotives.length > 0 ? ` — ${t(locale, 'common.missing_motives')} : ${verdict.missingMotives.join(', ')}` : '';
    lines.push(`- ${gaugeLabel(locale, verdict.gauge)} : **${verdictLabel(locale, verdict.kind)}**${motifs}`);
  }
  lines.push('');
  return lines;
}

/** L'honnêteté : les réserves, en clair (§25). */
function honestySection(report: AuditReport, locale: Locale): string {
  const honesty = report.honesty;
  const caveats: string[] = [];
  if (honesty.undecidedGauges.length > 0) {
    caveats.push(`${honesty.undecidedGauges.map((gauge) => gaugeLabel(locale, gauge)).join(', ')} — ${t(locale, 'report.honesty.undecided')}`);
  }
  caveats.push(honesty.calibrated
    ? t(locale, 'report.honesty.calibrated')
    : t(locale, 'report.honesty.uncalibrated'));
  if (honesty.deadOracles > 0) {
    caveats.push(`${honesty.deadOracles} — ${t(locale, 'report.honesty.dead_oracles')}`);
  }
  if (honesty.budgetExhausted) caveats.push(t(locale, 'honesty.budget_exhausted'));
  if (honesty.invalidated) caveats.push(t(locale, 'honesty.run_invalidated'));
  if (honesty.sampled) caveats.push(t(locale, 'report.honesty.sampled'));
  return [
    `## ${t(locale, 'report.section.honesty')}`,
    '',
    ...caveats.map((caveat) => `- ${caveat}`),
  ].join('\n');
}

/** L'intégrité : l'empreinte du corps du rapport. */
function integritySection(report: AuditReport, locale: Locale): string {
  return [
    `## ${t(locale, 'report.section.integrity')}`,
    '',
    `- ${t(locale, 'report.label.algorithm')} : ${report.integrity.algorithm}`,
    `- ${t(locale, 'report.label.digest')} : \`${report.integrity.digest}\``,
    `- ${t(locale, 'report.label.started')} : ${report.integrity.generatedAt}`,
    '',
    t(locale, 'report.integrity.note'),
  ].join('\n');
}

/** Le rapport complet, en Markdown. */
export function toMarkdown(report: AuditReport, locale: Locale = 'fr'): string {
  const sections = [
    `# ${t(locale, 'report.title')}`,
    identitySection(report, locale),
    conditionsSection(report, locale),
    gaugesSection(report, locale),
    gateSection(report, locale),
    fissuresSection(report, locale),
    changesSection(t(locale, 'report.section.regressions'), report.regressions, locale),
    changesSection(t(locale, 'report.section.drifts'), report.drifts, locale),
    casesSection(report, locale),
    honestySection(report, locale),
    integritySection(report, locale),
  ];
  return `${sections.join('\n\n')}\n`;
}
