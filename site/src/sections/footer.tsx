/** Pied de page : licence, dépôt, concours. */
import { CODEGEIST, LICENSE_LABEL, REPO_LABEL, REPO_URL } from '../links';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__brand">
        <p className="footer__name">Banc</p>
        <p className="footer__tag">Before you trust an agent, bench it.</p>
      </div>
      <div className="footer__links">
        <p>
          <a href={REPO_URL} rel="noreferrer">
            {REPO_LABEL}
          </a>
        </p>
        <p>
          Licence {LICENSE_LABEL} · open source, self-hosted on your Atlassian site
        </p>
        <p>{CODEGEIST}</p>
      </div>
    </footer>
  );
}
