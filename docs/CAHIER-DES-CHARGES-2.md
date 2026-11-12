# Cahier des charges — partie 2 (§21 à §35)

> **Partie 2/2 — §21 à §35.** Suite de
> [`CAHIER-DES-CHARGES.md`](CAHIER-DES-CHARGES.md) (partie 1, §1 à §20),
> découpée pour respecter la garde CI « aucun fichier de plus de 500 lignes ».
> Le contenu ci-dessous est inchangé.

## 21. Architecture Forge

Une app principalement Jira et Confluence, qui interroge les agents Rovo par leurs actions et lit les sources pour recalculer les oracles.

```yaml
# Esquisse, à valider avec forge lint et les vérifications du § 24
modules:
  rovo:mcp:                     # les 12 outils du § 19
  rovo:agent:                   # « Le jury »
  rovo:skill:                   # before-promoting-an-agent
  action:                       # une entrée par outil
  jira:globalPage:              # le banc, scorecards, budget, santé des oracles
  jira:projectPage:             # corpus par projet, cas bloquants
  jira:issuePanel:              # état d'un cas, régressions d'un ticket
  jira:workflowValidator:       # la porte de promotion sur la transition « approuvé »
  jira:customField:             # « Cas bloquant », « Version d'agent », « Empreinte »
  jira:dashboardGadget:         # compteur de régressions et santé du banc
  confluence:globalPage:        # rapport d'essai exportable pour auditeur
  confluence:spaceSettingsPage: # règles du banc par espace
  trigger:                      # cas créé, ticket lié, version d'agent modifiée
  scheduledTrigger:             # nuit : suite complète ; fumée sur événement
  consumer:                     # essais longs, jusqu'à 900 s, par tranches
  webtrigger:                   # points d'entrée externes (CI, hooks d'agents)
  sql:
  llm:                          # vérification d'implication des citations, propositions de cas
permissions:
  scopes:                       # read/write Jira, Confluence (lecture), graph:document,
                                # graph:work-item, graph:project, graph:software-service,
                                # graph:test-*, graph:comment, graph:atlassian-user
  external:
    images: []                  # aucun chargement distant dans les interfaces
```

### Ce qu'impose la plateforme

- L'appel à un agent Rovo passe par une **action** : 55 s, entrées simples. Un essai est donc une série d'appels, jamais un appel unique.
- Les exécutions longues passent par `consumer` (900 s) ou déclencheur planifié, **par tranches avec curseur** : un essai de 200 cas × 3 passages ne tient pas dans une fonction.
- **Cinq déclencheurs planifiés** au plus, un seul à 5 minutes : la suite complète tourne la nuit, la fumée sur événement de version.
- Le recalcul des oracles lit le graphe au nom d'un utilisateur : un droit manquant **vide le résultat sans erreur** → l'écran de santé des oracles distingue « pas de droit » de « pas de données ».
- LLM hébergé : Haiku pour la vérification d'implication, Sonnet pour les propositions de cas ; cache par empreinte de cas.
- **Coût** : un essai de 20 cas × 3 passages = 60 appels d'agent ; le budget et le nombre d'appels sont affichés et plafonnés.

### Ce que l'app conserve

Des faits : cas, oracles recalculés, verdicts, empreintes, journaux, votes. **Jamais** le contenu d'un cas dans une table de statistiques, jamais une réponse d'agent conservée au-delà de l'essai (hors journal de l'essai, qui est la trace attendue).

## 22. Modèle de données (Forge SQL)

