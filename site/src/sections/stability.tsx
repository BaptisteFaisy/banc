/**
 * Passages, fissures et stabilité (§9). Un cas n'est jamais jugé sur une
 * réponse isolée, et une fissure a toujours une attribution.
 */
import { PASSES } from '../demo-data';
import { useDemoFacts } from '../demo-context';
import { Callout, Section, StateChip } from '../ui';

const VERDICT_LABEL: Record<string, string> = {
  exact: 'Exact',
  faux: 'Wrong',
  infonde: 'Unfounded',
  concordant: 'Concordant',
  fond: 'Founded',
};

export default function Stability() {
  const facts = useDemoFacts();
  const CRACK_CASE = facts?.crack;
  if (!CRACK_CASE) return null;
  return (
    <Section
      id="stability"
      eyebrow="Passages"
      title="Three passes, and the crack in between"
      intro="An agent is not deterministic: the same question twice does not always give the same answer. The bench asks each case k times — 3 by default — and never judges a single passage."
    >
      <div className="cards cards--two">
        <article className="card">
          <p className="card__kicker">A crack</p>
          <h3 className="card__title">The verdict changes from one passage to the next.</h3>
          <p className="card__body">
            A cracked case is not a hard case: it is a badly written case
            <strong> or </strong> an unstable agent — and the bench says which one, with the gap
            between the answers.
          </p>
          <p>
            <StateChip tone="warn" label="Crack — attribution required: case or agent" />
          </p>
        </article>

        <article className="card">
          <p className="card__kicker">Stability</p>
          <h3 className="card__title">The share of cases that are not cracked.</h3>
          <p className="card__body">
            A first-rank gauge. An agent that is right but unstable is unusable in production, and a
            cracked case joins a work list: to rewrite, to decide, or to disable.
          </p>
          <p>
            <StateChip tone="info" label={`${PASSES} passages per case by default`} />
          </p>
        </article>
      </div>

      <div className="crack" aria-labelledby="crack-title">
        <p className="crack__kicker">
          Case {CRACK_CASE.caseId} on version {CRACK_CASE.agentVersion}
        </p>
        <h3 className="crack__title" id="crack-title">
          {CRACK_CASE.question}
        </h3>
        <ol className="crack__passages">
          {CRACK_CASE.passages.map((passage) => (
            <li className="crack__passage" key={passage.no}>
              <p className="crack__meta">
                <span className="mono">passage {passage.no}</span>
                <StateChip
                  tone={passage.kind === 'exact' ? 'ok' : 'bad'}
                  label={VERDICT_LABEL[passage.kind] ?? passage.kind}
                />
              </p>
              <p className="crack__answer">{passage.answer}</p>
              <p className="crack__note">{passage.note}</p>
            </li>
          ))}
        </ol>
        <p className="crack__attribution">
          <StateChip tone="bad" label={CRACK_CASE.attribution} />
          <span>{CRACK_CASE.reason}</span>
        </p>
      </div>

      <Callout tone="info" title="The bench decides, it does not shrug">
        <p>
          The oracle did not move between the three passages and the same case passes on the other
          versions, so the crack belongs to the agent. When the oracle itself moves between
          passages, the bench says the case is badly written instead.
        </p>
      </Callout>
    </Section>
  );
}