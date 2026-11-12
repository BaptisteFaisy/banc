---
name: before-promoting-an-agent
description: >-
  Before pushing a new version of an agent, run the gold suite and read the
  gate. If the gate is red, do not promote. On a regression, check truth drift
  first — the organisation may have changed, not the agent. Never conclude on
  a single case, and record the fingerprint of the configuration you tested.
version: 1.0.0
license: MIT
---

# Before promoting an agent

A change to a prompt is not a change you can judge by eye. This skill is the
short procedure to follow before an agent version reaches production. It is
written for anyone — a developer, a platform owner, an agent — holding a bench
run and a promotion ticket.

It applies to **any** agent evaluated against a bench. Banc is one
implementation; the discipline is the point.

---

## The five rules

### 1. Run the gold suite first

The gold suite is the short set of cases the organisation cannot afford to
miss. Run it before you push, not after a customer complains. It is designed
to run in under two minutes.

```
banc run --agent <agentId> --suite smoke
```

A full suite is a nightly job, sliced into chunks with a cursor. A smoke run
belongs in continuous integration: every prompt or skill change must produce
a verdict.

### 2. If the gate is red, do not promote

The gate is a set of rules, not a score. A version may be promoted only if:

| Rule | Meaning |
|---|---|
| no blocking case regressed | a case of the gold suite got worse |
| no gauge below its floor | every gauge stays above its declared floor |
| stability above its floor | the agent is not unstable |
| cost within budget | the average cost per case respects the declared budget |
| no bait followed | the agent resisted the hostile battery |

Read the **motives**, not only the verdict. A red gate that names the two
cases that broke is a minute of work. A red gate that just says "failed" is
an afternoon.

### 3. On a regression, check truth drift FIRST

This is the step everyone forgets. The oracles are recomputed on every run.
If the truth changed, the agent did not regress — the organisation did.

- Truth unchanged, answer changed → **agent regression**. Real bug.
- Truth changed → **truth drift**. Not the agent's fault. The case is replayed
  and the event is traced.

Check the oracle's history before you touch a prompt. Debugging a prompt for
three days because the source data moved is the failure mode this step
exists to prevent.

### 4. Never conclude on a single case

An agent is not deterministic. Every case is played several times (three by
default), and a verdict is never taken from a single passage.

A case whose verdict changes between passages is **cracked**: the bench says
whether the case is badly written or the agent is unstable, with the spread
between the answers. A cracked case does not count as a failure — it becomes
work to do.

Likewise, a gauge without enough samples reads **"not enough data"**. That is
not a percentage of zero and not a pass. Do not average your way out of it.

### 5. Record the fingerprint of what you tested

An agent is not a thing, it is an assembly: prompt, skills, actions, tools,
model, temperature. The bench fingerprints it and stores the fingerprint with
the run. If the configuration changed *during* the run, the run is invalidated
and no score is published.

Write the fingerprint on the promotion ticket. Without it, the result belongs
to no version, and the audit trail is broken.

---

## Procedure

1. **Freeze the configuration.** Record the fingerprint. Do not edit the
   prompt while the bench is running.
2. **Run the gold suite.** Smoke in CI, full suite nightly.
3. **Read the scorecard.** Every gauge with its sample size, its confidence
   interval and its floor. Below the sample threshold, the gauge says "not
   enough data" — take that seriously, do not round it up.
4. **Open the failure explorer.** For each regressed case: the agent's
   answer, the oracle, the sources, and the diff with the witness version.
5. **Classify each failure before fixing it.**
   - *exact but unfounded* → the agent got it right without citing. Fix the
     prompt, not the knowledge.
   - *cited a source that does not exist* → worse than no citation. Fix first.
   - *answered a case that should have been refused* → the most serious: the
     bench is measuring hallucination here.
   - *truth drift* → not a regression. Ask the data owner what changed.
6. **Check the stability dial.** Cracked cases are a work list, not failures.
7. **Read the gate.** If it is red, stop here and fix what it names.
8. **Attach the run log and the fingerprint** to the promotion ticket, then
   promote.

---

## What this skill does not do

- It does not judge the quality of writing, the intelligence or the
  personality of an agent — only verifiable facts.
- It does not fix the agent. It produces a verdict, a regression and a
  probable cause.
- It does not compare two agents on different contexts: every version in a
  run receives the same test condition.
- It does not invent the right answer when the organisation does not know it.
  The case is marked "oracle unverifiable" and the bench says so.

---

## The vocabulary, precisely

These words are not interchangeable, and confusing them is how a bench starts
rewarding the wrong thing:

| Word | Meaning |
|---|---|
| **exact** | the agent gives the oracle's value |
| **concordant** | the agent does not contradict itself and stays consistent with the oracle without naming it |
| **founded** | every claim is backed by a verifiable source |
| **unfounded** | a citation does not resolve, or does not say what is claimed |
| **unverifiable** | no source can settle it — the oracle is dead |

A refusal is a first-class answer. An agent that answers a case whose correct
behaviour is to refuse is penalised **more heavily** than an agent that
answers wrongly: a bench that only measures good answers rewards
hallucination.

---

## Before you trust an agent, bench it.
