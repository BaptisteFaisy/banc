/**
 * Les dérivations du corpus RÉEL — la vérité recalculée, jamais tapée.
 *
 * Chaque requête du banc réel résout ici, contre les bytes exacts du dépôt
 * capturés par `tools/capture-real-corpus.mjs`. C'est le modèle « valeur
 * dérivée » du §6.1 appliqué au banc lui-même : personne n'a écrit « 12 outils
 * MCP » dans un fichier de test, le banc lit `manifest.yml` et le compte. Si le
 * manifeste change, la valeur change, et un cas dont la réponse attendue
 * devient fausse est détecté comme une **dérive de vérité** (§7) — pas comme une
 * régression de l'agent.
 *
 * Une seule implémentation du YAML : `tools/lib/mini-yaml.mjs`, celle du garde
 * du manifeste. Deux analyseurs divergeraient sur le même fichier.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { parseMiniYaml } from '../../tools/lib/mini-yaml.mjs';
import type { FixtureMap } from '../collect/registry.js';
import type { RealCorpus } from './corpus.js';

/** Le manifeste Forge, parsé une fois par appel (aucun cache implicite). */
function manifeste(corpus: RealCorpus): Record<string, any> {
  const doc = corpus.documents.find((d) => d.path === 'manifest.yml');
  if (!doc) throw new Error('corpus réel sans manifest.yml — recapture requis');
  return parseMiniYaml(doc.contenu) as Record<string, any>;
}

/** Les workflows CI réels, par fichier. */
function workflows(corpus: RealCorpus): readonly { fichier: string; data: Record<string, any> }[] {
  return corpus.documents
    .filter((d) => d.path.startsWith('.github/workflows/'))
    .map((d) => ({ fichier: d.path, data: parseMiniYaml(d.contenu) as Record<string, any> }));
}

/** Un objet du corpus, parsé en JSON (package.json, .mergify.yml n'est pas du JSON). */
function json(corpus: RealCorpus, path: string): Record<string, any> {
  const doc = corpus.documents.find((d) => d.path === path);
  return doc ? (JSON.parse(doc.contenu) as Record<string, any>) : {};
}

/** Les 12 outils MCP déclarés, et leurs clés exactes. */
function outilsMcp(manifest: Record<string, any>): Record<string, unknown> {
  const module = manifest.modules?.['rovo:mcp']?.[0] ?? {};
  const cles: string[] = (module.tools ?? []).map((outil: any) => String(outil.key));
  return { count: cles.length, keys: cles, name: module.name ?? null };
}

/** Les actions et les tables SQL déclarées (§19, §22). */
function modulesDeclared(manifest: Record<string, any>): Record<string, unknown> {
  const tables: string[] = (manifest.modules?.sql?.tables ?? []).map((t: any) => String(t.name));
  const actions: string[] = (manifest.modules?.action ?? []).map((a: any) => String(a.key));
  return { tables: tables.length, actions: actions.length, keys: actions, nomsTables: tables };
}

/** Les déclencheurs : immédiats + planifiés (limite plateforme : 5 planifiés). */
function declencheurs(manifest: Record<string, any>): Record<string, unknown> {
  const immediats = manifest.modules?.trigger ?? [];
  const planifies = manifest.modules?.scheduledTrigger ?? [];
  return { immediats: immediats.length, planifies: planifies.length,
    cles: planifies.map((t: any) => String(t.key)) };
}

/** L'identité de l'app Forge : ARI, nom, runtime, bande compatible. */
function identiteApp(manifest: Record<string, any>): Record<string, unknown> {
  const app = manifest.app ?? {};
  return { ari: String(app.id ?? ''), nom: String(app.name ?? ''),
    runtime: String(app.runtime ?? ''), stripe: String(app.stripe ?? '') };
}

/**
 * Les budgets CI réels : un job par fichier, son `timeout-minutes`.
 *
 * La règle user « tout verdict de CI en 5 minutes au plus » est ici une
 * **règle vivante** : elle se vérifie contre les fichiers, pas contre une
 * intention ni contre un commentaire. Les dépassements sont NOMMÉS (fichier,
 * job, budget) — c'est exactement le motif que l'agent doit citer pour que la
 * règle soit tenue pour vraie (§6.2).
 */
function budgetsCi(corpus: RealCorpus): Record<string, unknown> {
  const jobs: { fichier: string, job: string, timeout: number }[] = [];
  for (const { fichier, data } of workflows(corpus)) {
    for (const [nom, job] of Object.entries<any>(data.jobs ?? {})) {
      if (typeof job?.['timeout-minutes'] === 'number') {
        jobs.push({ fichier, job: nom, timeout: job['timeout-minutes'] });
      }
    }
  }
  const depassements = jobs.filter((j) => j.timeout > 5);
  return { jobs: jobs.length, max: Math.max(...jobs.map((j) => j.timeout), 0),
    conformes: jobs.length - depassements.length,
    depassements: depassements.map((j) => `${j.fichier}:${j.job}=${j.timeout}`) };
}

/** La répartition des runners : self-hosted (le r630) contre GitHub-hosted. */
function runnersCi(corpus: RealCorpus): Record<string, unknown> {
  let selfHosted = 0;
  let hosted = 0;
  for (const { data } of workflows(corpus)) {
    for (const job of Object.values<any>(data.jobs ?? {})) {
      const cible = JSON.stringify(job?.['runs-on'] ?? '');
      if (cible.includes('self-hosted')) selfHosted += 1; else if (cible) hosted += 1;
    }
  }
  return { selfHosted, hosted, total: selfHosted + hosted };
}

