/**
 * Extrait figé des sources de SAM Vision (isee, arbre du 26/10/2026).
 *
 * Pour que la vérité du lot d'or soit DÉRIVÉE et non tapée, le test de
 * grounding (`tests/demo/vision-golden.test.ts`) vérifie que chaque citation
 * du corpus est PRÉSENTE ici. C'est la preuve de provenance : si le code
 * évolue, l'extrait ne correspond plus, et le banc le dit au lieu de
 * continuer à affirmer un contrat d'UI périmé.
 *
 * Les lignes retenues sont exactement celles qui fondent les 12 cas.
 */
export const VISION_SOURCE_EXCERPT: string = [
  // LiveProbeText.kt — constantes, formats, notice
  'const val ENDPOINT_MAX_CHARS = 46',
  'const val DISTANCE_LINES_MAX = 3',
  'if (state.frames > 0) return null',
  'if (state.warming) return "réveil du GPU SAM… (≈ 30 s au premier lancement)"',
  'return "en attente de la première analyse…"',
  'usable.take(DISTANCE_LINES_MAX)',
  '.joinToString(" · ") { "${it.label} ${DistanceText.approximate(it.meters)}" }',
  'val head = clean.take(ENDPOINT_MAX_CHARS / 2 - 2)',
  'val tail = clean.takeLast(ENDPOINT_MAX_CHARS / 2 - 1)',
  'val clean = endpoint.removePrefix("https://").removePrefix("http://").trimEnd(\'/\')',
  'fun decimal(value: Float): String = String.format(Locale.FRANCE, "%.1f", value)',
  // TimingsText.kt — postes, symbole manquant, étages serveur
  'const val MISSING: String = "—"',
  'Poste("capt", "capture → jpeg", FrameTimings::encodeMs)',
  'Poste("up", "jpeg → envoi", FrameTimings::uploadMs)',
  'Poste("srv", "serveur", FrameTimings::serverMs)',
  'Poste("rtt", "envoi → réponse", FrameTimings::rttMs)',
  'Poste("masque", "réponse → masques", FrameTimings::receivedToOverlaysMs)',
  'Poste("pixel", "masques → pixel", FrameTimings::overlaysToPixelMs)',
  'private val SERVER_STAGES = listOf("preprocess", "vision", "tokenize", "detr", "masks", "queue")',
  // LiveSession.kt — cadence du direct
  'Cadence.Fast',
  // docs/TESTING.md — recette manuelle émulateur
  'input tap 540 2108',
].join('\n');

/**
 * Empreinte SHA-256 de l'extrait : la preuve que le corpus cite CET extrait,
 * pas un autre. Le test de grounding la compare — si on modifie l'extrait sans
 * revoir le corpus, le test casse.
 */
export const VISION_SOURCE_SHA256 = '5bc824b8e4d8d79c82653a5df7fb57e08d1a9c99ead2494b3b8153bcac4ed0ce';
