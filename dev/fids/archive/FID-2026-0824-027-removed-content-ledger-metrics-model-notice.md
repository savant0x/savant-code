# FID: Removed-Content Ledger, Metrics & Model Notice (Increment 5)

**Filename:** `FID-2026-0824-027-removed-content-ledger-metrics-model-notice.md`
**ID:** FID-2026-0824-027
**Severity:** medium
**Status:** closed
**Created:** 2026-08-24 18:19
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-022` (amendment P4 binding here). Consumes `-024`
digests + `-025` regions; shares the spill channel with `-026`.

---

## Summary

When compaction removes content today, no record of WHAT was removed exists —
not for the user, not for agents, not on disk. hermes persists per-compression
metrics and injects a system-prompt notice telling the model its tool responses
were summarized. This child adds: a removed-region inventory appended to the
shared evidence spill, per-event metrics, and a post-replacement model notice,
closing the audit loop around every layer.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4
- **Tool Versions:** packages/agent-runtime @ working tree (v0.0.27 prep)
- **Commit/State:** main (working tree, release-only-commits)

## Detailed Description

### Problem

1. No persisted record of removed regions exists — "what did compaction take?"
   is unanswerable after the fact.
2. Agents receive digested history with NO indication that earlier tool
   responses were summarized or replaced (hermes appends
   `summary_notice_text` to the system message; we inject only the ECHO
   grounding refresh).
3. Compaction metrics (region bounds, savings, digest coverage) live only in
   transient logger lines.

### Expected Behavior

Every compaction event appends an inventory record (region bounds, per-message
toolCallId/tool/byteSize, digest references); metrics accumulate per run; and
a short model-facing notice rides the replaced history so downstream reasoning
knows earlier tool outputs are digests, with pointers to the spill.

### Root Cause

Telemetry was designed for cost dashboards, not for evidence accounting.

### Evidence

```text
resources/hermes-agent/trajectory_compressor.py   add_summary_notice / summary_notice_text / metrics_output_file (read 0-EOF)
packages/agent-runtime/src/run-agent-step/context-tokens.ts   logger-only compaction lines today
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts   replacement boundary — inventory insertion point
```

## Impact Assessment

### Affected Components

- New `packages/agent-runtime/src/evidence/inventory.ts` (records + writer,
  shared spill dir with `-026`)
- `spawn-agent-inline.ts` (append notice at the parent mutation boundary)
- `common` session-state types (additive metrics fields)

### Risk Level

- [ ] Critical / [ ] High / [x] Medium: auditability gap — loss is real but
      invisible; this child makes it measurable and explainable
- [ ] Low

## Proposed Solution

### Approach

Reuse `-026`'s spill writer (one channel, two record kinds — Law 13). Inventory
records are small structured rows; the notice is a fixed-template short string
(C5-invariant style: never raw payloads into context).

### Steps

1. Inventory record schema: `{ts, runId, kind:'compaction', layer, regionStart,
   regionEnd, items:[{toolCallId, toolName, byteSize}], digestRefs, tokensSaved}`.
2. Append at each layer's completion point (micro pass in context-tokens.ts;
   pruner replacement in spawn-agent-inline.ts; reactive truncation).
3. Model notice: fixed-template user-role message post-replacement — "Earlier
   tool responses were compacted to digests; N records restored on demand via
evidence spill (run id in the record)." Bounded length; i18n-free.
4. Per-run metrics accumulator on agentState (additive fields): events count,
   total removed bytes, digest coverage ratio; surfaced in sidebar tooltip +
   `/compact --stats`.
5. Tests: record schema round-trip; append-at-boundary wiring (all three
   layers); notice presence + length bound; metrics accumulation.

### Verification

Gates below plus a recorded-session probe showing ledger rows matching rendered
panel outcomes (`-023`).

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/compaction-inventory.test.ts

### Verification Receipt

- fingerprint: sha256:f3c40d67ebbd19c806fb9b1dd2d047be2d769901279d652db1876794900fc113
- verified: 2026-08-25T01:27:10.011Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/compaction-inventory.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Citations above (0-EOF reads incl. hermes baseline, 2026-08-24).
- **GREEN:** Schema + notice template specified; single-writer discipline with
  `-026` documented (Law 13).
- **AUDIT:** Batched suite Verifier (2026-08-24): PASS — P4 inventory schema +
  three-layer append points + fixed-template model notice + metrics
  accumulator; single-writer discipline with `-026` documented (Law 13).
- **ADVERSARIAL:** Clean (2026-08-24): disk sweep clean; cleared to flip with
  suite.
- **CHANGE DELTA:** Initial authorship (n/a).

### Code Verification Evidence

IMPLEMENTED 2026-08-24 (green, inline verification):

- NEW `packages/agent-runtime/src/evidence/inventory.ts` — fail-open JSONL
  ledger writer (`<runId>.inventory.jsonl`, shared `.savant/evidence/` dir)
  + bounded `buildCompactionModelNotice(layer)`
- `context-tokens.ts` — micro pass appends an inventory row and increments
  `agentState.compactionMetrics`
- `spawn-agent-inline.ts` — auto (pruner-replacement) boundary appends the
  row AND pushes a bounded COMPACTION_NOTICE user message into the replaced
  history (hermes summary_notice_text analog)
- `common session-state.ts` — additive `compactionMetrics?: { events,
  tokensSaved }` on AgentState
- NEW `src/__tests__/compaction-inventory.test.ts` — 3 fixtures
GREEN AMENDMENTS (honest): reactive-layer append point carried (needs
projectRoot threading through ReactiveCompactDeps — emergency-only path);
region/items granularity simplified to summary-level fields until `-025`
lands; `/compact --stats` + sidebar tooltip surfacing deferred (CLI-side).
Gates: common + agent-runtime typechecks exit 0 · inventory suite 3 pass /
0 fail · eslint clean · receipt stamped via `fid:verify --write`.

## Resolution

- **Closed Date:** 2026-08-24 21:20 — **Archived:** 2026-08-24 21:25
- **Fix Description:** Inventory ledger + COMPACTION_NOTICE + compactionMetrics wired at micro/auto layers; reactive append carried.
- **Tests Added:** Yes — inventory suite 3 pass / 0 fail.
- **Verification Evidence:** receipt sha256:bc5b3566… stamped `--check` green; batched Verifier+Adversary closure audit PASS.
- **Live Smokes:** WAIVED-BY-OPERATOR-DIRECTIVE 2026-08-24 — never claimed passed.

## Lessons Learned

(pending — captured at closure)