/** Le type de licence, lu dans la première ligne du fichier LICENSE. */
function licence(corpus: RealCorpus): Record<string, unknown> {
  const doc = corpus.documents.find((d) => d.path === 'LICENSE');
  const premiere = (doc?.contenu ?? '').split('\n').find((l) => l.trim() !== '') ?? '';
  const type = premiere.replace(/\s+License$/i, '').trim();
  return { type, ligne: premiere, detenteur: (doc?.contenu.match(/Copyright \(c\) (\d{4}) (.+)/) ?? [])[2] ?? '' };
}

/** Les points de recette exécutables, comptés dans le tableau de docs/RECETTE.md. */
function pointsRecette(corpus: RealCorpus): Record<string, unknown> {
  const doc = corpus.documents.find((d) => d.path === 'docs/RECETTE.md');
  const lignes = (doc?.contenu ?? '').split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l));
  const faits = lignes.filter((l) => /\|\s*fait\s*\|\s*$/.test(l));
  return { count: lignes.length, faits: faits.length,
    ouverts: lignes.length - faits.length };
}

/** Les checks exigés par la file de merge Mergify. */
function checksMergify(corpus: RealCorpus): Record<string, unknown> {
  const doc = corpus.documents.find((d) => d.path === '.mergify.yml');
  const data = (doc ? parseMiniYaml(doc.contenu) : {}) as Record<string, any>;
  const regle = data.queue_rules?.[0] ?? {};
  const conditions: string[] = (regle.queue_conditions ?? []).map(String);
  const checks = conditions.filter((c) => c.startsWith('check-success')).map((c) => c.replace('check-success', '').trim());
  return { checks, count: checks.length, merge_method: String(regle.merge_method ?? ''), batch: regle.batch_size ?? null };
}

/** Le commit courant réel, et son sujet (lus dans `git log`, pas dans l'API). */
function commitCourant(corpus: RealCorpus): Record<string, unknown> {
  const premier = corpus.github.commits[0] ?? {};
  return { sha: String(premier.sha ?? corpus.meta.commit), sujet: String(premier.message ?? ''),
    date: String(premier.date ?? ''), auteur: String(premier.author ?? '') };
}

/** L'auteur le plus fécond du dépôt, et son nombre de commits dans la capture. */
function auteurLePlusFecond(corpus: RealCorpus): Record<string, unknown> {
  const comptes = new Map<string, number>();
  for (const commit of corpus.github.commits) {
    const nom = String(commit.author ?? 'inconnu');
    comptes.set(nom, (comptes.get(nom) ?? 0) + 1);
  }
  const tries = [...comptes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { nom: tries[0]?.[0] ?? '', commits: tries[0]?.[1] ?? 0, auteurs: tries.length };
}

/** Les PR réelles : fusionnées, ouvertes — absent si le REST n'a pas été capturé. */
function etatDesPrs(corpus: RealCorpus): Record<string, unknown> {
  const pulls = corpus.github.pulls;
  if (pulls.length === 0) return {};
  const fusionnees = pulls.filter((p) => p.merged_at || p.state === 'MERGED');
  return { count: pulls.length, fusionnees: fusionnees.length,
    numeros: fusionnees.map((p) => Number(p.number)),
    dernierSujet: String(fusionnees[0]?.title ?? '') };
}

/** Les runs CI réels : statut, conclusion, et les rouges. */
function etatDesRuns(corpus: RealCorpus): Record<string, unknown> {
  const runs = corpus.github.runs;
  if (runs.length === 0) return {};
  const rouges = runs.filter((r) => r.conclusion && r.conclusion !== 'success');
  return { count: runs.length, succes: runs.length - rouges.length,
    rouges: rouges.map((r) => `${String(r.name)}=${String(r.conclusion)}`),
    workflows: [...new Set(runs.map((r) => String(r.name)))].sort() };
}

/** Les versions de dépendance réellement déclarées dans package.json. */
function dependances(corpus: RealCorpus): Record<string, unknown> {
  const pkg = json(corpus, 'package.json');
  const toutes = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return { count: Object.keys(toutes).length, typescript: String(toutes.typescript ?? ''),
    react: String(toutes.react ?? ''), scripts: Object.keys(pkg.scripts ?? {}).length,
    version: String(pkg.version ?? '') };
}

/**
 * Le jeu de requêtes du corpus réel : requête → valeur RECALCULÉE.
 *
 * Une requête absente rend un oracle **mort** (`{}` pour les agrégats vides) :
 * c'est voulu — si la capture n'a pas pu lire GitHub, les cas GitHub sont
 * déclarés sans source au lieu d'être comptés comme des réponses fausses.
 */
export function valeursDuCorpus(corpus: RealCorpus): FixtureMap {
  const manifest = manifeste(corpus);
  return {
    'repo:manifest.outils-mcp': outilsMcp(manifest),
    'repo:manifest.modules': modulesDeclared(manifest),
    'repo:manifest.declencheurs': declencheurs(manifest),
    'repo:manifest.app': identiteApp(manifest),
    'repo:ci.budget': budgetsCi(corpus),
    'repo:ci.runners': runnersCi(corpus),
    'repo:licence': licence(corpus),
    'repo:recette': pointsRecette(corpus),
    'repo:mergify.checks': checksMergify(corpus),
    'repo:git.commit-courant': commitCourant(corpus),
    'repo:git.auteur-le-plus-fecond': auteurLePlusFecond(corpus),
    'repo:prs': etatDesPrs(corpus),
    'repo:runs': etatDesRuns(corpus),
    'repo:dependances': dependances(corpus),
  };
}
