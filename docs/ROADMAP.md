# Feuille de route

## D'ici la soumission (22 décembre 2026)

| Semaine | Objectif | État |
|---|---|---|
| 11 – 17 nov. | Les neuf validations du §24 ; squelette Forge et socle CI | **fait** : socle, manifeste, CI 5 min, garde de taille, garde Hermes |
| 18 – 24 nov. | Corpus, trois formes d'oracle, recalcul des oracles « valeur dérivée », jauges exactitude / fondation / refus | **fait** : les trois formes d'oracle, les huit jauges, le corpus de 40 cas |
| 25 nov. – 1ᵉʳ déc. | Stabilité et fissures, empreinte de spécification, témoin, lot d'or, banc de fumée, journal d'essai | **fait** : fissures avec attribution, empreinte, témoin, lot d'or curaté, journal rejouable |
| 2 – 8 déc. | Porte de promotion (outil + verrou), scorecards, explorateur d'échecs, mode blanc / noir, isolation | **fait** : porte à cinq règles, verrou de workflow, scorecards, modes séparés, isolation |
| 9 – 15 déc. | Outils MCP, agent Rovo « Le jury », skill, batterie d'amorces, jury humain et étalonnage ; **gel des fonctionnalités le 15** | **fait** : 12 outils, agent « Le jury », skill publiée, batterie, jury et calibrage |
| 16 – 22 déc. | Recette, banc de démonstration semé, rapport exportable, vidéo, instructions pour les jugés, soumission | **partiel** : recette (22 points), banc semé, instructions aux jugés, rapport exportable ; **reste** : vidéo |

## Ce qui reste à faire, par ordre de valeur

> Note de la branche B : l'export pour auditeur est prioritaire, parce que
> la conformité l'attend avant la vidéo.

1. ~~**Le rapport exportable pour auditeur** (BE-29)~~ — **fait** : le
   rapport s'exporte en JSON scellé SHA-256 et en Markdown
   (`npm run report:export`), il est servi par le site et vérifié par neuf
   tests. L'écran Confluence reste à écrire côté Forge.
2. **La vidéo** (§28) — le récit est écrit dans `docs/JUDGES.md` et dans les
   sections du site ; il reste le montage.
3. **Les tests d'outils MCP** (BE-27) : contrat d'interface, erreurs,
   idempotence. Le contrat des douze outils est déjà testé.
4. **La collecte d'un vrai jury humain** — le mécanisme est là
   (`record-judgment`, `calibrate`), l'échantillon réel manque. Sans lui, les
   jauges restent marquées « non calibrée », ce qui est le comportement
   honnête.

## Sacrifiables, dans l'ordre

Le §30 fixe l'ordre. Aucun n'est nécessaire à la démonstration du cœur du
produit :

1. le mode blanc (repli sur le mode noir seul, explicitement déclaré) ;
2. la batterie d'amorces ;
3. le jury humain (remplacé par l'auto-étalonnage) ;
4. l'export pour auditeur ;
5. le test d'outils.

## Phase 2 — ce que le banc devient

Le §35 décrit la direction. En un mot : **le corpus devient un organisme**.

- **Banc continu** — chaque question réelle posée à l'agent devient un cas
  candidat, et la correction d'un humain devient l'oracle. La vérité vient du
  terrain, pas d'un rédacteur : c'est le seul mécanisme qui rende le banc
  tenable au-delà de quelques dizaines de cas.
- **Banc adversarial auto-généré** — le banc mutile ses propres cas (une date
  décalée, une condition niée, une source plausible mais inexistante) pour
  produire des tests auxquels personne n'a pensé.
- **Témoin vivant** — le témoin tourne en continu sur le même corpus : sa
  dérive mesure la dérive de l'organisation, indépendamment de tout changement
  d'agent. La distinction « régression » / « dérive » devient continue au lieu
  d'être événementielle.
- **Banc multi-modèles** — le même corpus contre N agents, N modèles, N
  fournisseurs, avec un classement normalisé par coût. L'organisation
  négocie alors avec ses éditeurs sur ses propres questions.
- **Banc de composition** — quand un agent en appelle un autre, l'arbre
  d'appels est enregistré et chaque niveau est évalué : une régression est
  attribuée à un niveau précis plutôt qu'à « l'agent ».
- **Banc d'outils** — les outils MCP sont testés comme des logiciels :
  contrat, erreurs, idempotence, effet de bord réel contre effet de bord
  déclaré. Le banc cesse d'évaluer des réponses pour évaluer des interfaces.
- **Banc comme contrat** — le lot d'or devient un engagement public :
  « cet agent tient au moins ce niveau sur ces cas », mesuré en continu, avec
  rupture notifiée.

## Phase 3 — l'extension naturelle

La même discipline de mesure pour tout ce qui exécute dans l'organisation :
les automatisations (se déclenchent-elles encore ?), les modes opératoires
(sont-ils encore vrais ?). Une seule discipline pour tout ce qui exécute.

Et l'actif durable : le corpus est une représentation **exécutable** de ce que
l'organisation sait et attend de ses machines. Il survit aux agents, aux
modèles et aux éditeurs. C'est la seule partie du dispositif qui ait de la
valeur à dix ans.

