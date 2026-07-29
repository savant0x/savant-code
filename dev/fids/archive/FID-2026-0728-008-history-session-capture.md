# FID: /history Command Not Capturing Full Sessions

**Filename:** `FID-2026-0728-008-history-session-capture.md`
**ID:** FID-2026-0728-008
**Severity:** high
**Status:** closed
**Created:** 2026-07-28
**Author:** Savant (Orchestrator)

---

## Summary

The `/history` command does not reliably capture and display full chat sessions. The root cause is a split persistence architecture where async checkpoint writes (periodic saves during streaming) only persist to the filesystem, while the database is only updated at turn start and turn end. On restart, `loadMostRecentChatState()` prefers the DB path, returning stale data and silently discarding newer filesystem checkpoints containing mid-stream messages.

## Environment

- **OS:** Windows (reported), cross-platform issue
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Tool Versions:** OpenTUI 0.2.2, React 19
- **Commit/State:** main branch, post-v0.0.8

## Detailed Description

### Problem

The `/history` slash command opens the `ChatHistoryScreen`, which loads sessions via `getAllChats()`. Users report that sessions are not captured fully — messages go missing, sessions appear incomplete, or resume with fewer messages than were visible during the live session.

### Expected Behavior

Every message sent or received during a session should be persisted and recoverable. Resuming a session from `/history` should restore the complete conversation transcript, including all mid-stream checkpoints.

### Root Cause

**Primary: DB/filesystem persistence split**

The chat persistence layer has two write paths:

1. **Sync path** (`saveChatState` in `cli/src/utils/run-state-storage.ts`): Writes to BOTH the SQLite database AND the filesystem (`chat-messages.json` + `chat-meta.json` sidecar). Called at turn start and turn end.

2. **Async path** (`scheduleCheckpointSave` / `saveChatStateAsync`): Writes to filesystem ONLY via a coalesced timer (~5s intervals during streaming). Does NOT update the database.

When loading, `loadMostRecentChatState()` (line ~150 of `run-state-storage.ts`) tries the DB first. If the DB returns a result, it returns immediately — never checking the filesystem for a newer checkpoint. This means any messages saved only via the async path (mid-stream state) are silently discarded on reload.

**Secondary: Dual-source history listing**

`getAllChats()` in `cli/src/utils/chat-history.ts` merges results from:
- `getAllChatsFromDb()` — reads all chat IDs from the SQLite DB
- `getAllChatsFromDisk()` — scans the `chats/` directory for `chat-meta.json` sidecars

These can diverge: a DB entry may exist for a chat whose filesystem data was lost, or a filesystem entry may exist for a chat not yet committed to the DB. This produces ghost sessions (showing 0 messages) or missing sessions in the history view.

**Tertiary: No session-completeness marker**

There is no flag distinguishing a gracefully-completed session from one that crashed mid-stream. The `chat-meta.json` sidecar records `messageCount`, `title`, `timestamp`, and `model` — but no `completed: true` field. Users cannot tell which sessions are complete.

**Quaternary: Sidecar staleness window**

`writeChatMeta` records `messagesSize` and `messagesMtimeMs` to detect staleness via `isChatMetaStale()`. But there is a window between the `chat-messages.json` write and the `chat-meta.json` write where concurrent reads get stale sidecar data.

### Evidence

Key files involved:

```
cli/src/utils/run-state-storage.ts    — persistence layer (saveChatState, scheduleCheckpointSave, loadMostRecentChatState)
cli/src/utils/chat-history.ts          — getAllChats() history listing
cli/src/utils/chat-meta.ts             — sidecar read/write (readChatMeta, writeChatMeta)
cli/src/components/chat-history-screen.tsx — /history UI component
cli/src/hooks/use-send-message.ts      — orchestrator that wires persistence callbacks
cli/src/state/chat-store.ts            — Zustand store for messages
cli/src/commands/command-registry.ts   — /history command registration
cli/src/commands/copy-conversation.ts  — /copy reads from in-memory store only
```

The async checkpoint save in `use-send-message.ts` (onStateSnapshot callback):
```typescript
onStateSnapshot: (runState) => {
  if (!runChatIsCurrent()) return
  latestRunStateSnapshot = runState
  scheduleCheckpointSave(runState, useChatStore.getState().messages, runChatDir)
}
```

Note: `scheduleCheckpointSave` calls `saveChatStateAsync` which writes to filesystem only — the DB is NOT updated.

The load path in `loadMostRecentChatState`:
```typescript
// Tries DB first — if it returns, filesystem is never checked
const dbState = await loadChatStateFromDb(chatId)
if (dbState) return dbState
// Only falls through to filesystem if DB returns null
return await loadChatStateFromDisk(chatDir)
```

