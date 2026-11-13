/**
 * Garde d'autorisation des outils MCP (§19, dernière ligne).
 *
 * « Aucun outil n'expose le contenu d'un cas à un agent non autorisé : les cas
 * sont filtrés par l'espace du banc et par les droits du lecteur. »
 *
 * Deux règles de comportement, délibérées :
 *   - un appel non autorisé rend une ERREUR EXPLICITE, jamais un contenu vide :
 *     un résultat vide serait lu comme « il n'y a pas de cas », ce qui est une
 *     information fausse ;
 *   - l'espace du banc est le seul espace servi : un cas ne fuit pas dans un
 *     espace de production, et un cas de production n'entre pas dans le banc
 *     (§16 isolation, §25 confidentialité).
 */

/** Le lecteur qui appelle un outil. */
export interface Caller {
  readonly accountId: string;
  /** Espaces que ce lecteur est autorisé à voir. */
  readonly allowedSpaces: readonly string[];
  /** Un agent sous test n'est jamais un lecteur autorisé du banc (§25). */
  readonly isAgentUnderTest?: boolean;
}

/** Erreur d'autorisation, avec le motif lisible. */
export class BancAccessDenied extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`accès refusé : ${reason}`);
    this.name = 'BancAccessDenied';
    this.reason = reason;
  }
}

/** Espace du banc : le seul où vivent les cas (§16). */
export const BENCH_SPACE = 'BENCH';

/** Vérifie qu'un lecteur peut accéder à l'espace du banc. */
export function assertCanReadBench(caller: Caller | undefined): void {
  if (!caller) throw new BancAccessDenied('appel non authentifié');
  if (caller.isAgentUnderTest) {
    throw new BancAccessDenied('l’agent sous test ne peut pas lire le banc (séparation des rôles)');
  }
  if (!caller.allowedSpaces.includes(BENCH_SPACE)) {
    throw new BancAccessDenied(`l'espace ${BENCH_SPACE} n'est pas dans les droits du lecteur`);
  }
}

/** Un cas est-il visible par ce lecteur ? */
export function canReadCase(caller: Caller, spaceKey: string): boolean {
  return caller.allowedSpaces.includes(spaceKey) && !caller.isAgentUnderTest;
}

/** Filtre un corpus sur les droits du lecteur, sans jamais lever. */
export function filterCases<T extends { spaceKey: string }>(
  caller: Caller | undefined,
  cases: readonly T[],
): readonly T[] {
  if (!caller || caller.isAgentUnderTest) return [];
  return cases.filter((item) => caller.allowedSpaces.includes(item.spaceKey));
}

/** Rend l'erreur d'autorisation sous forme de réponse d'outil. */
export function deniedResponse(error: unknown): { error: string; code: string } {
  if (error instanceof BancAccessDenied) {
    return { error: error.message, code: 'accès_refusé' };
  }
  return { error: 'accès refusé', code: 'accès_refusé' };
}

/** Lecteur de service pour le banc de démonstration (§29). */
export function demoCaller(accountId = 'demo-judge'): Caller {
  return { accountId, allowedSpaces: [BENCH_SPACE] };
}
