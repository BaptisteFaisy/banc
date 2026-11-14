# Banc — the agent test bench

> *before you trust an agent, bench it*

An agent is not judged by eye. You ask it questions whose **truth is derived
from your own systems**, replay those questions against every version, and
watch what regressed — before a customer finds it.

Banc is an **Atlassian Forge app** (Jira + Confluence) that turns that loop
into infrastructure: twelve MCP tools, an agent to explain the results, a
workflow lock that blocks a promotion when the measurements say so, and a
replayable audit trail.

Submitted at **Codegeist 2026**, category *Apps for Software Teams*.
Bonus targets: Rovo agents, MCP, Marketplace.

---

## The problem

- The first test is an angry customer. You have impressions, not a suite.
- Changing a prompt makes no sense without measurement: you tweak one
  instruction and you don't know whether you improved anything or broke three
  behaviours out of twelve.
- An agent that answers well is not necessarily an agent that is **right**. It
  is often confident and wrong, and "it looks fine" is not a metric.
- You have nothing to compare against. A second model, a second editor, a
  previous version — the answers are non-deterministic and the contexts differ.
- And above all: **you don't have the truth.** "Can we ship on Friday?" depends
  on freezes, open incidents, ticket acceptance criteria. That truth lives in
  the organisation, not in a checkbox.

The world has a standard artefact for that — the **bench** (benchmark,
evaluation suite, "golden set"). It does not exist for Atlassian agents,
because it assumes two rare things: being able to **replay** an agent
reproducibly, and being able to **compute** the right answer from the
organisation's own data.

---

## What Banc does

Three oracle shapes, non-interchangeable (§6 of the spec):

| Oracle | The truth is | Example |
|---|---|---|
| **Derived value** | already in the systems, under a computable form — **recomputed on every run**, never typed | "Who owns the payments service?" → read from the graph |
| **Living rule** | a **predicate** on the current state; the agent must rediscover the rule | "Can we ship 2026.11 on Friday?" → freeze ∧ no critical incident ∧ all criteria proven |
| **Expected refusal** | there is no answer; the right behaviour is **not to answer**, and to say what is missing | "What is next quarter's commercial plan?" → refusal + what is missing |

Eight gauges (§8): exactness, grounding, live citation, rule exactness, correct
refusal, completeness, stability, cost & latency. Every gauge carries its
**sample size**, its **confidence interval** and its **floor** — below the
sample threshold it reads *"not enough data"* instead of a percentage.

And the distinction every evaluation framework forgets (§7):

> **Truth drift is not an agent regression.** The oracles are recomputed on
> every run. If the truth changed, the agent did not regress — the
> organisation did. The bench proves it, replays the case and closes the
> regression with the evidence.

---

## What Banc does not do

- It does **not** judge an agent in production: the bench is a separate space,
  with its own data and no side effects.
- It does **not** invent the right answer when the organisation does not know
  it: the case is marked *oracle unverifiable*, and the bench says so.
- It does **not** compare agents on different contexts: every version in a run
  receives the same test condition.
- It does **not** fix the agent: it produces the verdict, the regression and
  the probable cause.
- It does **not** evaluate writing quality, intelligence or personality: only
  verifiable facts.
- It does **not** publish the content of a test case in a visible space: a
  case often contains the business answer.

---

## The promotion gate

The bench is not a report, it is a **gate** (§11). A version can be promoted
only if:

1. no blocking case of the gold suite regressed,
2. no gauge falls below its floor,
3. stability stays above the floor,
4. the average cost per case respects the declared budget,
5. no bait of the hostile battery was followed.

It is a tool (`check-promotion`) **and** a workflow lock
(`jira:workflowValidator`): the ticket of the new version cannot move to
"approved" while the gate is red. The gate refuses by **naming** the motive.

---

## The twelve MCP tools

`run-bench` · `get-scorecard` · `list-regressions` · `compare-versions` ·
`get-case` · `list-cases` · `check-promotion` · `get-stability` ·
`get-oracle-health` · `propose-case` · `record-judgment` · `get-run-log`

No tool exposes a case's content to an unauthorized agent: cases are filtered
by the bench space and by the reader's rights, and a refused call returns an
explicit error — never an empty list that could be read as "there are no
cases".

---

## Try it in five minutes

```bash
git clone git@github.com:BaptisteFaisy/banc.git
cd banc
npm install
npm test            # 200+ tests, including the 22-point acceptance suite
npm run seed        # writes the demo corpus to dist/seed/
npm run site:dev    # the public demo site

# the real bench: this repository is the organisation under test
node tools/capture-real-corpus.mjs            # -> src/real/corpus.json (sealed)
INFERHUB_API_KEY=… npm run demo:real          # -> site/public/real-run.json
```

The demo bench ships **40 cases** in the bench space: 15 derived values, 10
living rules, 8 expected refusals, 7 baits — plus three versions of one agent:
**v4** (the witness), **v5** (breaks two blocking cases and loses a point of
grounding) and **v6** (repairs grounding but breaks stability). Judges see it
immediately, with no configuration.

Two benches, two purposes, labelled on the page and never confused:

- **the seeded bench** (40 cases, three versions of one agent) runs on a
  **fictional** organisation, on purpose: it is reproducible, and a judge sees
  the whole story in two minutes with no configuration.
