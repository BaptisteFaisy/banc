/**
 * src/score/floors.ts — les planchers de qualité par jauge.
 *
 * UNE SEULE SOURCE pour tout le dépôt : aucun autre fichier ne doit
 * réinventer un seuil. Changer un plancher = changer la politique du
 * banc, donc cela se fait ici, en un seul commit, avec justification.
 *
 * Asymétrie assumée : `coût` n'est PAS un plancher mais un PLAFOND.
 * Pour les sept jauges de qualité, « bon » = au-dessus du seuil ;
 * pour le coût, « bon » = en dessous d'un plafond. `floorOf('coût')`
 * renvoie 0 (un taux est toujours ≥ 0, donc jamais en échec) : le
 * verdict coût passe par `GAUGE_CEILINGS['coût']`, pas par `floorOf`.
 *
 * ESM, TypeScript strict, jamais `any`, imports relatifs suffixés `.js`.
 */

/**
 * Les huit jauges du banc.
 *
 * Redéclaré ici (au lieu de `import type { Gauge } from '../domain/vocabulary.js'`)
 * pour garder ce module autonome et compilable même si le domaine n'est pas
 * encore câblé. Ce type DOIT rester aligné sur `Gauge` dans
 * `src/domain/vocabulary.ts` : mêmes huit membres, mêmes orthographes.
 */
export type Gauge =
  | 'exactitude'
  | 'fondation'
  | 'citation_vivante'
  | 'exactitude_de_règle'
  | 'refus_correct'
  | 'complétude'
  | 'stabilité'
  | 'coût';

/** Les huit jauges, dans l'ordre — utile pour itérer sans `Object.keys` magique. */
export const GAUGES: readonly Gauge[] = [
  'exactitude',
  'fondation',
  'citation_vivante',
  'exactitude_de_règle',
  'refus_correct',
  'complétude',
  'stabilité',
  'coût',
] as const;

/**
 * Planchers par jauge, justifiés un par un.
 *
 * - exactitude 0.90 : cœur du banc ; 1 erreur sur 10 est le maximum
 *   tolérable avant que la sortie cesse d'être fiable pour un humain pressé.
 * - fondation 0.85 : la chaîne de justification (ce qui prouve le score)
 *   peut connaître des trous rares ; en dessous, on ne peut plus auditer.
 * - citation_vivante 0.80 : vérification des citations ; on tolère les
 *   reformulations mineures, pas les citations inventées.
 * - exactitude_de_règle 0.85 : appliquer la bonne règle au bon cas ;
 *   une confusion de règle fausse tout un lot, mais reste rattrapable en revue.
 * - refus_correct 0.95 : le plus sévère. Un banc qui récompense
 *   l'hallucination est PIRE que pas de banc — un refus manqué laisse
 *   passer une invention crédible, dommage silencieux et durable.
 * - complétude 0.80 : couvrir les cas attendus ; un oubli ponctuel se
 *   corrige, un banc lacunaire reste utile.
 * - stabilité 0.85 : reproductibilité d'un run à l'autre ; un score qui
 *   danse n'est pas une mesure (voir aussi STABILITY_FLOOR pour la porte).
 * - coût 0 : asymétrie documentée en tête de fichier — le coût est un
 *   PLAFOND (GAUGE_CEILINGS), pas un plancher. 0 = jamais en échec ici.
 */
export const GAUGE_FLOORS: Readonly<Record<Gauge, number>> = {
  exactitude: 0.9,
  fondation: 0.85,
  citation_vivante: 0.8,
  exactitude_de_règle: 0.85,
  refus_correct: 0.95,
  complétude: 0.8,
  stabilité: 0.85,
  coût: 0,
};

/**
 * Plafonds (le pendant de GAUGE_FLOORS pour les jauges « plus c'est bas,
 * mieux c'est »). Seule `coût` en a un aujourd'hui : au-delà de 1,0
 * (coût normalisé), le run est rejeté même si sa qualité est bonne —
 * la qualité ne s'achète pas à n'importe quel prix.
 */
export const GAUGE_CEILINGS: Readonly<Partial<Record<Gauge, number>>> = {
  coût: 1.0,
};

/**
 * Plancher spécifique de la PORTE (§11 règle c) : la stabilité exigée
 * pour qu'un résultat passe la porte, distincte du plancher de jauge
 * affiché. Plus sévère que GAUGE_FLOORS.stabilité : on peut MONTRER un
 * score à 0.85 de stabilité, mais on ne laisse PAS passer la porte une
 * mesure qui bouge autant.
 */
export const STABILITY_FLOOR = 0.9;

/**
 * Seuil d'accord automatique/humain (§15) : en dessous de 0.65 d'accord
 * entre le juge automatique et le juge humain, l'étalonnage est déclaré
 * insuffisant et les scores automatiques ne font plus foi seuls.
 */
export const CALIBRATION_THRESHOLD = 0.65;

/**
 * Plancher d'une jauge. Pour `coût`, renvoie 0 — vérifier le plafond via
 * `GAUGE_CEILINGS['coût']` à la place (asymétrie documentée plus haut).
 */
export function floorOf(gauge: Gauge): number {
  return GAUGE_FLOORS[gauge];
}

/** Sous-ensemble des planchers pour les jauges demandées (même source). */
export function floorsFor(gauges: readonly Gauge[]): Readonly<Record<Gauge, number>> {
  const out = {} as Record<Gauge, number>;
  for (const g of gauges) {
    out[g] = GAUGE_FLOORS[g];
  }
  return out;
}
