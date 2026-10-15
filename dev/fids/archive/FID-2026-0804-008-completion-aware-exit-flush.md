<!-- markdownlint-disable MD013 -->

# FID: Completion-Aware Exit Flush + /history Interrupted-Marker Hint

**Filename:** `FID-2026-0804-008-completion-aware-exit-flush.md`
**ID:** FID-2026-0804-008
**Severity:** medium
**Status:** closed
**Created:** 2026-08-04 15:00
**Author:** Savant

---

## Summary

The `/history` screen marks every chat as interrupted (`!N msgs`) because the exit-path chat-state flush (`flushLiveChatState`) unconditionally writes `completed: false` for pending checkpoints and the live provider. Make the flush completion-aware — preserve an already-`completed: true` sidecar instead of downgrading it — and surface a hint in the history screen when every entry looks interrupted. Follow-up to FID-2026-0804-007 (which status-checked `/history` and found this exact symptom with root cause in `run-state-storage.ts`).

## Environment

- **OS:** Windows 11 / win32
- **Language/Runtime:** TypeScript, Bun 1.3.11 local (`.bun-version` pin 1.3.14)
- **Commit/State:** working tree at `32a217a` + uncommitted Loop 2/3 changes from FID-2026-0804-001 + Loop 2-4 changes from FID-2026-0804-007

## Detailed Description

### Problem

FID-2026-0804-007 Loop 1 recorded, with runtime evidence, that `/history` lists real chats correctly but **every** entry shows `!N msgs`. Every chat sidecar on disk reported `completed: false`. Root cause: `flushLiveChatState()` (cli/src/utils/run-state-storage.ts) runs on every process exit/signal path (renderer-cleanup.ts) and writes `completed: false` for (a) every queued checkpoint and (b) the live provider — even when the chat's last authoritative save already marked it `completed: true`. The completion flag therefore cannot distinguish "session ended mid-run" from "session completed then process exited".

### Expected Behavior

- The exit flush must never downgrade a chat that was already marked complete. `completed: true` survives process exit/signal.
- Chats that genuinely never completed (interrupted mid-run, brand-new in-flight turn) still carry `completed: false` so the `!N msgs` marker stays meaningful.
- When every chat in `/history` shows as interrupted (the exact misleading state this bug produced), the screen surfaces a hint so users aren't left believing all their work was lost/interrupted.

### Root Cause

`flushLiveChatState()` hardcodes `completed: false` in both write paths (run-state-storage.ts:74 for pending checkpoints, :92 for the live provider). The turn-end authoritative save (`saveChatState(..., true)` in use-send-message.ts:879) can be followed by a process exit that flushes a queued checkpoint or a still-registered provider, overwriting the sidecar with `false`. Because checkpoints are queued for chat A even after a chat switch (regression-tested in run-state-storage.test.ts "chat switches while saves are pending"), and the abort path explicitly schedules a final checkpoint, a completed chat is one exit away from being relabeled interrupted.

### Evidence

```text
cli/src/utils/run-state-storage.ts:74  saveChatState(state.runState, state.messages, chatDir, '', false)      // pending checkpoint flush
cli/src/utils/run-state-storage.ts:92  saveChatState(state.runState, state.messages, provider.chatDir, '', false) // live provider flush
cli/src/utils/chat-meta.ts:56-76       writeChatMeta(chatDir, messages, completed) — completed defaults true
cli/src/hooks/use-send-message.ts:879  saveChatState(runState, ..., getSelectedSavantFreeModel())  // turn-end: completed: true (default)
cli/src/hooks/use-send-message.ts:928  saveChatState(..., false)  // error-path persist: intentionally incomplete
cli/src/utils/renderer-cleanup.ts:56   flushLiveChatState() on SIGTERM/SIGHUP/SIGINT/beforeExit/exit/uncaughtException/unhandledRejection

Runtime evidence (FID-2026-0804-007 Loop 1, prod env): getAllChats(500) → 5 chats, all with completed: false in chat-meta.json.
```

## Impact Assessment

### Affected Components

