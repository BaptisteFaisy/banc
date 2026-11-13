/**
 * Le problème (§2) : ce que l'organisation vit aujourd'hui avec ses agents
 * Rovo, et pourquoi une impression n'est pas une mesure.
 */
import { Section } from '../ui';

const PAIN_POINTS = [
  {
    title: 'The first test is a dissatisfied customer.',
    body: 'There is no test suite, only impressions. The failure is discovered by the person paying for the answer, at the worst possible moment.',
  },
  {
    title: 'Changing a prompt makes no sense without a measure.',
    body: 'One instruction is edited. Nobody knows whether it improved one behaviour or broke three out of twelve.',
  },
  {
    title: 'An agent that answers well is not necessarily an agent that is right.',
    body: 'It is often confident and wrong. "It reads well" is not a metric, and it never becomes one by being read twice.',
  },
  {
    title: 'We do not have the truth — it is in the organisation.',
    body: '"Can we ship Friday?" depends on freezes, open incidents and the acceptance criteria of the release ticket. The truth lives in your systems, not in a checkbox somebody typed last year.',
  },
] as const;

export default function Problem() {
  return (
    <Section
      id="problem"
      eyebrow="The problem"
      title="Agents everywhere, no measurement"
      intro="In 2026 agents answer in Rovo Chat, write in Jira and staff runbooks. What nobody can say is whether they are right."
    >
      <div className="cards cards--two">
        {PAIN_POINTS.map((item) => (
          <article className="card" key={item.title}>
            <h3 className="card__title">{item.title}</h3>
            <p className="card__body">{item.body}</p>
          </article>
        ))}
      </div>
      <p className="lede">
        The AI world has a standard artefact for this: the benchmark. It does not exist for
        Atlassian agents, because it assumes two rare things — being able to <strong>replay</strong> an
        agent reproducibly, and being able to <strong>compute</strong> the right answer from the
        organisation&apos;s own data. Banc is those two things.
      </p>
    </Section>
  );
}
