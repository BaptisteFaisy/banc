#!/usr/bin/env node
/**
 * Proxy LLM du banc — r630, derrière un tunnel public HTTPS.
 *
 * Un seul rôle : recevoir `POST /api/chat { system, user }` du navigateur,
 * appeler InferHub AVEC la clé, et rendre `{ text, tokens }`. La clé ne vit
 * que dans l'environnement du serveur ; le navigateur ne l'a jamais vue, et
 * le bundle public non plus.
 *
 * Zéro dépendance (stdlib Node uniquement), comme le serveur de démo Accent.
 * Deux gardes : CORS restreint aux origines du banc, et quota par IP par jour
 * (la clé reste chère à abuser, pas gratuite à gaspiller).
 *
 * Env attendu :
 *   LLM_API_KEY   la clé InferHub (obligatoire, sinon `/api/chat` répond 503) ;
 *   LLM_BASE_URL  par défaut https://api.inferhub.dev/v1 ;
 *   LLM_MODEL     par défaut combo/cheap ;
 *   PORT          par défaut 8830.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8830);
const BASE_URL = (process.env.LLM_BASE_URL ?? 'https://api.inferhub.dev/v1').replace(/\/$/, '');
const MODEL = process.env.LLM_MODEL ?? 'combo/cheap';
const CLE = process.env.LLM_API_KEY ?? '';
const ORIGINES = new Set((process.env.ORIGINES_AUTORISEES ?? 'https://tradoooo.github.io,http://localhost:5178').split(',').map((s) => s.trim()));
const QUOTA_PAR_IP_PAR_JOUR = Number(process.env.QUOTA_PAR_IP ?? 200);
const quotas = new Map();

/** Quota glissant par IP, remis à zéro chaque jour. */
function autorise(ip) {
  const jour = Math.floor(Date.now() / 86_400_000);
  const cle = `${ip}:${jour}`;
  const compte = (quotas.get(cle) ?? 0) + 1;
  quotas.set(cle, compte);
  return compte <= QUOTA_PAR_IP_PAR_JOUR;
}

/** IP tronquée, pour un journal qui ne garde pas de donnée personnelle. */
function ipTronquee(socket) {
  const brut = socket?.remoteAddress ?? 'inconnu';
  return brut.replace(/\:\:ffff\:/, '').split('.').slice(0, 2).join('.') + '.x.x';
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function finir(res, statut, corps, lienOrigine) {
  res.writeHead(statut, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ORIGINES.has(lienOrigine ?? '') ? lienOrigine : '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(corps));
}

function lireCorps(req, max = 64 * 1024) {
  return new Promise((ok, ko) => {
    let taille = 0;
    const morceaux = [];
    req.on('data', (m) => {
      taille += m.length;
      if (taille > max) { ko(new Error('payload trop grand')); req.destroy(); return; }
      morceaux.push(m);
    });
    req.on('end', () => ok(Buffer.concat(morceaux).toString('utf-8')));
    req.on('error', ko);
  });
}

async function appelerLLM(system, user) {
  const reponse = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CLE}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0 }),
  });
  const corps = await reponse.json();
  if (!reponse.ok) {
    throw new Error(`LLM ${reponse.status} : ${JSON.stringify(corps).slice(0, 120)}`);
  }
  return {
    text: corps?.choices?.[0]?.message?.content ?? '',
    tokens: corps?.usage?.total_tokens ?? 0,
    modeleServi: corps?.model ?? MODEL,
  };
}

const serveur = createServer(async (req, res) => {
  const origine = req.headers.origin ?? '';
  const chemin = (req.url ?? '/').split('?')[0];
  const ip = ipTronquee(req.socket);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method === 'GET' && chemin === '/api/health') {
    finir(res, 200, { ok: true, model: MODEL, cle: CLE.length > 0 }, origine);
    return;
  }
  if (req.method !== 'POST' || chemin !== '/api/chat') {
    finir(res, 404, { error: 'inconnu' }, origine);
    return;
  }
  if (!CLE) {
    finir(res, 503, { error: 'proxy sans clé', note: 'le proxy ne détient aucune clé LLM' }, origine);
    return;
  }
  if (!autorise(ip)) {
    finir(res, 429, { error: 'quota dépassé', note: 'quota par IP et par jour atteint' }, origine);
    return;
  }
  try {
    const corps = JSON.parse(await lireCorps(req));
    const system = String(corps.system ?? '');
    const user = String(corps.user ?? '');
    const resultat = await appelerLLM(system, user);
    console.log(`${new Date().toISOString()} chat ${ip} ${resultat.tokens} jetons (${resultat.modeleServi})`);
    finir(res, 200, resultat, origine);
  } catch (erreur) {
    console.error(`${new Date().toISOString()} erreur ${ip} : ${erreur.message}`);
    finir(res, 502, { error: 'échec en amont', note: String(erreur.message).slice(0, 160) }, origine);
  }
});

serveur.listen(PORT, () => {
  console.log(`banc-proxy sur :${PORT} — modèle ${MODEL}, clé ${CLE.length > 0 ? 'présente' : 'ABSENTE'}`);
});
