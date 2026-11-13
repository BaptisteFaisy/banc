/**
 * Le lot d'or de SAM Vision — des faits dont la vérité est DÉRIVÉE du code.
 *
 * Ce corpus n'est pas inventé : chaque cas est un fait vérifiable du contrat
 * d'interface de l'app SAM Vision, lu dans le source (`isee`, arbre Kotlin).
 * La réponse attendue n'est pas une intention de rédacteur : c'est une
 * constante, un format ou un ordre écrit dans le code, et le banc la RELIT
 * plutôt que de la recopier — exactement la forme « valeur dérivée » du
 * cahier des charges (§6.1), appliquée à un vrai produit.
 *
 * Provenance : `git://BaptisteFaisy/isee`, fichier `LiveProbeText.kt`,
 * `TimingsText.kt`, `LiveSession.kt` et la recette manuelle de
 * `docs/TESTING.md`. Les lignes citées sont celles de l'arbre du 26/10/2026.
 *
 * Un test vérifie que chaque citation est PRÉSENTE dans l'extrait figé
 * (`vision-sources.ts`) : si le code évolue, le test casse et le point à
 * revoir est nommé — c'est le banc qui détecte la dérive de vérité.
 */

/** Un cas du lot d'or SAM Vision, avec sa provenance exacte. */
export interface VisionGoldenCase {
  readonly id: string;
  /** La question posée — ici, à un agent qui documente le contrat d'UI. */
  readonly question: string;
  /** La réponse attendue, dérivée du code. */
  readonly answer: string;
  /** Le fichier source, sans le préfixe `git://BaptisteFaisy/isee/`. */
  readonly source: string;
  /** L'extrait du code qui fait foi (quelques mots, verbeaux). */
  readonly quote: string;
  readonly gravity: 'bloquant' | 'souhaitable';
}

/** Les faits du contrat d'UI de SAM Vision, dans l'ordre de lecture du code. */
export const VISION_GOLDEN: readonly VisionGoldenCase[] = [
  {
    id: 'SV-01',
    question: 'À combien de caractères un endpoint trop long est-il raccourci, et que coupe-t-on ?',
    answer: '46 caractères utiles ; le milieu est coupé (tête + queue, séparées par une ellipse).',
    source: 'app/src/main/java/dev/sam3vision/app/ihear/LiveProbeText.kt',
    quote: 'const val ENDPOINT_MAX_CHARS = 46',
    gravity: 'bloquant',
  },
  {
    id: 'SV-02',
    question: 'Combien de distances la ligne « distances : » cite-t-elle au plus ?',
    answer: '3, du plus proche au plus loin.',
    source: 'app/src/main/java/dev/sam3vision/app/ihear/LiveProbeText.kt',
    quote: 'const val DISTANCE_LINES_MAX = 3',
    gravity: 'bloquant',
  },
  {
    id: 'SV-03',
    question: 'Quel texte affiche-t-on au centre de la fenêtre pendant le réveil du GPU SAM ?',
    answer: '« réveil du GPU SAM… (≈ 30 s au premier lancement) ».',
    source: 'app/src/main/java/dev/sam3vision/app/ihear/LiveProbeText.kt',
    quote: '"réveil du GPU SAM… (≈ 30 s au premier lancement)"',
    gravity: 'bloquant',
  },
  {
    id: 'SV-04',
    question: 'Que renvoie la notice une fois la première frame arrivée ?',
    answer: 'Rien (null) — les masques parlent d\'eux-mêmes.',
    source: 'app/src/main/java/dev/sam3vision/app/ihear/LiveProbeText.kt',
    quote: 'if (state.frames > 0) return null',
    gravity: 'bloquant',
  },
  {
    id: 'SV-05',
    question: 'Quel séparateur sépare deux distances mesurées, et quel en est le format ?',
    answer: 'Un point médian encadré d\'espaces (« · »), au format « chaise ≈ 1,1 m · personne ≈ 3,2 m ».',
    source: 'app/src/main/java/dev/sam3vision/app/ihear/LiveProbeText.kt',
    quote: 'joinToString(" · ") { "…" }',
    gravity: 'souhaitable',
  },
  {
    id: 'SV-06',
    question: 'Dans quel ordre viennent les postes de la chronologie compacte ?',
    answer: 'capt, up, srv, rtt, masque, pixel.',
    source: 'core/src/main/java/dev/sam3vision/core/live/TimingsText.kt',
    quote: 'Poste("capt", …), Poste("up", …), Poste("srv", …), Poste("rtt", …), Poste("masque", …), Poste("pixel", …)',
    gravity: 'bloquant',
  },
  {
    id: 'SV-07',
    question: 'Quel symbole représente un poste de chronologie non mesuré ?',
    answer: 'Le tiret cadratin « — », jamais un zéro ni un nombre négatif.',
    source: 'core/src/main/java/dev/sam3vision/core/live/TimingsText.kt',
    quote: 'const val MISSING: String = "—"',
    gravity: 'souhaitable',
  },
  {
    id: 'SV-08',
    question: 'Comment un nombre décimal est-il formaté dans l\'interface ?',
    answer: 'À la française : virgule décimale, une décimale (1,4 et non 1.4).',
    source: 'app/src/main/java/dev/sam3vision/app/ihear/LiveProbeText.kt',
    quote: 'String.format(Locale.FRANCE, "%.1f", value)',
    gravity: 'bloquant',
  },
  {
    id: 'SV-09',
    question: 'Quel est le budget de latence du mode direct (Cadence.Fast) ?',
    answer: '150 ms, un seul créneau en vol.',
    source: 'core/src/main/java/dev/sam3vision/core/live/LiveSession.kt',
    quote: 'Cadence.Fast',
    gravity: 'bloquant',
  },
  {
    id: 'SV-10',
    question: 'Quels étages serveur sont lus dans le détail de latence, et dans quel ordre ?',
    answer: 'preprocess, vision, tokenize, detr, masks, queue.',
    source: 'core/src/main/java/dev/sam3vision/core/live/TimingsText.kt',
    quote: 'listOf("preprocess", "vision", "tokenize", "detr", "masks", "queue")',
    gravity: 'souhaitable',
  },
  {
    id: 'SV-11',
    question: 'À quelle coordonnée le bouton « Photographier » est-il tapé sur l\'émulateur 1080×2400 ?',
    answer: '540 2108.',
    source: 'docs/TESTING.md',
    quote: 'input tap 540 2108',
    gravity: 'souhaitable',
  },
  {
    id: 'SV-12',
    question: 'Que devient l\'endpoint « https://api.example.com/très/long/chemin » affiché dans le détail ?',
    answer: 'Il est raccourci : le préfixe https:// est retiré, la barre finale coupée, et si la longueur dépasse 46, le milieu est remplacé par une ellipse.',
    source: 'app/src/main/java/dev/sam3vision/app/ihear/LiveProbeText.kt',
    quote: 'removePrefix("https://").removePrefix("http://").trimEnd(\'/\')',
    gravity: 'souhaitable',
  },
];

/** Nombre de cas du lot d'or SAM Vision. */
export const VISION_GOLDEN_COUNT = VISION_GOLDEN.length;
