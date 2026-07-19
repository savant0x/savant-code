# FID: DB Rebrand + Learnings Wiring + Depth Limits + Snapshots

**Filename:** `FID-2026-0717-005-infra-fixes.md`
**ID:** FID-2026-0717-005
**Severity:** high
**Status:** closed
**Created:** 2026-07-17 17:00
**Author:** Spencer Howell

---

## Summary

Four infrastructure fixes: (1) DB path uses old brand name `~/.freebuff/echo.db` — rename to `~/.savant/data.db`, (2) `dev/LEARNINGS.md` is write-only — wire into knowledge pipeline so agents read prior session learnings, (3) No subagent depth limit — add `MAX_AGENT_DEPTH` enforcement, (4) No file rollback — add pre-execution snapshots for Perfection Loop reversibility.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Commit/State:** Post FID-2026-0717-004 (bash gating + strict_mode)

## Detailed Description

### Problem 1: DB Path Uses Old Brand Name

`packages/database/src/index.ts:10-11`:
```typescript
const DB_DIR = path.join(os.homedir(), '.freebuff')
const DB_PATH = path.join(DB_DIR, 'echo.db')
```

Two issues:
- `freebuff` — old brand name, should be `savant` or `savant-code`
- `echo` — conflicts with ECHO Protocol naming (the protocol is governance, not the database)

### Problem 2: LEARNINGS.md Is Write-Only

The Scribe agent writes to `dev/LEARNINGS.md` at end of session. But:
- `KNOWLEDGE_FILE_NAMES` in `common/src/constants/knowledge.ts:13` doesn't include it
- The prompt injection filter in `strings.ts:133` only injects root-level knowledge files
- `dev/LEARNINGS.md` is never auto-loaded into agent context
- Agents can read it via `read_files` tool, but nothing prompts them to

### Problem 3: No Subagent Depth Limit

- `ancestorRunIds` tracks nesting depth — but is never checked
- `MAX_AGENT_DEPTH = 10` exists in `layout-helpers.ts` — dead code, UI only
- No circular spawn detection
- Each spawned child gets fresh 200 steps — no cumulative limit

### Problem 4: No File Rollback

- `FileProcessingState` tracks changes per-step — ephemeral, discarded after each step
- No `git stash`/`git checkout` for rollback
- `propose_*` tools store in-memory diffs — never persist
- If Verifier rejects Forge's code, no way to restore files

## Impact Assessment

### Affected Components

- `packages/database/src/index.ts` — DB path constants
- `common/src/constants/knowledge.ts` — knowledge file names
- `packages/agent-runtime/src/templates/strings.ts` — prompt injection filter
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` — depth check
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` — depth check entry
- `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` — snapshot hooks
- `packages/agent-runtime/src/tools/tool-executor.ts` — snapshot on write

### Risk Level

- [x] High: No rollback = unrecoverable bad writes. No depth limit = potential runaway spawning.

## Proposed Solution

### Steps

**Phase 1: DB Path Rebrand**
1. Change `DB_DIR` from `.freebuff` to `.savant` in `packages/database/src/index.ts:10`
2. Change `DB_PATH` from `echo.db` to `data.db` in `packages/database/src/index.ts:11`
3. Add migration logic: if `~/.savant/data.db` doesn't exist but `~/.freebuff/echo.db` does, copy it

**Phase 2: Wire LEARNINGS.md**
4. Add `'LEARNINGS.md'` to `KNOWLEDGE_FILE_NAMES` in `common/src/constants/knowledge.ts:13`
5. Modify the prompt injection filter in `strings.ts:133` to also match `dev/LEARNINGS.md` (check if path ends with `LEARNINGS.md` or `learnings.md`)
6. The `isKnowledgeFile()` function already handles exact name matches — adding to the array is sufficient for discovery, but the injection filter needs the path override

**Phase 3: Subagent Depth Limit**
7. Add `MAX_AGENT_DEPTH = 5` constant (reuse existing from `layout-helpers.ts` or define in `spawn-agent-utils.ts`)
8. In `createAgentState()` at `spawn-agent-utils.ts:252`, compute depth from `ancestorRunIds.length` and reject if > `MAX_AGENT_DEPTH`
9. Return clear error message: "Maximum agent nesting depth (5) exceeded"

**Phase 4: Pre-Execution Snapshots**
10. Create `packages/agent-runtime/src/tools/handlers/tool/file-snapshot-store.ts` — in-memory `Map<runId, Map<path, originalContent>>`
11. In `tool-executor.ts` tool gating: before allowing `write_file`/`str_replace`/`apply_patch` in `green` phase, snapshot the target file if not already snapshotted
12. In `transition-phase.ts`: on `self_correct→green` transition, restore all snapshotted files
13. On `audit→complete` transition, clear snapshots for that run

