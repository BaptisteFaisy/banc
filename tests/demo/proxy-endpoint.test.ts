/**
 * La résolution du proxy direct est résiliente, et ça se prouve.
 *
 * L'URL du tunnel meurt en silence (constaté le 2026-11-14 : `cloudflared`
 * vivant, port ouvert, unité « active », et « Unauthorized: Tunnel not found
 * » en boucle depuis des heures). Ce qui protège le visiteur, c'est l'ordre
 * des candidates, la sonde et le repli — trois comportements mesurables, donc
 * testés : l'ordre, le saut d'une candidate morte, l'erreur honnête quand tout
 * est mort.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveProxyCandidates, normaliseBase, probeProxy, findLiveProxy,
  withProxyFallback, type ProxyCandidate,
} from '../../src/demo/proxy-endpoint.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('candidates du proxy', () => {
  it('ordonne cache, publiée, replis — et déduplique', () => {
    const candidates = resolveProxyCandidates({
      published: 'https://a.trycloudflare.com/',
      cached: 'https://b.trycloudflare.com',
      fallbacks: ['https://a.trycloudflare.com', 'https://c.trycloudflare.com'],
    });
    expect(candidates.map((c) => c.url)).toEqual([
      'https://b.trycloudflare.com', 'https://a.trycloudflare.com', 'https://c.trycloudflare.com',
    ]);
    expect(candidates.map((c) => c.source)).toEqual(['cache', 'published', 'fallback']);
  });

  it('jette les URLs vides et normalise la barre de fin', () => {
    const candidates = resolveProxyCandidates({ published: '', cached: '  ' });
    expect(candidates).toEqual([]);
    expect(normaliseBase('https://x/')).toBe('https://x');
    expect(normaliseBase('https://x///')).toBe('https://x');
  });
});

describe('sonde de santé', () => {
  it('dit vrai seulement sur une réponse 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    expect(await probeProxy('https://a')).toBe(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(await probeProxy('https://a')).toBe(false);
  });

  it('dit faux quand le réseau ne répond pas (tunnel mort)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    expect(await probeProxy('https://mort')).toBe(false);
  });

  it('rend la première candidate vivante et saute les mortes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: !String(url).includes('mort') })));
    const candidates: ProxyCandidate[] = [
      { url: 'https://mort', source: 'cache' },
      { url: 'https://vivant', source: 'published' },
    ];
    const vivante = await findLiveProxy(candidates);
    expect(vivante?.url).toBe('https://vivant');
  });

  it('rend null quand toutes sont mortes — jamais un succès inventé', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    expect(await findLiveProxy([{ url: 'https://a', source: 'published' }])).toBeNull();
  });
});

describe('repli par appel', () => {
  it('prend la première candidate qui répond', async () => {
    const appelee: string[] = [];
    const rendu = await withProxyFallback(
      [{ url: 'https://a', source: 'published' }, { url: 'https://b', source: 'fallback' }],
      async (url) => { appelee.push(url); if (url === 'https://a') throw new Error('502'); return url; },
    );
    expect(rendu).toBe('https://b');
    expect(appelee).toEqual(['https://a', 'https://b']);
  });

  it('remonte la dernière erreur quand tout échoue', async () => {
    await expect(withProxyFallback(
      [{ url: 'https://a', source: 'published' }],
      async () => { throw new Error('proxy 502'); },
    )).rejects.toThrow('proxy 502');
  });

  it('ne fait aucun appel sans candidate', async () => {
    const appel = vi.fn();
    await expect(withProxyFallback([], appel)).rejects.toThrow('candidates: aucune');
    expect(appel).not.toHaveBeenCalled();
  });
});
