/**
 * Le lot d'or de SAM Vision — de la vraie donnée.
 *
 * Ce corpus n'est pas fictif : chaque cas est un fait du contrat d'IU de
 * l'app SAM Vision, lu dans son code Kotlin (`LiveProbeText.kt`,
 * `TimingsText.kt`, `LiveSession.kt`) et sa recette manuelle. La réponse
 * attendue est DERIVÉE du source — la même discipline « valeur dérivée » que
 * le banc applique aux systèmes d'une organisation, démontrée ici sur un vrai
 * produit.
 *
 * La vérité est garantie par un test de grounding : chaque citation est
 * vérifiée présente dans l'extrait figé des sources, et l'extrait est scellé
 * par son empreinte SHA-256.
 */
import { VISION_GOLDEN } from '../../../src/seed/vision-golden.js';
import { Section, StateChip } from '../ui';

/** Un cas du lot d'or, avec sa provenance. */
function GoldenCase({ id, question, answer, source, quote, gravity }: {
  readonly id: string; readonly question: string; readonly answer: string;
  readonly source: string; readonly quote: string; readonly gravity: 'bloquant' | 'souhaitable';
}): JSX.Element {
  return (
    <li className="golden-case" id={`golden-${id}`}>
      <div className="golden-case__head">
        <span className="mono">{id}</span>
        <span className="golden-case__question">{question}</span>
        <StateChip tone={gravity === 'bloquant' ? 'bad' : 'info'} label={gravity} />
      </div>
      <p className="golden-case__answer">
        <strong>Answer:</strong> {answer}
      </p>
      <p className="golden-case__source">
        <span className="mono">{source}</span>
        <code className="golden-case__quote">{quote}</code>
      </p>
    </li>
  );
}

/** La section du site qui montre de la vraie donnée. */
export default function Vision() {
  return (
    <Section
      id="vision"
      eyebrow="Real data"
      title="The golden set of SAM Vision, derived from its own code"
      intro="Twelve facts about the UI contract of a real app — maximum distances, the exact waiting text, the latency budget, the button coordinates. Each answer is read back from the source, not typed by hand."
    >
      <ol className="golden-list">
        {VISION_GOLDEN.map((kase) => (
          <GoldenCase key={kase.id} {...kase} />
        ))}
      </ol>
      <p className="lede">
        This is what a bench looks like when the truth is derived instead of written: the corpus
        survives the agent, the model and the editor. If the code of SAM Vision changes, the
        grounding test fails and names the case — the bench detects the truth drift before anyone
        ships a wrong answer.
      </p>
    </Section>
  );
}
