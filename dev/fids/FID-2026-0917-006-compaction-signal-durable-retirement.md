# FID-2026-0917-006 — Compaction Signal Durable Retirement

## Metadata

- **Filename:** `FID-2026-0917-006-compaction-signal-durable-retirement.md`
- **ID:** FID-2026-0917-006
- **Severity:** high
- **Status:** fixed
- **Created:** 2026-09-17

## Problem

FID-2026-0916-008 made the in-stream `CompactionSignal` panel retire on the
next user message by clearing `compactionStatus`, `compactionEvents`, and
`lastCompactionReport` in `onNewUserMessage`. The operator reports the panel
**still pins** after compaction, and the running CLI (PID 39136, started
20:57 — after the fix landed at 13:40) confirms the fix is live but the
symptom persists.

### Root cause — the retirement is defeated by the run-end mirror

`onNewUserMessage` fires pre-run from `send-message-prepare.ts:165`, correctly
zeroing all three fields. But **two mirror sites unconditionally re-hydrate
them from the runtime session state during/after the same run**:

- `send-message-monitors.ts:90` — the 2s heartbeat re-mirrors
  `mainAgentState.compactionStatus` on every poll.
- `send-message-lifecycle.ts:218-223` — `adoptAndPersist` re-mirrors both the
  terminal `compactionStatus` and `lastCompactionReport` at run end.

The runtime's `mainAgentState.compactionStatus` **retains a terminal
`compacted` phase indefinitely** after micro-compaction
(`context-tokens-compaction.ts:178-184` — set every step from the micro-compact
pass, never reset). So the sequence is:

1. Compaction runs → terminal `compacted` status → panel pins ✓ (desired)
2. Next user message → `onNewUserMessage` clears all three ✓
3. That same run ends → `adoptAndPersist` re-mirrors the **stale** terminal
   status + report → panel **re-pins** ✗
4. The heartbeat would re-pin it even mid-run if the terminal status lingers

The retirement cleared the *store copy* but never told the mirror sites the
signal had been retired, so anything that re-reads the still-terminal runtime
field resurrects it. This is a store-layer ordering defect, not a runtime
defect — the runtime field is intentionally long-lived (the sidebar percent
readout depends on it).

## Proposed Solution

Make the retirement **durable across the run boundary** by recording what was
retired and suppressing re-mirroring of the *same* compaction, while still
letting a genuinely *new* compaction display.

The identity is split into **two epoch halves** because each mirror site only
holds one half at re-delivery time (the status mirror has no report; the report
mirror has no status), so a single combined epoch could never match either —
the first test run proved this and drove the split.

1. **`cli/src/state/chat-store/compaction-helpers.ts`** — two helpers:
   `compactionStatusEpochOf(status)` (terminal `phase` + `tokensSaved`; returns
   `null` for `compacting`/`blocked`/`warning` live states) and
   `compactionReportEpochOf(report)` (`removedMessages` + `tokensSaved` +
   `summaryExcerpt.length`). `percentUsed` is deliberately excluded from both
   — it drifts on every step boundary and would destabilize the epoch.
2. **`cli/src/state/chat-store/sidebar-actions.ts`** — `onNewUserMessage`
   stamps BOTH epochs from the outgoing status + report *before* clearing, then
   clears all three fields as before. `setLastCompactionReport` guards against
   a report whose epoch matches `retiredCompactionReportEpoch`.
3. **`cli/src/state/chat-store/sidebar-reset.ts`** — `applyCompactionStatus`
   drops a status whose epoch matches `retiredCompactionStatusEpoch`; any
   non-matching status clears both stamps and displays.
4. State plumbing: `retiredCompactionStatusEpoch` +
   `retiredCompactionReportEpoch` on `ChatStoreState`, initialized `null`, both
   cleared in `resetSidebarSlice` (a session reset zeroes every compaction field,
   so there is nothing left to remember).

### Invariants preserved

- `compactionCount` (sidebar stat) still only counts real outcomes.
- A *new* compaction after retirement still shows (epoch differs).
- `blocked` / `warning` phases are NOT terminal compaction outcomes — a
  retirement never suppresses them, so the blocked/warning panel still
  surfaces live runtime truth.
- The in-stream `CompactionSummaryBlock` transcript block is untouched (it
  reads from a different store slice; the permanent record stands).

## Affected Components

- `cli/src/state/chat-store/compaction-helpers.ts` (add epoch helper)
- `cli/src/state/chat-store/sidebar-actions.ts` (stamp retirement + report guard)
- `cli/src/state/chat-store/sidebar-reset.ts` (suppress stale re-mirror)
- `cli/src/state/chat-store/types.ts` (new state field)
- `cli/src/state/chat-store/initial-state.ts` (init field)
- `cli/src/state/__tests__/chat-store-compaction.test.ts` (regression tests)

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/state/__tests__/chat-store-compaction.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:29dbddecdf88d2fb2e3404392111434d6d507022c6ca8aaa2824631a9ca8c56f
- verified: 2026-09-18T04:07:31.766Z
- typecheck cli: exit 0
- test cli/src/state/__tests__/chat-store-compaction.test.ts: exit 0
- quality: exit 0

## Code Verification Evidence

All gates run after the fix (evidence: tool output, exit 0):

- `typecheck` cli workspace — **exit 0**, zero errors
- `eslint` on all six changed files `--max-warnings 0` — **exit 0**, clean
- `prettier --check` on all six changed files — clean (post `--write`)
- `chat-store-compaction.test.ts` — **16 pass / 0 fail** (47 expects),
  including the 6 new `CompactionSignal durable retirement` tests: the
  retirement stamps the epoch; a stale status re-mirror does NOT re-pin; a
  stale report re-mirror does NOT resurrect the excerpt; a genuinely new
  compaction after retirement displays normally and clears the stamps;
  `blocked`/`warning` are never suppressed; session reset clears the stamps.
- `compaction-signal.test.tsx` + `compaction-summary-block.test.tsx` —
  **17 pass / 0 fail** combined; the fold/excerpt behavior is untouched.
- Law 4 reachability: `compactionStatusEpochOf` used at `sidebar-reset.ts:38`;
  `compactionReportEpochOf` at `sidebar-actions.ts:81`; both stamps written at
  `sidebar-actions.ts:227-232`, read at `sidebar-reset.ts:37-45`, declared at
  `types.ts:134-135`, initialized at `initial-state.ts:55-56`, cleared at
  `sidebar-reset.ts:139-140`.

<!-- fid:verify receipt — do not remove this comment -->