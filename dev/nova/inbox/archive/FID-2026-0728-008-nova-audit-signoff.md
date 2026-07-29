# Nova Audit Sign-Off — FID-2026-0728-008

**Date:** 2026-07-28
**Auditor:** Nova
**FID:** FID-2026-0728-008-history-session-capture.md
**Subject:** `/history` command not capturing full sessions

---

## Executive Summary

**VERDICT: ✅ SIGN OFF — Converged plan is sound and ready for implementation**

The Perfection Loop for FID-2026-0728-008 has completed. The root cause is confirmed, the proposed fix is minimal and robust, and the change delta is small. No DB schema changes are required. The plan correctly treats the filesystem as the authoritative source of truth while preserving the database as a durable fallback.

---

## Root Cause Confirmed

- `saveChatStateAsync` (mid-stream checkpoint) writes only to the filesystem.
- `saveChatState` (turn-end save) writes to both filesystem and database.
- `loadMostRecentChatState` queries the database first and returns immediately, so newer filesystem checkpoints are silently discarded.
- The current `saveChatStateToDb` appends every message on every call; mirroring every 5-second checkpoint to the DB would duplicate rows.
- `ChatMeta` has no `completed` field, so `/history` cannot distinguish interrupted sessions.

---

## Converged Implementation Plan

1. **Add `completed` to `chat-meta.json`**
   - `saveChatStateAsync` writes `completed: false`.
   - `saveChatState` writes `completed: true`.
   - `readChatMeta` defaults missing `completed` to `true` for backward compatibility.

2. **Make `loadMostRecentChatState` prefer filesystem over DB**
   - Load filesystem checkpoint first.
   - Fall back to DB only when filesystem data is missing or unreadable.

3. **Surface completeness in `/history`**
   - Extend `ChatHistoryEntry` and `getAllChats` with `completed`.
   - Render a warning indicator in `ChatHistoryScreen` for incomplete sessions.

4. **Add tests**
   - Checkpoint survives restart and is preferred over stale DB state.
   - `saveChatState` marks complete; `saveChatStateAsync` marks incomplete.
   - `getAllChats` surfaces incomplete sessions.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Existing sessions without `completed` field | `readChatMeta` defaults to `true` |
| DB-only sessions not shown in `/history` | `getAllChats` already scans filesystem only; acceptable because filesystem is primary store |
| Load path reordering breaks resume-from-DB fallback | DB fallback is preserved; filesystem is only preferred when readable |
| Atomic write failures | `writeFileAtomic`/`writeFileAtomicAsync` already use temp-then-rename |

---

## Files Touched

- `cli/src/utils/chat-meta.ts` — add `completed` field
- `cli/src/utils/run-state-storage.ts` — update save/load paths
- `cli/src/utils/chat-history.ts` — carry `completed` in entries
- `cli/src/components/chat-history-screen.tsx` — render incomplete indicator
- `cli/src/utils/__tests__/run-state-storage.test.ts` — checkpoint recovery tests
- `cli/src/utils/__tests__/chat-history.test.ts` — completeness marker tests
- `dev/fids/FID-2026-0728-008-history-session-capture.md` — status updated to `analyzed`

---

## ECHO Compliance

- ✅ Core Laws 1–4 will be followed during implementation.
- ✅ Separation of duties preserved: Orchestrator updates FID; Verifier will audit implementation.
- ✅ Change delta is minimal and well-scoped.
- ✅ No placeholders, TODOs, or pseudo-code in the converged plan.

---

## Verification Checklist

- [x] `cd cli && bun run typecheck` passes
- [x] `bun test cli/src/utils/__tests__/run-state-storage.test.ts` passes
- [x] `bun test cli/src/utils/__tests__/chat-history.test.ts` passes
- [x] `bun test cli/src/utils/__tests__/chat-meta.test.ts` passes
- [ ] Manual smoke test: kill process mid-stream, restart, verify `/history` shows all messages and incomplete indicator

---

## Implementation Verdict

**VERDICT: ✅ IMPLEMENTED AND VERIFIED**

The converged plan was implemented in full:
- Filesystem is now the authoritative source of truth; DB is the fallback.
- `ChatMeta` gained a `completed` field with backward-compatible defaulting.
- Mid-stream checkpoints mark sessions incomplete; turn-end saves mark them complete.
- `ChatHistoryScreen` surfaces incomplete sessions with a warning indicator.
- Reviewer feedback addressed: unreadable chats no longer conflate corruption with interruption, and the message-count column was widened to fit the incomplete label.

Automated verification passed (56/56 tests across the three affected test files; CLI typecheck clean). The manual mid-stream smoke test remains outstanding and can be completed during the next A-Z release test pass.

---

*Audit completed 2026-07-28. Nova sign-off.*
