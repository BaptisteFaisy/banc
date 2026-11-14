/**
 * Le circuit de retrieval du banc réel : l'agent LIT, il ne reçoit pas.
 *
 * C'est la correction du script. L'agent réel recevait la valeur de l'oracle
 * dans son prompt (`contextOf` injectait `JSON.stringify(oracle.value)`, quatre
 * fois) — d'où une exactitude de 100 % qui ne mesurait rien : le modèle
 * récitait. Ici :
 *
 *   tour 1 — le système pose le rôle, les règles de citation, et l'INDEX des
 *            documents réels (identifiants et tailles, aucune valeur).
 *            L'agent répond soit `BESOIN: <chemin>` (un ou plusieurs), soit
 *            qu'il nomme ce qui manque ;
 *   tour 2 — les documents demandés sont lus dans le corpus scellé et donnés
 *            en pâture brute ; l'agent répond, en citant ses sources.
 *
 * Deux modes (§12), même contrat : `noir` = l'agent ne voit que l'index et doit
 * aller chercher ; `blanc` = les documents de provenance du cas sont fournis
 * d'emblée, les deux versions testées recevant le MÊME instantané. Dans les
 * deux cas, la valeur de l'oracle n'apparaît nulle part dans la prompt.
 *
 * Le coût est mesuré : les deux tours comptent, en jetons, latence et citations,
 * parce qu'un agent qui lit deux fois coûte deux fois.
 */
import type { BancCase } from '../domain/vocabulary.js';
import { indexDesSources, lireDocument } from '../real/corpus.js';
import type { RealCorpus } from '../real/corpus.js';
import { fichiersDeLaRequete } from '../real/provenance.js';
import type { ChatClient } from './real-agent.js';

/** Plafond déclaré d'un document servi : au-dessus, la troncature est marquée. */
export const LIMITE_DOCUMENT_CARACTERES = 20_000;

/** Nombre maximal de documents qu'un agent peut réclamer par cas. */
export const LIMITE_DOCUMENTS_PAR_CAS = 4;

/** La règle de conduite, en un bloc : rôle, citation, refus, demande. */
export function systemeAgent(index: readonly string[]): string {
  return [
    'Tu es l’agent support interne d’une organisation. Les faits sont dans son dépôt.',
    'Réponds UNIQUEMENT à partir des documents de l’organisation. Ne devine rien.',
    'Cite chaque affirmation au format exact [source: chemin/du/fichier].',
    'Si un document te manque pour répondre, demande-le sur une ligne par document :',
    'BESOIN: chemin/du/fichier — puis n’écris rien d’autre dans ce tour.',
    'Si la réponse n’existe dans aucun document, dis quel fait manque et où il faudrait le chercher.',
    '',
    'Index des documents disponibles (identifiant et taille, aucun contenu) :',
    ...index.map((ligne) => `- ${ligne}`),
  ].join('\n');
}

/** Les documents qu'un agent réclame au tour 1 (`BESOIN:`), dans l'ordre. */
export function besoinsDe(texte: string): readonly string[] {
  const trouvés: string[] = [];
  for (const ligne of texte.split('\n')) {
    const m = /^BESOIN:\s*(\S+)\s*$/.exec(ligne.trim());
    if (m?.[1] && !trouvés.includes(m[1])) trouvés.push(m[1]);
  }
  return trouvés.slice(0, LIMITE_DOCUMENTS_PAR_CAS);
}

/** Un document réel en pâture brute, avec son chemin en tête. */
export function blocDocument(chemin: string, corpus: RealCorpus): string {
  const contenu = lireDocument(chemin, corpus);
  if (contenu === undefined) return `### ${chemin}\n(absent du corpus scellé)`;
  const tronque = contenu.length > LIMITE_DOCUMENT_CARACTERES;
  const corps = tronque ? contenu.slice(0, LIMITE_DOCUMENT_CARACTERES) : contenu;
  return `### ${chemin}${tronque ? ' (tronqué : marqueur de lecture partielle)' : ''}\n${corps}`;
}

