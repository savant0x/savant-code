# FID: Eval-runner model override + per-run usage telemetry

**Filename:** `FID-2026-1007-013-eval-runner-model-override-and-usage-telemetry.md`
**ID:** FID-2026-1007-013
**Severity:** low
**Status:** fixed
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

Formal FID for `dev/build-orders/BO-2026-09-08-eval-runner-model-override-and-usage-telemetry.md`.
Two additive capabilities the Savant Bench lane benchmark needs from
`evals/v2/`: a per-run model override so a benchmark lane can execute against an
explicitly supplied model without mutating `agents/` on disk, and per-run token
usage surfaced on the trace so lane economics are measured rather than
synthesized. Zero implementation since 2026-09-08. This FID tracks the work;
implementation is **not** authorized by this record.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint`, `bun test`
- **Commit/State:** uncommitted working tree

## Detailed Description

### Problem

The measurement substrate cannot express a lane. `RunnerConfig` has no `model`,
so a lane cannot pin its model without touching the agent registry on disk; and
no usage data reaches the trace, so the board cannot report lane economics.

### Expected Behavior

`RunnerConfig.model?: string` + `RunnerConfig.onUsage?: (s: UsageSample) => void`,
with `TraceMetadata` gaining `usage?` (summed across calls and subagents) and
`model?` (the effective model). Zero behavior change when both are absent.

### Root Cause

Not a defect — an unstarted feature, untracked until 2026-10-07.

### Evidence

Measured 2026-10-07, every named surface absent:

```text
evals/v2/src/runner.ts          RunnerConfig: no `model`, no `onUsage`
evals/v2/src/trace.ts           no `usage` / `model` fields on TraceMetadata
common/src/types/print-mode.ts  no `usage` member in printModeEventSchema
                                 (union runs start → compliance_warning)
