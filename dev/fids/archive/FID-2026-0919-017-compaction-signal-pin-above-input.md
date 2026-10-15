# FID: CompactionSignal Pins Above Input After Compact

**Filename:** `FID-2026-0919-017-compaction-signal-pin-above-input.md`
**ID:** FID-2026-0919-017
**Severity:** high
**Status:** closed
**Created:** 2026-09-19 01:05
**YAGNI-Compliance:** Confirmed (Loop 3 — two determinism fixes in existing
modules + two missing sidebar labels; no new state, no new components.)

---

## Summary

`CompactionSignal` is the last child of the chat scrollbox. After a
compaction it paints a TrafficLightPanel that is not a message, so later
turns render *above* it and the panel only clears on harness restart.
FID-2026-0918-004 retired the terminal status; live `warning` and a
`percentUsed`-sensitive matcher still re-pin the same slot.

## Environment

- **OS:** all (TUI)
- **Language/Runtime:** TypeScript / Bun
- **Commit/State:** uncommitted 0918-004 tree, 2026-09-19

## Detailed Description

### Problem

Operator: compact summary pins above the input; later messages go above
it; restart is the only clear.

### Expected Behavior

In-flight `compacting` may occupy the trailing slot. Terminal outcomes
live in `CompactionSummaryBlock` (a real message). `warning`/`blocked`
live in the sidebar Context row. Later messages append below the
summary, above the input.

### Root Cause

1. Layout: `cli/src/chat/panels.tsx` mounts `<CompactionSignal />` after
   `visibleTopLevelMessages` inside `stickyStart="bottom"` scrollbox.
2. Paint: `compaction-signal.tsx` renders warning/blocked/compacted and
   last `compactionEvents` entry as a full panel.
3. Retirement hole: `applyCompactionStatus` drops a retired remirror via
   `sameCompactionStatus` (includes drifting `percentUsed`). Epoch helper
   is percent-blind; a 62→64 remirror ends retirement and re-pins.

### Evidence

```text
panels.tsx:149              CompactionSignal after the message map (verified)
compaction-signal.tsx:40-41 warning/blocked/compacted/events all paint (verified)
sidebar-reset.ts:36         sameCompactionStatus drop includes percentUsed (verified)
compaction-helpers.ts:84-95 epoch = phase:tokensSaved — percent-blind (verified)
```

## Impact Assessment

### Affected Components

- `cli/src/components/compaction-signal.tsx`
- `cli/src/state/chat-store/sidebar-reset.ts`
- `cli/src/components/right-sidebar-format.ts` (NEW scope — see Loop 2)
- `cli/src/chat/panels.tsx` (comment only)
- signal + retirement + format tests

### Risk Level

- [x] High: transcript order broken until restart; workaround = restart

## Proposed Solution

### Approach

Scrollbox slot is in-flight only. Retirement identity is the epoch
helper (phase + tokensSaved), not `sameCompactionStatus`. Sidebar still
receives live phases.

### Loop 2 amendments (grounding audit, 2026-09-19)

- **A1 — gate paths:** the signal test exists as
  `compaction-signal.test.tsx` (the Verification section declared
  `.test.ts`, missing the `x`). Paths corrected; FID-006 contract
  sweep would have failed the stamp.
- **A2 — orphaned outcomes:** `formatCompactionStatus`
  (`right-sidebar-format.ts`) has NO case for `blocked` or
  `ineffective` — both label as `idle`. Once the signal stops painting
  them (step 1), those outcomes would go dark AND the sidebar would
  lie. Formatter gains both cases + a new test file.

### Steps

1. `CompactionSignal` returns null unless `phase === 'compacting'`.
2. Retirement drop: epoch equality; new distinct terminal disarms.
3. Formatter: `blocked` → `⛔ blocked (reason)`, `ineffective` →
   `⚠ pruner ineffective` (+ band).
4. Comment `panels.tsx` slot as in-flight-only; invert signal tests;
   add percent-drift remirror pin + format tests.

### Verification

Named tests + typecheck. Contract (FID-2026-0918-006) — every promised
artifact maps to a declared gate:

