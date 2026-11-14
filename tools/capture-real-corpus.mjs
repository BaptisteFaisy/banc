#!/usr/bin/env node
/**
 * Capture le corpus RÉEL sur lequel le banc se joue : le dépôt `banc` lui-même.
 *
 * Le banc de démonstration jouait un monde fictif (`src/seed/truth.ts` : équipes
 * inventées, tickets inventés) et recevait la valeur oracle dans son prompt —
 * donc il récitait. Ce script produit l'inverse : des faits réels, lus dans des
 * fichiers réels, scellés par empreinte, que le banc RECALCULE et que l'agent
 * doit RETROUVER sans jamais les voir passer dans son prompt.
 *
 * Une seule règle de conception : rien n'est tapé à la main. Chaque document
 * est le bytes exact du dépôt, avec son chemin, son empreinte SHA-256 et sa
 * provenance (commit, horodatage). Si un fichier change, l'empreinte change et
 * le test de grounding nomme le cas — c'est la dérive de vérité détectée par
 * le banc lui-même (§7), appliquée au banc.
 *
 * Usage : node tools/capture-real-corpus.mjs [--repo <dir>] [--out <fichier>]
 * Sortie : src/real/corpus.json (+ un rapport sur stdout)
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = join(RACINE, 'src/real/corpus.json');
const LIMITE_OCTETS = 64 * 1024;

/** Lit les arguments `--cle valeur`, sans dépendance. */
function arguments_(argv) {
  const sortis = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) { sortis[argv[i].slice(2)] = argv[i + 1]; i += 1; }
  }
  return sortis;
}

/** SHA-256 hex d'un contenu, pour le sceau et la traçabilité. */
function empreinte(contenu) {
  return createHash('sha256').update(contenu).digest('hex');
}

/** Le commit courant du dépôt, lu par git (aucune supposition). */
function commitCourant(repo) {
  return execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

/** Les commits réels, lus dans le dépôt local : aucun réseau, aucun jeton. */
function commitsLocaux(repo, limite = 12) {
  const brut = execFileSync('git', ['-C', repo, 'log', `-${limite}`,
    '--pretty=format:%H%x1f%an%x1f%aI%x1f%s'], { encoding: 'utf8' });
  return brut.split('\n').filter(Boolean).map((ligne) => {
    const [sha, author, date, message] = ligne.split('\u001f');
    return { sha, author, date, message };
  });
}

/** Un document : le bytes exact du fichier, plus sa provenance. */
function document_(repo, cheminRelatif) {
  const absolu = join(repo, cheminRelatif);
  if (!existsSync(absolu)) throw new Error(`document réel absent : ${cheminRelatif}`);
  const contenu = readFileSync(absolu, 'utf8');
  if (Buffer.byteLength(contenu, 'utf8') > LIMITE_OCTETS) {
    throw new Error(`${cheminRelatif} dépasse ${LIMITE_OCTETS} octets — à découper, pas à tronquer`);
  }
  return { id: cheminRelatif, path: cheminRelatif, contenu, empreinte: empreinte(contenu) };
}

/** Les fichiers d'une racine, triés (le tri fait l'empreinte de l'ensemble). */
function fichiersDe(repo, dossier, filtre) {
  return readdirSync(join(repo, dossier), { withFileTypes: true })
    .filter((e) => e.isFile() && filtre(e.name))
    .map((e) => `${dossier}/${e.name}`)
    .sort();
}

/** L'appel GitHub, par `gh` (le serveur a un jeton ; pas de clé en dur). */
function githubApi(repo, chemin, jq = '.') {
  const sortie = execFileSync('gh', ['api', chemin, '--jq', jq], { encoding: 'utf8', timeout: 60_000 });
  return JSON.parse(sortie);
}

/** Les faits GitHub réels : PRs, commits, runs CI. Champs nommés, pas de tuples. */
function faitsGithub(repoSlug, limite = 12) {
  const page = `per_page=${limite}`;
  const pulls = githubApi(repoSlug, `repos/${repoSlug}/pulls?state=all&${page}`,
    '[.[] | {number, title, state, merged_at, head_branch}]');
  const runs = githubApi(repoSlug, `repos/${repoSlug}/actions/runs?${page}`,
    '[.workflow_runs[] | {name, status, conclusion, run_started_at, updated_at, path: .path}]');
  const commits = githubApi(repoSlug, `repos/${repoSlug}/commits?${page}`,
    '[.[] | {sha, message: .commit.message, author: .commit.author.name, date: .commit.author.date}]');
  return { pulls, runs, commits };
}

/** Assemble le corpus : documents du dépôt + faits GitHub, le tout scellé.
 *
 * `sansGithub` : les appels REST sont bornés par un jeton partagé ; quand le
 * quota est épuisé, on capture quand même la vérité locale (fichiers + git
 * log) et on marque ce qui manque, au lieu d'inventer ou d'échouer.
 */
function capturer(repo, repoSlug, { sansGithub = false } = {}) {
  const chemins = [
    'manifest.yml', 'package.json', 'LICENSE', 'tsconfig.json', 'vitest.config.ts',
    '.mergify.yml', 'README.md', 'SKILL.md', 'docs/ROADMAP.md', 'docs/RECETTE.md',
    ...fichiersDe(repo, '.github/workflows', (n) => n.endsWith('.yml')),
  ];
  const documents = chemins.map((c) => document_(repo, c));
  const commits = commitsLocaux(repo);
  const github = sansGithub ? { pulls: [], runs: [], commits, partiel: true }
    : { ...faitsGithub(repoSlug), commits, partiel: false };
  const capture = new Date().toISOString();
  const commit = commitCourant(repo);
  const ensemble = empreinte(documents.map((d) => `${d.empreinte}  ${d.path}\n`).join(''));
  return {
    meta: {
      capturéLe: capture, commit, dépôt: repoSlug, empreinteEnsemble: ensemble,
      sources: sansGithub
        ? 'fichiers du dépôt + git log local (REST non interrogé : quota du jeton épuisé)'
        : 'fichiers du dépôt + git log local + REST GitHub',
      note: 'Corpus réel du banc : le dépôt lui-même. Rien n’est tapé à la main — chaque valeur oracle est recalculée depuis ces bytes.',
    },
    documents, github,
  };
}

function main() {
  const opts = arguments_(process.argv.slice(2));
  const repo = resolve(opts.repo ?? RACINE);
  const sortie = resolve(opts.out ?? SORTIE);
  const corpus = capturer(repo, opts.slug ?? 'Tradoooo/banc', { sansGithub: 'sansGithub' in opts });
  writeFileSync(sortie, `${JSON.stringify(corpus, null, 2)}\n`);
  const octets = Buffer.byteLength(JSON.stringify(corpus), 'utf8');
  console.log(`${corpus.documents.length} document(s) réels, ${octets} octets, empreinte ${corpus.meta.empreinteEnsemble.slice(0, 12)}…`);
  console.log(`GitHub : ${corpus.github.pulls.length} PR, ${corpus.github.runs.length} runs, ${corpus.github.commits.length} commits${corpus.github.partiel ? ' (REST ignoré : quota)' : ''}`);
  console.log(`écrit : ${sortie}`);
}

main();
