# FID: Compaction Signal Re-Pins After Completion (Null-Epoch Retirement Failure)

**Filename:** `FID-2026-0918-004-compaction-signal-repin-retirement.md`
**ID:** FID-2026-0918-004
**Severity:** high
**Status:** verified
**Created:** 2026-09-18 17:26
**YAGNI-Compliance:** Compliant (fixes an existing broken feature; no speculative API)

---

## Summary

The post-compaction summary pins to the bottom of the chat window and never
scrolls with history. Once compaction completes, every subsequent user message
still shows the compaction summary as the last message. The root cause is the
FID-2026-0917-006 retirement scheme's use of a **nullable epoch string**: the
suppression guards require `retiredCompactionStatusEpoch !== null`, but
`compactionStatusEpochOf` returns `null` for every non-terminal phase
(`warning`/`blocked`/`compacting`/`idle`). A run that ends on a live phase
stamps a null retirement that suppresses nothing, and the stale-seed re-mirror
from `previousRunStateRef` resurrects the panel on every subsequent run
forever. A second, independent hole in `applyCompactionStatus` clears both
retirement stamps whenever any non-matching status arrives, letting a stale
re-mirror of the previous run's terminal status be accepted as fresh.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** monorepo workspaces `cli`, `packages/agent-runtime`, `common`
- **Commit/State:** `main`, 4 commits ahead of `origin/main`, working tree clean

## Detailed Description

### Problem

Operator report: "the compact triggers and then it pins to the window, it does
not operate like a regular message. Every message you send after the compact,
still shows the compact summary as the last message."

The completed-compaction summary should behave like a normal message — stay in
scroll history at its original position — and not be re-rendered below new
messages.

### Expected Behavior

Once compaction completes and the summary block is appended to the transcript,
the trailing `CompactionSignal` panel retires on the next user message and
never resurrects. A genuinely new compaction (different terminal outcome)
displays; a stale re-mirror of the previous run's outcome is suppressed.

### Root Cause

Two independent holes in the FID-2026-0917-006 retirement scheme:

1. **Null-epoch suppression failure.** `compactionStatusEpochOf`
   (`cli/src/state/chat-store/compaction-helpers.ts:90`) returns `null` for
   every phase except `compacted`/`pruned`/`ineffective`. The suppression
   guards in `sidebar-reset.ts:36-39` and `sidebar-actions.ts:79-83` require
   `retiredCompactionStatusEpoch !== null` to fire, so a null stamp suppresses
   nothing. `onNewUserMessage` (`sidebar-actions.ts:227`) stamps that null
   whenever the previous run ended on a live phase. This is the ordinary
   post-compaction regime: after a compaction that doesn't drop context back
   below the auto-compact threshold, every subsequent run ends on
   `phase: 'warning'`, which has a null epoch.

2. **Stamp-clearing on non-matching status.** `applyCompactionStatus`
   (`sidebar-reset.ts:43-45`) clears both retirement stamps whenever a
   non-matching status arrives while a retirement is active. A live `warning`
   in the new run (epoch `null` ≠ the retired epoch) clears the retirement,
   after which the stale seed re-mirror of the previous run's terminal status
   is accepted as fresh — re-pinning the panel AND double-counting
   `compactionCount` via `recordRun`.

The stale re-mirror is continuous: `createRunLifecycle`
(`send-message-lifecycle.ts`) seeds `latestRunStateSnapshot` from
`previousRunStateRef.current`, which retains the previous run's terminal
`compactionStatus`/`lastCompactionReport` indefinitely; the 2s heartbeat
(`send-message-monitors.ts`) and `adoptAndPersist` re-mirror both halves on
every run.

