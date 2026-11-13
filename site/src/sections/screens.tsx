/**
 * Les douze écrans (§20) et la métaphore de la métrologie : chaque élément
 * encode une donnée, rien n'est décoratif.
 */
import { Section } from '../ui';

const SCREENS = [
  { name: 'The bench', content: 'A global Jira page: the agents, their versions, their status.' },
  { name: 'Scorecard of a version', content: 'Gauges, sample sizes, gaps to the witness, regressions.' },
  { name: 'Failure explorer', content: 'Answer, oracle, sources, diff between two versions.' },
  { name: 'Case sheet', content: 'Question, oracle, gravity, truth history, cracked or not.' },
  { name: 'Run', content: 'Progress, budget, live over Realtime.' },
  { name: 'Promotion gate', content: 'Rules, refusal motives, workflow lock.' },
  { name: 'The witness', content: 'Versions compared side by side.' },
  { name: 'Oracle health', content: 'Dead oracles, drifts, coverage of the corpus.' },
  { name: 'Human jury', content: 'Sample, grids, agreement between notators.' },
  { name: 'Bait battery', content: 'Hostile cases: injection, contradictions, false citations.' },
  { name: 'Budget', content: 'What the runs cost, per organisation, per agent, per period.' },
  { name: 'Curator', content: 'Case proposals built from real tickets and real questions.' },
] as const;

const METROLOGY = [
  { element: 'The bench', datum: 'One agent under test; its version engraved on the plate.' },
  { element: 'A specimen plate', datum: 'One case; its oracle and its gravity engraved on it.' },
  { element: 'The verdict', datum: 'Engraved per cell: exact, concordant, founded, refusal, unfounded, unverifiable.' },
  { element: 'The witness', datum: 'The reference version, placed next to it for immediate comparison.' },
  { element: 'The gauge', datum: 'One metric, with its scale and its marked floor.' },
  { element: 'The stability dial', datum: 'The verdict gap between passages; cracks show up there.' },
  { element: 'The bait', datum: 'A hostile case, orange edge, blocking by nature.' },
  { element: 'The gold suite', datum: 'The box of mandatory cases, closed or open.' },
  { element: 'The crack', datum: 'A case that cracks from one passage to the next.' },
  { element: 'The barrier', datum: 'The promotion rule, stretched between two posts: red or green.' },
  { element: 'The run log', datum: 'The logbook: every run, its conditions, its timestamps.' },
  { element: 'The calibre', datum: 'The agreement indicator between the automatic corrector and the human jury.' },
  { element: 'The straw', datum: 'A case whose oracle changed: the agent is not at fault.' },
  { element: 'The budget tag', datum: 'What the run cost, compared with the budget.' },
] as const;

export default function Screens() {
  return (
    <Section
      id="screens"
      eyebrow="The product"
      title="Twelve screens, borrowed from metrology"
      intro="The metaphor is the one of the measuring workshop: a bench, specimen plates, witnesses, gauges. Each element encodes a datum — nothing is decorative."
    >
      <div className="screens">
        <ol className="screens__list">
          {SCREENS.map((screen, index) => (
            <li key={screen.name}>
              <span className="screens__index">{String(index + 1).padStart(2, '0')}</span>
              <span className="screens__name">{screen.name}</span>
              <span className="screens__content">{screen.content}</span>
            </li>
          ))}
        </ol>

        <div className="table-scroll">
          <table className="data">
            <caption className="data__caption">The elements of the bench, and the datum each one encodes.</caption>
            <thead>
              <tr>
                <th scope="col">Element</th>
                <th scope="col">Datum encoded</th>
              </tr>
            </thead>
            <tbody>
              {METROLOGY.map((item) => (
                <tr key={item.element}>
                  <th scope="row">{item.element}</th>
                  <td>{item.datum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}