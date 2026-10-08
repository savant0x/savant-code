# FID: Eval-runner model override + per-run usage telemetry

**Filename:** `FID-2026-1007-013-eval-runner-model-override-and-usage-telemetry.md`
**ID:** FID-2026-1007-013
**Severity:** low
**Status:** created
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

None — `created` status; gates declared at implementation time.

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

## Resolution

- **Closed Date:** pending
- **Fix Description:** pending
- **Tests Added:** pending
- **Verification Evidence:** pending
- **Source:** `dev/build-orders/BO-2026-09-08-eval-runner-model-override-and-usage-telemetry.md`
- **Archived:** pending

### Code Verification Evidence

Status is `created` — no implementation exists, so there is nothing to verify
against. The absence claims in this FID's Evidence section are the verified
facts (measured 2026-10-07, all three named surfaces confirmed to lack the
fields), reproduced here so a future session re-measures rather than trusts.

## Lessons Learned

Pending implementation.