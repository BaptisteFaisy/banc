/**
 * Script de semis du banc de démonstration (§29).
 *
 * Écrit le corpus en JSON dans `dist/seed/` — une copie lisible, exportable
 * et diffusable aux juges. Rien de secret, rien de réel : le corpus est
 * fictif et le dit.
 *
 * Usage : `npm run seed`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SEED_CASES, SEED_SUITES, SEED_VERSIONS, SEED_AGENT, seedIsComplete, seedOracleStates } from './index.js';

/** Répertoire de sortie : `dist/seed/`. */
const OUT = resolve(process.cwd(), 'dist/seed');

/** Écrit un fichier JSON, en créant les répertoires manquants. */
function write(name: string, value: unknown): string {
  const path = resolve(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  return path;
}

/** Point d'entrée : semis et résumé sur stdout. */
export function main(): number {
  const complete = seedIsComplete();
  write('cases.json', SEED_CASES);
  write('suites.json', SEED_SUITES);
  write('agents.json', { agent: SEED_AGENT, versions: SEED_VERSIONS });
  write('truth.json', seedOracleStates());
  write('README.md', [
    '# Banc de démonstration',
    '',
    complete.motive,
    '',
    'Corpus **fictif** : aucune donnée réelle, aucun secret. Les cas vivent dans',
    "l'espace du banc (`BENCH`), jamais dans un espace de production.",
    '',
    '| Fichier | Contenu |',
    '|---|---|',
    '| `cases.json` | les 40 cas, avec question, oracle, gravité, tags |',
    '| `suites.json` | les quatre suites : lot d’or, fumée, batterie, complète |',
    '| `agents.json` | l’agent et ses trois versions, dont le témoin |',
    '| `truth.json` | l’état de vérité semé, avec la dérive de D-13 |',
    '',
  ].join('\n'));
  process.stdout.write(`${complete.motive}\n`);
  process.stdout.write(`écrit dans ${OUT}\n`);
  return complete.ok ? 0 : 1;
}

// Ce fichier est un point d'entrée en ligne de commande : rien ne l'importe,
// donc l'exécution est directe. (Un garde `import.meta.url` ne se déclencherait
// pas sous `vite-node`, dont `process.argv[1]` est le binaire.)
process.exit(main());
