/**
 * La découverte du proxy, côté navigateur.
 *
 * Le tunnel Cloudflare du banc est éphémère : son URL change à chaque
 * redémarrage, et une URL cuite dans un site statique meurt donc avec lui
 * (constat le 2026-11-14 : la démo en direct ne répondait plus depuis la
 * veille, tandis que tout semblait « actif » sur le serveur). Trois règles,
 * dans ce fichier :
 *
 * 1. on lit d'abord l'URL **fraîche** — celle que le serveur republie sur la
 *    branche `live` du dépôt, lisible sans reconstruire le site ;
 * 2. on garde l'URL **cuite** dans le bundle comme repli, et le cache du
 *    navigateur comme première tentative ;
 * 3. on ne déclare la démo « en ligne » qu'après avoir **sondé** le proxy :
 *    un code HTTP 200 sur `/api/health`, pas une intuition.
 */
import { resolveProxyCandidates, findLiveProxy, type ProxyCandidate } from '../../src/demo/proxy-endpoint.js';

const STOCKAGE = 'banc-proxy-url';
const DELAI_CONFIG_MS = 4_000;

/** Où le serveur publie l'URL vivante, sans passer par un déploiement. */
export const SOURCE_LIVE = 'https://raw.githubusercontent.com/Tradoooo/banc/live/site/public/banc-proxy.json';

/** Les sources de configuration, dans l'ordre : fraîche d'abord, cuite ensuite. */
export function sourcesDeConfiguration(): readonly string[] {
  return [
    `${SOURCE_LIVE}?t=${Date.now()}`,
    `${import.meta.env.BASE_URL}banc-proxy.json`,
  ];
}

/** Le cache du navigateur : la dernière URL connue comme vivante. */
function lireCache(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(STOCKAGE) ?? undefined;
  } catch {
    return undefined; // navigation privée stricte : sans cache, pas sans démo.
  }
}

/** Mémorise une URL qui a répondu, pour les prochaines visites. */
export function memoriserProxy(url: string): void {
  try {
    globalThis.localStorage?.setItem(STOCKAGE, url);
  } catch {
    // stockage refusé : la découverte vaut pour ce chargement seulement.
  }
}

/** Lit une URL de proxy dans une source de configuration ; vide si absente. */
async function lireUneSource(url: string): Promise<string> {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(DELAI_CONFIG_MS) });
    if (!response.ok) return '';
    const corps = (await response.json()) as { url?: string };
    return typeof corps.url === 'string' ? corps.url : '';
  } catch {
    return ''; // une source injoignable n'est pas une erreur : c'est la suivante.
  }
}

/** Les candidates ordonnées : cache, URL fraîche, URL cuite, replis. */
export async function candidatesDuProxy(): Promise<readonly ProxyCandidate[]> {
  const publiees: string[] = [];
  for (const source of sourcesDeConfiguration()) {
    const url = await lireUneSource(source);
    if (url) publiees.push(url);
  }
  return resolveProxyCandidates({
    published: publiees[0] ?? '', cached: lireCache(), fallbacks: publiees.slice(1),
  });
}

/** Sonde les candidates et mémorise la première vivante — sans relire les sources. */
export async function sonderCandidates(
  candidates: readonly ProxyCandidate[],
): Promise<ProxyCandidate | null> {
  const vivante = await findLiveProxy(candidates);
  if (vivante) memoriserProxy(vivante.url);
  return vivante;
}

/** La candidate vivante, découverte depuis les sources publiées. */
export async function proxyVivant(): Promise<ProxyCandidate | null> {
  return sonderCandidates(await candidatesDuProxy());
}
