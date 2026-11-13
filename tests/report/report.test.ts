/**
 * Le rapport d'essai exportable (BE-29, §18).
 *
 * Ce test verrouille les quatre propriétés qui font qu'un rapport vaut comme
 * pièce d'audit : il dit ce qu'il a mesuré (la porte et ses motifs), il porte
 * sa preuve cas par cas, il avoue ses réserves (§25), et son empreinte SHA-256
 * casse à la moindre retouche. Une seule mesure, deux sorties (JSON et
 * Markdown) — c'est le même modèle qui est vérifié ici.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { runDemo } from '../../src/demo/run.js';
import type { DemoRun, DemoVersion } from '../../src/demo/run.js';
import { SEED_CASES } from '../../src/seed/index.js';
import { caseEvidence, ANSWER_EXCERPT } from '../../src/report/evidence.js';
import { casesOfVersion, reportOfVersion } from '../../src/report/from-demo.js';
import { canonicalJson, digestOf } from '../../src/report/integrity.js';
import { toMarkdown } from '../../src/report/markdown.js';
import type { AuditReport } from '../../src/report/types.js';

/** L'empreinte de la condition : les mêmes cas pour les deux versions comparées. */
const CONDITION = digestOf(SEED_CASES.map((kase) => ({ id: kase.id, question: kase.question })));

let demo: DemoRun;
let v4: DemoVersion;
let v5: DemoVersion;
let reportV5: AuditReport;
let reportV4: AuditReport;

/** Bâtit le rapport d'une version, à partir de la démonstration mesurée. */
function build(version: DemoVersion): AuditReport {
  return reportOfVersion({
    version, agentId: 'agent-support', health: demo.health, mode: 'noir', passes: demo.passes,
    runId: `test:${version.id}`, conditionHash: CONDITION,
    startedAt: demo.generatedAt, finishedAt: demo.generatedAt, state: 'done',
    sampled: false, calibrated: false, generatedAt: demo.generatedAt,
  });
}

/** Le corps du rapport, sans son empreinte : ce que le digest scelle. */
function withoutIntegrity(report: AuditReport): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...report };
  delete copy.integrity;
  return copy;
}

beforeAll(async () => {
  demo = await runDemo();
  v4 = demo.versions.find((version) => version.id === 'v4') as DemoVersion;
  v5 = demo.versions.find((version) => version.id === 'v5') as DemoVersion;
  reportV5 = build(v5);
  reportV4 = build(v4);
}, 30_000);

describe('rapport d’essai (BE-29, §18)', () => {
  it('v5 est refusée, et la porte donne son motif chiffré', () => {
    expect(reportV5.gate.allowed).toBe(false);
    const failing = reportV5.gate.motives.filter((motive) => !motive.passed);
    expect(failing.length).toBeGreaterThan(0);
    const floor = failing.find((motive) => motive.rule === 'aucune_jauge_sous_son_plancher');
    expect(floor?.gauges).toContain('fondation');
  });

  it('le témoin v4 passe la porte', () => {
    expect(reportV4.gate.allowed).toBe(true);
  });

  it('le rapport porte la preuve cas par cas', () => {
    expect(reportV5.cases.length).toBe(v5.outcomes.length);
    expect(casesOfVersion(v5).length).toBe(v5.outcomes.length);
    const d01 = reportV5.cases.find((item) => item.caseId === 'D-01');
    expect(d01?.question.length).toBeGreaterThan(0);
    expect(d01?.verdicts.length).toBeGreaterThan(0);
    expect(d01?.oracleType).toBe('valeur_dérivée');
    expect(d01?.answerHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('avoue ses réserves : un banc non calibré le dit, une jauge sans recul aussi', () => {
    expect(reportV5.honesty.calibrated).toBe(false);
    expect(reportV5.honesty.undecidedGauges).toContain('citation_vivante');
  });

  it('l’empreinte est déterministe et casse à la moindre retouche', () => {
    expect(build(v5).integrity.digest).toBe(reportV5.integrity.digest);
    expect(reportV5.integrity.algorithm).toBe('sha256');
    expect(reportV5.integrity.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digestOf(withoutIntegrity(reportV5))).toBe(reportV5.integrity.digest);
    const mutated = { ...withoutIntegrity(reportV5), header: { ...reportV5.header, runId: 'autre' } };
    expect(digestOf(mutated)).not.toBe(reportV5.integrity.digest);
  });

  it('le Markdown contient toutes les sections, l’empreinte et l’en-tête corrigé', () => {
    const md = toMarkdown(reportV5, 'en');
    for (const section of [
      '# Bench trial report', '## Trial identity', '## Trial conditions', '## The eight gauges',
      '## Promotion gate', '## Evidence, case by case', '## Integrity',
    ]) {
      expect(md).toContain(section);
    }
    expect(md).toContain(reportV5.integrity.digest);
    expect(md).toContain('| Gauge |');
  });

  it('le Markdown suit la langue demandée', () => {
    const fr = toMarkdown(reportV5, 'fr');
    expect(fr).toContain('Rapport d’essai du banc');
    expect(fr).toContain('| Jauge |');
  });
});

describe('preuve et intégrité (briques du rapport)', () => {
  it('canonicalJson ignore l’ordre des clés, digestOf le détecte', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
    expect(digestOf({ a: 1, b: 2 })).toBe(digestOf({ b: 2, a: 1 }));
    expect(digestOf({ a: 1 })).not.toBe(digestOf({ a: 2 }));
  });

  it('caseEvidence tronque la réponse et scelle son empreinte', () => {
    const long = 'x'.repeat(ANSWER_EXCERPT + 50);
    const oracle = v4.outcomes[0].oracle;
    const evidenceOf = () => caseEvidence({
      kase: { id: 'X-1', question: 'q', gravity: 'souhaitable', oracleType: 'valeur_dérivée' },
      oracle, verdicts: [], answers: [long], citations: [],
    });
    const ev = evidenceOf();
    expect(ev.answer.length).toBe(ANSWER_EXCERPT + 1);
    expect(ev.answer.endsWith('…')).toBe(true);
    expect(ev.answerHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ev.answerHash).toBe(evidenceOf().answerHash);
  });
});