# FID: Sidebar context readout stalls near zero in the small-count regime

**Filename:** `FID-2026-0827-001-sidebar-context-readout-damping-small-count-stall.md`
**ID:** FID-2026-0827-001
**Severity:** medium
**Status:** closed
**Created:** 2026-08-27 19:25
**YAGNI-Compliance:** Verified

---

## Summary

The sidebar's `Tokens used/max` readout appeared stuck at `0/x` during live use
(operator-reported 2026-08-27). Root cause: the display-only token damper
(`dampTokenCount`, introduced by FID-2026-0821-003-A in commit `f929c903`)
applies a relative deadband (±5%) and a bounded 12% ramp against the
**currently displayed** value. At the small end of a large context window (e.g.
a real count of a few thousand tokens against a 1M window) this pins the
readout near zero: growth is capped at 12% of a tiny number per heartbeat and
sub-5% relative changes are suppressed entirely, so the meter reads ~0 for a
long stretch. Fix: a small-count floor — any count at or below the floor is
adopted outright (exact truth), and any transition out of zero is adopted
outright, so the meter tracks reality until the count is large enough that
relative damping is safe.

## Environment

- **OS:** Windows (win32, Git Bash)
- **Language/Runtime:** TypeScript `strict: true`, Bun 1.3.14
- **Tool Versions:** tsc `--noEmit`, bun test v1.3.14
- **Commit/State:** working tree on `main` (ahead of origin), 2 files modified

## Detailed Description

### Problem

During a live session the sidebar `Context` readout showed `0/x`
(`tokensUsed = 0`) while the denominator (`tokensMax`) had correctly resolved
to the model's real context window (~1M tokens). The operator reported the
meter never advanced.

### Expected Behavior

The used-token readout should track the runtime's `contextTokenCount`
truthfully: rise as soon as the first real count lands, and never sit pinned
near zero when the true count is nonzero.

### Root Cause

The display damper introduced for FID-2026-0821-003-A:

```ts
export function dampTokenCount(current, incoming) {
  if (current <= 0) return incoming
  const delta = incoming - current
  const rel = Math.abs(delta) / current
  if (rel <= 0.05) return current        // deadband: suppress ±5% jitter
  const maxStep = Math.max(Math.floor(current * 0.12), 1)  // ≤12% ramp
  ...
}
```

Both knobs are **relative to the currently displayed value**, not the window.
With a 1M window, a real early-session count of ~5k tokens means the displayed
value can only move by `0.12 × current` per 2 s heartbeat — from a small
`current` (e.g. a few hundred) that is a gain of tens of tokens per tick, and
any sub-5% relative change is a no-op. The readout therefore reads ~0 for a
long stretch. The damper was designed and tested against large normalized
counts (100k-scale test fixtures); it degrades exactly where the operator is
sitting: the small end of a large window.

### Evidence

Operator report (live session, 2026-08-27): "context seems stuck at 0/x" —
with `tokensMax` resolved to the real 1M window. The display chain is:

```text
heartbeat (2s) → snap.sessionState.mainAgentState.contextTokenCount
  → updateContextTokens(used) → dampTokenCount → state.contextTokensUsed
  → right-sidebar-sections.tsx (Tokens used/max)
```

`cli/src/state/chat-store/compaction-helpers.ts` (`dampTokenCount`,
`CONTEXT_TOKEN_DEADBAND_RATIO = 0.05`, `CONTEXT_TOKEN_MAX_STEP_RATIO = 0.12`).
Pre-fix behavior reproduced by inspection:

```text
dampTokenCount(50, 5000)   → 56    (12% of 50 = +6/tick; ~14 s to 5000)
dampTokenCount(1000, 5000) → 1120  (12% of 1000 = +120/tick)
```

## Impact Assessment

### Affected Components

- `cli/src/state/chat-store/compaction-helpers.ts` — `dampTokenCount` + new `CONTEXT_TOKEN_SMALL_COUNT_FLOOR`
- `cli/src/state/__tests__/chat-store-noop-guards.test.ts` — regression cases

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