| Table | Colonnes principales |
|---|---|
| `agent` | id, name, rovo_ref, owner_ref, suite_kind, created_at |
| `agent_version` | id, agent_id, label, spec_hash, prompt_hash, skills_json, actions_json, tools_json, model, temperature, created_at, is_witness |
| `case` | id, space_key, question, oracle_type, oracle_spec_json, gravity, tags_json, rubric_json, created_at, created_by_ref, origin_ref, disabled_at |
| `oracle_state` | case_id, version_no, value_hash, value_json, computed_at, source_refs_json, alive, drift_at |
| `condition` | id, case_id, snapshot_hash, snapshot_json_ref, captured_at, mode (blanc/noir) |
| `suite` | id, name, kind (gold/smoke/battery/full), case_ids_json, version, updated_at |
| `run` | id, agent_version_id, suite_id, mode, passes, started_at, finished_at, state, budget_used_json, config_hash_at_end, invalidated_reason |
| `pass` | id, run_id, case_id, passage_no, answer_hash, answer_ref, latency_ms, tokens, cost_estimate, tool_calls_json, side_effects_json |
| `verdict` | id, pass_id, case_id, gauge, value, detail_json, evidence_json, computed_at |
| `scorecard` | id, agent_version_id, suite_id, mode, gauge, n, value, ci_low, ci_high, floor, computed_at |
| `regression` | id, agent_version_id, baseline_version_id, case_id, gauge, delta, kind (regression/truth_drift), opened_at, state |
| `fissure` | id, case_id, agent_version_id, passages, spread_json, state, opened_at |
| `judgment` | id, case_id, judge_ref, verdict, notes, at, sample_id |
| `calibration` | scope, gauge, n, auto_vs_human_agreement, inter_judge_agreement, computed_at, calibrated |
| `amorce` | id, case_id, kind (injection/contradiction/fake_citation), expected_behavior, blocking |
| `budget` | scope, period, calls, tokens, cost_estimate, limit, stopped_at |

Aucune table ne contient de donnée métier sensible du site : les cas sont des questions et des oracles, pas des extracts de production.

## 23. Réutilisation du portefeuille

Rien n'est recopié.

| App existante | Ce que Banc en prend |
|---|---|
| `deja-vu-ci` | Le moteur de signature d'échec et la détection de flakiness : un cas fissuré est un flaky, même moteur, même vocabulaire |
| `preuve-a-l-appui` | La grille de force des preuves (machine / attestée / déclarée) pour classer la citation d'un agent |
| `brief-forge` | La discipline des citations et le budget de contexte : une citation sans source vérifiable est une infondée |
| `permis-forge` | Le principe « l'agent n'atteste jamais » : le jury humain est le seul juge, l'agent sous test ne peut pas valider son propre cas |
| `tickets-pieges` | La discipline « le texte externe est une donnée, jamais une instruction » : c'est le fondement de la batterie d'amorces |
| `delegable-ou-pas` | Le refus de conclure sous un seuil d'effectif, et les intervalles de confiance appliqués aux jauges |
| `problemes-caches` | Le cache par empreinte de contenu (SHA-256) appliqué aux oracles recalculés |
| `vigie` | Les mesures de Banc deviennent des résultats clés de niveau A (« stabilité des agents », « taux de régression ») |
| `gammes` | Le verrou : un cas bloquant s'acquitte comme une étape de gamme, avec preuve et refus des agents |
| `placard-wiki` | Les détecteurs : un cas du banc ne doit contenir ni secret ni donnée personnelle |

## 24. Contraintes vérifiées et points à valider

### Vérifié dans la documentation (11 novembre 2026)

