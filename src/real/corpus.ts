/**
 * Le corpus RÉEL du banc : le dépôt `banc` lui-même, figé et scellé.
 *
 * Le banc de démonstration jouait un monde inventé (`src/seed/truth.ts` :
 * « Tout est fictif »). Celui-ci joue un monde **réel** : dix-neuf fichiers
 * exacts du dépôt, les commits lus dans `git log`, les PR et runs CI lus par
 * le REST GitHub. Capturé par `tools/capture-real-corpus.mjs`, jamais tapé à
 * la main.
 *
 * Trois garanties, dans ce fichier :
 *   1. **provenance** — chaque document porte son chemin, son empreinte
 *      SHA-256 et le commit de capture ; un fait affirmé sans citation peut
 *      être contrôlé contre eux ;
 *   2. **sceau** — l'empreinte de l'ensemble est vérifiée au chargement : si
 *      un document est modifié sans recapture, le corpus est déclaré suspect
 *      au lieu de servir des valeurs périmées (§7, dérive de vérité) ;
 *   3. **aucune valeur dans l'index** — l'index rendu à l'agent ne contient
 *      que des identifiants et des tailles : la réponse n'est jamais donnée,
 *      elle est lisible quelque part et l'agent doit y aller (§21, action).
 *
 * Le JSON est importé (pas de réseau) : un test du banc ne fait jamais
 * d'appel réseau, et le mode direct du navigateur a le même corpus que le CLI.
 */
import corpusJson from './corpus.json';
import { sha256 } from '../oracle/sha256.js';

/** Un document réel du corpus. */
export interface RealDocument {
  readonly id: string;
  readonly path: string;
  readonly contenu: string;
  readonly empreinte: string;
}

/** Les faits GitHub retenus (PRs, runs CI, commits). */
export interface RealGithub {
  readonly pulls: readonly Record<string, unknown>[];
  readonly runs: readonly Record<string, unknown>[];
  readonly commits: readonly Record<string, unknown>[];
  readonly partiel: boolean;
}

/** Le corpus, tel que capturé. */
export interface RealCorpus {
  readonly meta: {
    readonly capturéLe: string; readonly commit: string; readonly dépôt: string;
    readonly empreinteEnsemble: string; readonly sources: string; readonly note: string;
  };
  readonly documents: readonly RealDocument[];
  readonly github: RealGithub;
}

/** Le corpus capturé, typé une seule fois. */
export const REAL_CORPUS = corpusJson as unknown as RealCorpus;

/**
 * L'empreinte de l'ensemble, recalculée depuis les bytes SERVIS — pas depuis
 * les empreintes stockées dans le JSON. Un sceau qui hache des champs
 * d'auto-déclaration ne lie rien : modifier `contenu` sans toucher `empreinte`
 * resterait invisible. C'est le piège que ce fichier ferme.
 */
export function empreinteEnsemble(corpus: RealCorpus = REAL_CORPUS): string {
  return sha256(corpus.documents.map((d) => `${sha256(d.contenu)}  ${d.path}\n`).join(''));
}

/** Un document porte-t-il bien l'empreinte de son propre contenu ? */
export function empreinteDocumentValide(doc: RealDocument): boolean {
  return sha256(doc.contenu) === doc.empreinte;
}

/**
 * Le sceau tient-il ? Deux conditions, jamais une seule :
 *   1. chaque document porte l'empreinte de ses bytes (rien n'est réécrit en
 *      douce dans le corpus) ;
 *   2. l'empreinte de l'ensemble correspond à celle de la capture.
 * Faux = le corpus a changé sans recapture : les valeurs oracle sont périmées,
 * et le banc le dit au lieu d'affirmer (§7).
 */
export function sceauValide(corpus: RealCorpus = REAL_CORPUS): boolean {
  const liés = corpus.documents.every(empreinteDocumentValide);
  return liés && empreinteEnsemble(corpus) === corpus.meta.empreinteEnsemble;
}

/** Un document par identifiant. */
export function documentsParId(corpus: RealCorpus = REAL_CORPUS): ReadonlyMap<string, RealDocument> {
  return new Map(corpus.documents.map((doc) => [doc.id, doc]));
}

/** L'index rendu à l'agent : identifiants et tailles, jamais de valeur. */
export function indexDesSources(corpus: RealCorpus = REAL_CORPUS): readonly string[] {
  return corpus.documents.map((doc) => `${doc.id} (${doc.contenu.length} caractères)`);
}

/** Le texte d'un document réel, ou `undefined` s'il n'existe pas. */
export function lireDocument(id: string, corpus: RealCorpus = REAL_CORPUS): string | undefined {
  return corpus.documents.find((doc) => doc.id === id || doc.path === id)?.contenu;
}
