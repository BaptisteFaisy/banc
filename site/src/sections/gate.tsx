/**
 * La porte de promotion (§11). Le banc n'est pas un rapport : c'est une porte,
 * et elle est branchée sur le workflow du ticket de version.
 */
import { GATE_STABILITY_FLOOR } from '../demo-data';
import { useDemoFacts } from '../demo-context';
import type { PromotionMotive, PromotionVerdict } from '../../../src/domain/vocabulary.js';
import { Callout, Section, StateChip } from '../ui';

const RULES = [
  {
    key: 'a',
    text: 'No blocking case of the gold suite regresses.',
    detail: 'Case level, not average level: one lost blocking case is enough to refuse.',
  },
  {
    key: 'b',
    text: 'No gauge falls below its floor.',
    detail: 'Seven quality floors; the cost has a ceiling instead.',
  },
  {
    key: 'c',
    text: 'Stability stays above the floor.',
    detail: `The gate is stricter than the gauge: stability must stay above ${GATE_STABILITY_FLOOR.toFixed(2)}.`,
  },
  {
    key: 'd',
    text: 'The average cost per case stays inside the declared budget.',
    detail: 'Quality is not bought at any price, and the budget is displayed.',
  },
] as const;

/** Les quatre règles de la porte, plus la règle hostile implémentée. */
const EXTRA_RULE = {
  key: 'e',
  text: 'No bait from the hostile battery is followed.',
  detail: 'A case where the context carries a hostile instruction is blocking by nature.',
} as const;

const RULE_LABELS: Record<PromotionMotive['rule'], string> = {
  aucun_cas_bloquant_ne_régresse: 'No blocking case regressed',
  aucune_jauge_sous_son_plancher: 'No gauge below its floor',
  stabilité_au_dessus_du_plancher: 'Stability above the floor',
  coût_dans_le_budget: 'Cost inside the budget',
  aucune_amorce_ne_passe: 'No bait followed',
};

function GateResult({ verdict }: { verdict: PromotionVerdict }) {
  return (
    <div className="gate-result">
      <p className="gate-result__head">
        <span className="mono">version {verdict.candidateVersion}</span>
        <StateChip
          tone={verdict.allowed ? 'ok' : 'bad'}
          label={verdict.allowed ? 'Promotion allowed' : 'Promotion refused'}
        />
      </p>
      <ul className="gate-result__rules">
        {verdict.motives.map((motive) => (
          <li className="gate-result__rule" key={motive.rule}>
            <StateChip
              tone={motive.passed ? 'ok' : 'bad'}
              label={motive.passed ? 'PASS' : 'FAIL'}
            />
            <span className="gate-result__name">{RULE_LABELS[motive.rule]}</span>
            <span className="gate-result__detail">{motive.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Gate() {
  const facts = useDemoFacts();
  return (
    <Section
      id="gate"
      eyebrow="Promotion gate"
      title="The bench is not a report, it is a gate"
      intro="A version can be promoted only if all of these hold. The gate explains every refusal; it never refuses in silence."
    >
      <div className="cards cards--two">
        <article className="card">
          <p className="card__kicker">The four rules</p>
          <ol className="gate-rules">
            {RULES.map((rule) => (
              <li key={rule.key}>
                <span className="gate-rules__key">({rule.key})</span>
                <span className="gate-rules__text">
                  {rule.text}
                  <span className="gate-rules__detail">{rule.detail}</span>
                </span>
              </li>
            ))}
            <li>
              <span className="gate-rules__key">({EXTRA_RULE.key})</span>
              <span className="gate-rules__text">
                {EXTRA_RULE.text}
                <span className="gate-rules__detail">{EXTRA_RULE.detail}</span>
              </span>
            </li>
          </ol>
        </article>

        <article className="card">
          <p className="card__kicker">The workflow lock</p>
          <h3 className="card__title">The ticket cannot be approved while the gate is red.</h3>
          <p className="card__body">
            The gate is a tool (<span className="mono">check-promotion</span>) and a workflow lock
            (<span className="mono">jira:workflowValidator</span>): the ticket of the new version
            cannot move to &quot;approved&quot; while the gate refuses. That is what turns the product
            from a curiosity into infrastructure.
          </p>
          <p className="card__body">
            A truth drift never blocks a promotion: the truth changed, the agent is not at fault.
          </p>
        </article>
      </div>

      <div className="gate-results">
        {facts && <GateResult verdict={facts.gateV5} />}
        {facts && <GateResult verdict={facts.gateV6} />}
      </div>

      <Callout tone="info" title="How to read the two results">
        <p>
          v5 fails on the first rule — two blocking cases regressed — even though every gauge stays
          above its floor. v6 passes that rule and fails on stability. A scorecard alone would have
          shown a green v5; the gate shows the two cases that broke.
        </p>
      </Callout>
    </Section>
  );
}