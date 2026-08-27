# FID: Minimal-Surgery Compaction Algorithm — hermes Disciplines Online (Increment 3)

**Filename:** `FID-2026-0824-025-compaction-minimal-surgery-algorithm.md`
**ID:** FID-2026-0824-025
**Severity:** medium
**Status:** closed
**Created:** 2026-08-24 18:16
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-022` (amendment P2 binding here). Builds on `-024`
digests.

---

## Summary

Today's auto-compact sweeps the ENTIRE history every time it fires; nothing is
protected and nothing is spared. hermes' trajectory compressor demonstrates the
discipline we skipped: protect head turns (system/first-human/first-gpt/
first-tool) plus last-N tail, compress ONLY as much as needed to get under the
trigger, keep the remainder verbatim, and never split a tool_call/tool_response
pair at a region boundary. This child ports those disciplines onto the online
pruner path.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4
- **Tool Versions:** agents/context-pruner/* @ working tree (v0.0.27 prep)
- **Commit/State:** main (working tree, release-only-commits)

## Detailed Description

### Problem

`runContextPrunerMain` summarizes all messages except the live user prompt.
Consequences: (1) early context (original task framing, first tool outputs)
gets digested away even when there is token headroom to keep it verbatim;
(2) compression is all-or-nothing, so digest caps must be aggressive enough
for the worst case rather than sized to actual need.

### Expected Behavior

Compaction removes the MINIMUM region that brings context under the trigger:
protected head + protected tail stay verbatim; only the accumulated middle
region between them is replaced by the `-024` digest-backed summary; boundaries
snap so no pair splits.

### Root Cause

The pruner was built as a summarizer, not as a surgeon — no budgeting pass
existed to compute "how much is enough."

### Evidence

```text
resources/hermes-agent/trajectory_compressor.py   _find_protected_indices / accumulate-until-target / _snap_boundary (read 0-EOF 2026-08-24)
agents/context-pruner/main.ts                      full-sweep entry (no protect/budget pass)
packages/agent-runtime/src/context-compactor/reactive-compact.ts   Layer 4 keeps first+20% tail — precedent exists in-tree for reactive, absent for proactive
```

## Impact Assessment

### Affected Components

- `agents/context-pruner/*` (new budget module wired into main flow)
- `agents/context-pruner/constants.ts` (protect counts, tail N)
- Consumed by `-027` (removed-region inventory = exactly this region)

### Risk Level

- [ ] Critical / [ ] High / [x] Medium: unnecessary evidence destruction even
      when headroom exists; wrong-region removal could orphan live references
      without boundary snapping
- [ ] Low

## Proposed Solution

### Approach

Pure planning function: given messages + per-message token counts + trigger,
emit `{protectedStart, regionStart, regionEnd}` — then existing machinery
summarizes ONLY that region. No new LLM calls; deterministic and testable.

### Steps

1. Protect set: first system message, first user, first assistant, first tool
   result, last N turns (N=4 default, config under `compression.budget:`).
2. Accumulate-from-region-start until savings target met (trigger − current +
   summary allowance); if never met, fall back to full-region (today's
   behavior) — degradation, not failure.
3. Pair snapping: walk boundaries forward/backward so region edges never land
   between an assistant tool-call and its tool result (Message[] pairing via
   toolCallId).
4. Wire into pruner main before summarize; emit chosen region into telemetry
   (`-027` consumes).
5. Tests: fuzzed histories assert zero split pairs; minimal-region property
   (region ≤ full sweep when trigger reachable); protect-set fixtures;
   fallback path; boundary clamp cases from hermes' suite mirrored.

### Verification

Gates below plus property-based mini-fuzz (seeded, deterministic CI).

## Verification Gates

- gate: typecheck agents
- gate: test agents/context-pruner/__tests__/compaction-budget.test.ts

### Verification Receipt

- fingerprint: sha256:ebd28095f9ba98970822dde7b4de2faa7f6dfecce985b63707b30205032d0640
- verified: 2026-08-25T01:26:38.314Z
- typecheck agents: exit 0
- test agents/context-pruner/__tests__/compaction-budget.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Citations above (hermes read 0-EOF; our files read 0-EOF,
  2026-08-24).
- **GREEN:** Algorithm specified; constants owned with `-024`; region output
  shaped for `-027`.
- **AUDIT:** Batched suite Verifier (2026-08-24): PASS — P2 disciplines ported
  (protect set N=4, accumulate-until-target, pair snapping via toolCallId,
  full-region degradation fallback); fuzz + property tests declared.
- **ADVERSARIAL:** Clean (2026-08-24): disk sweep clean; cleared to flip with
  suite.
- **CHANGE DELTA:** Initial authorship (n/a).

### Code Verification Evidence

LANDING AMENDMENT + IMPLEMENTED 2026-08-24 (green, inline verification):
Deep-dive of `summary-assembly.ts` + `fold-exchange.ts` revealed that
`runFoldOldestExchange` ALREADY implements minimal surgery per-exchange:
user-delimited exchanges make pair-splitting structurally impossible (the
hermes `_snap_boundary` concern dissolves), and everything outside the folded
exchange survives verbatim. The landed design therefore composes that proven
machinery instead of adding a parallel region planner:

- NEW `agents/context-pruner/budget.ts` — embeddable pure core:
  `segmentExchanges` (user-delimited regions), `tokensForRange`
  (shape-agnostic JSON estimator), `planFoldsToReachTarget`
  (accumulate-until-target with protected head/tail clamps + allowance)
- `constants.ts` — COMPACTION_PROTECTED_TAIL_TURNS = 4,
  COMPACTION_SUMMARY_ALLOWANCE_TOKENS = 2_000 (baked into factory constants)
- `main.ts` — pre-sweep minimal-surgery pass: plan → iterate
  `runFoldOldestExchange` folds oldest-first → adopt partial folds into
  `currentMessages`; yield-and-return when recounted ≤ window; otherwise fall
  through to the full sweep (Step-2 fallback preserved)
- `handle-steps.ts` — three budget functions embedded via `.toString()`
- NEW `__tests__/compaction-budget.test.ts` — segmentation/planner units +
  seeded 200-iteration fuzz (pair integrity across seams, contiguity, clamp
  bounds, projected-formula recompute)
GREEN AMENDMENT (honest): Step-1's per-message protect set and Step-3's
walk-based snapping are satisfied STRUCTURALLY (user-delimited exchanges);
Step-4's region→telemetry handoff to `-027` is summary-level (layer rows,
not per-region indices) until `-027` extends its schema.
Gates: agents typecheck exit 0 · pruner suites 43 pass / 0 fail (incl. new
planner units + fuzz) · eslint clean · receipt stamped via `fid:verify --write`.

## Resolution

- **Closed Date:** 2026-08-24 21:20 — **Archived:** 2026-08-24 21:25
- **Fix Description:** Minimal surgery — fold-until-target planner composed
  with runFoldOldestExchange; full-sweep fallback preserved; protected head/tail.
- **Tests Added:** Yes — pruner suites 43 pass / 0 fail incl. seeded fuzz.
- **Verification Evidence:** receipt sha256:cce77973… stamped `--check` green;
  batched Verifier+Adversary closure audit PASS.
- **Live Smokes:** WAIVED-BY-OPERATOR-DIRECTIVE 2026-08-24 — never claimed passed.

## Lessons Learned

(pending — captured at closure)