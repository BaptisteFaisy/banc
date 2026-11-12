/**
 * La distinction centrale (§7) : dérive de vérité ≠ régression de l'agent.
 * Les deux cas, côte à côte.
 */
import { DRIFT_CASE } from '../demo-data';
import { Callout, Section, StateChip } from '../ui';

function RegressionCard() {
  return (
    <article className="card card--bad">
      <p className="card__kicker">Case A</p>
      <h3 className="card__title">Regression of the agent.</h3>
      <p className="card__body">
        The truth did not move, the answer of the agent did. That is a regression, and it comes back
        with the questions that changed.
      </p>
      <p>
        <StateChip tone="bad" label="Regression — blocking case affected" />
      </p>
    </article>
  );
}

function DriftCard() {
  return (
    <article className="card card--ok">
      <p className="card__kicker">Case B</p>
      <h3 className="card__title">Truth drift.</h3>
      <p className="card__body">
        The truth changed on Tuesday, the agent missed nothing. The agent is not at fault: the case
        is replayed, the event is traced, and the regression is closed as a drift with the proof of
        the change.
      </p>
      <p>
        <StateChip tone="ok" label="Truth drift — not a regression of the agent" />
      </p>
    </article>
  );
}

function DriftExample() {
  return (
    <div className="drift-example">
      <p className="drift-example__case">
        <span className="drift-example__id">{DRIFT_CASE.caseId}</span>
        {DRIFT_CASE.question}
      </p>
      <p className="drift-example__line">
        <span className="drift-example__label">Truth before</span>
        <span className="mono">{DRIFT_CASE.before.value}</span>
        <span className="drift-example__label">computed {DRIFT_CASE.before.computedAt}</span>
        <span className="mono">hash {DRIFT_CASE.before.hash}</span>
      </p>
      <p className="drift-example__line">
        <span className="drift-example__label">Truth after</span>
        <span className="mono">{DRIFT_CASE.after.value}</span>
        <span className="drift-example__label">computed {DRIFT_CASE.after.computedAt}</span>
        <span className="mono">hash {DRIFT_CASE.after.hash}</span>
      </p>
      <p className="drift-example__line">
        <span className="drift-example__label">Agent answer</span>
        <span className="mono">{DRIFT_CASE.agentAnswer}</span>
      </p>
      <p className="drift-example__verdict">
        <StateChip tone="ok" label={DRIFT_CASE.verdict} />
        <span className="drift-example__detail">{DRIFT_CASE.detail}</span>
      </p>
    </div>
  );
}

export default function Drift() {
  return (
    <Section
      id="drift"
      eyebrow="The living oracle"
      title="Truth drift is not an agent regression"
      intro="Oracles are recalculated at every run. When the truth moves, the agent is not the one who broke."
    >
      <div className="cards cards--two">
        <RegressionCard />
        <DriftCard />
      </div>
      <DriftExample />
      <Callout tone="info" title="Why it matters">
        <p>
          Every case keeps a history of truth — oracle version, computation date, value hash. That is
          the distinction every evaluation framework forgets, and it is the one that saves three days
          of prompt debugging when it was the organisation that changed.
        </p>
      </Callout>
    </Section>
  );
}