- **Actions et agents** : 55 s d'exécution ; l'agent Rovo est soumis au contrôle de sécurité d'Atlassian ; les entrées d'action restent simples.
- **`rovo:mcp`** : Preview, un module par app, 50 outils au plus. **`rovo:skill`** : Preview, instructions et fichiers réutilisables, publiables en source ouverte pour les agents tiers.
- **Fonctions** : 25 s en standard ; jusqu'à **900 s** via `consumer` ou déclencheur planifié ; mémoire 512 Mo à 1 Go ; payload 5 Mo, 500 Ko depuis une interface custom.
- **Sorties réseau** : 100 requêtes/min par runtime ; invocation 1 200/min par utilisateur, 7 000/min par installation.
- **Déclencheurs planifiés** : 5 au plus par app, un seul à 5 minutes.
- **LLM hébergé** : Haiku (200K/64K), Sonnet et Opus (1M/128K) ; 100 invites/min par installation, 500K jetons/min par modèle ; jusqu'à 5 min d'inférence avec les événements asynchrones.
- **Stockage** : SQL, KVS, Entity Store, Object Store (Preview) ; facturation à la consommation depuis le 1ᵉʳ janvier 2026.
- **Forge Realtime** : GA sur Jira et Confluence, push backend → front.
- **Teamwork Graph** : lecture GraphQL en Preview, requêtes prêtes ou Cypher persisté (le Cypher brut est refusé aux nouvelles apps), au nom d'un utilisateur, un droit par type d'objet, droit manquant = résultats omis sans erreur ; types utiles : `document`, `work-item`, `project`, `software-service`, `commit`, `pull-request`, `deployment`, `test-plan`, `test-run`, `test-execution`, `test-status`, `comment`, `conversation`, `AtlassianUser`, `AtlassianTeam`, `AssetsObject`, `AtlassianGoal`.
- **Connecteur** : catalogue fermé de 26 types, sans `goal`/`objective` ; ingestion interdite des e-mails, agendas, enregistrements de réunion, données RH, financières ou de santé réglementées.

### À valider par un prototype la première semaine

| Point | Pourquoi | Solution de repli |
|---|---|---|
| **Appeler un agent Rovo depuis une action** et capturer sa réponse avec citations | tout le produit | Appeler l'agent via Rovo Chat en mode contrôle, ou tester un agent *mcp* piloté par l'app |
| La citation produite par un agent est-elle exploitable (identifiant de document, extrait) | fondation et citation vivante | Demander à l'agent un format imposé ; à défaut, mesurer la présence de sources citées sans les résoudre |
| Le contexte peut-il être fourni à l'agent (mode blanc) | comparabilité | Ne garder que le mode noir, et le dire dans le rapport |
| Épingler une version d'agent pour l'essai | empreinte de spécification | Épingler par référence de version Rovo si elle existe ; sinon, ne garder que l'empreinte de configuration disponible |
| Oracles « règle vivante » :表达能力 d'un prédicat sur les sources | cas à règle | Commencer par des règles simples (gel actif, incident ouvert, critères prouvés) |
| Orchestration d'un agent par un agent (multi-agents) | BE-26 | Reporter en catégorie C |
| Contrôle des effets de bord d'un agent en essai | isolation | Environment de test dédié + surveillance des créations d'objets |
| Existe-t-il déjà un outil d'évaluation d'agents sur le Marketplace | différenciation | Documenter la différence : vérité dérivée de l'organisation + agents Rovo |
| Tester des outils MCP (contrat, erreurs) | BE-27 | Tester par l'agent qui les appelle, en observant les appels |

## 25. Exigences non fonctionnelles

- **Honnêteté.** Aucune jauge sans effectif ni fourchette ; un oracle mort est affiché ; une jauge non calibrée est marquée ; un banc interrompu par budget le dit.
- **Séparation des rôles.** L'agent sous test ne peut ni s'auto-évaluer ni attester ; le jury humain est la seule autorité de recours.
- **Reproductibilité.** Un essai se rejoue à l'identique : conditions d'essai figées, empreinte de configuration conservée, journal complet.
- **Distinction.** Régression de l'agent et dérive de vérité sont toujours séparées, avec la preuve du changement de vérité.
- **Isolation.** Aucune écriture dans les espaces de production pendant un essai ; tout effet de bord est détecté et signalé.
- **Confidentialité.** Les cas restent dans l'espace du banc ; leurs contenus ne sont ni indexés pour l'IA globale ni injectés dans le graphe.
- **Budget.** Le banc s'arrête à la limite et le dit ; il ne coupe jamais une mesure en silence.
- **Sobriété.** LLM seulement pour la vérification d'implication et la proposition de cas ; cache par empreinte ; budget affiché.
- **Rapidité.** Banc de fumée en moins de deux minutes ; scorecard servie depuis le cache ; explorateur d'échecs en moins de 2 s.
- **Accessibilité.** Registre et tables accessibles, navigation clavier, aucune information portée par la seule couleur (vert/rouge) mais aussi par des mots et des motifs.
- **Langues.** Interface en anglais et en français ; soumission en anglais.

