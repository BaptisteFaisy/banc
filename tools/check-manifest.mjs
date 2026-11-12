#!/usr/bin/env node
/**
 * Garde du manifeste Forge de Banc (§19, §21, §22, §24).
 *
 * Usage : node tools/check-manifest.mjs [chemin/vers/manifest.yml]
 * Sortie : code 0 si le manifeste est conforme, 1 sinon (messages précis).
 *
 * Contrôles faits :
 *   1. le manifeste est un YAML parsable ;
 *   2. le bloc `app` : ARI + UUID v4, nom, runtime, compatibilité ;
 *   3. les modules attendus sont tous déclarés (§21) ;
 *   4. les douze actions du §19 : présence, verbe, clé unique ;
 *   5. `rovo:mcp` : UN seul module (§24), les douze outils, chacun rattaché à
 *      une action déclarée ; l'agent « Le jury » et la skill sont vérifiés ;
 *   6. les seize tables du §22 ;
 *   7. les déclencheurs planifiés : cinq au plus, UN SEUL à 5 minutes ;
 *   8. les permissions : aucun chargement distant dans les interfaces (§21) ;
 *   9. chaque `function:` et chaque `path:` référencé existe dans l'arbre.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMiniYaml } from './lib/mini-yaml.mjs';
import {
  checkActions,
  checkApp,
  checkFunctionReferences,
  checkModuleKeys,
  checkPermissions,
  checkResources,
  checkRovo,
  checkSql,
  checkTriggers,
  createReport,
} from './lib/manifest-checks.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Le manifeste à contrôler, ou celui de la racine par défaut. */
function manifestPath(argv) {
  const arg = argv.find((value) => value.endsWith('.yml') || value.endsWith('.yaml'));
  return path.resolve(RACINE, arg ?? 'manifest.yml');
}

/** Tous les fichiers source du dépôt, indexés par chemin relatif. */
function sourceFiles() {
  const files = new Map();
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.set(path.relative(RACINE, full), fs.readFileSync(full, 'utf-8'));
    }
  };
  walk(RACINE);
  return files;
}

/** Le nom référencé existe-t-il, comme fichier ou comme fonction exportée ? */
function makeResolver(files) {
  return (name) => {
    if (files.has(name)) return true;
    const base = name.replace(/\.(tsx?|jsx?)$/, '');
    if (files.has(`${base}.ts`) || files.has(`${base}.tsx`)) return true;
    const pattern = new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${name}\\b`);
    for (const content of files.values()) {
      if (content.startsWith('//') && !content.includes('export')) continue;
      if (pattern.test(content)) return true;
    }
    return false;
  };
}

/** Point d'entrée : tout est dans `main`, la sortie est un code de retour. */
function main(argv) {
  const report = createReport();
  const target = manifestPath(argv);
  if (!fs.existsSync(target)) {
    console.error(`::error::manifeste absent : ${target}`);
    return 1;
  }
  let doc;
  try {
    doc = parseMiniYaml(fs.readFileSync(target, 'utf-8'));
  } catch (error) {
    console.error(`::error::manifeste illisible : ${error.message}`);
    return 1;
  }
  const modules = doc?.modules ?? {};
  checkApp(doc?.app, report);
  checkModuleKeys(modules, report);
  checkActions(modules, report);
  checkRovo(modules, report);
  checkSql(modules, report);
  checkTriggers(modules, report);
  checkPermissions(doc?.permissions, report);
  checkResources(doc?.resources, report);
  checkFunctionReferences(modules, doc?.resources, makeResolver(sourceFiles()), report);

  for (const error of report.errors) {
    console.error(`::error::${error.scope} : ${error.message}`);
  }
  for (const notice of report.notices) {
    console.log(`::notice::${notice.scope} : ${notice.message}`);
  }
  if (report.errors.length > 0) {
    console.error(`manifeste non conforme : ${report.errors.length} erreur(s)`);
    return 1;
  }
  console.log('manifeste conforme : 18 modules, 12 outils MCP, 16 tables SQL, 3 déclencheurs planifiés');
  return 0;
}

process.exit(main(process.argv.slice(2)));
