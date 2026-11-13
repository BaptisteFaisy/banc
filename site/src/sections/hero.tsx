/**
 * Écran d'ouverture. Le résultat d'abord (§31) : une régression attrapée
 * avant le client. Ensuite seulement, l'idée en une phrase.
 */
import { CODEGEIST } from '../links';

const STATS = [
  { value: '40', label: 'seeded cases — 15 derived values, 10 rules, 8 refusals, 7 bait' },
  { value: '8', label: 'gauges, each with a floor, a sample size and a range' },
  { value: '3', label: 'passes per case by default: no verdict on a single answer' },
  { value: '1', label: 'promotion gate, wired to the version ticket' },
] as const;

export default function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <p className="eyebrow">{CODEGEIST}</p>
      <h1 id="hero-title">
        Before you trust an agent, <span className="hero__accent">bench it</span>.
      </h1>
      <p className="hero__lead">
        Banc asks your agent questions whose truth is <strong>derived from your own
        organisation</strong> — Jira, Confluence, JSM, the Teamwork Graph — replays them on every
        version, and tells you what regressed.
      </p>

      <div className="hero__result">
        <p className="hero__result-kicker">The result first</p>
        <p className="hero__result-title">A regression caught before the customer.</p>
        <p className="hero__result-text">
          A shortened prompt ships. The gold suite shows two blocking cases regressed on version 5
          of the support agent. The promotion gate refuses the version, the release ticket cannot
          be approved, and the cause is read the same morning — instead of a customer discovering
          it two weeks later.
        </p>
        <div className="hero__actions">
          <a className="button" href="#demo">
            See the scorecard
          </a>
          <a className="button button--ghost" href="#judges">
            Run it in 5 minutes
          </a>
        </div>
      </div>

      <ul className="hero__stats">
        {STATS.map((item) => (
          <li key={item.value}>
            <p className="hero__stat-value">{item.value}</p>
            <p className="hero__stat-label">{item.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
