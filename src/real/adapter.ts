/**
 * L'adaptateur des sources RÉELLES du banc : le dépôt lui-même, derrière le
 * contrat `SourceAdapter` du produit.
 *
 * Rien de nouveau sous le soleil : `createFixtureAdapter` est le même que celui
 * du banc de démonstration et des tests. La différence est dans le contenu —
 * ici la table requête → valeur est **recalculée** depuis les bytes capturés
 * (`src/real/derive.ts`), jamais écrite à la main. Un adaptateur réel de
 * Teamwork Graph se brancherait exactement au même endroit (§21).
 *
 * Le droit manquant (§21 : la plateforme vide le résultat sans erreur) est
 * déclaré ici : les requêtes `repo:prs` et `repo:runs` touchent le REST GitHub,
 * qui peut ne pas être capturé. Sans cette table, l'écran de santé des oracles
 * afficherait « pas de données » là où il manque une autorisation.
 */
import { createFixtureAdapter } from '../collect/registry.js';
import type { SourceAdapter } from '../domain/vocabulary.js';
import { createRegistry } from '../oracle/deps.js';
import type { SourceRegistry } from '../oracle/deps.js';
import { REAL_CORPUS, sceauValide } from './corpus.js';
import type { RealCorpus } from './corpus.js';
import { valeursDuCorpus } from './derive.js';

/** Types d'objet touchés par chaque requête réelle. */
export const SCOPES_PAR_REQUETE: Readonly<Record<string, readonly string[]>> = {
  'repo:prs': ['pull-request'],
  'repo:runs': ['check-run'],
};

/** Droits du lecteur de démonstration sur le dépôt réel. */
export const SCOPES_ACCORDES: readonly string[] = [
  'file', 'commit', 'pull-request', 'check-run', 'manifest', 'document',
];

/** La requête touche-t-elle un type de droit ? (sinon : le dépôt lui-même.) */
export function scopesDe(query: string): readonly string[] {
  return SCOPES_PAR_REQUETE[query] ?? ['file'];
}

/** Un corpus dont le sceau ne tient plus est suspect : on le dit, on ne le tait pas. */
export class SceauCorpusReel extends Error {
  constructor(corpus: RealCorpus) {
    super(`corpus réel suspect : empreinte ${corpus.meta.empreinteEnsemble.slice(0, 12)}… `
      + `ne correspond plus aux documents servis — recapture requis `
      + `(tools/capture-real-corpus.mjs)`);
  }
}

/** L'adaptateur `repo` sur le corpus capturé, avec ses droits déclarés. */
export function createRepoAdapter(corpus: RealCorpus = REAL_CORPUS): SourceAdapter {
  if (!sceauValide(corpus)) throw new SceauCorpusReel(corpus);
  return createFixtureAdapter('repo', valeursDuCorpus(corpus), {
    grantedScopes: SCOPES_ACCORDES, scopesOf: scopesDe,
  });
}

/** Le registre du banc réel : le dépôt, et rien d'autre. */
export function registreReel(corpus: RealCorpus = REAL_CORPUS): SourceRegistry {
  return createRegistry([createRepoAdapter(corpus)]);
}