A secondary design gap: the main-agent micro-compact path
(`runMicroCompactPass` → `phase: 'compacted'`) never emits a `compaction_summary`
print-mode event — only the subagent pruner boundary does
(`spawn-agent-inline-pruner-outcome.ts:141`). Micro-compact outcomes therefore
have no in-stream, scrollable record and live only in the pinned panel. The
emission seam is already available as `loopParams.onResponseChunk`, typed
`(chunk: string | PrintModeEvent) => void` (`run-agent-step/types.ts:43`), so
no type widening is required.

### Evidence

```text
cli/src/state/chat-store/compaction-helpers.ts:90:export function compactionStatusEpochOf(
cli/src/state/chat-store/compaction-helpers.ts:94:  // Only terminal outcome phases carry a retired signal worth suppressing.
cli/src/state/chat-store/compaction-helpers.ts:98:    status.phase !== 'compacted' &&
cli/src/state/chat-store/sidebar-reset.ts:37:    state.retiredCompactionStatusEpoch !== null &&
cli/src/state/chat-store/sidebar-reset.ts:38:    state.retiredCompactionStatusEpoch === compactionStatusEpochOf(status)
cli/src/state/chat-store/sidebar-reset.ts:43:  if (state.retiredCompactionStatusEpoch !== null) {
cli/src/state/chat-store/sidebar-reset.ts:44:    state.retiredCompactionStatusEpoch = null
cli/src/state/chat-store/sidebar-reset.ts:45:    state.retiredCompactionReportEpoch = null
cli/src/state/chat-store/sidebar-actions.ts:80:        state.retiredCompactionReportEpoch !== null &&
cli/src/state/chat-store/sidebar-actions.ts:227:      state.retiredCompactionStatusEpoch = compactionStatusEpochOf(
cli/src/state/hooks/helpers/send-message-monitors.ts:  // 2s heartbeat mirrors compactionStatus + lastCompactionReport from snapshot
cli/src/state/hooks/helpers/send-message-lifecycle.ts:  // adoptAndPersist mirrors terminal compaction status + report
```

## Impact Assessment

### Affected Components

- `cli/src/state/chat-store/` — retirement scheme (types, initial-state,
  compaction-helpers, sidebar-reset, sidebar-actions)
- `cli/src/hooks/helpers/send-message-monitors.ts` — heartbeat re-mirror
- `cli/src/hooks/helpers/send-message-lifecycle.ts` — adoptAndPersist re-mirror
- `cli/src/components/compaction-signal.tsx` — pinned trailing panel (read-only)
- `packages/agent-runtime/src/run-agent-step/context-tokens-compaction.ts` —
  micro-compact path (Part 2 in-stream record)

### Risk Level

- [x] High: Major feature broken (compaction summary pins permanently after
  every compaction in the common over-threshold regime), no workaround

## Proposed Solution

### Approach

Replace the nullable-epoch retirement with an **explicit active flag plus the
retired values themselves**, so suppression is an equality test that works for
every phase, not a null-guarded epoch match:

- Add `compactionSignalRetired: boolean`, `retiredCompactionStatus:
  CompactionStatus | null`, `retiredCompactionReport: LastCompactionReport |
  null` to the store.
- `onNewUserMessage` sets the flag and captures the outgoing values.
- Suppression: drop an incoming status/report when a retirement is active and
  it equals the retired value (`sameCompactionStatus` / a new
  `sameCompactionReport`). Equality covers every phase including the live ones.
