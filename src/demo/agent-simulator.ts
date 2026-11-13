/**
 * L'agent simulé du banc de démonstration (§29).
 *
 * Un agent simulé ne simule pas un modèle : il joue UN COMPORTEMENT, et c'est
 * le banc — le vrai moteur, les vraies jauges, la vraie porte — qui mesure.
 * C'est ce qui rend la démo honnête : les chiffres affichés sont calculés,
 * pas recopiés.
 *
 * Le scénario semé (§29 point 2) :
 *   `témoin`          v4 — répond juste, cite ses sources, stable ;
 *   `perte_fondation` v5 — casse deux cas bloquants et ne cite plus rien ;
 *   `instabilité`     v6 — répare la fondation mais varie d'un passage à
 *                      l'autre sur les cas à règle.
 */
import type {
  AgentAnswer, AgentCitation, AgentUnderTest, BancCase, BenchMode, OracleState, RuleOracleSpec,
} from '../domain/vocabulary.js';
import { hashValue } from '../oracle/hash.js';

/** Les comportements semés du banc de démonstration. */
export type SeededBehaviour = 'témoin' | 'perte_fondation' | 'instabilité';

/** Ce qui distingue une version simulée d'une autre. */
export interface BehaviourProfile {
  readonly behaviour: SeededBehaviour;
  /** L'agent cite-t-il ses sources ? (la jauge de fondation) */
  readonly cites: boolean;
  /** Cas auxquels l'agent répond FAUX. */
  readonly wrongCases: readonly string[];
  /** Cas auxquels l'agent varie d'un passage à l'autre. */
  readonly unstableCases: readonly string[];
  /** Motifs que l'agent cite sur un cas à règle. */
  readonly motivesCited: boolean;
}

/** Les trois profils semés, dans l'ordre du §29. */
export const PROFILES: Readonly<Record<SeededBehaviour, BehaviourProfile>> = {
  témoin: {
    behaviour: 'témoin', cites: true, wrongCases: [], unstableCases: [], motivesCited: true,
  },
  perte_fondation: {
    // L'agent ne cite plus ses sources (il a perdu la consigne de citation),
    // mais il refuse toujours correctement et nomme ce qui manque.
    behaviour: 'perte_fondation', cites: false,
    wrongCases: ['D-01', 'R-04'], unstableCases: [], motivesCited: true,
  },
  instabilité: {
    behaviour: 'instabilité', cites: true, wrongCases: [], unstableCases: ['R-04', 'R-02'], motivesCited: true,
  },
};

/** Options du simulateur. */
export interface SimulatorOptions {
  readonly profile: BehaviourProfile;
  readonly cases: readonly BancCase[];
  readonly oracles: Readonly<Record<string, OracleState>>;
}

/** La citation que l'agent produit pour une source. */
function citationFor(
  source: { kind: string; id: string; label?: string }, passage: string, alive = true,
): AgentCitation {
  return {
    raw: source.label ?? source.id,
    resolved: { kind: source.kind, id: source.id, label: source.label },
    alive,
    // L'extrait cité : c'est lui que la jauge « citation vivante » vérifie
    // (§8). Sans extrait, une citation existe mais ne dit rien.
    passage,
  };
}

/**
 * Le sujet de la question, en phrase affirmative.
 *
 * Un agent réel reformule ce qu'il répond : « Le propriétaire du service
 * paiements est … ». Cette reformulation est aussi ce qui rend la jauge de
 * complétude mesurable — la question posée et la réponse attendue partagent
 * alors leurs mots significatifs.
 */
