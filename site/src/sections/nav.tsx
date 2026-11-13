/**
 * Barre de navigation : ancres vers chaque section, plus le dépôt.
 *
 * Liens natifs → navigation clavier et lecteur d'écran sans JavaScript
 * spécifique.
 */
import { REPO_URL } from '../links';

const LINKS = [
  { href: '#problem', label: 'Problem' },
  { href: '#oracles', label: 'Oracles' },
  { href: '#drift', label: 'Truth drift' },
  { href: '#gauges', label: 'Gauges' },
  { href: '#stability', label: 'Stability' },
  { href: '#gate', label: 'Gate' },
  { href: '#screens', label: 'Screens' },
  { href: '#demo', label: 'Demo' },
  { href: '#judges', label: 'Try it' },
] as const;

export default function Nav() {
  return (
    <header className="topbar">
      <nav className="nav" aria-label="Site sections">
        <a className="nav__brand" href="#top">
          <span className="nav__mark" aria-hidden="true">
            ▤
          </span>
          <span className="nav__name">Banc</span>
          <span className="nav__tag">the agent test bench</span>
        </a>
        <ul className="nav__links">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
          <li>
            <a className="nav__cta" href={REPO_URL} rel="noreferrer">
              GitHub
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
