/**
 * Comparaison normalisée — la jauge « exactitude » (§8) s'appuie dessus.
 *
 * L'agent donne-t-il la valeur de l'oracle ? Rarement dans la même forme :
 * un nombre peut arriver en lettres ou avec une unité, une date dans un autre
 * fuseau ou à une autre granularité, une liste dans un autre ordre, un nom
 * avec une casse différente. Le banc compare donc des formes **canoniques**,
 * avec des tolérances qui sont toujours DÉCLARÉES dans le cas — jamais
 * devinées par le correcteur. Une tolérance implicite est une mesure fausse.
 *
 * Aucune dépendance externe : `Date` et `Math` natifs seulement.
 */
import type { Tolerance } from '../domain/vocabulary.js';

/** Motifs de date reconnus : ISO 8601 complet, date seule, date + heure. */
const DATE_PATTERNS: readonly RegExp[] = [
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/,
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{4}-\d{2}-\d{2}[ ]\d{2}:\d{2}(:\d{2})?$/,
];

/** Millisecondes retenues par granularité de troncature. */
const GRANULARITY_MS: Readonly<Record<NonNullable<Tolerance['dateGranularity']>, number>> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

/** Une date est-elle reconnue comme telle (chaîne ou `Date`) ? */
export function isDateLike(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!DATE_PATTERNS.some((pattern) => pattern.test(text))) return false;
  return !Number.isNaN(Date.parse(text));
}

/** Convertit en `Date`, ou `null` si la valeur n'est pas une date valide. */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !isDateLike(value)) return null;
  const ms = Date.parse(value.trim());
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Tronque une date à la granularité demandée (UTC). */
function truncateDate(date: Date, granularity: NonNullable<Tolerance['dateGranularity']>): string {
  const step = GRANULARITY_MS[granularity];
  return new Date(Math.floor(date.getTime() / step) * step).toISOString();
}

/** Un nombre écrit sans notation exponentielle parasite. */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}

/** Sérialisation à clés triées, pour comparer deux objets structurellement. */
function stableObject(value: Record<string, unknown>): string {
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${normalise(value[key])}`)
    .join(',')}}`;
}

/**
 * Forme canonique d'une valeur. Deux valeurs dont la forme canonique est
 * identique sont considérées comme égales par `valuesEqual`.
 */
export function normalise(value: unknown, tolerance?: Tolerance): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return formatNumber(value);
  if (value instanceof Date) {
    return tolerance?.dateGranularity ? truncateDate(value, tolerance.dateGranularity) : value.toISOString();
  }
  if (typeof value === 'string') return normaliseText(value, tolerance);
  if (Array.isArray(value)) return normaliseArray(value, tolerance);
  if (typeof value === 'object') return stableObject(value as Record<string, unknown>);
  return String(value);
}

/** Chaîne : espaces réduits, trim, casse éventuellement neutralisée, dates tronquées. */
function normaliseText(text: string, tolerance?: Tolerance): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  const date = parseDate(compact);
  if (date && tolerance?.dateGranularity) return truncateDate(date, tolerance.dateGranularity);
  return tolerance?.caseInsensitive ? compact.toLowerCase() : compact;
}

/** Tableau : chaque élément normalisé, trié si l'ordre est déclaré non pertinent. */
function normaliseArray(values: readonly unknown[], tolerance?: Tolerance): string {
  const parts = values.map((item) => normalise(item, tolerance));
  return (tolerance?.listOrderInsensitive ? [...parts].sort() : parts).join('|');
}

/** Les deux valeurs sont-elles numériques (ou nombres sous forme de chaîne) ? */
function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Comparaison numérique avec marge INCLUSIVE : `|a - b| <= numeric`. */
function withinTolerance(a: unknown, b: unknown, tolerance?: Tolerance): boolean {
  const margin = tolerance?.numeric;
  if (margin === undefined) return false;
  const left = asNumber(a);
  const right = asNumber(b);
  if (left === null || right === null) return false;
  return Math.abs(left - right) <= margin;
}

/** Comparaison de deux dates à la granularité déclarée. */
function sameDateAt(a: unknown, b: unknown, tolerance?: Tolerance): boolean {
  if (!tolerance?.dateGranularity) return false;
  const left = parseDate(a);
  const right = parseDate(b);
  if (!left || !right) return false;
  return truncateDate(left, tolerance.dateGranularity) === truncateDate(right, tolerance.dateGranularity);
}

/**
 * Égalité au sens du banc : formes canoniques identiques, OU tolérance
 * numérique respectée, OU dates identiques à la granularité déclarée.
 */
export function valuesEqual(a: unknown, b: unknown, tolerance?: Tolerance): boolean {
  if (normalise(a, tolerance) === normalise(b, tolerance)) return true;
  if (withinTolerance(a, b, tolerance)) return true;
  return sameDateAt(a, b, tolerance);
}

/** Extrait les nombres d'une réponse d'agent : « 3 incidents et 12 jours » → [3, 12]. */
export function extractNumbers(text: string): readonly number[] {
  const found: number[] = [];
  const pattern = /-?\d+(?:[.,]\d+)?/g;
  let match = pattern.exec(text);
  while (match !== null) {
    const parsed = Number(match[0].replace(',', '.'));
    if (Number.isFinite(parsed)) found.push(parsed);
    if (match[0] === '') pattern.lastIndex += 1;
    match = pattern.exec(text);
  }
  return found;
}