- `cli/src/utils/run-state-storage.ts` — `flushLiveChatState()` completion-aware
- `cli/src/components/chat-history-screen.tsx` — interrupted-all hint
- `cli/src/utils/__tests__/run-state-storage.test.ts` — regression tests for flag preservation
- `dev/fids/FID-2026-0804-008-*.md` — this FID

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. **Completion-aware flush:** in `flushLiveChatState()`, before each write, read the existing sidecar via `readChatMeta(chatDir)`. Pass `existing?.completed ?? false` as the `completed` argument instead of the hardcoded `false`. A chat whose sidecar already says `completed: true` (turn-end save landed) is preserved as complete; a chat with `completed: false` or no sidecar (genuinely interrupted / first write) stays `false`. `readChatMeta` already defaults missing `completed` to `true` for legacy sidecars and returns `null` on missing/stale meta — `?? false` keeps first-write flushes incomplete.
2. **/history hint:** in `chat-history-screen.tsx`, compute `allInterrupted = chats.length > 0 && chats.every(c => c.completed === false)`. When true, render a muted hint line under the title (e.g. "All sessions show as interrupted — this may be a display quirk; resume one to verify."). Extract a tiny pure helper so it is unit-testable.
3. **Tests:** (a) `flushLiveChatState` preserves `completed: true` after a turn-end save (provider path); (b) preserves `true` across queued checkpoint writes (pending-checkpoint path); (c) keeps `false` for genuinely interrupted chats; (d) keeps a brand-new in-flight chat (no sidecar yet) incomplete; (e) the `allChatsInterrupted` screen helper returns true only when every listed chat is `completed === false` (4 flush tests + 5 helper tests).

### Verification

- `bun run --cwd=cli typecheck`
- `bun test src/utils/__tests__/run-state-storage.test.ts` (+ new screen helper test)
- `bun x eslint` on changed files, `--max-warnings 0`
- Combined CLI suites with the dev NEXT_PUBLIC env block still green

## Perfection Loop

### Loop 1

- **RED:** Independent investigation of the current working tree:
  1. `flushLiveChatState()` writes `completed: false` unconditionally on both the pending-checkpoint path (run-state-storage.ts:74) and the live-provider path (:92). No read of the existing sidecar before either write.
  2. The turn-end authoritative save (use-send-message.ts:879) passes no `completed` argument, so it defaults to `true` — proving the intent that a finished turn is complete. The exit flush then contradicts that intent.
  3. The chat-switch/abort paths deliberately queue final checkpoints for the original chat dir (regression-tested at run-state-storage.test.ts "chat switches while saves are pending", lines 660-720). A completed chat whose chat dir still holds a queued checkpoint is relabeled `completed: false` by the exit flush.
  4. `readChatMeta` (chat-meta.ts:80-106) returns the parsed sidecar or `null`; it defaults missing `completed` to `true` for legacy sidecars and rejects stale sidecars. A safe source for "was this chat already marked complete?".
  5. `/history` display (chat-history-screen.tsx:113) renders `!${messageCount} msgs` when `completed === false`, `N msgs` otherwise — the misleading "everything interrupted" state this FID fixes.
  6. No existing test asserts the exit flush preserves an existing `completed: true` flag — the gap the fix must close.
- **GREEN:** Converged design (detailed in Approach): completion-aware exit flush via `readChatMeta(chatDir)?.completed ?? false`, history-screen hint driven by a pure `allChatsInterrupted` helper, and three regression tests + one helper test. No change to the meaning of `completed: false` for genuinely interrupted sessions.
- **AUDIT:** Cross-checked against all write sites: (1) turn-end true (use-send-message.ts:879) — preserved by the new logic; (2) error-path false (:928) — stays false, correct (run failed); (3) checkpoint async writes (run-state-storage.ts:235) — these intentionally mark incomplete mid-stream and are superseded by the turn-end save; unaffected. The hint only triggers when every listed chat is `completed === false` (unreadable chats have `undefined` and correctly suppress the hint). No risk to resume/load paths (`loadMostRecentChatState` reads run-state + messages, never the `completed` flag).
- **CHANGE DELTA:** Loop 1 converged without revision.

### Loop 2 (Implementation + Independent Verification)

