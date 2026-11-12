/**
 * Les trois formes d'oracle (§6) — la pièce centrale du produit — et l'oracle
 * mort (§6.4). Le cas R-04 vient de la donnée de démonstration : il est
 * repris mot pour mot du cahier des charges.
 */
import { useDemoFacts } from '../demo-context';
import type { DemoFacts } from '../demo-facts';
import { Callout, Section, StateChip } from '../ui';

const DERIVED_EXAMPLES = [
  { case: 'Who owns the payments service?', source: 'Graph: software-service → AtlassianUser / AtlassianTeam' },
  { case: 'Which is the oldest blocking ticket of the sprint?', source: 'Jira: JQL + work-item' },
  { case: 'Was the key rotation page modified this week?', source: 'Confluence: document + version date' },
  { case: 'Is there an open incident on the billing service?', source: 'JSM + graph' },
  { case: 'Which test plan covers acceptance criterion X?', source: 'test-plan / test-run objects in the graph' },
] as const;

function DerivedCard() {
  return (
    <article className="card">
      <p className="card__kicker">1 · Derived value</p>
      <h3 className="card__title">The answer is already in your systems.</h3>
      <p className="card__body">
        It exists in a computable form. The oracle is not typed by a human: it is
        <strong> recalculated at every run</strong> from the source, and the agent has to find that
        value by itself.
      </p>
      <ul className="tight-list">
        {DERIVED_EXAMPLES.map((item) => (
          <li key={item.case}>
            <span className="tight-list__case">{item.case}</span>
            <span className="tight-list__source">{item.source}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function RuleCard() {
  return (
    <article className="card">
      <p className="card__kicker">2 · Living rule</p>
      <h3 className="card__title">The answer is a predicate on the current state.</h3>
      <p className="card__body">
        The rule is stored as an expression over the same sources. The agent does not have to know it
        — it has to rediscover it. The bench measures the verdict <em>and</em> the motives it cites.
      </p>
      <p className="card__body">
        This is the form that breaks agents, and the one a classic test suite cannot evaluate.
      </p>
    </article>
  );
}

function RefusalCard() {
  return (
    <article className="card">
      <p className="card__kicker">3 · Expected refusal</p>
      <h3 className="card__title">The question has no answer.</h3>
      <p className="card__body">
        The right behaviour is to say so: refuse, and name what is missing and where to find it.
        Seeded case F-01 — &quot;What is next quarter&apos;s commercial plan?&quot; — expects a
        refusal naming the commercial plan and the sales targets, plus the commercial direction and
        the Confluence space that is not connected to the graph.
      </p>
      <p className="card__body">A bench that measures only the right answers rewards hallucination.</p>
    </article>
  );
}

function RuleCaseBlock({ facts }: { readonly facts: DemoFacts }) {
  const FAILURE_CASE = facts.failure;
  if (!FAILURE_CASE) return null;
  return (
    <div className="rule-case" aria-labelledby="rule-case-title">
      <p className="rule-case__kicker">Case R-04, in full</p>
      <h3 className="rule-case__title" id="rule-case-title">
        &quot;{FAILURE_CASE.question}&quot;
      </h3>
      <p className="rule-case__rule">{FAILURE_CASE.rule}</p>
      <ol className="rule-case__factors">
        {FAILURE_CASE.factors.map((factor, index) => (
          <li key={factor.label}>
            <span className="rule-case__index">{index + 1}</span>
            <span className="rule-case__factor">{factor.label}</span>
            <span className="rule-case__source">
              {factor.source} → {factor.read} (expected {factor.expected})
            </span>
          </li>
        ))}
      </ol>
      <p className="rule-case__expected">
        Expected verdict: <strong>{FAILURE_CASE.expectedAnswer}</strong> — and all three motives must
        be cited. Even if its conclusion differs, the agent must stay consistent with what it claims.
      </p>
    </div>
  );
}

function DeadOracle({ facts }: { readonly facts: DemoFacts }) {
  const ORACLE_HEALTH = facts.oracleHealth;
  return (
    <Callout tone="warn" title="And the dead oracle">
      <p>
        When the source is missing, or the rule depends on a system that is not connected, the oracle
        is marked <strong>dead</strong>: the case does not count in the score, and the bench displays
        the dead-oracle rate.
      </p>
      <p>
        A bench where a third of the oracles are dead is worth nothing — the product says it to your
        face. In the seeded bench: {ORACLE_HEALTH.dead} dead oracles out of {ORACLE_HEALTH.total},
        that is {Math.round(ORACLE_HEALTH.deadRate * 100)}%.
      </p>
      <p>
        <StateChip tone="info" label="Dead oracle: reported, never silently counted as false" />
      </p>
    </Callout>
  );
}

export default function Oracles() {
  const facts = useDemoFacts();
  return (
    <Section
      id="oracles"
      eyebrow="The oracle"
      title="Three forms of truth, and the truth is never typed"
      intro="Every question in the bench belongs to one of three forms. They are not interchangeable, and the bench measures them differently."
    >
      <div className="cards cards--three">
        <DerivedCard />
        <RuleCard />
        <RefusalCard />
      </div>
      {facts && <RuleCaseBlock facts={facts} />}
      {facts && <DeadOracle facts={facts} />}
    </Section>
  );
}
