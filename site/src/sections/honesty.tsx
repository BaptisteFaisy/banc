/**
 * Honnêteté du banc (§25). Ce que le banc refuse de publier, et ce qu'il dit
 * quand il n'a pas la mesure.
 */
import { CALIBRATION_THRESHOLD } from '../../../src/score/floors.js';
import { DEMO_BUDGET, SAMPLE_MINIMUM } from '../demo-data';
import { useDemoFacts } from '../demo-context';
import { Section, StateChip } from '../ui';

function refusals(dead: number, total: number, deadRate: number): readonly { title: string; body: string; shown: string }[] {
  return [
  {
    title: 'No gauge without a sample size or a range.',
    body: `A gauge computed on ${SAMPLE_MINIMUM - 2} cases is not published as a percentage: the bench displays "not enough data" and says how many cases it would need.`,
    shown: 'not enough data',
  },
  {
    title: 'A dead oracle is displayed.',
    body: `Dead oracles do not count in the score, and their rate is on the scorecard: ${dead} of ${total} cases, ${Math.round(deadRate * 100)}% in the seeded bench.`,
    shown: `dead oracle: ${Math.round(deadRate * 100)}%`,
  },
  {
    title: 'An uncalibrated gauge is marked.',
    body: `Below ${CALIBRATION_THRESHOLD.toFixed(2)} agreement between the automatic corrector and the human jury, the gauge is displayed as "not calibrated" and the report says so. The bench publishes its own error rate.`,
    shown: 'not calibrated',
  },
  {
    title: 'An exhausted budget is stated.',
    body: `The bench stops at the limit and says it: ${DEMO_BUDGET.tokens.toLocaleString('en-US')} of ${DEMO_BUDGET.limitTokens.toLocaleString('en-US')} tokens, ${DEMO_BUDGET.costEstimate.toFixed(2)} of ${DEMO_BUDGET.limitCost.toFixed(2)} budget. It never cuts a measurement in silence.`,
    shown: 'budget exhausted',
  },
  {
    title: 'The agent under test never evaluates itself.',
    body: 'It can neither grade nor attest. The human jury is the only fallback authority, and the agreement between the two is published.',
    shown: 'separation of roles',
  },
];
}

export default function Honesty() {
  const facts = useDemoFacts();
  const health = facts?.oracleHealth;
  return (
    <Section
      id="honesty"
      eyebrow="Honesty"
      title="What the bench refuses to show"
      intro="A bench that is wrong in silence is worse than no bench. These are the five things the product refuses to hide."
    >
      <ul className="refusals">
        {refusals(health?.dead ?? 0, health?.total ?? 40, health?.deadRate ?? 0).map((item) => (
          <li className="refusal" key={item.title}>
            <h3 className="refusal__title">{item.title}</h3>
            <p className="refusal__body">{item.body}</p>
            <p className="refusal__shown">
              <StateChip tone="info" label={`on screen: ${item.shown}`} />
            </p>
          </li>
        ))}
      </ul>
      <p className="lede">
        The bench also separates two things that are always confused: a regression of the agent and
        a drift of the truth — with the proof of the change of truth attached.
      </p>
    </Section>
  );
}
