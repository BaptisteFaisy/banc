/**
 * La provenance de chaque requête réelle : quels fichiers du dépôt fondent la
 * valeur recalculée.
 *
 * C'est la pièce qui rend un oracle **consultable** : on ne déclare pas « 12
 * outils MCP », on dit que la valeur sort de `manifest.yml`, et n'importe qui
 * peut ouvrir le fichier. Le site l'affiche, le mode blanc s'en sert pour
 * fournir à l'agent les VRAIS documents (jamais la valeur), et un test vérifie
 * que chaque requête nomme des fichiers qui existent dans le corpus scellé —
 * une provenance inventée casse donc le build, pas la démonstration.
 */
import type { RealCorpus } from './corpus.js';

/** Requête → chemins des fichiers réels qui la fondent. */
export const PROVENANCE_PAR_REQUETE: Readonly<Record<string, readonly string[]>> = {
  'repo:manifest.outils-mcp': ['manifest.yml'],
  'repo:manifest.modules': ['manifest.yml'],
  'repo:manifest.declencheurs': ['manifest.yml'],
  'repo:manifest.app': ['manifest.yml'],
  'repo:ci.budget': ['.github/workflows/'],
  'repo:ci.runners': ['.github/workflows/'],
  'repo:licence': ['LICENSE'],
  'repo:recette': ['docs/RECETTE.md'],
  'repo:mergify.checks': ['.mergify.yml'],
  'repo:git.commit-courant': [],
  'repo:git.auteur-le-plus-fecond': [],
  'repo:prs': [],
  'repo:runs': [],
  'repo:dependances': ['package.json'],
};

/** Les fichiers exacts d'une requête, préfixes de dossier résolus dans le corpus. */
export function fichiersDeLaRequete(
  query: string, corpus: RealCorpus,
): readonly string[] {
  const déclarés = PROVENANCE_PAR_REQUETE[query] ?? [];
  const chemins = corpus.documents.map((doc) => doc.path);
  return déclarés.flatMap((entree) => (
    entree.endsWith('/')
      ? chemins.filter((chemin) => chemin.startsWith(entree))
      : chemins.filter((chemin) => chemin === entree)
  ));
}

/** Toutes les requêtes connaissables, dans l'ordre du fichier de dérivation. */
export function requetesConnues(): readonly string[] {
  return Object.keys(PROVENANCE_PAR_REQUETE);
}
