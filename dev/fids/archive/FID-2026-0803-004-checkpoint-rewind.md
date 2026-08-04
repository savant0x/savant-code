# FID: Checkpoint & Rewind — Persistent Per-Turn Edit Safety Net

**Filename:** `FID-2026-0803-004-checkpoint-rewind.md`
**ID:** FID-2026-0803-004
**Severity:** medium
**Status:** verified
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Add a snapshot-based edit safety net: one persistent checkpoint per user turn that records the
pre-edit content of every file first touched that turn, plus the conversation boundary
(`msgIndex`) at turn start. A `/rewind` command (OpenTUI picker) lets the user restore the
**code**, **conversation**, or **both** to an earlier turn, or **fork** a new session from it —
without touching git. The primitive already exists as `file-snapshot-store.ts` (in-memory,
run-scoped, currently **zero callers**); this FID promotes it into a persistent per-session
checkpoint store and wires the user-facing flow. Modeled on Claude Code rewind and the
DeepSeek-Reasonix `internal/checkpoint` design (git-free, `tool.Previewer` capture seam, one
checkpoint per turn, dedup per path).

> Design note (correction): Savant already has session persistence + complete session restore
> (DB sessions, session files, `cloneSessionState` in `sdk/src/run.ts`, CLI checkpoint saves in
> `use-send-message.ts`). Rewind is **orthogonal**: restore brings the conversation back to the
> same state; rewind returns the *workspace files* (and optionally the conversation) to an
> earlier turn's state. The existing run-scoped `file-snapshot-store.ts` proves the snapshot
> concept was already intended in-tree — it just was never wired.

---

## Environment

- `packages/agent-runtime/src/tools/handlers/tool/file-snapshot-store.ts` — in-memory
  `captureSnapshot(runId, path)` / `restoreSnapshots(runId)` / `clearSnapshots(runId)`.
  **Repo-wide grep (packages/cli/sdk/common/agents/evals) finds zero callers** — dead but
  purpose-built for exactly this feature.
- File writes flow through `processFileBlock` → `postStreamProcessing` in
  `packages/agent-runtime/src/tools/handlers/tool/write-file.ts`; all writes are dispatched from
  `executeToolCall` in `packages/agent-runtime/src/tools/tool-executor.ts:310`.
- Write tools: `write_file`, `str_replace`, `apply_patch` (plus `propose_*` variants that resolve
  to them). `run_terminal_command` side effects are untrackable (same rule as Claude Code /
  Reasonix — terminal writes are out of scope for checkpointing).
- CLI checkpoint saves (`cli/src/hooks/use-send-message.ts`) already persist conversation state
  per turn to the run directory — the conversation boundary and persistence location are known
  quantities.

### Findings (gap analysis — RED)

#### CKR-1 — MEDIUM — the file-snapshot primitive exists but is unwired

`file-snapshot-store.ts` implements exactly the capture/restore/clear lifecycle this feature
needs, but nothing calls it. The comment claims Perfection-Loop usage (`self_correct → green`)
that does not exist in the tree. **Fix:** promote this store to a persistent per-session store and
wire it; do not add a parallel mechanism.

#### CKR-2 — MEDIUM — snapshots are in-memory and run-scoped; they die with the run

`restoreSnapshots` cannot survive a process restart or a resumed session, so there is no durable
"undo my last turn's edits" after the fact. **Fix:** persist one JSON file per turn under the
session directory (cheap delete, corruption-isolated), loaded on session resume.

#### CKR-3 — HIGH — no user-facing rewind UX

There is no `/rewind` command, picker, or restore/fork flow anywhere in the CLI. The edit safety
net is the most-requested missing capability for this class of tool (Claude Code ships it;
Reasonix ships it). **Fix:** `/rewind` command + OpenTUI picker with restore modes.

#### CKR-4 — LOW — conversation rewind boundary not captured for rewinding