export function subjectOf(question: string): string {
  const sansPoint = question.replace(/[?？]+\s*$/, '').trim();
  const sansInterrogatif = sansPoint.replace(
    /^(qui\s+est|quelles?\s+(est|sont)|quel(le)?\s+(est|sont)?|combien\s+d[e']|combien\s+de|y\s+a-t-il|peut-on|doit-on)\s+/i, '',
  );
  const sujet = sansInterrogatif.replace(/^(le|la|les|l['’])\s+/i, '').trim();
  return sujet.charAt(0).toUpperCase() + sujet.slice(1);
}

/** Texte de la réponse pour un cas à valeur dérivée. */
function derivedAnswer(subject: string, oracle: OracleState, wrong: boolean): string {
  const source = oracle.sourceRefs[0];
  const cite = source ? ` (source : ${source.label ?? source.id})` : '';
  const value = wrong ? 'Équipe Comptable'
    : (Array.isArray(oracle.value) ? oracle.value.join(', ') : String(oracle.value));
  return `${subject} : « ${value} »${cite}.`;
}

/** Texte de la réponse pour un cas à règle vivante. */
function ruleAnswer(
  subject: string, kase: BancCase, oracle: OracleState, wrong: boolean, withMotives: boolean,
): string {
  const spec = kase.oracleSpec as RuleOracleSpec;
  const outcome = oracle.ruleOutcome;
  const expected = outcome?.expectedAnswer ?? spec.expectedWhenFalse;
  const answer = wrong ? (expected === spec.expectedWhenTrue ? spec.expectedWhenFalse : spec.expectedWhenTrue)
    : expected;
  if (!withMotives) return `${subject} : ${answer}.`;
  const motives = outcome ? (outcome.satisfied ? outcome.trueAtoms : outcome.falseAtoms) : [];
  const labels = spec.atoms.filter((atom) => motives.includes(atom.id)).map((atom) => atom.label);
  return `${subject} : ${answer}. Facteurs vérifiés : ${labels.join(' ; ')}.`;
}

/** Texte de la réponse pour un cas à refus attendu. */
function refusalAnswer(subject: string, kase: BancCase, withReason: boolean): string {
  const spec = kase.oracleSpec;
  const missing = 'missing' in spec ? spec.missing : [];
  if (!withReason) return `${subject} : je ne peux pas répondre à cette question.`;
  return `${subject} : je ne peux pas répondre, ${missing.join(', ')} ne sont pas dans les systèmes.`;
}

/** Réponse de l'agent pour un cas donné, à un passage donné. */
function answerFor(
  kase: BancCase, oracle: OracleState, profile: BehaviourProfile, passageNo: number,
): { text: string; citations: readonly AgentCitation[] } {
  const wrong = profile.wrongCases.includes(kase.id);
  const unstable = profile.unstableCases.includes(kase.id);
  const subject = subjectOf(kase.question);
  // Sur un cas instable, la variation dépend du passage : c'est ce qui crée
  // une fissure (le verdict change d'un passage à l'autre).
  const variant = unstable ? passageNo : 1;
  // Un passage sur trois se trompe : c'est ce qui fait varier le verdict.
  // Un agent qui varie seulement dans la formulation ne fissure pas — le
  // verdict, lui, ne bouge pas.
  const wrongHere = wrong || (unstable && variant === 2);
  const text = buildText(kase, oracle, profile, wrongHere, variant, subject);
  const citations = profile.cites && oracle.alive ? citationsOf(kase, oracle, wrongHere) : [];
  return { text, citations };
}

/** Construit le texte de la réponse. */
function buildText(
  kase: BancCase, oracle: OracleState, profile: BehaviourProfile, wrong: boolean, variant: number,
  subject: string,
): string {
  if (kase.oracleType === 'valeur_dérivée') {
    const base = derivedAnswer(subject, oracle, wrong);
    return variant === 1 ? base : `${base} Réponse incertaine : je n’ai pas pu confirmer la valeur.`;
  }
  if (kase.oracleType === 'règle_vivante') {
    // Un agent qui se trompe ne cite pas tous les facteurs : c'est ce qui rend
    // sa réponse franchement différente de la bonne — et ce qui rend la fissure
    // attribuable à l'agent plutôt qu'au cas.
    const base = ruleAnswer(subject, kase, oracle, wrong, profile.motivesCited && !wrong);
    return variant === 1 ? base : `${base} Je réponds sans avoir pu vérifier l'ensemble des facteurs.`;
  }
  return refusalAnswer(subject, kase, profile.motivesCited);
}

/** Citations produites par l'agent pour un cas. */
function citationsOf(
  kase: BancCase, oracle: OracleState, wrong: boolean,
): readonly AgentCitation[] {
  if (!oracle.alive) return [];
  if (kase.oracleType === 'valeur_dérivée') {
    const source = oracle.sourceRefs[0];
    const valeur = Array.isArray(oracle.value) ? oracle.value.join(', ') : String(oracle.value);
    return source ? [citationFor(source, `… ${valeur} …`)] : [];
  }
  if (kase.oracleType === 'règle_vivante') {
    const spec = kase.oracleSpec as RuleOracleSpec;
    const outcome = oracle.ruleOutcome;
    const motives = outcome ? (outcome.satisfied ? outcome.trueAtoms : outcome.falseAtoms) : [];
    const wanted = spec.atoms.filter((atom) => motives.includes(atom.id));
    // Un agent qui se trompe ne cite que le premier facteur : c'est ce que la
    // jauge de règle sanctionne (les motifs manquants).
    const limit = wrong ? 1 : wanted.length;
    const attendu = String(oracle.value ?? '');
    return wanted.slice(0, limit).map((atom) => citationFor(
      { kind: 'regle', id: atom.id, label: atom.label },
      `${attendu} — ${atom.label}`,
    ));
  }
  return [];
}

/**
 * Crée l'agent simulé d'une version.
 *
 * Le contrat est celui de `AgentUnderTest` : le banc ne sait pas qu'il parle à
 * un simulateur. En production, la même interface est branchee sur une action
 * Rovo.
 */
export function createSimulatedAgent(options: SimulatorOptions): AgentUnderTest {
  const byId = new Map(options.cases.map((item) => [item.id, item]));
  const counter = new Map<string, number>();
  return {
    versionId: options.profile.behaviour,
    fingerprint: async () => ({
      specHash: hashValue(options.profile), promptHash: hashValue(options.profile.behaviour),
      skills: [], actions: [], tools: [], model: 'simulé', temperature: 0, capturedAt: '2026-11-12T09:00:00Z',
    }),
    ask: async (question: string, _mode: BenchMode): Promise<AgentAnswer> => {
      const kase = [...byId.values()].find((item) => item.question === question);
      if (!kase) return emptyAnswer();
      const oracle = options.oracles[kase.id];
      if (!oracle) return emptyAnswer();
      const passageNo = (counter.get(kase.id) ?? 0) + 1;
      counter.set(kase.id, passageNo);
      const { text, citations } = answerFor(kase, oracle, options.profile, passageNo);
      return {
        text, citations, latencyMs: 1200 + (hashValue(text).charCodeAt(0) % 400),
        tokens: 120 + text.length, costEstimate: 0.0012, toolCalls: [], sideEffects: [],
      };
    },
  };
}

/** Réponse vide : le cas d'un cas introuvable (incident d'essai). */
function emptyAnswer(): AgentAnswer {
  return {
    text: '', citations: [], latencyMs: 10, tokens: 0, costEstimate: 0, toolCalls: [], sideEffects: [],
  };
}