```

### Design decision carried forward

The source build order adjudicated the mechanism: add a `usage` PrintMode event
emitted from the **existing** `onUsage` hook in `step.ts`, rather than threading
a host-facing callback through `RunOptions → runOnce → agent-runtime-impl →
AgentRuntimeDeps → RunAgentStepParams`. The latter touches ~8 files across 4
packages; the former is additive to a zod-discriminated union whose additive
members are the established compatibility mechanism, and every consumer
(SDK `handleEvent`, the eval runner, the NDJSON transport) gets it for free.

## Impact Assessment

### Affected Components

`evals/v2/src/runner.ts`, `evals/v2/src/runners/savant.ts`,
`evals/v2/src/trace.ts`, `evals/v2/src/cli.ts`,
`common/src/types/print-mode.ts`,
`packages/agent-runtime/src/run-agent-step/step.ts`.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

> Risk is low precisely because the change is additive and optional; the source
> order's hard constraint is that the full existing suite passes **unchanged**.

## Proposed Solution

### Approach

Adopt the source build order's design decision and its eight steps unchanged.

### Steps

1. `printModeUsageSchema` + append to `printModeEventSchema`.
2. Emit from the existing `onUsage` hook body in `step.ts` via `onResponseChunk`.
3. `RunnerConfig.model?` + `onUsage?`, with exported `UsageSample`.
4. Inline agent-definition clone in `savant.ts`; fail fast on unresolved `agentId`.
5. `TraceMetadata.usage?` + `model?`; `finalize()` fills both.
6. Optional `--model <slug>` on the eval CLI.
7. New unit suite: usage accumulation across subagent-tagged samples, override
   reaching SDK options without touching `agents/`, trace fields, absence-of-
   options parity.
8. Confirm no diff outside the named files.

### Verification

Per the source build order's six acceptance gates, including the unchanged-suite
parity proof and the Law 4 call-graph check that `model` is consumed by
`SavantAgentRunner.executePrompt` and `usage` by `trace.ts`.

## Verification Gates

- gate: test evals/v2/tests/eval-runner-model-usage.test.ts
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck evals
- gate: quality

### Verification Receipt

- fingerprint: sha256:3ec13c2d667e06753a17090bd841b627af5fec94187e28252833d1f063e6bc0d
- verified: 2026-10-08T21:26:58.333Z
- test evals/v2/tests/eval-runner-model-usage.test.ts: exit 0
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck evals: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** 0 of 8 steps implemented; all three named surfaces confirmed absent.
- **GREEN:** Not reached — design authority is the source build order.
- **AUDIT / ADVERSARIAL:** Not reached.
- **CHANGE DELTA:** n/a

### Missed Questions

1. **Does the NDJSON transport need a `usage` frame kind?** → Possibly, but it
   is out of this FID's scope: the frozen wire contract lists only
   `progress | question | artifact | error`, and changing it is a Savant-side
   decision. The child would need to map `usage` onto an existing kind or the
   contract must be amended deliberately — worth noting before FID 5 of the
   transport work is reopened.
2. **Is `subagent_finish` cost a gap here?** → Out of scope; the source order
   scopes usage, not cost. Recorded so it is not silently assumed covered.

### Loop 2 — full-perfection pass, GREEN fold (2026-10-08, operator-triggered)

RED re-confirmed today: `RunnerConfig` has no `model`/`onUsage` (grep, no
match); `trace.ts` has no usage/model fields; the print-mode union (17 literals)
has no `usage` member. The `onUsage` emission seam in `step.ts` exists.

GREEN fold — missed questions answered (defaults from code inspection):

1. Resolve `model` ONCE at run-config construction, not per-runner — per-runner
   threading recreates the multi-loader problem the BO rejected for `onUsage`.
2. Stage the public wire change: eval-local capture from the existing `onUsage`
   hook plus `TraceMetadata.usage?`/`model?` first; add the
   `printModeEventSchema` `usage` member only when a NAMED consumer exists
   outside the eval harness.
3. Acceptance pin: a fixture run with an override asserts every trace's `model`
   equals the override (mixed-model runs impossible, not assumed).
4. Clone the agent definition at load; never edit the generated bundled agents.
5. Payload is token counts + model slugs only (Law 12 stated, not assumed).

Five Questions: fails "all cases" without (1) and "2 years" without (2); both
folded. Named operator decisions: eval billing keys; ratify the staged
wire-change decision.

### Loop 3 — STAGE 1-2 IMPLEMENTED (2026-10-08, operator-approved work list)

The staged design's first stage is implemented; the print-mode wire member is
NOT (no named consumer exists outside the eval harness — exactly the staging
condition Loop 2 set). Deviations from the source build order's step list,
recorded rather than smoothed:

- **`onUsage` callback deferred, not implemented.** The SDK `RunOptions` has
  no per-sample usage channel (`sdk/src/run/types.ts` — `handleEvent`,
  `onStateSnapshot`, `onFileWritten`, none usage-shaped). A callback field on
  `RunnerConfig` with no producer behind it is a dead field (Law 4). The
  callback ships WITH the wire stage, when `step.ts` emits `usage` events.
- **Run-total usage instead reaches the trace from the runtime state**: the
  existing `onUsage` hook body in `step.ts` now also folds each observation
  into `agentState.runUsage` (new `RunUsageSample` type on `AgentState`,
  classified by-design in the spawn partition — a child sums its own calls;
  the host totals the tree), and `TraceCollector.finalize` lifts the sum over
  the recursive `subagents` tree into `TraceMetadata.usage`.
- **`TraceMetadata.model`**: the runner records the effective model at
  initialize (override if set, else the resolved definition's model) via
  `TraceCollector.recordEffectiveModel`.

Implementation evidence (all on this tree):

- `common/src/types/session-state-run-usage.ts` (new) — `RunUsageSample`,
  4 token-count fields, Law 12 payload rule stated on the type.
- `common/src/types/session-state-agent-state.ts` — `runUsage?:
  RunUsageSample` + import (file was near the ceiling; the type lives in its
  own module per the `session-state-cache-usage.ts` precedent).
- `packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts` —
  `runUsage` classified by-design with its reason (compile-time partition
  gate stays exhaustive).
- `packages/agent-runtime/src/run-agent-step/step.ts` — the existing
  `onUsage` hook body additionally sums into `agentState.runUsage` (extend,
  don't duplicate — same channel, zero new emission sites).
- `evals/v2/src/runner.ts` — `RunnerConfig.model?`; `TraceMetadata.usage?` /
  `model?`; exported `UsageSample`. `onUsage` deferred with the reason
  recorded on the config field's comment.
- `evals/v2/src/runners/savant.ts` — override → inline definition clone
  (`{ ...base, model }` — `resolveAgentIdentity` appends clones; `agents/`
  untouched), fail-fast error naming the unresolved id; effective model
  recorded at initialize.
- `evals/v2/src/trace.ts` — `collectRunUsage` depth-first sum over the
  recursive subagent tree; absent-when-unreported (never a fake zero);
  `metadata.model` from the collector.
- `evals/v2/src/cli.ts` — `--model <slug>` (help text, validation,
  threaded to the runner config).
- New suite `evals/v2/tests/eval-runner-model-usage.test.ts` — 7 pins:
  override clone reaches `client.run` as an inline object; mixed-model
  impossibility (trace `model` equals EXACTLY the override); fail-fast on
  unresolved id; string passthrough parity (no clone without override);
  resolved-template model recorded without override; usage-tree sum across
  recursive subagents; absent-when-unreported; Law 12 token-only surface.

Gates (live, this tree): new suite 7/7; full evals battery **229 pass /
0 fail across 31 files** (the BO's unchanged-suite proof — every pre-existing
suite green with no modification); `typecheck` exit 0 on common,
packages/agent-runtime, sdk, and evals; receipts stamped below.
No diff outside the named files (step 8) — verified by `git status` at
commit time: only `common/src/types/session-state-run-usage.ts` (new),
`session-state-agent-state.ts`, `spawn-child-fields.ts`, `step.ts`,
`evals/v2/src/{runner,trace,runners/savant,cli}.ts`, and the new test file.

Remaining (tracked, not dropped): the wire stage — the `printModeEventSchema`
`usage` member, emission from `step.ts` via `onResponseChunk`, and the
host-facing `RunnerConfig.onUsage` — opens when a NAMED consumer outside the
eval harness exists. The two named operator decisions (eval billing keys;
wire-stage ratification) stay with the operator.

## Resolution

- **Closed Date:** pending operator commit (G2 authorized; lands with this
  session's batch)
- **Fix Description:** stage 1-2 of the staged design: per-run model override
  (inline clone, fail-fast, no disk mutation), run-total usage telemetry
  (`AgentState.runUsage` folded from the existing hook, summed over the
  subagent tree in `finalize()`), `TraceMetadata.usage`/`model`, CLI
  `--model`. The per-sample `onUsage` callback and print-mode `usage` event
  are deferred to the wire stage per Loop 2's staging decision (no named
  consumer yet).
- **Tests Added:** Yes — `evals/v2/tests/eval-runner-model-usage.test.ts`,
  7 pins.
- **Verification Evidence:** new suite 7/7; full evals battery 229 pass /
  0 fail (unchanged-suite proof); typecheck exit 0 on common, agent-runtime,
  sdk, evals; receipt stamped below from live gate runs.
- **Source:** `dev/build-orders/BO-2026-09-08-eval-runner-model-override-and-usage-telemetry.md`
- **Archived:** pending closure ceremony

### Code Verification Evidence

Status is `fixed` — stage 1-2 implemented and gate-verified (Loop 3). The
original absence evidence (2026-10-07) is retained below as the record of
what this FID found; the named surfaces now carry the fields Loop 3 lists.

Original RED (2026-10-07): the absence claims in this FID's Evidence section
were the verified facts (all three named surfaces confirmed to lack the
fields).

## Lessons Learned

The build order's step list and the tree disagreed about the mechanism: the
"thread `onUsage` through RunnerConfig" step assumed an SDK channel that does
not exist. Recording the deviation (and deferring the callback rather than
shipping a dead field) kept the implementation additive without inventing a
producer.