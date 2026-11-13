/**
 * Le banc RÉEL — enregistré par défaut, rejouable EN DIRECT à la demande.
 *
 * La clé ne quitte jamais le serveur : le mode direct appelle le proxy (r630
 * derrière le tunnel), le proxy appelle InferHub. Le navigateur ne voit que
 * des réponses et des mesures. Le bouton « Run live » exécute le banc réel
 * dans la page : vraies réponses, vraie latence, vrais jetons, vraies
 * fissures — au moment où vous regardez.
 */
import { useRealRun } from '../use-real-run';
import type { RealRunRecord } from '../use-real-run';
import { useLiveRun } from '../live-run';
import { Section, StateChip } from '../ui';

/** Un état de jauge : jamais la couleur seule, toujours un mot (§25). */
function statusOf(value: number | null, floor: number): { label: string; tone: 'ok' | 'bad' | 'warn' } {
  if (value === null) return { label: 'not enough data', tone: 'warn' };
  if (value < floor) return { label: 'below floor', tone: 'bad' };
  return { label: 'above floor', tone: 'ok' };
}

/** Les totaux de la mesure : appels, jetons, coût, latence. */
function Totals({ run }: { readonly run: RealRunRecord }): JSX.Element {
  const t = run.totals;
  return (
    <dl className="real__totals">
      <div><dt>model</dt><dd className="mono">{run.meta.model}</dd></div>
      <div><dt>calls</dt><dd>{t.calls}</dd></div>
      <div><dt>tokens</dt><dd>{t.tokens.toLocaleString('en-US')}</dd></div>
      <div><dt>cost</dt><dd>${t.costUsd.toFixed(4)}</dd></div>
      <div><dt>latency (mean)</dt><dd>{Math.round(t.latencyMeanMs)} ms</dd></div>
      <div><dt>latency (max)</dt><dd>{Math.round(t.latencyMaxMs)} ms</dd></div>
      <div><dt>passes / case</dt><dd>{run.meta.passes}</dd></div>
      <div><dt>mode</dt><dd>{run.meta.mode}</dd></div>
    </dl>
  );
}

/** La scorecard réelle : chaque jauge avec son effectif et son plancher. */
function RealScorecard({ run }: { readonly run: RealRunRecord }): JSX.Element {
  return (
    <table className="data">
      <caption>
        Measured on {new Date(run.meta.recordedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC —
        sample size, range and floor for every gauge, never a bare percentage.
      </caption>
      <thead>
        <tr><th scope="col">Gauge</th><th scope="col">n</th><th scope="col">value</th>
          <th scope="col">range</th><th scope="col">floor</th><th scope="col">status</th></tr>
      </thead>
      <tbody>
        {run.scorecard.map((row) => {
          const status = statusOf(row.value, row.floor);
          return (
            <tr key={row.gauge}>
              <th scope="row">{row.gauge}</th>
              <td>{row.n}</td>
              <td>{row.value === null ? '—' : `${Math.round(row.value * 100)} %`}</td>
              <td>{row.ciLow === null || row.ciHigh === null ? '—' : `${Math.round(row.ciLow * 100)}–${Math.round(row.ciHigh * 100)} %`}</td>
              <td>{Math.round(row.floor * 100)} %</td>
              <td><StateChip tone={status.tone} label={status.label} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Les fissures réellement observées : la non-détermination du modèle. */
function RealCracks({ run }: { readonly run: RealRunRecord }): JSX.Element {
  const cracked = run.cases.filter((item) => item.crack !== null);
  if (cracked.length === 0) {
    return <p className="lede">No cracked case in this run: the model answered the same thing three times.</p>;
  }
  return (
    <ul className="real__cracks">
      {cracked.map((item) => (
        <li key={item.id}>
          <span className="mono">{item.id}</span>
          <StateChip tone="bad" label={item.crack ?? ''} />
          <span>{item.question}</span>
        </li>
      ))}
    </ul>
  );
}

/** Une réponse réelle, avec l'oracle en face. */
function RealAnswer({ item }: { readonly item: RealRunRecord['cases'][number] }): JSX.Element {
  return (
    <article className="real__answer">
      <p className="real__question"><span className="mono">{item.id}</span> {item.question}</p>
      <p className="real__oracle"><strong>Oracle:</strong> {item.oracle ?? '—'}</p>
      <blockquote className="quote">{item.answers[0]}</blockquote>
      <p className="real__meta">
        {item.latencyMs[0]} ms · {item.tokens[0]} tokens · {item.citations} citation(s) emitted
        {' '}· {item.verdicts.filter((v) => v.gauge === 'exactitude').map((v) => v.kind).join(', ')}
      </p>
    </article>
  );
}

/** La section, avec son bouton de rejeu direct. */
export default function RealRun() {
  const recorded = useRealRun();
  const live = useLiveRun();
  const run = live.result ?? recorded.run;
  const answers = run?.cases.filter((item) => ['D-01', 'R-04', 'F-01'].includes(item.id)) ?? [];
  const red = run?.gate.motives.filter((motive) => !motive.passed) ?? [];

  return (
    <Section
      id="real-run"
      eyebrow="Real environment"
      title="A real model answers. The bench measures."
      intro="Twelve cases from the corpus, three passes each. You can watch it happen: the run below is recorded, and the button replays it live through a server that holds the key — the browser never sees it."
    >
      <div className="real__toolbar">
        <button type="button" className="run-live" onClick={() => void live.start()} disabled={live.running}
          aria-busy={live.running}>
          {live.running ? 'Running the bench…' : '▶ Run live now'}
        </button>
        <StateChip tone={live.result ? 'ok' : 'info'} label={live.result ? 'LIVE' : 'recorded'} />
        {live.running && live.progress && (
          <span role="status" className="real__progress">
            case {live.progress.done}/{live.progress.total} — {live.progress.caseId}
          </span>
        )}
        {live.error && <span className="real__progress real__progress--err">{live.error}</span>}
      </div>

      {!run && recorded.loading && <p role="status">Loading the recorded run…</p>}
      {!run && recorded.error && (
        <p>No run yet. Produce one with <code>INFERHUB_API_KEY=… npm run demo:real</code>.</p>
      )}

      {run && (
        <>
          <Totals run={run} />
          <RealScorecard run={run} />
          <h3>The gate</h3>
          <p>
            <StateChip tone={run.gate.allowed ? 'ok' : 'bad'} label={run.gate.allowed ? 'GREEN' : 'RED'} />
            {' '}This version would not be promoted, and the bench says exactly why:
          </p>
          <ul className="real__motives">
            {red.map((motive) => (
              <li key={motive.rule}><StateChip tone="bad" label="REFUSED" /> {motive.detail}</li>
            ))}
          </ul>
          <h3>Cracks — the model is not deterministic</h3>
          <RealCracks run={run} />
          <h3>Two answers, against the oracle</h3>
          {answers.map((item) => <RealAnswer key={item.id} item={item} />)}
          <p className="lede">
            The model found the right values, and grounded almost nothing: it emitted
            {' '}{run.totals.citationsEmitted} citation-like strings, and none resolved to a document.
            That is the whole reason this product exists.
          </p>
        </>
      )}
    </Section>
  );
}
