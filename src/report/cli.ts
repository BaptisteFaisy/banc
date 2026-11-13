/**
 * L'export du rapport d'essai pour auditeur (BE-29, §18).
 *
 * Joue le scénario semé du §29 — déterministe, aucun réseau — puis écrit le
 * rapport de la version candidate v5 (celle qui casse deux cas bloquants) et
 * celui du témoin v4. Deux sorties pour un même modèle : le JSON scellé par
 * son empreinte SHA-256, et le Markdown qu'un auditeur lit et garde.
 *
 * Usage : `npm run report:export`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runDemo } from '../demo/run.js';
import type { DemoVersion } from '../demo/run.js';
import { SEED_CASES } from '../seed/index.js';
import { digestOf } from './integrity.js';
import type { AuditReport } from './types.js';
import { reportOfVersion } from './from-demo.js';
import { toMarkdown } from './markdown.js';

/** L'agent sous test du scénario semé : le même que la porte et la scorecard. */
const AGENT_ID = 'agent-support';

/**
 * Écrit un artefact généré sous `site/public/generated/` et rend son chemin.
 *
 * Le dossier `generated/` est gitignoré et exclu de la garde des 500 lignes :
 * ce sont des rapports produits par un script, jamais édités à la main — les
 * découper n'aurait pas de sens.
 */
function writePublic(name: string, content: string): string {
  const path = resolve(process.cwd(), 'site/public/generated', name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  return path;
}

/** L'empreinte de la condition d'essai : les mêmes cas, le même instantané (§13). */
function conditionHash(): string {
  return digestOf(SEED_CASES.map((kase) => ({
    id: kase.id, question: kase.question, oracleType: kase.oracleType, gravity: kase.gravity,
  })));
}

/** Le rapport d'une version, à partir de la démonstration complète. */
function reportOf(
  demo: Awaited<ReturnType<typeof runDemo>>, version: DemoVersion, condition: string,
): AuditReport {
  return reportOfVersion({
    version, agentId: AGENT_ID, health: demo.health, mode: 'noir', passes: demo.passes,
    runId: `demo:${version.id}`, conditionHash: condition,
    startedAt: demo.generatedAt, finishedAt: demo.generatedAt, state: 'done',
    sampled: false, calibrated: false, generatedAt: demo.generatedAt,
  });
}

/** Une ligne de résumé : la porte et l'empreinte, en clair. */
function summary(label: string, report: AuditReport): string {
  const gate = report.gate.allowed ? 'verte' : 'ROUGE';
  return `${label} — porte ${gate} · ${report.gauges.length} jauges · ${report.cases.length} cas`
    + ` · ${report.fissures.length} fissures · empreinte ${report.integrity.digest.slice(0, 16)}…`;
}

/** Point d'entrée : joue, exporte, résume. */
async function main(): Promise<number> {
  const demo = await runDemo();
  const condition = conditionHash();
  const witness = demo.versions.find((version) => version.isWitness) ?? demo.versions[0];
  const candidate = demo.versions.find((version) => version.id === 'v5')
    ?? demo.versions[demo.versions.length - 1] ?? witness;

  const candidateReport = reportOf(demo, candidate, condition);
  const witnessReport = reportOf(demo, witness, condition);

  const jsonPath = writePublic('audit-report.json', `${JSON.stringify(candidateReport, null, 2)}\n`);
  const mdPath = writePublic('audit-report.md', toMarkdown(candidateReport, 'en'));
  const witnessPath = writePublic('audit-report-witness.md', toMarkdown(witnessReport, 'en'));

  process.stdout.write(`${jsonPath}\n${mdPath}\n${witnessPath}\n`);
  process.stdout.write(`${summary(`rapport ${candidate.id}`, candidateReport)}\n`);
  process.stdout.write(`${summary(`rapport ${witness.id} (témoin)`, witnessReport)}\n`);
  return 0;
}

process.exit(await main());