`msgIndex` at turn start is derivable but not recorded in a rewind-oriented structure; the CLI
checkpoint saves target crash recovery, not time-travel. **Fix:** persist `msgIndex` in the
checkpoint so conversation restore + fork-from-here are deterministic.

## Root Cause

The snapshot concept predates the user-facing flow: `file-snapshot-store.ts` was written for a
self-correct restore path that was never wired, leaving a purpose-built primitive dead. Session
persistence evolved separately (crash-safe saves), so the two never met into a rewind feature.

## Proposed Solution (after approval — audit-only now)

1. **Persistent checkpoint store** — evolve `file-snapshot-store.ts` into
   `checkpoint-store.ts`:
   - `openTurn(turn, prompt, msgIndex)`, `capture(path)` (dedup: only first touch per turn),
     `closeTurn()`, `listTurns()`, `restoreTurn(turn, { code, conversation })`,
     `forkFrom(turn)`.
   - Persist under the session directory: `<sessionDir>/checkpoints/<turn>.json`; load on
     resume; bounded retention (keep last 20 turns, prune older).
   - `FileSnap { path, content: string | null, encoding? }` — `null` content means the file did
     not exist at turn start, so restore **deletes** it (Reasonix checkpoint semantics).
   - Path-escape guards via `resolveAndContain` on restore.
2. **Capture seam** — one centralized hook in `executeToolCall` (before write tools dispatch),
   mirroring Reasonix's `tool.Previewer` approach: no per-tool code. Tracked tools:
   `write_file`, `str_replace`, `apply_patch`. `run_terminal_command` explicitly out of scope.
3. **Rewind UX** — `/rewind` slash command (command-registry) + OpenTUI picker listing turns
   (prompt, time, touched paths). Confirmation prompt before any restore (read-only until
   confirmed). Modes: **code only / conversation only / both / fork-from-here**.
   - Restore code: write back `FileSnap` contents (delete for `content == null`).
   - Restore conversation: truncate session messages to `msgIndex` + reload run state via
     `cloneSessionState`.
   - Fork: new session seeded from the checkpoint's conversation; current state untouched.
4. **Non-goals (Phase 2, explicitly deferred):** git-backed checkpoint mode, tracking bash side
   effects, cross-session checkpoint restore, checkpoints for `move_file` previews.

## Files To Be Changed (implementation stage)

- `packages/agent-runtime/src/tools/handlers/tool/file-snapshot-store.ts` → `checkpoint-store.ts`
  (persistent store)
- `packages/agent-runtime/src/tools/tool-executor.ts` (capture hook)
- `packages/agent-runtime/src/tools/handlers/tool/write-file.ts` (snapshot via `processFileBlock`)
- `cli/src/commands/command-registry.ts` (`/rewind`)
- `cli/src/components/` (rewind picker UI) + `cli/src/state/chat-store.ts` (truncate/fork)
- `cli/src/hooks/use-send-message.ts` (open/close turn checkpoints)
- `sdk/src/run-state.ts` / `client.ts` (conversation restore/fork API)
- Tests: capture dedup, restore code/conversation/both, fork, persistence across restart,
  pruning, path-escape rejection

## Verification

- [x] Recon: `file-snapshot-store.ts` zero callers confirmed; session restore + checkpoint saves
      confirmed existing (DB, session files, `cloneSessionState`, `use-send-message` saves)
- [x] Write-tool surface + execution seam identified (`executeToolCall`, `processFileBlock`,
      `postStreamProcessing`)
- [x] No implementation files modified during this audit (audit-only)
- [x] Implementation: agent-runtime + cli + sdk suites green; 4-way typecheck; zero-warning
      ESLint; `bun run lint:md`; Prettier
- [x] Implementation: independent AUDIT via code-reviewer; CHANGELOG entry; FID archived

## Perfection Loop

### Loop 1

- **RED:** Completed 2026-08-03 — gap analysis against the live tree: the snapshot primitive
  exists but is unwired (zero callers), snapshots are in-memory/run-scoped, no rewind UX, no
  rewind-oriented conversation boundary. Existing session persistence explicitly noted and not
  duplicated.
