/**
 * Lance un banc RÉEL côté serveur et enregistre sa mesure.
 *
 * C'est la variante « enregistrée » : la clé vient de l'environnement, le
 * client HTTP appelle InferHub en direct, et la mesure est écrite dans
 * `site/public/real-run.json`. Le site peut ensuite l'afficher même sans
 * réseau — et le mode direct (navigateur) rejoue le MÊME `runRealBench` en
 * appelant le proxy.
 *
 * Usage :
 *   INFERHUB_API_KEY=… npm run demo:real
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { seededRegistry } from './sources.js';
import { httpAgentFactory } from './real-agent.js';
import { runRealBench, DEMO_CASE_IDS } from './real-bench.js';
import { SEED_CASES } from '../seed/index.js';

/** Modèle, tarif et base : réglables, défauts posés. */
const MODEL = process.env.DEMO_MODEL ?? 'combo/cheap';
const BASE_URL = process.env.DEMO_BASE_URL ?? 'https://api.inferhub.dev/v1';
const USD_PER_THOUSAND = Number(process.env.DEMO_PRICE_PER_1K ?? 0.0003);

/** Point d'entrée : joue, mesure, enregistre. */
async function main(): Promise<number> {
  const apiKey = process.env.INFERHUB_API_KEY;
  if (!apiKey) {
    process.stderr.write('INFERHUB_API_KEY absente : le banc réel ne peut pas jouer.\n');
    return 1;
  }
  const registry = seededRegistry();
  const cases = SEED_CASES.filter((item) => (DEMO_CASE_IDS as readonly string[]).includes(item.id));
  process.stdout.write(`Joue ${cases.length} cas × 3 passages contre ${MODEL}…\\n`);
  const run = await runRealBench(
    {
      cases, registry,
      priceUsdPerThousandTokens: USD_PER_THOUSAND, model: MODEL, provider: 'inferhub.dev',
    },
    httpAgentFactory({
      baseUrl: BASE_URL, apiKey, model: MODEL,
      price: { usdPerThousandTokens: USD_PER_THOUSAND }, registry,
    }),
  );
  const path = resolve(process.cwd(), 'site/public/real-run.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(run, null, 2)}\n`, 'utf-8');
  process.stdout.write(`écrit : ${path}\\n`);
  process.stdout.write(`jetons : ${run.totals.tokens} · coût : ${run.totals.costUsd.toFixed(4)} $ · `
    + `latence moyenne : ${Math.round(run.totals.latencyMeanMs)} ms\\n`);
  return 0;
}

process.exit(await main());