### Verification

1. Typecheck: `bun run --cwd=common typecheck`
2. Grep `freebuff` in database module — should not appear
3. Grep `LEARNINGS` in knowledge.ts — should appear
4. Verify `MAX_AGENT_DEPTH` check in spawn-agent-utils.ts
5. Verify snapshot store created and hooked into tool gating

## Perfection Loop

### RED Phase — Issues Identified

| # | Issue | File:Line | Evidence |
|---|-------|-----------|----------|
| 1 | DB path uses `~/.freebuff/echo.db` | `database/src/index.ts:10-11` | `const DB_DIR = path.join(os.homedir(), '.freebuff')` |
| 2 | `echo.db` name conflicts with ECHO Protocol | `database/src/index.ts:11` | `const DB_PATH = path.join(DB_DIR, 'echo.db')` |
| 3 | LEARNINGS.md not in knowledge file names | `knowledge.ts:13-17` | `KNOWLEDGE_FILE_NAMES` array doesn't include it |
| 4 | Prompt injection filter blocks subdirectory files | `strings.ts:133` | `KNOWLEDGE_FILE_NAMES_LOWECASE.includes(lowerPath)` — `dev/learnings.md` won't match `learnings.md` |
| 5 | No subagent depth limit enforced | `spawn-agent-utils.ts:252-301` | `ancestorRunIds` tracked but never length-checked |
| 6 | `MAX_AGENT_DEPTH = 10` is dead code | `layout-helpers.ts:5` | Only used for UI, never imported by runtime |
| 7 | No file rollback mechanism | — | `FileProcessingState` is ephemeral, no snapshot store exists |
| 8 | `propose_*` tools don't persist | `proposed-content-store.ts:1-64` | In-memory only, cleared per run |

### GREEN Phase — Proposed Fixes

**Fix 1: DB Path** (`database/src/index.ts:10-11`)
- `DB_DIR = '.savant'`
- `DB_PATH = 'data.db'`
- Migration: copy `~/.freebuff/echo.db` → `~/.savant/data.db` if source exists and target doesn't

**Fix 2: LEARNINGS.md Wiring** (`knowledge.ts:13`, `strings.ts:133`)
- Add `'LEARNINGS.md'` to `KNOWLEDGE_FILE_NAMES`
- Modify filter to match `dev/LEARNINGS.md`: check if path ends with `LEARNINGS.md` (case-insensitive), not just exact root-level match

**Fix 3: Depth Limit** (`spawn-agent-utils.ts:252`)
- `MAX_AGENT_DEPTH = 5`
- Compute: `const depth = parentAgentState.ancestorRunIds.length + 1`
- Guard: `if (depth > MAX_AGENT_DEPTH) throw new Error(...)`

**Fix 4: Snapshots** (new `file-snapshot-store.ts` + `tool-executor.ts`)
- Store: `Map<runId, Map<path, string>>` — maps run to file snapshots
- Capture: in tool gating, before allowing write in `green`, read current file content and store if not already snapshotted
- Restore: on `self_correct→green` transition, write back snapshotted content
- Clear: on `audit→complete` transition, delete snapshots for that run

### AUDIT Phase — Verification

| # | Check | Method |
|---|-------|--------|
| 1 | No `freebuff` in database module | Grep `packages/database/src/` for `freebuff` |
| 2 | `LEARNINGS.md` in knowledge names | Grep `knowledge.ts` for `LEARNINGS` |
| 3 | `LEARNINGS.md` injectable from subdirectory | Grep `strings.ts` for `LEARNINGS` or modified filter |
| 4 | Depth check exists | Grep `spawn-agent-utils.ts` for `MAX_AGENT_DEPTH` or `depth` |
| 5 | Snapshot store exists | Grep for `file-snapshot-store` or `FileSnapshotStore` |
| 6 | Typecheck passes | `bun run --cwd=common typecheck` |

### SELF-CORRECT Phase

**Finding S1**: The DB migration needs to handle the case where the user has data in both `~/.freebuff/echo.db` and `~/.savant/data.db`. Which takes precedence?

