# Session Handoff: /history Session Capture Fix

**Session ID:** 2026-07-28-history-capture-handoff
**Status:** interrupted (intentional pivot — credit conservation)
**FID:** [FID-2026-0728-008-history-session-capture.md](../fids/FID-2026-0728-008-history-session-capture.md)

---

## Quick Start

Paste this into freebuff:

```text
Pick up FID-2026-0728-008 (dev/fids/FID-2026-0728-008-history-session-capture.md). 
The root cause analysis is complete. Read the FID, then read the handoff at 
dev/session-summaries/2026-07-28-history-capture-handoff.md for the exact 
implementation plan. Implement the fix, run typecheck, and archive the FID.
```

---

## What We Found (Root Cause Analysis)

The `/history` command shows incomplete sessions. Four layered issues:

### Issue 1: DB/Filesystem Persistence Split (PRIMARY)

**Files:** `cli/src/utils/run-state-storage.ts`, `cli/src/hooks/use-send-message.ts`

Two write paths exist:

| Path | Writes to DB? | Writes to FS? | When Called |
|------|--------------|---------------|-------------|
| `saveChatState()` (sync) | ✅ | ✅ | Turn start + turn end |
| `scheduleCheckpointSave()` → `saveChatStateAsync()` (async) | ❌ | ✅ | Every ~5s during streaming |

**The bug:** `loadMostRecentChatState()` (line ~150) tries DB first. If DB returns a result, it returns immediately —
never checking the filesystem for a newer checkpoint. Messages saved only via async checkpoints (mid-stream state) are
silently discarded on reload.

**The fix:** `saveChatStateAsync` must also update the DB (throttled, e.g. every 30s). AND/OR `loadMostRecentChatState`
must compare DB timestamp vs filesystem timestamp and prefer the newer one.

### Issue 2: Dual-Source History Listing

**File:** `cli/src/utils/chat-history.ts`

`getAllChats()` merges results from:

- `getAllChatsFromDb()` — reads all chat IDs from SQLite
- `getAllChatsFromDisk()` — scans `chats/` dir for `chat-meta.json`

These can diverge. A DB entry may exist for a chat whose FS data was lost, or vice versa → ghost sessions (0 messages)
or missing sessions.

### Issue 3: No Session-Completeness Marker

**File:** `cli/src/utils/chat-meta.ts`

`ChatMeta` type has `title`, `timestamp`, `messageCount`, `model` — but no `completed: boolean`. Users can't distinguish
a graceful session end from a crash.

### Issue 4: Sidecar Staleness Window

**File:** `cli/src/utils/chat-meta.ts`

`writeChatMeta` records `messagesSize`/`messagesMtimeMs` for staleness detection. But there's a window between
`chat-messages.json` write and `chat-meta.json` write where concurrent reads get stale data.

---

## Exact Implementation Plan

### Step 1: Add DB write to async checkpoint (run-state-storage.ts)

In `saveChatStateAsync`, after writing to filesystem, also update the DB. Throttle DB writes to avoid excessive SQLite I/O:

```typescript
let lastDbCheckpointAt = 0
const DB_CHECKPOINT_THROTTLE_MS = 30_000

async function saveChatStateAsync(
  runState: RunState,
  messages: Message[],
  chatDir: string,
): Promise<void> {
  // ... existing FS write logic ...
  
  // Throttled DB update
  const now = Date.now()
  if (now - lastDbCheckpointAt > DB_CHECKPOINT_THROTTLE_MS) {
    lastDbCheckpointAt = now
    try {
      await saveChatStateToDb(runState, messages)
    } catch { /* non-critical, FS is source of truth for checkpoints */ }
  }
}
```

### Step 2: Fix loadMostRecentChatState (run-state-storage.ts)

After loading from DB, also check filesystem. If filesystem is newer, prefer it:

```typescript
export async function loadMostRecentChatState(
  chatId?: string,
  chatDir?: string,
): Promise<{ runState: RunState; messages: Message[] } | null> {
  if (chatId && chatDir) {
    const [dbState, fsState] = await Promise.all([
      loadChatStateFromDb(chatId).catch(() => null),
      loadChatStateFromDisk(chatDir).catch(() => null),
    ])
    // Prefer whichever has more recent data
    if (dbState && fsState) {
      const dbTime = dbState.runState.startedAt ?? 0
      const fsTime = fsState.runState.startedAt ?? 0
      return fsTime >= dbTime ? fsState : dbState
    }
    return dbState ?? fsState
  }
  // ... rest of existing logic
}
```

### Step 3: Add `completed` field to ChatMeta (chat-meta.ts)

```typescript
export interface ChatMeta {
  // ... existing fields ...
  completed?: boolean
}
```

Set `completed: true` in the final `saveChatState` call at turn end (in `use-send-message.ts`, after the
`settleCheckpointSave()` + final `saveChatState()`).

### Step 4: Fix getAllChats reconciliation (chat-history.ts)

When a DB entry has no matching filesystem data, skip it. When a filesystem entry has no DB entry, create one. Filter
out sessions with 0 messages.

### Step 5: Close sidecar staleness window (chat-meta.ts)

Ensure `chat-meta.json` is written atomically (write to temp, then rename) AFTER `chat-messages.json` is fully flushed.

### Step 6: Update copy-conversation (copy-conversation.ts)

Before reading from the store, verify the session is fully loaded. If not, load from disk first.

### Step 7: Tests

Add tests covering:

1. Checkpoint-then-restart preserves all messages
2. Incomplete sessions show warning in history
3. DB/filesystem reconciliation produces correct listing
4. Sidecar write atomicity

---

## Key Files (Read These First)

```text
cli/src/utils/run-state-storage.ts    — Core persistence (saveChatState, scheduleCheckpointSave, loadMostRecentChatState)
cli/src/utils/chat-history.ts         — getAllChats() history listing
cli/src/utils/chat-meta.ts            — Sidecar read/write (readChatMeta, writeChatMeta)
cli/src/hooks/use-send-message.ts     — Orchestrator that wires persistence callbacks
cli/src/state/chat-store.ts           — Zustand store for messages
cli/src/components/chat-history-screen.tsx — /history UI component
cli/src/commands/copy-conversation.ts — /copy reads from in-memory store only
```

---

## Verification

After implementing:
```bash
cd cli && bun run typecheck
cd cli && bun test src/utils/__tests__/
```

Manual test checklist:

- [ ] Start a long session, kill mid-stream, restart, `/history` shows all messages
- [ ] `/copy` exports complete transcript
- [ ] Incomplete sessions show visual indicator in history
- [ ] Resuming a session restores full conversation

---

## Git Status at Handoff

- Branch: `main`
- Uncommitted changes exist (from v0.0.8 release work — CHANGELOG, README, Ollama, privacy, sandbox, etc.)
- The FID and this handoff are untracked new files
- **Do NOT commit anything until the fix is complete and verified**

---

## Lessons from This Session

1. **Dual persistence paths without a preference strategy = silent data loss.** Always prefer the newer source when loading.
2. **Async writes that skip the database create a durability gap.** If both sources are used, both must be updated.
3. **Session-completeness markers are essential** — users need to know if a session was saved gracefully or interrupted.
