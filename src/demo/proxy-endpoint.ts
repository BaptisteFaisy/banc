/**
 * Le point d'entrée du proxy de la démo en direct — résilient par construction.
 *
 * L'URL publique du proxy est un tunnel Cloudflare éphémère : elle change à
 * chaque redémarrage du tunnel, et une URL cuite dans un site statique finit
 * donc toujours par être morte. Plutôt que de promettre une URL unique, on
 * manipule une **liste ordonnée de candidates** et on prend la première qui
 * répond — par appel, pas par run : un tunnel qui meurt au milieu du banc ne
 * condamne pas les 30 appels déjà faits.
 *
 * Ce module est partagé : le site (navigateur) s'en sert tel quel, et le CLI
 * d'enregistrement n'a qu'une candidate (son URL directe). Une seule
 * implémentation de « essayer les URLs du proxy », jamais deux.
 */

/** Durée maximale d'une sonde de santé : le proxy répond en quelques ms. */
const DELAI_SONDE_MS = 4_000;

/** Une candidate d'URL, avec son origine — pour un diagnostic lisible. */
export interface ProxyCandidate {
  readonly url: string;
  readonly source: 'cache' | 'published' | 'fallback';
}

/** Normalise une base : sans barre de fin, pour concaténer des chemins. */
export function normaliseBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Ordonne et déduplique les candidates : cache d'abord, puis publiée. */
export function resolveProxyCandidates(input: {
  readonly published: string;
  readonly cached?: string;
  readonly fallbacks?: readonly string[];
}): ProxyCandidate[] {
  const brutes: ProxyCandidate[] = [
    ...(input.cached ? [{ url: input.cached, source: 'cache' as const }] : []),
    ...(input.published ? [{ url: input.published, source: 'published' as const }] : []),
    ...(input.fallbacks ?? []).map((url) => ({ url, source: 'fallback' as const })),
  ];
  const vues = new Set<string>();
  const triees: ProxyCandidate[] = [];
  for (const candidate of brutes) {
    const url = normaliseBase(candidate.url).trim();
    if (!url || vues.has(url)) continue;
    vues.add(url);
    triees.push({ ...candidate, url });
  }
  return triees;
}

/** Sonde une candidate : `GET /api/health` doit répondre, 200 seulement. */
export async function probeProxy(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${normaliseBase(url)}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(DELAI_SONDE_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Première candidate vivante, ou `null` si toutes sont mortes. */
export async function findLiveProxy(
  candidates: readonly ProxyCandidate[],
): Promise<ProxyCandidate | null> {
  for (const candidate of candidates) {
    if (await probeProxy(candidate.url)) return candidate;
  }
  return null;
}

/** Erreur honnête quand aucune candidate ne passe. */
export function proxyHorsLigne(candidates: readonly ProxyCandidate[]): Error {
  const origines = candidates.map((c) => `${c.source}:${c.url}`).join(', ');
  return new Error(`proxy hors ligne — candidates: ${origines || 'aucune'}`);
}

/**
 * Exécute `appel` sur chaque candidate, dans l'ordre, et rend le premier
 * succès. Un échec réseau sur une candidate n'est pas une erreur : c'est la
 * suivante. Seulement quand toutes ont échoué, on remonte la dernière.
 */
export async function withProxyFallback<T>(
  candidates: readonly ProxyCandidate[],
  appel: (url: string) => Promise<T>,
): Promise<T> {
  let derniere: unknown = null;
  for (const candidate of candidates) {
    try {
      return await appel(candidate.url);
    } catch (erreur) {
      derniere = erreur;
    }
  }
  throw derniere instanceof Error ? derniere : proxyHorsLigne(candidates);
}