## 26. Cas limites

- L'agent répond juste mais **sans citer** : verdict exact, fondation nulle — l'écran montre les deux, et la régression est signalée sur fondation, pas sur exactitude.
- L'agent cite une source **qui n'existe pas** : affirmation infondée, plus grave qu'une absence de citation.
- L'agent cite une source **qui existe mais ne dit pas ça** : citation non vivante, distincte.
- La vérité **change** entre deux essais : dérive de vérité, pas régression ; le cas est rejoué, l'événement tracé, la régression close.
- L'agent **change** au milieu de l'essai : empreinte de configuration finale différente → essai invalidé, aucun score publié.
- Un cas **fissuré** (3 réponses, 3 verdicts) : ni réussi ni échoué ; il rejoint la liste de travail, et le rapport le signale au lieu de le compter comme faux.
- Le nombre de cas dépasse ce qu'un essai peut jouer : la suite est **échantillonnée** en priorité sur les cas bloquants, et l'échantillonnage est affiché.
- La règle de cas à règle est **trop complexe** pour être un prédicat : le cas est marqué « oracle manuel », il passe par le jury humain, et il compte dans les jauges humaines.
- L'agent **refuse** un cas à refus, mais pour la mauvaise raison : refus counted, motif faux — la nuance est dans le détail.
- L'agent **échoue de façon triviale** (réponse vide, erreur d'outil) : pas de rejeu, signalé immédiatement comme incident d'essai.
- Deux agents partagent le même nom : la version est identifiée par empreinte, jamais par le nom.
- Un cas contient une donnée personnelle : les détecteurs de `placard-wiki` le refusent à la création du cas.
- L'organisation n'a aucun agent : le banc est inutilisable — l'écran d'accueil le dit et propose le mode « concurrent » (comparer deux modèles sur le même corpus).

## 27. Recette

1. Un cas « valeur dérivée » recalcule son oracle depuis le graphe et l'affiche avec sa source et sa date.
2. Deux cas d'un même cas dont la source change : la dérive de vérité est signalée, pas une régression.
3. Un cas à règle produit le verdict du prédicat et compare verdict et motifs.
4. Un cas à refus est compté comme réussi uniquement si l'agent refuse **et** nomme ce qui manque.
5. Un agent qui répond à un cas à refus est pénalisé plus lourdement qu'un agent qui répond mal.
6. Une citation qui pointe un document inexistant produit un verdict « infondé ».
7. Une citation vers un document existant qui ne contient pas l'affirmation produit « citation non vivante ».
8. Un cas posé 3 fois avec 3 verdicts différents est marqué fissuré et n'entre pas dans le score.
9. La stabilité d'une version est affichée en pourcentage de cas non fissurés, avec l'effectif.
10. Un cas dont la source est absente est marqué « oracle mort » et n'entre pas dans le score ; le taux d'oracles morts est affiché.
11. Un essai dont la configuration d'agent a changé en cours de route est invalidé et ne produit aucun score.
12. Le mode blanc fournit le même instantané à deux versions successives ; le mode noir est rapporté séparément.
13. La porte refuse une promotion qui casse un cas bloquant, et le motif est explicite.
14. La porte refuse une promotion qui fait passer une jauge sous son plancher.
15. La porte refuse une promotion qui exceed le budget déclaré.
16. Une amorce d'injection suitée par l'agent fait échouer l'essai et remonte en bloquant.
17. Le scorecard montre chaque jauge avec son effectif, sa fourchette et son plancher.
18. L'accord entre correcteur automatique et jury humain est affiché ; sous le seuil, la jauge est marquée « non calibrée ».
19. Un effet de bord détecté pendant un essai disqualifie le cas et est tracé.
20. Le budget dépassé arrête l'essai et l'indique dans le rapport.
21. Aucune écriture n'est constatée dans les espaces de production pendant un essai.
22. Aucun cas du banc n'apparaît dans l'espace de production.