(Display-only degradation; the pruner still consumes the raw count. Workaround:
ignore the readout early in a session.)

## Proposed Solution

### Approach

Add a small-count floor to the damper. In the small regime the damper's
jitter-suppression value is zero and its correctness cost is real, so adopt the
incoming count exactly; keep the deadband/ramp only where relative damping is
safe (counts above the floor).

### Steps

1. Add `CONTEXT_TOKEN_SMALL_COUNT_FLOOR = 10_000` (exported constant).
2. In `dampTokenCount`, return `incoming` outright when `current <= 0` **or**
   `incoming <= CONTEXT_TOKEN_SMALL_COUNT_FLOOR`.
3. Add two regression tests: small-count exact adoption (large window
   non-stall) and below-the-floor replacement from a mid count.
4. Run cli typecheck + the noop-guards suite.

### Verification

- `bun run --cwd=cli typecheck` — exit 0
- `bun test cli/src/state/__tests__/chat-store-noop-guards.test.ts` — 12 pass / 0 fail (2 new cases)
- Live visual confirmation of the sidebar readout is the operator's boundary
  (the fix is display-damping calculus; automated gates prove the formula
  change, the live meter is exercised at the operator's next session).

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/state/__tests__/chat-store-noop-guards.test.ts

### Verification Receipt

- fingerprint: sha256:722551a1a34cb9852ec82a09d3f209d5022822ea33e7a81f9d4332d4a554f6c6
- verified: 2026-08-28T00:17:31.494Z
- typecheck cli: exit 0
- test cli/src/state/__tests__/chat-store-noop-guards.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** `dampTokenCount` relative deadband/ramp pins the readout near zero
  for small counts against a large window (`compaction-helpers.ts`, pre-fix
  behavior reproduced by inspection; operator live report "stuck at 0/x").
- **GREEN:** small-count floor — adopt any `incoming <= 10_000` and any
  transition out of `current <= 0` exactly; 2 regression tests added.
- **AUDIT:** cli typecheck exit 0; noop-guards suite 12/0 (2 new cases pass).
- **ADVERSARIAL:** two prior FID citations checked against the ledger — the
  original code comment cited `FID-2026-0824-030`, which is the robot-cast
  record (collision); corrected to this FID. Damping intent for mid/high
  counts (deadband + 12% ramp) preserved unchanged.
- **CHANGE DELTA:** <10% (32 insertions across 2 files + FID).

### Missed Questions

1. **Should `current <= 0` also handle a negative incoming?** → Yes by the
   same branch; `incoming <= floor` covers negatives too, and the sidebar never
   receives negatives from the runtime.
2. **Does the floor break the deadband's purpose (sub-5% jitter suppression)?**
   → Only below 10k tokens, where jitter is negligible against cost; the
   estimated/truth source flip at 100k scale still renders as the bounded ramp
   (existing tests unchanged and green).
3. **Why 10k?** → An order-of-magnitude cross-over: at 10k the 12% ramp moves
   ~1.2k/tick, which is visually responsive; below that the ramp moves <1.2k/tick
   and stalls perceptibly against 1M windows.

### Implementation Evidence (REQUIRED for `closed`)

> Closed 2026-08-27 by operator directive (archive request via the archive
> workflow). The live visual-meter boundary is **operator-confirmed 2026-08-27**:
> after restarting the CLI the sidebar readout tracked correctly instead of
> sitting at `0/x`, satisfying the one remaining human checkpoint. Implementation
> evidence below remains the ground truth.

- [x] **Commit SHA:** working tree (uncommitted); commit lands with the next
  atomic commit per ECHO workflow.
- [x] **File:line ranges:** `cli/src/state/chat-store/compaction-helpers.ts` —
  `CONTEXT_TOKEN_SMALL_COUNT_FLOOR` const + `dampTokenCount` guard;
  `cli/src/state/__tests__/chat-store-noop-guards.test.ts` — 2 new tests in the
  `dampTokenCount (FID-2026-0821-003-A)` block.
- [x] **Gate output:** See Verification Receipt + pasted test output below.
- [x] **Reproducibility:** `grep -n CONTEXT_TOKEN_SMALL_COUNT_FLOOR
  cli/src/state/chat-store/compaction-helpers.ts` matches.
- [x] **Step statuses:** Steps 1–3 `implemented`; Step 4 `implemented`
  (gates below). Live visual confirmation = operator boundary, recorded, not
  deferred.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present for new or repaired wiring —
  N/A (formula change inside an existing, already-wired helper; no new wiring)
- [x] FID status reflects the actual implementation state

```text
$ bun test src/state/__tests__/chat-store-noop-guards.test.ts   (cwd: cli)
 12 pass
 0 fail
 15 expect() calls
Ran 12 tests across 1 file. [527.00ms]

$ bun run typecheck                                          (cwd: cli)
$ tsc --noEmit -p .                                           (exit 0)
```

### Loop 2 — Independent audit and self-correction

- **RED:** none outstanding at write time.
- **GREEN:** n/a.
- **AUDIT:** Verifier review of the 2-file diff + FID. **Verdict: PASS** (2026-08-27
  19:33) — 4/4 criteria met with evidence: (1) `dampTokenCount` small-count
  guard correctly fixes the reported stall (pre-fix `dampTokenCount(1000, 5000)`
  returned 1120 via `maxStep = 120`; now adopted exactly) while preserving the
  `current <= 0` first-update branch and the >10k deadband/ramp path;
  (2) both new tests are true regression tests (fail on pre-fix code), match
  the existing describe-block pattern, and reference the exported constant
  rather than a magic number; (3) gate outputs in the receipt match the last
  full-surface run exactly (prettier/eslint/markdownlint exit 0, 12 pass /
  0 fail / 15 expect calls, cli typecheck exit 0); (4) FID metadata
  (verified / medium / gates list) consistent. Two cosmetic observations
  recorded, no action required: counts hovering exactly at the 10k boundary
  alternate exact-adopt vs damped behavior, and a small-current → large-incoming
  jump above the floor converges via the ~12%/tick ramp (~60 s at 2 s
  heartbeats). Call-graph reachability confirmed — `dampTokenCount` still
  invoked from `sidebar-actions.ts:38`, the new constant is consumed within the
  same module.
- **ADVERSARIAL:** receipt re-fingerprinted if any AUDIT edit changed the
  document; ledger collision check on `FID-2026-0827-001` (unused, confirmed).
- **CHANGE DELTA:** 0 (no post-verification edits).

### Loop 3 — Final convergence

- **RED:** residual risk is a display-staleness nuance at exactly the floor
  boundary (10.0k–10.15k sub-deadband), bounded by design.
- **GREEN:** none required.
- **AUDIT:** gates re-run green at closure.
- **ADVERSARIAL:** overrides none.
- **CHANGE DELTA:** 0.

## Resolution

- **Closed Date:** 2026-08-27 (operator-directed archive)
- **Live Confirmation:** operator-confirmed 2026-08-27 — sidebar `Tokens used/max`
  tracked correctly after a CLI restart, resolving the final visual-meter boundary.
- **Fix Description:** `dampTokenCount` now adopts any count ≤ 10k exactly and
  adopts any transition out of zero, so a large-window session's small
  early-session count reaches the sidebar immediately instead of ramping
  imperceptibly from ~0.
- **Tests Added:** Yes — 2 regression cases (small-count exact adoption;
  below-floor replacement).
- **Verification Evidence:** cli typecheck exit 0; suite 12/0 (pasted above).
- **Archived:** 2026-08-27 (moved to `dev/fids/archive/`)

## Lessons Learned

Display-damping formulas designed against normalized percentage tests can
misbehave at the small end of real workloads. When a "percent-free" UI reads
near zero for a long stretch, check the damper's anchor (relative-to-current vs
relative-to-window) before blaming the data source. Keep a floor below which
truth wins over smoothness.