- **RED→GREEN:** Implemented per the converged design:
  - `cli/src/utils/run-state-storage.ts`: `flushLiveChatState()` now reads `readChatMeta(chatDir)`/`readChatMeta(provider.chatDir)` via `flushCompletionForChatDir` and passes `existing?.completed ?? false` to both `saveChatState` calls; import `readChatMeta`.
  - `cli/src/components/chat-history-screen.tsx`: exported pure helper `allChatsInterrupted(chats)`; renders a muted hint under the title when every listed chat is `completed === false` (skip in compact mode / when chats are empty).
  - Tests: 4 new `flushLiveChatState` regression tests in run-state-storage.test.ts (preserves completed:true on provider path, preserves completed:true on pending-checkpoint path, keeps completed:false for interrupted chats, keeps brand-new in-flight chats incomplete) + a new `chat-history-screen.test.tsx` with 5 `allChatsInterrupted` tests.
- **AUDIT (evidence):** recorded below under Code Verification Evidence. CLI typecheck exit 0; ESLint 0/0 on changed files; run-state-storage suite + new helper suite + combined CLI suites all pass with the dev NEXT_PUBLIC env block.
- **CHANGE DELTA:** No code changes after Loop 2 audit. FID closed and archived.

### Missed Questions

1. Does the exit flush ever legitimately need to force `false`? → Yes — for chats that genuinely never completed. The new logic keeps `false` whenever the sidecar says `false` or is absent, preserving interrupted-detection.
2. Could preserving `completed: true` hide a real interruption? → Only in the pathological case where a turn-end save landed and a *later* turn in the same chat was interrupted — but each turn's messages are still checkpointed, and the chat-level flag reflects "this conversation finished at least one completed turn", which matches how `/history` uses it. Precision note: the async checkpoint drain (`saveChatStateAsync`, run-state-storage.ts:235) still hardcodes `writeChatMeta(..., false)`; the "preserved true" outcome therefore only occurs when the process exits before that async drain rewrites the sidecar — the async writer is intentionally out of scope (mid-stream checkpoints must look incomplete until the turn-end save lands).
3. Do legacy sidecars (no `completed` field) behave correctly? → Yes — `readChatMeta` defaults missing `completed` to `true`, so legacy chats are preserved as complete (matching getAllChats' backward-compat intent).
3a. What happens when the sidecar is stale (messages rewritten without a sidecar refresh)? → `readChatMeta` returns `null`, so the exit flush writes `completed: false` — a deliberate, documented asymmetry vs `getAllChats`, which falls back to parsing the full transcript and defaults that case to complete. An exit path cannot parse multi-MB transcripts, and the narrow crash-between-writes window is treated as interrupted rather than silently assumed complete.
4. Is the hint misleading when chats were *genuinely* all interrupted? → It is worded as a possibility ("may be a display quirk; resume one to verify") and only appears when every entry is `completed === false` — exactly the state the bug produced. If a user genuinely interrupted everything, the hint is still factually true about the data.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation matches the proposed solution
- [x] Typecheck passes: `bun run --cwd=cli typecheck` (exit 0)
- [x] FID status updated to reflect actual implementation state
- [x] Loop 2 independent verification: ESLint 0/0, run-state-storage + helper + combined CLI suites green

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-04
- **Fix Description:** Made `flushLiveChatState()` completion-aware: the exit flush now reads each chat's existing sidecar and preserves `completed: true` instead of unconditionally downgrading to `false`, so `/history` stops marking every finished session as interrupted. Added a muted hint in the history screen when every listed chat is `completed === false` (the exact state this bug produced), driven by a pure `allChatsInterrupted` helper.
- **Tests Added:** Yes — 4 `flushLiveChatState` regression tests (preserves complete on provider + pending-checkpoint paths, keeps genuinely-interrupted chats incomplete, keeps brand-new in-flight chats incomplete) + 5 `allChatsInterrupted` helper tests.
- **Verified By:** CLI typecheck exit 0, ESLint 0/0, run-state-storage suite + helper suite green, combined provider/health/export/CLI suites green with the dev NEXT_PUBLIC env block.
- **Commit/PR:** Uncommitted working-tree changes (alongside FID-2026-0804-001/007 changes).
- **Archived:** 2026-08-04 — moved to `dev/fids/archive/` after Loop 2 verification; CHANGELOG entry appended.

## Lessons Learned

A completion flag written by one path (turn-end save) can be silently contradicted by another path (exit flush) unless every writer is completion-aware. Exit-path flushes are best-effort by design and run on every signal — they must treat the authoritative sidecar as ground truth and only write `false` for genuinely incomplete chats. Display surfaces should defend against all-interrupted data states with a hint rather than presenting the data as-is.
