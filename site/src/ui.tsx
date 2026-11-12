/**
 * Petits composants partagés par les sections du site.
 *
 * Règle d'accessibilité (§25) : un état n'est jamais porté par la seule
 * couleur. Chaque pastille porte un MOT et un glyphe ; la couleur n'est
 * qu'un renfort.
 */
import type { ReactNode } from 'react';

/** Les cinq tons d'état du site. */
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

const GLYPHS: Record<Tone, string> = {
  ok: '▲',
  warn: '◆',
  bad: '▼',
  info: '●',
  neutral: '■',
};

/** Une pastille d'état : glyphe + mot. Jamais la couleur seule. */
export function StateChip({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`chip chip--${tone}`}>
      <span className="chip__glyph" aria-hidden="true">
        {GLYPHS[tone]}
      </span>
      <span className="chip__label">{label}</span>
    </span>
  );
}

/** Une section du site : un ancrage, un titre, une accroche optionnelle. */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="section" id={id} aria-labelledby={`${id}-title`}>
      <header className="section__head">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 id={`${id}-title`}>{title}</h2>
        {intro ? <p className="section__intro">{intro}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Un encadré : une phrase à retenir, avec son ton. */
export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className={`callout callout--${tone}`}>
      {title ? <p className="callout__title">{title}</p> : null}
      <div className="callout__body">{children}</div>
    </aside>
  );
}

/** Une statistique courte : une valeur, une légende. */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <p className="stat__value">{value}</p>
      <p className="stat__label">{label}</p>
    </div>
  );
}

/** Une liste de définitions : un terme, sa définition. */
export function DefList({ items }: { items: readonly { term: string; detail: string }[] }) {
  return (
    <dl className="deflist">
      {items.map((item) => (
        <div className="deflist__row" key={item.term}>
          <dt className="deflist__term">{item.term}</dt>
          <dd className="deflist__detail">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
