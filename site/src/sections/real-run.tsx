/**
 * Un banc RÉEL, mesuré — la section la plus proche de l'environnement de prod.
 *
 * Ce n'est pas une simulation : un vrai modèle a répondu aux cas du corpus,
 * trois fois chacun, et le banc a mesuré ses réponses avec les mêmes jauges,
 * la même porte et le même journal. Ce qui est affiché ici est la MESURE :
 * latence réelle, jetons réels, coût réel, et les verdicts que le banc en a
 * tiré.
 *
 * Un mot sur la clé : le site est statique, donc la clé InferHub ne peut pas y
 * vivre — elle serait lisible dans le bundle. Le banc se joue côté serveur
 * (`npm run demo:real`) et c'est sa mesure qui est publiée. La sécurité n'est
 * pas un détail contourné pour faire une démo : c'est la raison pour laquelle
 * la mesure est enregistrée.
 */
import { useRealRun } from '../use-real-run';
import type { RealRunRecord } from '../use-real-run';
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
      <div><dt>latency (mean)</dt><dd>{t.latencyMeanMs} ms</dd></div>
      <div><dt>latency (max)</dt><dd>{t.latencyMaxMs} ms</dd></div>
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

/** La section : la mesure réelle, et ce qu'elle dit. */
export default function RealRun() {
  const { run, loading, error } = useRealRun();
  if (loading) {
    return (
      <Section id="real-run" eyebrow="Real environment" title="A real bench run">
        <p role="status">Loading the recorded run…</p>
      </Section>
    );
  }
  if (error || !run) {
    return (
      <Section id="real-run" eyebrow="Real environment" title="A real bench run">
        <p>No recorded run yet. Produce one with <code>INFERHUB_API_KEY=… npm run demo:real</code>.</p>
      </Section>
    );
  }
  const red = run.gate.motives.filter((motive) => !motive.passed);
  const answers = run.cases.filter((item) => ['D-01', 'R-04', 'F-01'].includes(item.id));
  return (
    <Section
      id="real-run"
      eyebrow="Real environment"
      title="A real model answered. The bench measured. Here is the measurement."
      intro="Twelve cases from the corpus, three passes each, one real model. Nothing here is simulated: the latency, the tokens and the cost come from the API, and the verdicts come from the same gauges the product uses."
    >
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
        The model found the right values, and it grounded almost nothing: it emitted
        {' '}{run.totals.citationsEmitted} citation-like strings, and none of them resolved to a document.
        That is the whole reason this product exists — an answer that looks right, with nothing behind it.
      </p>
    </Section>
  );
}
