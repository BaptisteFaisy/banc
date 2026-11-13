/**
 * Comment les jugés testent le produit (§29) : cinq minutes, quatre commandes,
 * sept étapes.
 */
import { REPO_LABEL, REPO_URL } from '../links';
import { Section } from '../ui';

const COMMANDS = ['npm install', 'npm test', 'npm run seed', 'npm run site:dev'];

const PATH = [
  {
    title: 'A preloaded demo bench.',
    body: '40 seeded cases in the bench space: 15 derived values, 10 rule cases, 8 expected refusals, 7 bait cases. Each one has its oracle — recalculated or written — and its gravity.',
  },
  {
    title: 'Two seeded versions of an agent.',
    body: 'Version 5 breaks two blocking cases and loses one point of grounding compared to version 4; version 6 repairs the grounding but breaks the stability. Judges see it immediately.',
  },
  {
    title: 'Run a bench.',
    body: 'Two minutes: scorecard, gaps to the witness, list of regressions, budget consumed.',
  },
  {
    title: 'Explore a failure.',
    body: 'Answer, oracle, sources, diff between versions, verdict per gauge.',
  },
  {
    title: 'Test the gate.',
    body: 'A version that breaks a blocking case is refused promotion, with the reason.',
  },
  {
    title: 'Propose a case.',
    body: 'The agent proposes a case from a real ticket; the candidate oracle is validated by hand; the case joins the corpus.',
  },
  {
    title: 'White mode against black mode.',
    body: 'The same case in both modes, with the measured gap in grounding — is the problem retrieval or reasoning?',
  },
] as const;

export default function Judges() {
  return (
    <Section
      id="judges"
      eyebrow="Try it"
      title="Five minutes, four commands"
      intro="Nothing to configure: the demo bench comes seeded, with one agent, three versions and forty cases."
    >
      <div className="try">
        <pre className="code" aria-label="Commands to run the demo">
          <code>
            {COMMANDS.map((command) => `${command}\n`).join('')}
          </code>
        </pre>
        <ol className="try__steps">
          {PATH.map((step, index) => (
            <li key={step.title}>
              <span className="try__index">{index + 1}</span>
              <span className="try__body">
                <strong className="try__title">{step.title}</strong>
                <span className="try__detail">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="lede">
        A trial can be exported for an auditor — the gate and its reasons, the eight gauges, the
        regressions, the truth drifts and the case-by-case evidence, sealed by a SHA-256 digest:{' '}
        <a href="generated/audit-report.md" rel="noreferrer">read the audit report</a>, or regenerate
        it with <code>npm run report:export</code>.
      </p>
      <p className="lede">
        Open source, MIT licence: <a href={REPO_URL} rel="noreferrer">{REPO_LABEL}</a>. The corpus is
        exportable, the seeding script is in the repository, and the demo video shows a run against a
        site connected to real data.
      </p>
    </Section>
  );
}
