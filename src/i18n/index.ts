/**
 * Interface en français et en anglais (§25).
 *
 * Toute chaîne visible par un utilisateur passe par `t()`. La parité entre
 * les deux langues est vérifiée par un test : une clé absente d'une langue
 * n'est pas un détail, c'est une interface cassée dans cette langue.
 *
 * Le repli d'une clé manquante est VISIBLE (la clé elle-même), jamais une
 * chaîne vide : une chaîne vide se lit comme « rien à dire », et masque le
 * problème au lieu de le montrer.
 */

/** Les deux langues de l'interface. */
export type Locale = 'fr' | 'en';

/** Les langues disponibles, dans l'ordre d'affichage. */
export const LOCALES: readonly Locale[] = ['fr', 'en'];

/** Langue par défaut : la soumission est en anglais (§25). */
export const DEFAULT_LOCALE: Locale = 'en';

/** Un dictionnaire de messages. */
export type Messages = Readonly<Record<string, string>>;

/** Interpole `{nom}` dans un message. */
export function interpolate(message: string, params?: Record<string, string | number>): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** Traduit une clé. Une clé inconnue rend la clé, jamais une chaîne vide. */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const dictionary = dictionaries[locale];
  const message = dictionary[key];
  if (message === undefined) return key;
  return interpolate(message, params);
}

/** Une clé existe-t-elle dans cette langue ? */
export function hasKey(locale: Locale, key: string): boolean {
  return dictionaries[locale][key] !== undefined;
}

/**
 * Clés présentes dans une langue et absentes de l'autre.
 *
 * La parité est une exigence de la §25 (« l'interface en anglais et en
 * français ») : la CI échoue si une langue décroche.
 */
export function missingKeys(locale: Locale): readonly string[] {
  const reference = Object.keys(dictionaries[DEFAULT_LOCALE]);
  return reference.filter((key) => dictionaries[locale][key] === undefined);
}

/** La valeur est-elle une langue supportée ? */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Résout une langue, avec repli sur la langue par défaut. */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Les dictionnaires, chargé une fois. */
const dictionaries: Readonly<Record<Locale, Messages>> = { fr: FR, en: EN };

import { FR } from './fr.js';
import { EN } from './en.js';
