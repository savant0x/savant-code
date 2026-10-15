# Session Summary: Completion-Aware Exit Flush (FID-2026-0804-008)

**Date:** 2026-08-04
**Author:** Savant
**FID:** `dev/fids/archive/FID-2026-0804-008-completion-aware-exit-flush.md`

## What happened

Opened the follow-up FID recommended by FID-2026-0804-007: `/history` showed every
session as interrupted (`!N msgs`) because the exit-path chat-state flush
(`flushLiveChatState` in `cli/src/utils/run-state-storage.ts`) unconditionally wrote
`completed: false` for pending checkpoints and the live provider on every process
exit/signal path — downgrading chats the turn-end save had already marked complete.

## Changes

- **`cli/src/utils/run-state-storage.ts`** — `flushLiveChatState()` is now
  completion-aware: it reads each chat's existing sidecar via
  `readChatMeta(chatDir)?.completed ?? false` and preserves `completed: true` instead
  of hardcoding `false`. Genuinely interrupted chats (sidecar `false` or absent) still
  flush as incomplete, so the `!N msgs` marker stays meaningful.
- **`cli/src/components/chat-history-screen.tsx`** — new exported pure helper
  `allChatsInterrupted(chats)` (true only when every listed chat is `completed ===
  false`); a muted hint line renders under the title in that state.
- **Tests** — 9 new: 4 `flushLiveChatState` regression tests (preserves `true` on the
  provider + pending-checkpoint paths; keeps genuinely interrupted and brand-new
  chats at `false`) in `run-state-storage.test.ts`, plus 5 `allChatsInterrupted`
  helper tests in a new `chat-history-screen.test.tsx`.

## Verification

- Runtime proof (real code, temp dir): turn-end save → `completed: true`; exit flush
  → still `true` (was `false` before the fix); genuinely interrupted chat → `false`.
- Gates: CLI typecheck exit 0; ESLint 0/0 on changed files; run-state-storage +
  chat-history + helper suites 58 pass / 0 fail; combined CLI suites (7 files) 83
  pass / 0 fail with the dev NEXT_PUBLIC env block.

## Artifacts

- FID-2026-0804-008 archived to `dev/fids/archive/` with Loop 1 + Loop 2 perfection
  loop records and a CHANGELOG entry under v0.0.19 Verification.
- Uncommitted working-tree changes (alongside FID-2026-0804-001/007 changes).
