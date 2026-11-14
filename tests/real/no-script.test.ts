/**
 * GARDE ANTI-SCRIPT : la démo ne raconte rien, elle le prouve.
 *
 * Le banc de démonstration injectait la valeur de l'oracle dans le prompt de
 * l'agent et décrétait les citations mortes (`resolved: null`). Ses deux
 * chiffres vedettes — 100 % d'exactitude, 0 % de fondation — étaient donc des
 * artefacts d'écriture, pas des mesures. Ce fichier rend l'écriture impossible
 * sans casser le build :
 *
 *   1. aucune valeur d'oracle n'apparaît dans un prompt envoyé au modèle ;
 *   2. l'agent doit DEMANDER les documents pour les obtenir (retrieval réel) ;
 *   3. les citations résolvent CONTRE le corpus scellé : une source inventée
 *      rend « infondé », une source réelle qui ne dit pas la valeur rend
 *      « citation non vivante », les deux sont atteignables (rien n'est constant) ;
 *   4. les dérivations sont recoupées par une seconde méthode indépendante du
 *      parseur YAML — une valeur d'oracle n'est jamais un nombre tapé à la main.
 *
 * Un test qui assert « 12 outils » serait lui-même un script : ici la valeur
 * attendue est recomptée depuis les bytes du fichier, par un autre chemin.
 */
import { describe, it, expect } from 'vitest';
import { recomputeOracle } from '../../src/oracle/recompute.js';
import { evaluateRuleForCase } from '../../src/oracle/rule.js';
import { createRealAgent, citationsRésolues, citationsBrutes } from '../../src/demo/real-agent.js';
import { systemeAgent, besoinsDe, blocDocument, documentsDuCas, LIMITE_DOCUMENT_CARACTERES } from '../../src/demo/retrieval.js';
import { DEMO_CASES } from '../../src/demo/real-bench.js';
import { REAL_CORPUS, sceauValide, indexDesSources, empreinteEnsemble } from '../../src/real/corpus.js';
import { createRepoAdapter } from '../../src/real/adapter.js';
import { registreReel } from '../../src/real/adapter.js';
import { valeursDuCorpus } from '../../src/real/derive.js';
import { PROVENANCE_PAR_REQUETE, fichiersDeLaRequete } from '../../src/real/provenance.js';
import type { ChatClient, ChatReply } from '../../src/demo/real-agent.js';
import type { BancCase, OracleState } from '../../src/domain/vocabulary.js';

/** Un client de test qui enregistre tout ce qui part au modèle. */
function clientEnregistreur(réponses: readonly string[]): {
  chat: ChatClient; prompts: { system: string; user: string }[]; replies: ChatReply[];
} {
  const prompts: { system: string; user: string }[] = [];
  const replies: ChatReply[] = [];
  let index = 0;
  return {
    prompts, replies,
    chat: {
      complete: async ({ system, user }) => {
        prompts.push({ system, user });
        const texte = réponses[index] ?? réponses[réponses.length - 1] ?? '';
        index += 1;
        const reply: ChatReply = { text: texte, tokens: texte.length, latencyMs: 10, modeleServi: 'test/modèle' };
        replies.push(reply);
        return reply;
      },
    },
  };
}