## 28. Scénario de la vidéo (moins de 5 minutes, en anglais)

| Temps | Contenu |
|---|---|
| 0:00 – 0:25 | « We shipped a new prompt. Three behaviors broke. We didn't know for two weeks. » |
| 0:25 – 1:00 | Le banc : 40 cas, trois formes d'oracle — valeur dérivée, règle vivante, refus attendu. La vérité **recalculée**, pas tapée |
| 1:00 – 1:35 | Le scorecard de deux versions, côte à côte, avec le témoin. Trois jauges en rouge, deux cas bloqués |
| 1:35 – 2:05 | L explorateur d'échecs : la réponse de l'agent, l'oracle, la source, et le diff entre versions |
| 2:05 – 2:35 | La distinction : « la vérité a changé mardi, l'agent n'a rien raté » — pas une régression |
| 2:35 – 3:00 | Les fissures : un cas instable, trois réponses, pas un cas difficile — un cas mal écrit |
| 3:00 – 3:25 | La porte : le ticket de version ne passe pas en approuvé tant que le lot d'or est rouge |
| 3:25 – 3:45 | L'amorce : le contexte contient une instruction hostile, l'agent ne suit pas, le cas est bloquant |
| 3:45 – 4:05 | Le jury humain et l'accord avec le correcteur automatique, affiché sans complaisance |
| 4:05 – 4:30 | Le banc de fumée en intégration continue : 20 cas, moins de deux minutes, chaque modification de prompt |
| 4:30 – 4:50 | Architecture : actions Rovo, oracles recalculés, graphe en lecture, SQL, budget et journal |

## 29. Comment les jugés testeront

1. **Banc de démonstration préchargé.** 40 cas seedés dans l'espace du banc : 15 valeurs dérivées, 10 cas à règle, 8 cas à refus, 7 amorces. Chaque cas a son oracle, recalculé ou écrit, et sa gravité.
2. **Deux versions d'un agent seedé.** La version 5 casse deux cas bloquants et perd un point de fondation par rapport à la version 4 ; la version 6 répare la fondation mais casse la stabilité. Les jugés le voient immédiatement.
3. **Exécuter un essai.** Deux minutes : scorecard, écarts au témoin, liste des régressions, budget consommé.
4. **Explorer un échec.** Réponse, oracle, sources, diff entre versions, verdict par jauge.
5. **Tester la porte.** Une version qui casse un cas bloquant est refusée à la promotion, avec le motif.
6. **Proposer un cas.** L'agent propose un cas depuis un ticket réel, l'oracle candidat est validé à la main, le cas rejoint le corpus.
7. **Le mode blanc vs noir.** Le même cas dans les deux modes, avec l'écart de fondation mesuré.

Lien d'installation, script de semis, corpus exportable et identifiants de démonstration figurent dans la soumission ; la vidéo montre en plus un essai sur un site relié à des données réelles.

## 30. Plan jusqu'au 22 décembre

| Semaine | Objectif |
|---|---|
| 11 – 17 nov. | Les neuf validations du § 24, en priorité l'appel à un agent Rovo depuis une action et l'exploitation des citations ; squelette Forge et socle CI |
| 18 – 24 nov. | Corpus, trois formes d'oracle, recalcul des oracles « valeur dérivée » depuis le graphe, jauges exactitude / fondation / refus |
| 25 nov. – 1ᵉʳ déc. | Stabilité et fissures, empreinte de spécification, témoin, lot d'or, banc de fumée, journal d'essai |
| 2 – 8 déc. | Porte de promotion (outil + verrou), scorecards, explorateur d'échecs, mode blanc / noir, isolation |
| 9 – 15 déc. | Outils MCP, agent Rovo « Le jury », skill, batterie d'amorces, jury humain et étalonnage ; **gel des fonctionnalités le 15** |
| 16 – 22 déc. | Recette, banc de démonstration semé, rapport exportable, vidéo, instructions pour les jugés, soumission, dépôt Marketplace |

