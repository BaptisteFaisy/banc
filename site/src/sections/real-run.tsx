/**
 * Le banc RÉEL — corpus scellé, réponse jamais donnée, mesure publiée.
 *
 * Trois choses distinguent cette section d'une démo habitée par un script :
 *
 *   1. le monde n'est pas inventé : les questions portent sur le dépôt Banc
 *      lui-même (19 fichiers réels, les commits de `git log`, les PR et runs du
 *      REST GitHub), capturés et scellés par empreinte SHA-256 ;
 *   2. la valeur de l'oracle n'est pas versée à l'agent : elle est RECALCULÉE
 *      par le banc depuis les bytes du corpus, et l'agent doit aller lire le
 *      fichier qui la contient (deux tours : il demande, on sert) ;
 *   3. les citations sont résolues CONTRE le corpus : une source inventée rend
 *      « unfounded », une source réelle qui ne dit pas la valeur rend « not
 *      live » — les deux états sont atteignables, rien n'est constant.
 *
 * La garde qui rend l'écriture impossible sans casser le build vit dans
 * `tests/real/no-script.test.ts` ; elle est nommée ici, parce qu'un chiffre
 * sans méthode lisible n'est pas une preuve.
 */
import { useRealRun } from '../use-real-run';
import type { RealRunRecord } from '../use-real-run';
import { useLiveRun } from '../live-run';
import type { EtatProxy } from '../live-run';
import { Section, StateChip } from '../ui';

/** L'état du proxy direct, double-codé : un mot, jamais la couleur seule. */
function ProxyChip({ status }: { readonly status: EtatProxy }): JSX.Element {
  const map = {
    'en-ligne': { tone: 'ok', label: 'proxy online' },
    'hors-ligne': { tone: 'bad', label: 'proxy offline' },
    inconnu: { tone: 'warn', label: 'proxy: probing' },
  } as const;
  const etat = map[status];
  return <StateChip tone={etat.tone} label={etat.label} />;
}

/** Un état de jauge : jamais la couleur seule, toujours un mot. */
function statusOf(value: number | null, floor: number): { label: string; tone: 'ok' | 'bad' | 'warn' } {
  if (value === null) return { label: 'not enough data', tone: 'warn' };
  if (value < floor) return { label: 'below floor', tone: 'bad' };
  return { label: 'above floor', tone: 'ok' };
}

/** Les totaux de la mesure : appels, tours, jetons, coût, latence, fondation. */
function Totals({ run }: { readonly run: RealRunRecord }): JSX.Element {
  const t = run.totals;
  return (
    <dl className="real__totals">
      <div><dt>model</dt><dd className="mono">{run.meta.model}</dd></div>
      <div><dt>cases</dt><dd>{t.cases}</dd></div>
      <div><dt>passes / case</dt><dd>{run.meta.passes}</dd></div>
      <div><dt>model calls</dt><dd>{t.tours ?? '—'}</dd></div>
      <div><dt>tokens</dt><dd>{t.tokens.toLocaleString('en-US')}</dd></div>
      <div><dt>cost</dt><dd>${t.costUsd.toFixed(4)}</dd></div>
      <div><dt>latency (mean)</dt><dd>{Math.round(t.latencyMeanMs)} ms</dd></div>
      <div><dt>latency (max)</dt><dd>{Math.round(t.latencyMaxMs)} ms</dd></div>
      <div><dt>documents read</dt><dd>{t.documentsLus ?? '—'}</dd></div>
      <div><dt>citations grounded</dt><dd>{t.citationsFondees ?? 0} / {t.citationsEmitted}</dd></div>
      <div><dt>providers served</dt><dd className="mono">{(t.modeleservis ?? []).join(' · ') || 'unknown'}</dd></div>
      <div><dt>mode</dt><dd>{run.meta.mode}</dd></div>
    </dl>
  );
}

/**
 * Le corpus réel : d'où sort chaque valeur.
 *
 * Un chiffre sans provenance n'est pas une preuve : voici le commit capturé,
 * l'horodatage, le nombre de fichiers et l'état du sceau. Si un fichier du
 * dépôt change sans recapture, le sceau rompt et la page le dit.
 */