- **the real bench** (`src/real/`) runs on **this repository**: 19 real files,
  the commits in `git log`, the PRs and CI runs on GitHub, captured and sealed
  by SHA-256. Sixteen questions — 10 derived values, 3 living rules, 3 expected
  refusals. The oracle is recomputed from those bytes on every pass, and the
  agent is never given the answer: it gets an index, asks for a file, and
  answers from what it read.

See [`docs/JUDGES.md`](docs/JUDGES.md) for the seven-step walkthrough and
[`docs/DEMO-DIRECT.md`](docs/DEMO-DIRECT.md) for how the live demo reaches the
model without ever leaking the key.

---

## Architecture

```
src/domain/    shared types — one concept, one type, one module
src/oracle/    the truth, recomputed: derived value, living rule, refusal,
               dead oracles, truth history and drift
src/collect/   the only impure layer: graph, Jira, Confluence, JSM, hosted
               LLM, content-addressed cache
src/judge/     the eight gauges, one file each, pure
src/run/       the engine: k passages, cracks, fingerprint, white/black
               modes, budget, side effects, replayable log
src/score/     what the bench announces: scorecards, intervals, regression vs
               drift, promotion gate, jury and calibration
src/db/        16 tables, mapping, and a memory stub for tests
src/mcp/       the twelve tools, their guard and their validation
src/actions/   Forge resolver, Rovo actions, triggers, consumer, lock
src/ui/        the twelve screens (UI Kit 2)
src/seed/      the demonstration bench
src/i18n/      French and English, with a parity test
```

The discipline: **pure first**. The domain, the gauges, the score and the gate
are pure functions; everything impure sits behind an injected port with a
memory stub. A test never makes a network call, and a run is replayable.

Full details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the
contract in [`docs/CONTRAT-TECHNIQUE.md`](docs/CONTRAT-TECHNIQUE.md).

---

## Honesty as a feature

The spec's non-functional requirements are encoded in the types, not in a
promise:

| Requirement | Where it lives |
|---|---|
| no gauge without sample size or interval | `ScorecardRow { n, value, ciLow, ciHigh, floor }`, `value: number \| null` |
| a dead oracle is displayed, never scored as wrong | `OracleState.alive`, `deadReason` |
| an uncalibrated gauge is marked as such | `Calibration.calibrated` |
| the bench stops at the budget and says so | `RunState 'stopped_budget'`, `BudgetUsage.exhausted` |
| the agent under test never self-evaluates | `assertCanReadBench` rejects an agent caller |
| reproducibility | same condition per version, fingerprint drift invalidates a run |
| a citation must resolve to a real document | `judgeCitationVivante` reaches *unfounded* / *not live* / *grounded*; none is a constant |
| **a demo never tells the agent the answer** | `tests/real/no-script.test.ts` asserts no oracle value reaches the prompt, and no document block is served before the agent asks |
| a sealed corpus that lies is refused | `sceauValide` hashes the bytes served, not the JSON's self-declared fields; `createRepoAdapter` throws on a broken seal |

See [`docs/HONNETETE.md`](docs/HONNETETE.md) for where each one is proved.

---

## Continuous integration

- **CI ≤ 5 minutes**, enforced by a guard (`ci-budget`) that fails the build if
  any job declares more than five minutes. Never a longer timeout: you
  optimise or you split.
- **File < 500 lines, function < 50 lines** — enforced on the app, the tests,
  the site and the docs.
- **No push to `main`**: Mergify merges, on a protected branch, after `ci`,
  `ci-budget` and `couche0`.
- **Hermes resolves conflicts.** When a pull request conflicts with `main`,
  the resolver rebases, resolves (InferHub first, deterministic fallback
  after), **validates the result with the repository's own toolchain**, and
  pushes with `--force-with-lease` on the PR branch only. If it cannot prove
  the result is good, it escalates to a human instead of guessing.
  See [`docs/HERMES.md`](docs/HERMES.md).

---

## Le registre d'essai

Chaque essai laisse un journal : conditions, versions, horodatages, arrêts et
invalidations. C'est la piste d'essais datée, rejouable et opposable qu'attend
la conformité — et ce qui permet à un auditeur de rejouer une mesure six mois
plus tard sans croire le rapport.

Le journal ne contient jamais le texte des réponses : il porte des
**empreintes** et des **références**. Le contenu d'un cas reste dans son
espace, et une réponse d'agent n'atterrit jamais dans une table de
statistiques.

## Layout

| Path | What |
|---|---|
| `manifest.yml` | the Forge app: 18 modules, 12 MCP tools, 16 SQL tables |
| `SKILL.md` | `before-promoting-an-agent`, published as open source |
| `src/` | the app |
| `tests/` | unit tests + the 22-point acceptance suite |
| `src/real/` | the real corpus: sealed capture, derivations, provenance, 16 cases |
| `tools/capture-real-corpus.mjs` | captures the repository into `src/real/corpus.json` |
| `site/` | the public demo site |
| `server/` | the live-demo proxy, the tunnel supervisor and its URL publisher |
| `docs/` | spec, contracts, architecture, honesty, judges, runbook, roadmap |
| `docs/DEMO-DIRECT.md` | how the live demo stays reachable (ephemeral tunnel URL) |
| `.github/hermes/` | the conflict resolver and its InferHub leg |

---

## Licence

MIT. See [`LICENSE`](LICENSE).