/** Les documents de provenance d'un cas, pour le mode blanc (§12). */
export function documentsDuCas(kase: BancCase, corpus: RealCorpus): readonly string[] {
  const spec = kase.oracleSpec;
  const requêtes = spec.type === 'règle_vivante'
    ? spec.atoms.map((atome) => atome.query)
    : spec.type === 'valeur_dérivée' ? [spec.query] : [];
  const chemins = requêtes.flatMap((requete) => fichiersDeLaRequete(requete, corpus));
  return [...new Set(chemins)].slice(0, LIMITE_DOCUMENTS_PAR_CAS);
}

/** Les deux tours joués sur un cas, avec la mesure accumulée. */
export interface ToursJoues {
  readonly texte: string;
  readonly tokens: number;
  readonly latencyMs: number;
  readonly docsLus: readonly string[];
  readonly tours: number;
  /** Le modèle réellement servi au dernier tour (méta-routeur : ça bouge). */
  readonly modeleServi?: string;
  /** Raison d'un échec de transport, déclarée — jamais avalée (§17). */
  readonly échec?: string;
}

/** Un tour appelé : la mesure, ou la raison déclarée de l'échec de transport. */
interface TourRéussi {
  readonly text: string; readonly tokens: number; readonly latencyMs: number; readonly modeleServi?: string;
}
interface TourÉchoué { readonly échec: string; readonly latencyMs: number }

/** Un tour, avec le délai et l'erreur attrapée : la panne se déclare, elle ne tue pas. */
async function tour(chat: ChatClient, envoi: { system: string; user: string }): Promise<TourRéussi | TourÉchoué> {
  const started = Date.now();
  try {
    const rendu = await chat.complete(envoi);
    return {
      text: rendu.text, tokens: rendu.tokens,
      latencyMs: rendu.latencyMs ?? (Date.now() - started), modeleServi: rendu.modeleServi,
    };
  } catch (erreur) {
    return { échec: `transport : ${erreur instanceof Error ? erreur.message : String(erreur)}`.slice(0, 200),
      latencyMs: Date.now() - started };
  }
}

/** Joue un cas en deux tours : demande de documents, puis réponse citée. */
export async function jouerCas(
  chat: ChatClient, kase: BancCase, corpus: RealCorpus, mode: 'blanc' | 'noir',
  systeme?: string,
): Promise<ToursJoues> {
  const base = systeme ?? systemeAgent(indexDesSources(corpus));
  const lus: string[] = [];
  let texte = '';
  let tokens = 0;
  let latencyMs = 0;
  let tours = 0;

  // La question d'abord, les documents ensuite : l'ordre rend lisible ce qui a
  // été VERSÉ d'office (mode blanc, §12) et ce qui ne l'a pas été.
  const premier = mode === 'blanc' ? documentsDuCas(kase, corpus) : [];
  const versés = premier.map((chemin) => { lus.push(chemin); return blocDocument(chemin, corpus); });
  const user1 = versés.length > 0
    ? `${kase.question}\n\nDocuments de provenance de ce cas :\n\n${versés.join('\n\n')}`
    : kase.question;

  const appel = await tour(chat, { system: base, user: user1 });
  if ('échec' in appel) return { texte: '', tokens: 0, latencyMs: appel.latencyMs, docsLus: lus, tours: 0, échec: appel.échec };
  tokens += appel.tokens; latencyMs += appel.latencyMs; tours += 1; texte = appel.text;
  const modeleServi = appel.modeleServi;

  const demandes = mode === 'noir' ? besoinsDe(texte) : [];
  if (demandes.length === 0) return { texte, tokens, latencyMs, docsLus: lus, tours, modeleServi };

  const blocs = demandes.map((chemin) => { lus.push(chemin); return blocDocument(chemin, corpus); });
  const user2 = `${kase.question}\n\nDocuments demandés :\n\n${blocs.join('\n\n')}\n\nRéponds maintenant, en citant [source: …].`;
  const suite = await tour(chat, { system: base, user: user2 });
  if ('échec' in suite) {
    return { texte: '', tokens, latencyMs, docsLus: lus, tours, modeleServi, échec: suite.échec };
  }
  return {
    texte: suite.text, tokens: tokens + suite.tokens,
    latencyMs: latencyMs + suite.latencyMs, docsLus: lus, tours: tours + 1,
    modeleServi: suite.modeleServi ?? modeleServi,
  };
}