- `cli/src/components/__tests__/compaction-signal.test.tsx`
- `cli/src/state/__tests__/chat-store-compaction-retirement.test.ts`
- `cli/src/components/__tests__/right-sidebar-format.test.ts`

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/__tests__/compaction-signal.test.tsx
- gate: test cli/src/state/__tests__/chat-store-compaction-retirement.test.ts
- gate: test cli/src/components/__tests__/right-sidebar-format.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b1ec125e2ef979b25dd5dbf10776eca5eba1b38f6c9d94db12623456208a03ce
- verified: 2026-09-19T05:49:29.918Z
- typecheck cli: exit 0
- test cli/src/components/__tests__/compaction-signal.test.tsx: exit 0
- test cli/src/state/__tests__/chat-store-compaction-retirement.test.ts: exit 0
- test cli/src/components/__tests__/right-sidebar-format.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** layout pin + warning re-paint + percentUsed matcher
- **GREEN:** compacting-only signal; epoch retirement drop
- **AUDIT (2026-09-19, real gate runs — see Verification Receipt):**
  typecheck cli 0; signal suite 9/0 (inverted contract + in-flight-only
  pins); retirement suite 10/0 (incl. the new percent-drift pin);
  format suite 6/0 (new A2 cases); quality PASS; eslint 0 warnings;
  lint:md 0; prettier --check clean. Method 2 re-read confirmed the
  four steps against the converged spec.
- **ADVERSARIAL (self, single-agent):** (a) mid-edit defect caught —
  the first signal rewrite dropped the `LastCompactionReport` type
  import still needed by the retained `CompactionReportExcerpt` export;
  restored before gates. (b) null-retired-half hole in the identity
  drop caught during self-review (a retired live phase would have made
  `null === null` swallow new live warnings) — guarded by requiring
  `epoch(retired) !== null`. (c) test-expectation drift caught at gate
  time (band 80–95 is orange, not red) — fixed in tests, not hidden.
- **CHANGE DELTA:** n/a (create)

### Missed Questions

1. Hide `blocked` from the slot? Yes — sidebar labels it (after A2).
2. Keep `CompactionReportExcerpt`? Yes, exported; signal no longer
   mounts it (terminal record is `CompactionSummaryBlock`).
3. *(Loop 2)* Can the drop guard see a null retired half?
   `onNewUserMessage` captures `state.compactionStatus` verbatim, which
   may be null — the guard requires `epoch(retired) !== null`, so a
   null/live retired half can never swallow a new status; anything else
   falls through to the shared FSM. No new hole.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** 20fe3180 (+ cf3bebf2 follow-up carrying the
      inverted suite omitted from the first commit; operator-authorized
      2026-09-19)
- [x] **File:line ranges:** `compaction-signal.tsx:36-58` (compacting
      gate + chrome); `sidebar-reset.ts:35-54` (identity drop);
      `right-sidebar-format.ts:66-79` (blocked/ineffective cases);
      `panels.tsx:146-156` (in-flight-only slot comment)
- [x] **Gate output:** Verification Receipt above (5/5, real runs,
      `fid:verify --write` + `--check` PASS, fingerprint match)
- [x] **Reproducibility:** `bun run fid:verify
      dev/fids/FID-2026-0919-017-compaction-signal-pin-above-input.md
      --check`
- [x] **Step statuses:** 1 implemented · 2 implemented · 3 implemented
      · 4 implemented — zero blocked/deferred/skipped

## Resolution

- **Closed Date:** 2026-09-19 (commit 20fe3180)
- **Fix Description:** in-flight-only scrollbox slot; outcome-identity
      retirement drop; no-orphaned-outcome sidebar labels
- **Tests Added:** signal suite inverted (9 tests, 5 new in-flight-only
      pins); retirement +2 (percent-drift remirror, drifted-live guard);
      new format suite (6 tests incl. blocked/ineffective)
- **Verification Evidence:** receipt 5/5 via `--write`; `--check` PASS
      (fingerprint sha256:b1ec125e…); eslint 0; lint:md 0; quality PASS
- **Archived:** 2026-09-19 — moved to `dev/fids/archive/`

## Lessons Learned

A trailing non-message child of a sticky-bottom scrollbox is a fake last
message. Status that must survive in the sidebar must not share that
slot. Retirement identity must ignore fields that drift every step.