/** La valeur est-elle présente telle quelle, et pas par hasard dans un mot ? */
function contientValeur(prompt: string, valeur: unknown): boolean {
  const brut = String(valeur ?? '');
  if (brut.length === 0) return false;
  const échappé = brut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${échappé}([^A-Za-z0-9]|$)`).test(prompt);
}

/** L'oracle recalculé d'un cas, sur le registre réel. */
async function oracleDe(kase: BancCase): Promise<OracleState> {
  return recomputeOracle(kase, registreReel(), { ruleEvaluator: evaluateRuleForCase, versionNo: 1 });
}

describe('garde anti-script : la réponse ne part jamais dans le prompt', () => {
  const casDérivés = DEMO_CASES.filter((kase) => kase.oracleType === 'valeur_dérivée');

  it.each(casDérivés.map((kase) => [kase.id, kase] as const))(
    '%s : la valeur n’est jamais annoncée à l’agent (rôle, tour 1, étiquette)',
    async (_id, kase) => {
      const oracle = await oracleDe(kase);
      expect(oracle.alive).toBe(true);
      const enregistreur = clientEnregistreur(['BESOIN: manifest.yml', 'Réponse [source: manifest.yml]']);
      const agent = createRealAgent({
        chat: enregistreur.chat, price: { usdPerThousandTokens: 0.0003 },
        cases: DEMO_CASES, oracles: { [kase.id]: oracle }, registry: registreReel(),
      });
      await agent.ask(kase.question, 'noir');
      const valeur = String(oracle.value);
      // 1. le bloc de rôle ne porte AUCUNE valeur d’oracle : il décrit la tâche.
      for (const prompt of enregistreur.prompts) {
        expect(contientValeur(prompt.system, valeur),
          `valeur « ${valeur} » dans le rôle système`).toBe(false);
      }
      // 2. au tour 1 (mode noir), l’agent n’a que l’index : rien qui puisse lui
      //    donner la réponse. C’est LA garde : la valeur n’est pas versée.
      expect(contientValeur(enregistreur.prompts[0]?.user ?? '', valeur),
        `valeur « ${valeur} » donnée au tour 1`).toBe(false);
      expect(enregistreur.prompts[0]?.user).not.toContain('### ');
      // 3. aucune étiquette d’oracle : le prompt ne dit jamais « voici la
      //    réponse attendue », quel que soit le mode.
      for (const prompt of enregistreur.prompts) {
        const envoyé = `${prompt.system}\n${prompt.user}`;
        for (const marqueur of ['réponse attendue', 'valeur attendue', 'oracle:', 'oracle =']) {
          expect(envoyé.toLowerCase(), `marqueur « ${marqueur} » dans le prompt`).not.toContain(marqueur);
        }
      }
    });

  it('l’index des sources ne contient aucune valeur, seulement des identifiants et des tailles', () => {
    const index = indexDesSources().join('\n');
    const valeurs = Object.values(valeursDuCorpus(REAL_CORPUS)) as Record<string, unknown>[];
    for (const valeur of valeurs) {
      for (const champ of Object.values(valeur ?? {})) {
        if (typeof champ === 'number' && String(champ).length >= 3) {
          expect(index).not.toContain(String(champ));
        }
      }
    }
    expect(index).toContain('manifest.yml');
    expect(indexDesSources().length).toBe(REAL_CORPUS.documents.length);
  });

  it('un agent qui ne demande rien ne lit rien : le corpus n’est pas donné d’avance', async () => {
    const kase = DEMO_CASES.find((item) => item.id === 'RD-01') as BancCase;
    const oracle = await oracleDe(kase);
    const enregistreur = clientEnregistreur(['Le manifeste déclare des outils, je réponds 12 sans lire.']);
    const agent = createRealAgent({
      chat: enregistreur.chat, price: { usdPerThousandTokens: 0.0003 },
      cases: DEMO_CASES, oracles: { [kase.id]: oracle }, registry: registreReel(),
    });
    const réponse = await agent.ask(kase.question, 'noir');
    expect(enregistreur.prompts.length).toBe(1);
    expect(réponse.toolCalls).toHaveLength(0);
    expect(réponse.citations).toHaveLength(0);
  });
});

describe('retrieval réel : l’agent demande, le corpus sert', () => {
  it('BESOIN: parse les demandes, dans l’ordre, sans doublon, borné', () => {
    expect(besoinsDe('BESOIN: manifest.yml\nBESOIN: LICENSE\nBESOIN: manifest.yml'))
      .toEqual(['manifest.yml', 'LICENSE']);
    const beaucoup = Array.from({ length: 9 }, (_, i) => `BESOIN: f${i}.md`).join('\n');
    expect(besoinsDe(beaucoup)).toHaveLength(4);
  });

  it('le tour 2 apporte les documents demandés et le compte des tours le dit', async () => {
    const kase = DEMO_CASES.find((item) => item.id === 'RD-02') as BancCase;
    const oracle = await oracleDe(kase);
    const enregistreur = clientEnregistreur([
      'BESOIN: manifest.yml',
      'Le manifeste déclare seize tables [source: manifest.yml].',
    ]);
    const agent = createRealAgent({
      chat: enregistreur.chat, price: { usdPerThousandTokens: 0.0003 },
      cases: DEMO_CASES, oracles: { [kase.id]: oracle }, registry: registreReel(),
    });
    const réponse = await agent.ask(kase.question, 'noir');
    expect(enregistreur.prompts.length).toBe(2);
    expect(enregistreur.prompts[1]?.user).toContain('### manifest.yml');
    expect(réponse.toolCalls.map((appel) => appel.name)).toEqual(['read:manifest.yml']);
    expect(réponse.tokens).toBe(enregistreur.replies.reduce((a, r) => a + r.tokens, 0));
  });

  it('un document réclamé hors corpus est rendu absent, jamais inventé', () => {
    expect(blocDocument('docs/CONTRATS.md', REAL_CORPUS)).toContain('absent du corpus scellé');
  });

  it('le mode blanc fournit les documents de provenance, sans la valeur', async () => {
    const kase = DEMO_CASES.find((item) => item.id === 'RD-05') as BancCase;
    const oracle = await oracleDe(kase);
    expect(documentsDuCas(kase, REAL_CORPUS)).toContain('LICENSE');
    const enregistreur = clientEnregistreur(['MIT [source: LICENSE]']);
    const agent = createRealAgent({
      chat: enregistreur.chat, price: { usdPerThousandTokens: 0.0003 },
      cases: DEMO_CASES, oracles: { [kase.id]: oracle }, registry: registreReel(),
    });
    await agent.ask(kase.question, 'blanc');
    const prompt = enregistreur.prompts[0] as { system: string; user: string };
    expect(prompt.user).toContain('Copyright (c) 2026');
    // §12 : le mode blanc verse les documents de provenance, pas la valeur. La
    // valeur peut donc se lire DANS le document — jamais en dehors d'un bloc.
    expect(contientValeur(prompt.system, String(oracle.value))).toBe(false);
    const horsDocument = prompt.user.split('\n### ')[0];
    expect(contientValeur(horsDocument, oracle.value)).toBe(false);
    expect(enregistreur.prompts.length).toBe(1);
  });

  it('la limite de document est déclarée, et aucun fichier réel du corpus ne la dépasse', () => {
    for (const doc of REAL_CORPUS.documents) {
      expect(doc.contenu.length, `${doc.path} serait tronqué`).toBeLessThanOrEqual(LIMITE_DOCUMENT_CARACTERES);
    }
  });
});

describe('citations : résolues contre le corpus, plus jamais décrétées', () => {
  it('extrait les citations [source: …] sans doublon', () => {
    expect(citationsBrutes('A [source: manifest.yml] B [source: LICENSE] C [source: manifest.yml]'))
      .toEqual(['manifest.yml', 'LICENSE']);
  });

  it('une source réelle résout ; une source inventée ne résout pas', () => {
    const citations = citationsRésolues(
      'Réponse [source: manifest.yml] et [source: docs/CONTRATS.md]', REAL_CORPUS,
    );
    const réelle = citations[0] as NonNullable<ReturnType<typeof citationsRésolues>[number]>;
    const fabriquée = citations[1] as NonNullable<ReturnType<typeof citationsRésolues>[number]>;
    expect(réelle.resolved).not.toBeNull();
    expect(réelle.alive).toBe(true);
    expect(réelle.passage).toContain('rovo:mcp');
    expect(fabriquée.resolved).toBeNull();
    expect(fabriquée.alive).toBe(false);
  });

  it('les trois verdicts de §8 sont atteignables, pas constants', async () => {
    const kase = DEMO_CASES.find((item) => item.id === 'RD-02') as BancCase;
    const oracle = await oracleDe(kase);
    expect(oracle.value).not.toBeNull();
    const réelle = citationsRésolues('[source: manifest.yml]', REAL_CORPUS);
    const horsSujet = citationsRésolues('[source: LICENSE]', REAL_CORPUS);
    const passageVivant = (c: typeof réelle[number]) => Boolean(c.passage?.includes(String(oracle.value)));
    expect(passageVivant(réelle[0] as typeof réelle[number])).toBe(true);
    expect(passageVivant(horsSujet[0] as typeof horsSujet[number])).toBe(false);
  });
});

describe('corpus scellé : la provenance se vérifie, elle ne se déclare pas', () => {
  it('le sceau tient sur le corpus capturé', () => {
    expect(sceauValide()).toBe(true);
    expect(empreinteEnsemble()).toBe(REAL_CORPUS.meta.empreinteEnsemble);
  });

  it('un document modifié sans recapture rend le sceau suspect', () => {
    const altéré = {
      ...REAL_CORPUS,
      documents: REAL_CORPUS.documents.map((doc) => (
        doc.path === 'LICENSE' ? { ...doc, contenu: `${doc.contenu}\najout` } : doc
      )),
    };
    expect(sceauValide(altéré)).toBe(false);
  });

  it('l’adaptateur réel refuse un corpus suspect plutôt que de servir des valeurs périmées', () => {
    const altéré = {
      ...REAL_CORPUS,
      documents: REAL_CORPUS.documents.map((doc) => (
        doc.path === 'LICENSE' ? { ...doc, contenu: `${doc.contenu}\najout` } : doc
      )),
    };
    expect(() => createRepoAdapter(altéré)).toThrow(/corpus réel suspect/);
  });

  it('chaque requête déclarée fonde ses valeurs sur des fichiers qui existent', () => {
    const chemins = REAL_CORPUS.documents.map((doc) => doc.path);
    for (const [requete, entrées] of Object.entries(PROVENANCE_PAR_REQUETE)) {
      if (entrées.length === 0) continue;
      const résolus = fichiersDeLaRequete(requete, REAL_CORPUS);
      expect(résolus.length, `${requete} ne résout sur aucun fichier`).toBeGreaterThan(0);
      for (const chemin of résolus) expect(chemins).toContain(chemin);
    }
  });

  it('le prompt de rôle est construit depuis l’index, et nomme la règle de citation', () => {
    const système = systemeAgent(indexDesSources());
    expect(système).toContain('[source: chemin/du/fichier]');
    expect(système).toContain('BESOIN:');
    expect(système).toContain('Ne devine rien.');
  });
});