### Impact Assessment

**Affected Components:**

- `cli/src/utils/run-state-storage.ts` — core persistence (DB + filesystem split)
- `cli/src/utils/chat-history.ts` — `getAllChats()` dual-source merge
- `cli/src/utils/chat-meta.ts` — sidecar staleness detection
- `cli/src/hooks/use-send-message.ts` — async checkpoint wiring
- `cli/src/components/chat-history-screen.tsx` — history display
- `cli/src/commands/copy-conversation.ts` — conversation export

**Risk Level:**

- [x] High: Major feature broken, no workaround

The `/history` feature is a core user workflow. Session loss erodes trust and makes the CLI unreliable for long-running coding sessions.

## Proposed Solution

### Approach

Make the filesystem the authoritative source of truth for chat state and treat the SQLite database as a durable fallback. The filesystem is already the only store updated by async checkpoints, and it is written atomically (temp-then-rename). Trying to mirror every async checkpoint into the database would duplicate rows because the current `saveChatStateToDb` implementation appends every message on every call without clearing prior rows. Instead, we unify the *load* path so the newest available source wins, and we add a session-completeness marker to the sidecar so `/history` can warn about interrupted sessions.

### Steps

1. **Add `completed` field to `chat-meta`** — Extend the `ChatMeta` schema with `completed: boolean`. `saveChatStateAsync` (mid-stream checkpoint) writes `completed: false`; `saveChatState` (turn-end authoritative save) writes `completed: true`. `readChatMeta` defaults a missing `completed` to `true` for backward compatibility.

2. **Fix `loadMostRecentChatState` to prefer the filesystem** — Load the filesystem checkpoint first. If it is readable, return it. Only fall back to the database when the filesystem data is missing or unreadable. This guarantees that mid-stream checkpoints are never silently discarded in favor of a stale DB snapshot.

3. **Surface completeness in `/history`** — Extend `ChatHistoryEntry` with `completed?: boolean`, populate it from the sidecar in `getAllChats`, and render an warning indicator in `ChatHistoryScreen` for incomplete sessions.

4. **Close the sidecar staleness window** — `chat-meta.json` is already written atomically via `writeFileAtomic`. Ensure `readChatMeta` handles a missing or torn `chat-messages.json` gracefully (it already returns `null` in those cases).

5. **Add tests** — Write integration tests covering: (a) mid-stream checkpoint survives a restart and `loadMostRecentChatState` returns the latest filesystem messages, (b) `saveChatState` marks a session complete while `saveChatStateAsync` marks it incomplete, and (c) `getAllChats` surfaces incomplete sessions.

### Verification

- Typecheck passes for `cli` package
- Unit tests pass for `run-state-storage.ts` (add new test cases)
- Manual test: start a long session, kill the process mid-stream, restart, verify `/history` shows all messages
- Manual test: verify `/copy` exports complete transcript
- Manual test: verify incomplete sessions show visual indicator

## Handoff Notes (Savant-Free)

This FID is ready for implementation in the freebuff codebase. Key context:

- The fix primarily touches `cli/src/utils/run-state-storage.ts` (persistence unification)
- Secondary changes in `cli/src/utils/chat-history.ts`, `cli/src/utils/chat-meta.ts`, `cli/src/components/chat-history-screen.tsx`
- The DB schema for `chat_sessions` table is in `packages/database/src/` — check if it needs a `completed` column or if the sidecar is sufficient
- Run `cd cli && bun run typecheck` to verify after changes
- Run `bun test cli/src/utils/__tests__/` for unit tests

## Perfection Loop

### Loop 1

- **RED:**
  - `saveChatStateAsync` in `cli/src/utils/run-state-storage.ts` writes `run-state.json`, `chat-messages.json`, and `chat-meta.json` but never touches the database.
  - `saveChatState` in the same file calls `saveChatStateToDb` once at turn start/end and then writes the same files to disk.
  - `loadMostRecentChatState` calls `loadChatStateFromDb` first and returns immediately if the DB has any session for the chat, so newer filesystem checkpoints are ignored.
  - `saveChatStateToDb` appends every message on every call (`createMessage` in a loop), so using it for 5-second checkpoints would duplicate rows.
  - `ChatMeta` in `cli/src/utils/chat-meta.ts` has no `completed` field, so `/history` cannot distinguish interrupted sessions.
  - `getAllChats` in `cli/src/utils/chat-history.ts` already enumerates the filesystem, so DB-only sessions do not create ghost entries.