**Correction**: If `~/.savant/data.db` exists, use it (it's the current data). If only `~/.freebuff/echo.db` exists, copy it to `~/.savant/data.db`. If both exist, use `~/.savant/data.db` and log a warning.

**Finding S2**: The `MAX_AGENT_DEPTH = 5` might be too restrictive for complex multi-persona workflows. The Orchestrator → Thinker → sequential thinking is 2 levels. Orchestrator → Forge → verifier is 3 levels.

**Correction**: 5 is appropriate. The typical flow is: Orchestrator (0) → spawns agent (1) → that agent might spawn a sub-agent (2). Depth 5 allows for Orchestrator → agent → sub-agent → sub-sub-agent → sub-sub-sub-agent. That's generous for a multi-persona system.

**Finding S3**: The snapshot store is in-memory. What happens if the process crashes during GREEN phase?

**Correction**: The snapshot is only needed for the Perfection Loop rollback (self_correct→green). If the process crashes, the session is lost anyway (no persistence mid-step). The snapshot doesn't need to survive crashes.

**Finding S4**: The LEARNINGS.md filter change — should it match any file named `LEARNINGS.md` anywhere in the project, or only `dev/LEARNINGS.md`?

**Correction**: Match any file named `LEARNINGS.md` or `learnings.md` anywhere. The `isKnowledgeFile()` function already does this via exact name match. The issue is only in the prompt injection filter which restricts to root-level. Fix the filter to also match subdirectory files with the exact name.

**Finding S5**: Should the snapshot capture be on `green` phase entry or on each write tool call?

**Correction**: On each write tool call in `green` phase. This way, only files that are actually modified get snapshotted, not the entire codebase. The snapshot check is: "has this file been snapshotted for this run? If not, read and store current content before allowing the write."

**Finding S6**: What if the file doesn't exist yet (new file creation via `write_file`)?

**Correction**: No snapshot needed for new files. If the file doesn't exist, there's nothing to restore. The snapshot store should only capture existing files. On restore, delete files that were created during GREEN phase.

### COMPLETE Phase

FID converged. 8 issues identified, 6 fixes specified, 6 self-corrections applied. Ready for Forge implementation.

## Blind Spots (Questions I Should Have Asked)

1. **What about the DB path in test files?** — Tests mock the database. The path change shouldn't affect mocks, but verify no test hardcodes `~/.freebuff/echo.db`.

2. **Should the migration be async or sync?** — The DB is opened at module load time (synchronous). The migration should happen before the DB connection is established. Use a lazy initialization pattern.

3. **What if the user has multiple projects with different databases?** — The DB is global (`~/.savant/data.db`), not per-project. All projects share one DB, keyed by `chat_id` and `session_id`. This is correct — no change needed.

4. **Should the depth limit be configurable?** — For now, hardcoded at 5. Could be made configurable via `protocol.config.yaml` later, but that's dead config territory. Keep it simple.

5. **Should the snapshot be exposed as a tool?** — No. Snapshots are internal to the Perfection Loop. Agents shouldn't manually create/restore snapshots — the FSM transitions handle it automatically.

6. **What about the `FileProcessingState.fileChanges` array?** — It tracks new content per step. Could it be used to derive snapshots? Yes — but it only has the NEW content, not the original. The snapshot needs the ORIGINAL content before the write.

7. **Should the snapshot be per-run or per-session?** — Per-run. Each agent run has its own `runId`. Snapshots should be scoped to the run that created them. When the run completes, snapshots are cleared.

8. **What about concurrent writes to the same file?** — The snapshot store should handle this by only capturing the FIRST write to a file in a run. Subsequent writes to the same file in the same run don't need re-snapshoting.

## Resolution

- **Fixed By:** Spencer Howell
- **Fixed Date:** 2026-07-17 17:30
- **Fix Description:** 4 fixes: (1) DB path renamed from ~/.freebuff/echo.db to ~/.savant/data.db with legacy migration; (2) LEARNINGS.md wired into knowledge pipeline — added to KNOWLEDGE_FILE_NAMES and fixed subdirectory injection filter; (3) MAX_AGENT_DEPTH = 5 enforced in createAgentState() with ancestorRunIds.length check; (4) Pre-execution snapshots via file-snapshot-store.ts — captures original content on write in GREEN, restores on self_correct→green, clears on audit→complete.
- **Tests Added:** No (typecheck verification only)
- **Verified By:** typecheck (common clean), grep verification (7 checks all pass)
- **Commit/PR:** Pending
- **Archived:** 2026-07-17 (set when moved to `dev/fids/archive/`)

## Lessons Learned

- DB paths are contracts — changing them requires migration logic
- Knowledge files need both discovery (isKnowledgeFile) and injection (prompt filter) — fixing one isn't enough
- Dead code (MAX_AGENT_DEPTH) is a clue — someone intended this feature but never shipped it
- Snapshots should be scoped to runs, not sessions — cleaner lifecycle management