function Corpus({ run }: { readonly run: RealRunRecord }): JSX.Element | null {
  const corpus = run.meta.corpus;
  if (!corpus) return null;
  return (
    <dl className="real__totals">
      <div><dt>corpus</dt><dd className="mono">{corpus.depot} @ {corpus.commit.slice(0, 7)}</dd></div>
      <div><dt>captured</dt><dd>{corpus.capture.replace('T', ' ').slice(0, 16)} UTC</dd></div>
      <div><dt>files</dt><dd>{corpus.documents}</dd></div>
      <div><dt>seal</dt><dd>
        <StateChip tone={corpus.sceauValide ? 'ok' : 'bad'} label={corpus.sceauValide ? 'sha-256 holds' : 'seal broken'} />
      </dd></div>
      <div><dt>read from</dt><dd>{corpus.sources}</dd></div>
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

/** Une réponse réelle : la question, l'oracle recalculé, ce qui a été lu. */
function RealAnswer({ item }: { readonly item: RealRunRecord['cases'][number] }): JSX.Element {
  const lus = item.docsLus ?? [];
  return (
    <article className="real__answer">
      <p className="real__question"><span className="mono">{item.id}</span> {item.question}</p>
      <p className="real__oracle">
        <strong>Oracle (recomputed from the corpus):</strong> {item.oracle ?? '—'}
        {!item.oracleAlive && <StateChip tone="warn" label="dead oracle: excluded" />}
      </p>
      <blockquote className="quote">{item.answers[0]}</blockquote>
      <p className="real__meta">
        {item.latencyMs[0]} ms · {item.tokens[0]} tokens · {item.tours ?? 1} model call(s)
        {' '}· {item.citationsFondees ?? 0}/{item.citations} citation(s) grounded
        {item.modeleServi ? <> · served by <span className="mono">{item.modeleServi}</span></> : null}
      </p>
      {lus.length > 0 && (
        <p className="real__meta mono">read: {lus.join(', ')}</p>
      )}
    </article>
  );
}

/** Les cas joués, dans l'ordre du corpus : dix-huit questions, pas une de plus. */
function casMontrés(run: RealRunRecord): readonly RealRunRecord['cases'][number][] {
  const montrés = ['RD-01', 'RD-05', 'RD-07', 'RR-01', 'RF-02', 'RF-03'];
  return run.cases.filter((item) => montrés.includes(item.id));
}

/** La section, avec son bouton de rejeu direct. */
export default function RealRun() {
  const recorded = useRealRun();
  const live = useLiveRun();
  const run = live.result ?? recorded.run;
  const red = run?.gate.motives.filter((motive) => !motive.passed) ?? [];

  return (
    <Section
      id="real-run"
      eyebrow="Real environment"
      title="A real model reads this repository. The bench recomputes the truth."
      intro="The questions are about Banc itself: 19 real files, the commits in git log, the PRs and CI runs on GitHub. Every oracle value is recomputed from those bytes and never handed to the agent — it gets an index, asks for a file, and answers from what it read. Grounding is resolved against the sealed corpus, so a made-up source reads as unfounded instead of being decreed dead."
    >
      <div className="real__toolbar">
        <button type="button" className="run-live" onClick={() => void live.start()} disabled={live.running}
          aria-busy={live.running}>
          {live.running ? 'Running the bench…' : '▶ Run live now'}
        </button>
        <StateChip tone={live.result ? 'ok' : 'info'} label={live.result ? 'LIVE' : 'recorded'} />
        <ProxyChip status={live.proxy.status} />
        {live.proxy.url && <span className="mono real__proxy-url">{live.proxy.url}</span>}
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
          <Corpus run={run} />
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
          <h3>Six answers, against the recomputed oracle</h3>
          {casMontrés(run).map((item) => <RealAnswer key={item.id} item={item} />)}
          <p className="lede">
            Not a scripted demo: <span className="mono">tests/real/no-script.test.ts</span> asserts that no
            oracle value reaches the model prompt, that documents are only served after the agent asks
            for them, and that a citation resolving to no real file reads as unfounded. The numbers above
            are what a bench finds when it is not told the answer — including the ones that flatter nobody.
          </p>
        </>
      )}
    </Section>
  );
}