- **GREEN:**
  - Add `completed: boolean` to `ChatMeta` and `writeChatMeta(chatDir, messages, completed)`.
  - `saveChatStateAsync` calls `writeChatMeta(..., false)`; `saveChatState` calls `writeChatMeta(..., true)`.
  - Refactor `loadMostRecentChatState` to load the filesystem first, then fall back to the database.
  - Extend `ChatHistoryEntry` and `getAllChats` with `completed` and surface it in `ChatHistoryScreen`.
  - Add tests in `cli/src/utils/__tests__/run-state-storage.test.ts` and `cli/src/utils/__tests__/chat-history.test.ts` for checkpoint recovery and completeness markers.

- **AUDIT:**
  - `cd cli && bun run typecheck` passes.
  - `bun test cli/src/utils/__tests__/run-state-storage.test.ts` passes.
  - `bun test cli/src/utils/__tests__/chat-history.test.ts` passes.
  - `bun test cli/src/utils/__tests__/chat-meta.test.ts` passes.
  - Manual smoke test: start a chat, kill the process mid-stream, restart, verify `/history` shows all messages and an incomplete indicator.

- **CHANGE DELTA:** Minimal. The persistence write paths are unchanged except for the sidecar marker; the load path is reordered; history listing/UI gains a completeness field. No DB schema change is required.

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: *"What questions should I have asked when this FID was created, but failed to?"*

1. **Does the SQLite schema support concurrent writes from async checkpoints?** — SQLite is in WAL mode (`packages/database/src/index.ts`), but the current `saveChatStateToDb` appends every message on every call, so mirroring every checkpoint would duplicate rows. The chosen fix avoids writing checkpoints to the DB at all, making this question moot.

2. **What happens to existing sessions that lack the `completed` field?** — `readChatMeta` will default missing `completed` to `true` so historical sessions are not flagged as incomplete.

3. **Is there a maximum session size that could cause filesystem write failures?** — `writeFileAtomic`/`writeFileAtomicAsync` already write to a temp file and rename, which is safe for multi-MB transcripts. The DB is not used for checkpoint writes, so DB row limits are not a concern.

4. **Does the freebuff variant have any `FREEBUFF_MODE` guards around persistence code?** — No. The persistence code in `cli/src/utils/run-state-storage.ts`, `chat-meta.ts`, and `chat-history.ts` is shared and has no `FREEBUFF_MODE` guards.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that the code referenced in this FID actually exists.

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation plan matches the affected code
- [x] No DB write for async checkpoints (avoids row duplication)
- [x] Typecheck passes: `cd cli && bun run typecheck`
- [x] Unit tests pass: `bun test cli/src/utils/__tests__/run-state-storage.test.ts` and `bun test cli/src/utils/__tests__/chat-history.test.ts`
- [x] FID status updated to reflect actual implementation state

## Resolution

- **Fixed By:** Savant (Orchestrator)
- **Fixed Date:** 2026-07-28
- **Fix Description:** Made the filesystem the authoritative source of truth for chat state; the SQLite database is now only consulted when filesystem state is missing or unreadable. Added a `completed` boolean to `ChatMeta`: `saveChatStateAsync` (mid-stream checkpoint) writes `completed: false`, and `saveChatState` (turn-end authoritative save) writes `completed: true`. `readChatMeta` defaults a missing `completed` to `true` for backward compatibility. `loadMostRecentChatState` now loads the filesystem checkpoint first and falls back to the DB only when filesystem data is unavailable. `ChatHistoryEntry` carries `completed`, `getAllChats` surfaces it, and `ChatHistoryScreen` renders a warning indicator for incomplete sessions. Unreadable chats leave `completed` unset to avoid conflating corruption with interruption.
- **Tests Added:** Added tests in `cli/src/utils/__tests__/chat-meta.test.ts` for `completed=false` checkpoint meta and legacy defaulting; in `cli/src/utils/__tests__/run-state-storage.test.ts` for complete/incomplete markers; and in `cli/src/utils/__tests__/chat-history.test.ts` for incomplete-session surfacing and legacy sidecar handling.
- **Verified By:** `cd cli && bun run typecheck` passes; `bun test src/utils/__tests__/chat-meta.test.ts src/utils/__tests__/chat-history.test.ts src/utils/__tests__/run-state-storage.test.ts` — 56 pass / 0 fail; code-reviewer-kimi approved.
- **Commit/PR:** TBD

> When status is set to **Closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

1. **Dual persistence paths without a preference strategy leads to silent data loss.** Always prefer the newer source when loading from multiple stores.
2. **Async writes that skip the database create a durability gap.** If both sources are used, both must be updated — or the load path must check both.
3. **Session-completeness markers are essential for reliability.** Users need to know if a session was saved gracefully or interrupted, especially for long-running coding sessions.