- **AUDIT:** Claims verified mechanically: `captureSnapshot`/`restoreSnapshots`/`clearSnapshots`
  have zero non-test callers repo-wide; session restore exists (`cloneSessionState` in
  `sdk/src/run.ts`, CLI checkpoint saves in `use-send-message.ts`); write path runs through
  `executeToolCall` → `processFileBlock` → `postStreamProcessing`. Design cross-checked against
  Reasonix `internal/checkpoint` (git-free snapshots, one checkpoint per turn, dedup per path,
  `Content == nil` ⇒ delete on restore) and Claude Code rewind semantics.
- **SELF-CORRECT:** Initial framing claimed Savant "lacks a memory system" — corrected during
  review feedback: session persistence/restore already exists and the design extends the
  in-tree snapshot primitive rather than duplicating persistence.

## Lessons Learned

1. Audit before borrowing: a feature idea from another project can already exist as an unwired
   primitive in-tree (`file-snapshot-store.ts`) — promoting it beats building fresh.
2. Session restore ≠ rewind. Keep the distinction explicit in design docs: one resumes state,
   the other returns state to an earlier turn.

## Resolution

- **Fixed By:** Savant (operator-approved implementation)
- **Fixed Date:** 2026-08-03
- **Fix Description:** **Stage 1 — persistent checkpoint store** (`checkpoint-store.ts`, evolving the
  zero-caller `file-snapshot-store.ts` which was deleted): `openTurn`/`captureSnapshot`/`closeTurn`/
  `listTurns`/`restoreTurn`/`forkFrom`, one JSON per turn under the chat's checkpoint dir, first-capture-wins
  dedup per path, `content: null` ⇒ delete-on-restore, `resolveAndContain` re-validation of every path at
  restore (tampered/escaped entries skipped), `CHECKPOINT_RETENTION` = 20 pruned on close, `path.basename`
  guard on the turnId→filename mapping, and openTurn reset of stale in-memory buffers (crash recovery).
  **Stage 2 — capture seam:** `checkpointDir`/`checkpointTurnId` threaded through
  `AgentRuntimeScopedDeps` → SDK `getAgentRuntimeImpl` → `RunOptions` → subagent context
  (`spawn-agent-utils`), with the capture hooked in `executeToolCall`'s write-gate immediately before
  `write_file`/`str_replace`/`apply_patch` dispatch (subagent writes land in the same turn; terminal side
  effects untracked per Claude Code/Reasonix rule). **Stage 3 — CLI UX:** `/rewind` command registered in
  command-registry + slash-commands, `RewindPicker` OpenTUI overlay + `rewind-picker-store`, and
  `executeRewind` (code / conversation / both / fork modes) with conversation truncation via
  `truncateRunStateToHistoryLength` + `cloneSessionState`-style restore; turn lifecycle wired in
  `use-send-message` (openTurn at aiMessageId generation, closeTurn in `finally`) and
  `createRunConfig` pass-through. SDK index re-exports the checkpoint API for CLI/host use.
- **Tests Added:** `checkpoint-store.test.ts` (15 tests — capture/close round-trip, null-for-created,
  dedup first-wins, openTurn stale-buffer reset, no-op when disabled, listTurns newest-first, retention
  prune to 20, restore + delete + path-escape rejection, fork seed + delete + missing-turn, missing-turn
  restore); `rewind-command.test.ts` (10 tests — resolveTurnArg, truncateRunStateToHistoryLength,
  executeRewind code/conversation/both modes, unknown-turn warning, listTurns persistence).
- **Verified By:** Savant — independent AUDIT via code-reviewer (clean — no CRITICAL/HIGH remaining;
  turnId filename guard + crash-recovery docs added, dedup-before-read ordering confirmed, 2 tests added)
- **Commit/PR:** None (working tree)
- **Archived:** Yes