- End the retirement **only** on a genuinely new terminal outcome
  (`compactionStatusEpochOf(status) !== null` AND differs from the retired
  status's epoch). A live phase that differs from the retired value updates the
  status (the current run's live state must display) but does NOT end the
  retirement, so the stale seed can never resurrect after a live-phase update.

Part 2: emit a dedupe-guarded `compaction_summary` print-mode event from
`runMicroCompactPass` when `microResult.tokensSaved > 0`, so micro-compact
outcomes land a permanent in-stream `CompactionSummaryBlock` instead of living
only in the pinned panel. Dedupe mirrors `emitCompactionStatus`'s
`lastEmittedCompactionStatus` WeakMap pattern.

### Steps

1. Add the three retirement fields to store types + initial state; remove the
   two epoch fields.
2. Add `sameCompactionReport` to `compaction-helpers.ts`; rewrite the epoch
   helpers' docblocks to reflect the new scheme.
3. Rewrite `applyCompactionStatus` suppression + stamp-clearing logic.
4. Rewrite `setLastCompactionReport` suppression.
5. Rewrite `onNewUserMessage` stamping; update both reset paths.
6. Emit `compaction_summary` from `runMicroCompactPass` with a WeakMap dedupe.
7. Update `chat-store-compaction.test.ts` for the new field names; add
   regression tests for the live-phase re-pin hole and the stamp-clearing hole.
8. Verify with typecheck + tests + lint.

### Verification

- `chat-store-compaction.test.ts` covers: live-phase retirement survives a
  stale re-mirror; a live phase does not end a retirement; a new terminal
  outcome ends it and displays; a retired report is suppressed.
- New runtime test: micro-compact with `tokensSaved > 0` emits exactly one
  `compaction_summary`.
- Typecheck `cli`, `packages/agent-runtime`, `common`; eslint --max-warnings 0.

## Verification Gates

- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: test cli/src/state/__tests__/chat-store-compaction.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED → GREEN

- **RED:** Null-epoch retirement suppression failure + stamp-clearing hole
  cataloged with file:line evidence across cli and agent-runtime.
- **GREEN:** Implemented Parts 1 + 2 (see Resolution). Inline verification green:
  typecheck cli ✓, typecheck packages/agent-runtime ✓, typecheck common ✓,
  eslint --max-warnings 0 ✓, prettier --check ✓,
  chat-store-compaction.test.ts 18/18 ✓, agent-runtime step+compactor 79/79 ✓.
  Law 4 call-graph: `runMicroCompactPass` ← `context-tokens.ts:204`
  (`prepareStepContext`) ← `loop-iteration.ts:107` (production step loop) ✓.
- **AUDIT:** Verifier returned zero confirmed FAILs; three NEEDS-REVIEW items
  that it could not confirm without disk access. All three resolved by the
  Orchestrator with disk evidence: (1) zero remaining references to the removed
  epoch fields — `grep -rn` across cli/packages/common/desktop/agents/sdk/
  scripts/evals returned exit 1 (0 matches); (2) post-prettier on-disk content
  re-read and confirmed correct; (3) the `setLastCompactionReport` deferral was
  analyzed and confirmed CORRECT, not a bug (see Missed Question 4).
- **ADVERSARIAL:** Confirmed all PASSes stand. Confirmed the three Orchestrator
  resolutions. Found two real findings, both fixed in self-correct:
  - **OMISSION** — the FID's own Verification section promised a runtime test
    for the Part 2 micro-compact emission; it had not been written. Fixed:
    `context-tokens-compaction-micro-summary.test.ts` added (4 tests:
    emission contract, WeakMap dedupe across step boundaries, subagent
    `parentId` gate, no-op silence).
  - **ADJUSTED (low)** — the armed-window live-phase branch in
    `applyCompactionStatus` early-returned, which skipped `recordRun` and
    silently swallowed the `compacting → warning` ineffective-pruner
    lifecycle event + count. Fixed: the branch now records the live status and
    falls through to the shared `recordRun` derivation while keeping the
    retirement armed.
- **SELF-CORRECT:** Both findings fixed; re-verified inline.
- **CHANGE DELTA:** ~150 lines of production + test code across 8 files.

### Missed Questions

1. Should the retirement persist across a chat switch? → Yes: the retirement
   is session-scoped state and `resetSidebarSlice` already zeroes compaction
   fields, so a chat switch naturally clears it.
2. Can `sameCompactionStatus` alone suppress a terminal re-mirror? → Yes for
   identical values; the epoch comparison is still needed to distinguish a
   genuinely new terminal outcome from a stale one when values differ but the
   outcome is new. Equality handles suppression; epoch handles retirement
   termination.
3. Does the micro-compact `compaction_summary` event double-emit with the
   pruner path? → No: they are distinct compaction layers with distinct
   content; the CLI assigns distinct block ids via `compactionSummarySeq`.
4. Does `setLastCompactionReport`'s armed-window deferral risk losing a report
   forever? → No. Both re-mirror sites (`adoptAndPersist` and the heartbeat)
   mirror status BEFORE report, so a genuine terminal outcome disarms the
   retirement before the report mirror re-delivers. The only lossy case — a
   genuine new compaction whose `{phase, percentUsed, tokensSaved}` triple
   exactly collides with the retired triple — loses only the pinned-panel
   excerpt, not the permanent in-stream record, which is created by the separate
   `compaction_summary` print-mode event (`handleCompactionSummary`) that never
   touches `setLastCompactionReport`. The Verifier's suggested alternative
   (store-on-mismatch) would reintroduce the pinning bug.

## Resolution

- **Closed Date:** 2026-09-18 19:34 (post-adversarial self-correct)
- **Fix Description:** Part 1 — replaced the nullable-epoch retirement with an
  explicit active flag + captured retired values. Store now carries
  `compactionSignalRetired: boolean`, `retiredCompactionStatus`,
  `retiredCompactionReport` (types.ts, initial-state.ts). `onNewUserMessage`
  arms the retirement and captures the outgoing values before clearing them
  (sidebar-actions.ts). `applyCompactionStatus` (sidebar-reset.ts) now: drops an
  exact-value re-mirror; records a live phase (warning/blocked/compacting/idle)
  as the current status WITHOUT ending the retirement; ends the retirement only
  on a genuinely new terminal outcome. `setLastCompactionReport` defers any
  report while armed (lossless: the next mirror re-delivers once a terminal
  status ends the retirement). Both reset paths clear the three fields.
  `compaction-helpers.ts` gains `sameCompactionReport`; `compactionStatusEpochOf`
  is retained as the terminal-outcome predicate that decides retirement
  termination. Part 2 — `runMicroCompactPass` emits a dedupe-guarded
  `compaction_summary` print-mode event (WeakMap keyed by agentState) when
  `tokensSaved > 0` and the agent has no parent, so micro-compact outcomes land
  a permanent in-stream `CompactionSummaryBlock` instead of living only in the
  pinned panel.
- **Tests Added:** 2 regression tests in `chat-store-compaction.test.ts`
  (`a live phase in the next run does NOT end the retirement (live-phase hole)`,
  `a report arriving while armed is deferred, not stored (report-lateness
  hole)`; existing epoch-field assertions migrated to the new field names), plus
  4 runtime tests in the new `context-tokens-compaction-micro-summary.test.ts`
  covering the Part 2 emission contract, the WeakMap dedupe across consecutive
  step boundaries, the subagent `parentId` suppression gate, and no-op silence.
- **Verification Evidence:** typecheck cli ✓, typecheck agent-runtime ✓,
  typecheck common ✓, eslint --max-warnings 0 ✓ (post-autofix of one
  `import/order` warning), prettier --check ✓ (all 8 changed files),
  chat-store-compaction 18/18 ✓ (60 expect calls, incl. the 6 FID-2026-0918-004
  retirement tests), agent-runtime run-agent-step + compactor suites 83/83 ✓
  (192 expect calls, incl. the 4 new emission tests). Law 4 call-graph
  reachability ✓.
- **Archived:** 2026-09-18 19:34 → dev/fids/archive/

## Lessons Learned

A suppression scheme keyed on a value that can be legitimately `null` cannot
distinguish "no suppression active" from "suppression active with no stable
identity." Prefer an explicit active flag plus captured values so suppression
is an equality test over the full domain.