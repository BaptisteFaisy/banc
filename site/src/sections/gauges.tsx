/**
 * Les huit jauges (§8). Chaque jauge a un plancher de qualité ; le coût a un
 * plafond. Les seuils sont importés du produit, jamais recopiés.
 */
import { GAUGE_FLOORS } from '../../../src/score/floors.js';
import { COST_CEILING, SAMPLE_MINIMUM } from '../demo-data';
import type { Gauge } from '../../../src/domain/vocabulary.js';
import { Section } from '../ui';

interface GaugeDoc {
  readonly gauge: Gauge;
  readonly label: string;
  readonly measures: string;
  readonly how: string;
}

const GAUGE_DOCS: readonly GaugeDoc[] = [
  {
    gauge: 'exactitude',
    label: 'Exactness',
    measures: 'The agent gives the value of the oracle.',
    how: 'Normalised comparison (numbers, dates, lists, names) with declared tolerances.',
  },
  {
    gauge: 'fondation',
    label: 'Grounding',
    measures: 'Every claim is backed by a verifiable source.',
    how: 'Cited sources are resolved to real documents; a citation that does not exist is an unfounded claim.',
  },
  {
    gauge: 'citation_vivante',
    label: 'Live citation',
    measures: 'The cited source exists and really contains the claim.',
    how: 'Extraction of the cited passage, then an implication check (rule + LLM).',
  },
  {
    gauge: 'exactitude_de_règle',
    label: 'Rule exactness',
    measures: 'For a rule case: the verdict is right and the motives are cited.',
    how: 'Application of the stored predicate, compared with the answer.',
  },
  {
    gauge: 'refus_correct',
    label: 'Correct refusal',
    measures: 'For a refusal case: the agent refuses and names what is missing.',
    how: 'Strict classification: refusal / answer / partial answer.',
  },
  {
    gauge: 'complétude',
    label: 'Completeness',
    measures: 'Every element of the question is addressed.',
    how: 'Multi-question decomposition, verified element by element.',
  },
  {
    gauge: 'stabilité',
    label: 'Stability',
    measures: 'The verdict does not change from one passage to another.',
    how: 'Verdict spread over k passes, and share of cracked cases.',
  },
  {
    gauge: 'coût',
    label: 'Cost and latency',
    measures: 'What the quality cost.',
    how: 'Tokens, milliseconds, estimated cost — per case and per run.',
  },
] as const;

export default function Gauges() {
  return (
    <Section
      id="gauges"
      eyebrow="Measurement"
      title="Eight gauges"
      intro="A bench that measures only the right answers rewards hallucination — so the refusal is a gauge of its own, and every gauge carries its floor."
    >
      <div className="table-scroll">
        <table className="data">
          <caption className="data__caption">
            The eight gauges, what each one measures, how it is measured, and its threshold.
          </caption>
          <thead>
            <tr>
              <th scope="col">Gauge</th>
              <th scope="col">What it measures</th>
              <th scope="col">How</th>
              <th scope="col">Threshold</th>
            </tr>
          </thead>
          <tbody>
            {GAUGE_DOCS.map((doc) => (
              <tr key={doc.gauge}>
                <th scope="row">{doc.label}</th>
                <td>{doc.measures}</td>
                <td>{doc.how}</td>
                <td className="mono">
                  {doc.gauge === 'coût'
                    ? `ceiling ${COST_CEILING.toFixed(2)}`
                    : `floor ${GAUGE_FLOORS[doc.gauge].toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="lede">
        Each gauge has a quality floor and, when it is an average, a range and a sample size.
        Below a sample of {SAMPLE_MINIMUM} cases the gauge displays &quot;not enough data&quot; instead
        of a percentage — a number nobody can rely on is not published.
      </p>
    </Section>
  );
}