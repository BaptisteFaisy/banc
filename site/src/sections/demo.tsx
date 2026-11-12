/**
 * La démonstration, jouable : le scorecard du témoin face à deux candidats,
 * un cas en échec, une dérive de vérité et une fissure.
 *
 * Les onglets sont accessibles au clavier (flèches, Début, Fin) et chaque
 * état porte un mot, pas seulement une couleur.
 */
import { useState, type KeyboardEvent } from 'react';
import { EN } from '../../../src/i18n/en.js';
import { COST_CEILING, VERSIONS } from '../demo-data';
import { useDemoFacts } from '../demo-context';
import type { DemoFacts } from '../demo-facts';
import type { Gauge, GaugeDelta, Scorecard, ScorecardRow } from '../../../src/domain/vocabulary.js';
import { Section, StateChip } from '../ui';

const TABS = [
  { id: 'scorecard', label: 'Scorecard — v4 · v5 · v6' },
  { id: 'failure', label: 'Failure — case R-04' },
  { id: 'drift', label: 'Truth drift — case D-13' },
  { id: 'crack', label: 'Crack — case R-02 on v6' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const GAUGE_ORDER: readonly Gauge[] = [
  'exactitude',
  'fondation',
  'citation_vivante',
  'exactitude_de_règle',
  'refus_correct',
  'complétude',
  'stabilité',
  'coût',
];

const GAUGE_LABEL: Record<Gauge, string> = {
  exactitude: EN['gauge.exactitude'],
  fondation: EN['gauge.fondation'],
  citation_vivante: EN['gauge.citation_vivante'],
  exactitude_de_règle: EN['gauge.exactitude_de_règle'],
  refus_correct: EN['gauge.refus_correct'],
  complétude: EN['gauge.completude'],
  stabilité: EN['gauge.stabilite'],
  coût: EN['gauge.cout'],
};

/** Ton d'un état : jamais la couleur seule, toujours un mot. */
function toneFor(row: ScorecardRow, gauge: Gauge) {
  if (row.value === null) return 'neutral' as const;
  if (gauge === 'coût') return row.value > COST_CEILING ? ('bad' as const) : ('ok' as const);
  return row.value < row.floor ? ('bad' as const) : ('ok' as const);
}

/** Le mot affiché avec l'état. */
function labelFor(row: ScorecardRow, gauge: Gauge): string {
  if (row.value === null) return 'NOT ENOUGH DATA';
  if (gauge === 'coût') return row.value > COST_CEILING ? 'ABOVE CEILING' : 'INSIDE CEILING';
  return row.value < row.floor ? 'BELOW FLOOR' : 'ABOVE FLOOR';
}

/** L'écart au témoin, en points et avec sa nature. */
function deltaText(delta: GaugeDelta): string {
  if (delta.delta === null) return 'no comparison with the witness';
  if (delta.delta === 0) return 'no change vs v4';
  const points = Math.abs(Math.round(delta.delta * 100));
  const sign = delta.delta > 0 ? '+' : '−';
  const kind = delta.kind === 'regression' ? 'regression' : 'progress';
  return `${sign}${points} pt${points > 1 ? 's' : ''} vs v4 · ${kind}`;
}

function GaugeCell({ scorecard, gauge }: { scorecard: Scorecard; gauge: Gauge }) {
  const row = scorecard.rows.find((item) => item.gauge === gauge);
  if (!row) return <td className="scorecell">—</td>;
  const delta = scorecard.deltas.find((item) => item.gauge === gauge);
  return (
    <td className="scorecell">
      <span className="scorecell__value">
        {row.value === null ? 'not enough data' : `${Math.round(row.value * 100)}%`}
      </span>
      <span className="scorecell__meta">
        n = {row.n} · {row.ciLow}–{row.ciHigh}
      </span>
      <StateChip tone={toneFor(row, gauge)} label={labelFor(row, gauge)} />
      <span className="scorecell__delta">{delta ? deltaText(delta) : 'reference version'}</span>
    </td>
  );
}

function ScorecardPanel({ facts }: { readonly facts: DemoFacts }) {
  const SCORECARDS = facts.scorecards;
  const REGRESSIONS_V5 = facts.versions.find((version) => version.id === 'v5')?.regressions ?? [];
  return (
    <div className="demo__body">
      <div className="table-scroll">
        <table className="data data--scorecard">
          <caption className="data__caption">
            Gold suite, black mode (open book). Each cell shows the value, its sample size and its
            range — never a bare percentage.
          </caption>
          <thead>
            <tr>
              <th scope="col">Gauge</th>
              {VERSIONS.map((version) => (
                <th scope="col" key={version.id}>
                  {version.label}
                  {version.id === 'v4' ? ' — witness' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GAUGE_ORDER.map((gauge) => (
              <tr key={gauge}>
                <th scope="row">{GAUGE_LABEL[gauge]}</th>
                {SCORECARDS.map((scorecard) => (
                  <GaugeCell key={scorecard.agentVersionId} scorecard={scorecard} gauge={gauge} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="demo__regressions">
        <h3 className="demo__subtitle">Blocking cases regressed on v5</h3>
        <ul className="demo__regression-list">
          {REGRESSIONS_V5.map((regression) => (
            <li key={regression.id}>
              <span className="mono">{regression.caseId}</span>
              <span>{GAUGE_LABEL[regression.gauge]}</span>
              <StateChip tone="bad" label="REGRESSION · blocking" />
            </li>
          ))}
        </ul>
        <p className="demo__note">
          The two cases are what refuses the promotion: every gauge of v5 stays above its floor.
        </p>
      </div>
    </div>
  );
}

function FailurePanel({ facts }: { readonly facts: DemoFacts }) {
  const FAILURE_CASE = facts.failure;
  if (!FAILURE_CASE) return null;
  return (
    <div className="demo__body">
      <p className="demo__case">
        <span className="mono">{FAILURE_CASE.caseId}</span>
        <span className="demo__question">{FAILURE_CASE.question}</span>
        <StateChip tone="bad" label="BLOCKING · REGRESSED ON v5" />
      </p>
      <div className="demo__answer">
        <p className="demo__answer-label">Agent answer (v5)</p>
        <blockquote className="quote">{FAILURE_CASE.answer}</blockquote>
        <p className="demo__answer-label">Citations produced</p>
        <p className="demo__citations">
          <StateChip tone="bad" label="NONE — an answer with no source is unfounded" />
        </p>
      </div>
      <div className="demo__oracle">
        <p className="demo__answer-label">Oracle — living rule, three factors</p>
        <p className="demo__rule">{FAILURE_CASE.rule}</p>
        <ol className="demo__factors">
          {FAILURE_CASE.factors.map((factor, index) => (
            <li key={factor.label}>
              <span className="demo__factor-index">{index + 1}</span>
              <span className="demo__factor-label">{factor.label}</span>
              <span className="demo__factor-source mono">{factor.source}</span>
              <span className="demo__factor-read mono">
                read {factor.read} · expected {factor.expected}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="demo__verdicts">
        {FAILURE_CASE.verdicts.map((verdict) => (
          <p className="demo__verdict" key={verdict.gauge}>
            <StateChip tone="bad" label={verdict.label.toUpperCase()} />
            <span className="demo__verdict-detail">{verdict.detail}</span>
          </p>
        ))}
        <p className="demo__note">
          Missing motives: {FAILURE_CASE.missingMotives.join(' · ')}
        </p>
      </div>
    </div>
  );
}

function DriftPanel({ facts }: { readonly facts: DemoFacts }) {
  const DRIFT_CASE = facts.drift;
  if (!DRIFT_CASE) return null;
  return (
    <div className="demo__body">
      <p className="demo__case">
        <span className="mono">{DRIFT_CASE.caseId}</span>
        <span className="demo__question">{DRIFT_CASE.question}</span>
        <StateChip tone="ok" label="TRUTH DRIFT · NOT A REGRESSION" />
      </p>
      <div className="table-scroll">
        <table className="data">
          <caption className="data__caption">
            History of truth for {DRIFT_CASE.caseId}, recomputed from {DRIFT_CASE.source}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Oracle version</th>
              <th scope="col">Value</th>
              <th scope="col">Computed at</th>
              <th scope="col">Value hash</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{DRIFT_CASE.before.version}</th>
              <td className="mono">{DRIFT_CASE.before.value}</td>
              <td className="mono">{DRIFT_CASE.before.computedAt}</td>
              <td className="mono">{DRIFT_CASE.before.hash}</td>
            </tr>
            <tr>
              <th scope="row">{DRIFT_CASE.after.version}</th>
              <td className="mono">{DRIFT_CASE.after.value}</td>
              <td className="mono">{DRIFT_CASE.after.computedAt}</td>
              <td className="mono">{DRIFT_CASE.after.hash}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="demo__note">
        Agent answer on {DRIFT_CASE.agentVersion}: &quot;{DRIFT_CASE.agentAnswer}&quot; — correct on
        Monday, and the world moved on Tuesday.
      </p>
      <p className="demo__verdict">
        <StateChip tone="ok" label={DRIFT_CASE.verdict.toUpperCase()} />
        <span className="demo__verdict-detail">{DRIFT_CASE.detail}</span>
      </p>
    </div>
  );
}

function CrackPanel({ facts }: { readonly facts: DemoFacts }) {
  const CRACK_CASE = facts.crack;
  if (!CRACK_CASE) return null;
  return (
    <div className="demo__body">
      <p className="demo__case">
        <span className="mono">{CRACK_CASE.caseId}</span>
        <span className="demo__question">{CRACK_CASE.question}</span>
        <StateChip tone="warn" label="CRACK · 3 PASSAGES" />
      </p>
      <ol className="demo__passages">
        {CRACK_CASE.passages.map((passage) => (
          <li key={passage.no}>
            <p className="demo__passage-meta">
              <span className="mono">passage {passage.no}</span>
              <StateChip
                tone={passage.kind === 'exact' ? 'ok' : 'bad'}
                label={passage.kind === 'exact' ? 'EXACT' : 'WRONG'}
              />
            </p>
            <p className="demo__passage-answer">{passage.answer}</p>
            <p className="demo__passage-note">{passage.note}</p>
          </li>
        ))}
      </ol>
      <p className="demo__verdict">
        <StateChip tone="bad" label={`ATTRIBUTION: ${CRACK_CASE.attribution.toUpperCase()}`} />
        <span className="demo__verdict-detail">{CRACK_CASE.reason}</span>
      </p>
    </div>
  );
}

function panelFor(id: TabId, facts: DemoFacts) {
  if (id === 'failure') return <FailurePanel facts={facts} />;
  if (id === 'drift') return <DriftPanel facts={facts} />;
  if (id === 'crack') return <CrackPanel facts={facts} />;
  return <ScorecardPanel facts={facts} />;
}

export default function Demo() {
  const [active, setActive] = useState<TabId>('scorecard');
  const facts = useDemoFacts();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((tab) => tab.id === active);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    setActive(TABS[next].id);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[next]?.focus();
  }

  return (
    <Section
      id="demo"
      eyebrow="Demo"
      title="The seeded bench, in four views"
      intro="One agent, three versions, forty cases. These are the views a judge sees after two minutes of running the bench."
    >
      <div className="demo">
        <div className="tabs" role="tablist" aria-label="Demo views" onKeyDown={onKeyDown}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              className="tab"
              aria-selected={tab.id === active}
              aria-controls={`panel-${tab.id}`}
              tabIndex={tab.id === active ? 0 : -1}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          className="tabpanel"
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          tabIndex={0}
        >
          {facts ? panelFor(active, facts) : (
            <p className="demo__note" role="status">
              Computing the bench — recalculating oracles, running 3 passages per case, judging eight gauges…
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}