Sacrifiables dans l'ordre : le mode blanc, la batterie d'amorces, le jury humain (remplacé par l'auto-étalonnage), l'export pour auditeur, le test d'outils.

## 31. Risques

| Risque | Parade |
|---|---|
| Les citations d'un agent ne sont pas exploitables | Mesurer la présence de sources citées même sans résolution, et le dire ; si l'agent accepte un format imposé, l'exploiter |
| Le mode blanc est impossible | Repli sur le mode noir seul, explicitement déclaré dans le rapport |
| L'agent sous test écrit pendant l'essai | Espace de test dédié, surveillance des créations, disqualification du cas avec trace |
| Un agent non déterministe rend le score instable | Multiplicité *k*, jauge de stabilité, jamais de verdict sur un passage isolé |
| La vérité de l'organisation est inconnue | Oracles morts affichés, taux affiché, banc d'agent non calibré marqué comme tel |
| Le banc coûte trop cher à jouer | Lot d'or restreint, fumée en intégration, suite complète la nuit, budget plafonné et affiché |
| Un cas contient une donnée sensible | Détecteurs de secrets à la création, cas refusés, espace du banc non indexé |
| L'agent est évasif sur ses sources | La fondation est une jauge bloquante, pas un indice de satisfaction |
| L'outil d'évaluation existe déjà ailleurs (hors Atlassian) | Différenciation : vérité dérivée de l'organisation, agents Rovo, gouvernance Atlassian ; à vérifier sur le Marketplace en semaine 1 |
| Le jury de Codegeist juge le produit trop « outillé » | La vidéo montre d'abord le **résultat** : une régression attrapée avant le client |

## 32. La vision poussée à l'extrême

- **Toute décision sur un agent devient une décision documentée.** « On déploie l'agent v6 » veut dire : lot d'or vert, empreinte consignée, journal joint, porte de promotion passée.
- **Le référentiel de vérité de l'organisation** devient une **molecule outillée** : chaque règle de l'entreprise (« on ne livre pas en gel », « un incident critique bloque ») devient un cas du banc, et chaque agent est jugé dessus. Les règles vivent dans le code et dans les oracles, pas dans une tête.
- **Les agents deviennent comparables.** Un nouveau modèle, un nouvel éditeur, une version maison : le banc dit lequel gagne, sur **vos** questions, au **même** coût affiché. L'arbitrage devient un chiffre, pas une préférence.
- **La dérive de vérité devient visible** : l'organisation voit, semaine après semaine, quelles de ses propres règles ont changé — et l'agent n'en est pas responsable.
- **Le banc devient la mémoire de l'IA.** Un agent qui régresse est rattrapé ; une règle qui change est expliquée ; un cas mal écrit est réécrit. L'intelligence artificielle de l'organisation cesse d'être une boîte noire qu'on redécouvre après l'incident.
- **Étendre au-delà des agents** : le même banc vérifie les **outils MCP** (contrat, erreurs, idempotence), les **automatisations** (se déclenchent-elles encore ?) et les **modes opératoires** (sont-ils encore vrais ?). Une seule discipline de mesure pour tout ce qui exécute dans l'organisation.
- **La confiance devient mesurable** : « nous faisons confiance à l'agent support » peut vouloir dire « il passe 34 cas bloquants, dérive de 2 %, coûte 0,12 € par conversation, et n'a pas régressé depuis huit versions ».

## 33. Liens avec les autres cahiers des charges

- **Déjà-vu CI (`deja-vu-ci`)** : même moteur de signature, même notion de flakiness ; un cas fissuré est un build instable, et les deux produits peuvent partager leur bibliothèque.
- **Fait, preuve à l'appui (`preuve-a-l-appui`)** : la force des preuves classe la citation d'un agent ; l'agent ne s'atteste jamais.
- **Brief de contexte (`brief-forge`)** : même discipline de citation et de budget de contexte ; une affirmation sans source est infondée ici aussi.
- **Permis d'agir (`permis-forge`)** : le jury humain est le seul juge ; l'agent sous test ne peut pas valider son propre cas.
- **Tickets piégés (`tickets-pieges`)** : le texte externe est une donnée, jamais une instruction — fondement de la batterie d'amorces.
- **Délégable ou pas (`delegable-ou-pas`)** : le refus de conclure sous un seuil d'effectif, les fourchettes, les époques.
- **Problèmes cachés (`problemes-caches`)** : cache par empreinte de contenu, appliqué aux oracles recalculés.
- **Objectifs réels (`vigie`)** : la stabilité des agents et le taux de régression deviennent des résultats clés de niveau A.
- **Procédures packagées (`gammes`)** : un cas bloquant s'acquitte comme une étape de gamme, avec refus des agents et preuve.
- **Placard du wiki (`placard-wiki`)** : aucun secret ni donnée personnelle dans un cas du banc.

## 34. Sources

- [Codegeist 2026](https://codegeist2026.devpost.com/) et ses [ressources](https://codegeist2026.devpost.com/resources) (bonus agents, MCP, Marketplace)
- [Modules Forge](https://developer.atlassian.com/platform/forge/manifest-reference/modules/) · [`rovo:agent`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/) · [`rovo:action`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/) · [`rovo:mcp`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/) · [`rovo:skill`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-skill/)
- [Limites d'exécution](https://developer.atlassian.com/platform/forge/limits-invocation/) · [LLM hébergé](https://developer.atlassian.com/platform/forge/ai/) · [stockage](https://developer.atlassian.com/platform/forge/storage-api/) · [Forge Realtime](https://developer.atlas.com/platform/forge/realtime/)
- [Teamwork Graph : API](https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api/) · [types d'objet](https://developer.atlassian.com/platform/teamwork-graph/api-reference/object-types/overview/) · [catalogue des connecteurs](https://developer.atlassian.com/platform/teamwork-graph/connector-reference/object-types-connectors/overview/)
- [API Jira Cloud](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/) · [API Confluence Cloud](https://developer.atlassian.com/cloud/confluence/rest/intro/) · [permissions Forge](https://developer.atlassian.com/platform/forge/manifest-reference/permissions/)
- [Publication d'une app Forge au Marketplace](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/)
- Rapports internes : `inventaire-codegeist/A-github.md`, `D-marche-forge.md`, `E-verif-goals.md` ; corpus `idees-codegeist/TOP-10.md`

## 35. Aller plus loin — la phase 2

La version 1 répond à « cette version d'agent régresse-t-elle ? ». La phase 2 répond à : **d'où viennent les cas** (le corpus ne doit pas être écrit à la main), **comment le banc se défend contre ce qu'il n'a pas prévu** (cas adversariaux générés), et **comment on compare deux agents qu'on n'a pas écrits** (banc multi-modèles).

### 35.1 Le banc continu : le corpus pousse tout seul

Écrire un corpus à la main ne tient pas. La v2 fait du corpus un **organisme vivant** :

- chaque question réelle posée à l'agent devient un **cas candidat**, anonymisé, avec la réponse donnée ;
- quand un humain corrige cette réponse, la correction devient **l'oracle** du cas candidat — la vérité vient du terrain, pas d'un rédacteur ;
- le cas entre en quarantaine, puis en revue humaine, puis au corpus ;
- les cas qui ne sont plus pertinents (la vérité a disparu, la fonctionnalité a changé) sont retirés avec trace.

Conséquence : le corpus couvre ce que les gens demandent vraiment, et non ce qu'on imagine qu'ils demandent. C'est le seul mécanisme qui rende le banc tenable au-delà de quelques dizaines de cas.

### 35.2 Le banc adversarial auto-généré

Le banc **mutile ses propres cas** pour produire de nouveaux tests : une date décalée d'un jour, une condition niée, une source plausible mais inexistante insérée, une instruction hostile glissée dans le contexte, un homonyme introduit. Chaque mutant hérite de l'oracle de son parent, ajusté mécaniquement quand c'est possible, marqué « à valider » sinon.

C'est ce qui permet de tester ce à quoi personne n'a pensé — et c'est la seule façon réaliste d'obtenir un corpus de plusieurs centaines de cas sans les écrire.

### 35.3 Le témoin vivant

La v1 garde une version témoin figée. La v2 la fait **tourner en continu** sur le même corpus : sa dérive mesure la dérive de l'organisation, indépendamment de tout changement d'agent. Quand le témoin baisse alors que rien n'a changé côté agent, c'est le monde qui a bougé — et la distinction entre « l'agent a régressé » et « la vérité a changé » devient continue plutôt qu'événementielle.

### 35.4 Le banc multi-agents et multi-modèles

Le même corpus, joué contre N agents, N modèles, N fournisseurs, avec un **classement normalisé par coût** : qualité par euro, qualité par seconde, qualité par jeton. L'organisation négocie alors avec ses éditeurs en présentant ses propres chiffres, sur ses propres questions — pas les bancs publics des vendeurs.

C'est aussi l'outil qui répond à la question « peut-on changer de modèle sans casser le support ? », que toute organisation finit par se poser.

### 35.5 Le banc de composition

Quand un agent en appelle un autre, tester chacun séparément ne prouve rien sur l'ensemble. La v2 teste la **composition** : l'arbre d'appels est enregistré, et chaque niveau est évalué contre ses propres règles. Une régression peut alors être attribuée à un niveau précis plutôt qu'à « l'agent ».

### 35.6 Le banc d'outils

Les outils MCP sont testés comme des logiciels : contrat d'entrée respecté, comportement en erreur, idempotence, effet de bord réel contre effet de bord déclaré, latence sous charge. Le banc cesse d'évaluer des réponses pour évaluer des **interfaces** — ce qui est plus stable, plus utile, et plus difficile à contester.

### 35.7 Le banc comme contrat

Le lot d'or devient un **engagement public** dans l'organisation : « cet agent tient au moins ce niveau sur ces cas », avec la mesure en continu et la rupture notifiée. Le banc passe d'outil de développeur à instrument de gouvernance, et la porte de promotion devient une clause, pas un script.

### 35.8 La version extrême

Plus personne ne déploie un agent sans son banc, comme plus personne ne déploie de code sans tests — et la raison est la même : le coût d'une régression silencieuse dépasse celui de la mesure. À ce stade, le banc produit un **actif** : le corpus est une représentation exécutable de ce que l'organisation sait et attend de ses machines. Cet actif survit aux agents, aux modèles et aux éditeurs. C'est la seule partie du dispositif qui ait de la valeur à dix ans.

### 35.9 Ce que ça donne avec les quatre autres

- **`gammes`** fournit les cas : une gamme est une procédure dont chaque étape est vérifiable, donc un oracle prêt à l'emploi.
- **`trame`** fournit les critères d'acceptation, qui deviennent des cas de niveau A.
- **`vigie`** reçoit « stabilité des agents » et « taux de régression » comme résultats clés.
- **`permis-forge`** : un agent dont le banc est rouge perd ses permis — la mesure devient une condition d'autorisation, pas seulement d'information.
- **`placard-wiki`** garantit qu'aucun cas du corpus ne contient de secret ni de donnée personnelle.

### 35.10 Ce que la phase 2 coûterait

Le banc continu et la mutation automatique sont les deux morceaux lourds (comptez trois semaines). Le multi-modèles est presque gratuit une fois le corpus partagé. Le banc d'outils est un produit distinct qui pourrait vivre seul — à envisager comme deuxième soumission plutôt que comme extension.
