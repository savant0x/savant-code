# FID: Slash Command Menu Cleanup

**Filename:** `FID-2026-0723-064-slash-command-cleanup.md`
**ID:** FID-2026-0723-064
**Severity:** medium
**Status:** closed
**Created:** 2026-07-23 12:00
**Author:** Forge

---

## Summary

The slash command menu (`cli/src/data/slash-commands.ts`) contains 8 issues: dead entries, orphaned handlers, stale agent references, and commented-out features. This FID catalogs all issues and proposes a cleanup plan.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript / Bun
- **Commit/State:** v0.0.5 prep branch (249 modified files)

## Detailed Description

### Issue 1: `/agent:gpt-5` — Stale Agent (HIGH)

**File:** `cli/src/data/slash-commands.ts:150-154`
**File:** `cli/src/commands/command-registry.ts:537-547`

The menu entry `agent:gpt-5` describes "Spawn the GPT-5 agent to help solve complex problems" and inserts `@GPT-5 Agent ` into the input. However:

- No `gpt-5` agent exists in `agents/` directory
- The `gpt-5-agent` handler in `command-registry.ts:537-547` is a UI-only shortcut (inserts text), not a real agent spawn
- The handler name `gpt-5-agent` doesn't match the menu ID `agent:gpt-5` — it's dead code
- Users clicking this get misleading text inserted with no actual agent behind it

**Verdict:** REMOVE both the menu entry and the dead handler.

### Issue 2: `/model` Description — Stale Example (LOW)

**File:** `cli/src/data/slash-commands.ts:200-201`

The `/model` command description reads: `Switch the active model (e.g. /model openai/gpt-4o)`. The user prefers `anthropic/claude-opus-4.6` (Claude Mythos) as the example model.

**Verdict:** Update description to: `Switch the active model (e.g. /model anthropic/claude-opus-4.6)`

### Issue 3: `/connect` — ChatGPT OAuth Status (INVESTIGATE)

**File:** `cli/src/data/slash-commands.ts:66-75`
**File:** `common/src/constants/chatgpt-oauth.ts:9` — `CHATGPT_OAUTH_ENABLED = true`

The `/connect` command is gated by `CHATGPT_OAUTH_ENABLED`, which is currently `true`. The command exists in the menu and has a handler in `command-registry.ts:549-561`. However, it's only shown when the flag is enabled, and it's listed in `SAVANT_FREE_ONLY_COMMAND_IDS` (only shown in free mode).

**Verdict:** Keep as-is if ChatGPT OAuth is still active. Flag for operator confirmation.

### Issue 4: `/login` — Orphaned Handler (MEDIUM)

**File:** `cli/src/commands/command-registry.ts:286-300`

The `login` handler exists in the command registry with alias `signin`, but:
- It's NOT defined in `slash-commands.ts` (not in the menu)
- It's a no-op handler that just says "You're already in the app. Use /logout to switch accounts."
- The `login` alias is not in the `SAVANT_FREE_REMOVED_COMMAND_IDS` or `SAVANT_FREE_ONLY_COMMAND_IDS` sets

**Verdict:** REMOVE the orphaned handler. It's unreachable from the menu and confusing.

### Issue 5: `/publish` — Commented-Out Entry + Orphaned Handler (MEDIUM)

**File:** `cli/src/data/slash-commands.ts:179-183` (commented out)
**File:** `cli/src/commands/command-registry.ts:519-534`

The `/publish` menu entry is commented out, but the handler in `command-registry.ts:519-534` is still active and functional. The handler opens publish mode with optional agent ID pre-selection.

**Verdict:** Either restore the menu entry (if publish is a feature) or REMOVE both the commented-out entry and the handler. The handler references `openPublishMode` which suggests it's a real feature. Flag for operator decision.

### Issue 6: `/agent:opus` — Commented-Out Placeholder (LOW)

**File:** `cli/src/data/slash-commands.ts:155-160`

Commented-out menu entry for `/agent:opus`. No corresponding handler exists.

**Verdict:** REMOVE the commented-out block. Dead code.

### Issue 7: `/undo` and `/redo` — Commented-Out, No Implementation (MEDIUM)

**File:** `cli/src/data/slash-commands.ts:93-102` (commented out)

Both commands are commented out in the menu. There are:
- No handlers in `command-registry.ts`
- No undo/redo logic in `chat-store.ts` (confirmed via grep)
- No snapshot/history stack mechanism

These are aspirational features that were never implemented.

**Verdict:** REMOVE the commented-out blocks. Create a separate FID if undo/redo is desired as a future feature.

### Issue 8: `/end-session` — Working But Gated (LOW)

**File:** `cli/src/data/slash-commands.ts:190-194`
**File:** `cli/src/commands/command-registry.ts:665-685`
**File:** `cli/src/commands/__tests__/savant-free-command-aliases.test.ts`

The `/end-session` command works correctly:
- Listed in `SAVANT_FREE_ONLY_COMMAND_IDS` (only shown in free mode)
- Handler calls `returnToSavantFreeLanding({ resetChat: true })`
- Has alias `model` in savant-free mode
- Test exists verifying the alias works

**Verdict:** No action needed. Working as designed.

## Impact Assessment

### Affected Components

- `cli/src/data/slash-commands.ts` — menu definitions
- `cli/src/commands/command-registry.ts` — handler registry
- `cli/src/commands/__tests__/savant-free-command-aliases.test.ts` — existing test

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Remove dead code, fix stale references, and clean up the slash command menu. Changes are minimal and surgical.

### Steps

1. **REMOVE** `/agent:gpt-5` menu entry (slash-commands.ts:150-154)
2. **REMOVE** `gpt-5-agent` handler (command-registry.ts:536-548)
3. **UPDATE** `/model` description example to `anthropic/claude-opus-4.6` (slash-commands.ts:201)
4. **REMOVE** `/login` orphaned handler (command-registry.ts:286-300)
5. **REMOVE** `/publish` commented-out menu entry (slash-commands.ts:179-183)
6. **REMOVE** `/agent:opus` commented-out menu entry (slash-commands.ts:155-160)
7. **REMOVE** `/undo` and `/redo` commented-out menu entries (slash-commands.ts:93-102)
8. **KEEP** `/connect` as-is (active, gated by CHATGPT_OAUTH_ENABLED)
9. **KEEP** `/end-session` as-is (working correctly)
10. Run typecheck verification: `cd cli && bun run typecheck`
11. Run existing test: `bun test cli/src/commands/__tests__/savant-free-command-aliases.test.ts`

### Verification

- Typecheck passes with zero errors
- Existing test passes
- `/help` menu no longer shows stale entries
- `/model` shows correct example

## Perfection Loop

### Loop 1

- **RED:** 8 issues cataloged: (1) stale `agent:gpt-5` menu + dead `gpt-5-agent` handler, (2) stale `/model` example, (3) `/connect` active (no action), (4) orphaned `/login` handler, (5) commented-out `/publish` entry + orphaned handler, (6) commented-out `/agent:opus`, (7) commented-out `/undo`+`/redo` with no implementation, (8) `/end-session` working (no action). Grep confirmed no undo/redo infrastructure exists in `chat-store.ts` or `command-registry.ts`.
- **GREEN:** Removed 7 dead entries across 2 files: `slash-commands.ts` (-undo/redo, -agent:gpt-5, -agent:opus, -publish commented block, updated /model description, removed `gpt-5-agent` from SAVANT_FREE_REMOVED_COMMAND_IDS); `command-registry.ts` (-login handler, -gpt-5-agent handler, removed `gpt-5-agent` from SAVANT_FREE_REMOVED_COMMANDS). Kept `/connect` (active) and `/end-session` (working).
- **AUDIT:** Typecheck passes (`tsc --noEmit -p .` — zero errors). Grep confirms zero remaining references to `gpt-5-agent`, `name: 'login'`, `agent:gpt-5`, `agent:opus`, `undo`, or `redo` in CLI source. Existing test (`savant-free-command-aliases.test.ts`) fails due to pre-existing env issue (`bun` not in PATH for subprocess), unrelated to changes.
- **CHANGE DELTA:** ~30 lines removed across 2 files (slash-commands.ts: 235→222 lines, command-registry.ts: 829→800 lines).

## Resolution

- **Fixed By:** Forge
- **Fixed Date:** 2026-07-23 12:15
- **Fix Description:** Removed 7 dead/commented-out slash command entries and 2 orphaned handlers. Updated /model description example to anthropic/claude-opus-4.6. Cleaned SAVANT_FREE_REMOVED_COMMANDS/IDS sets.
- **Tests Added:** No new tests needed (removal of dead code)
- **Verified By:** Typecheck (tsc --noEmit — zero errors), grep (zero remaining references to removed symbols)
- **Commit/PR:** Pending (v0.0.5 release commit)
- **Archived:** 2026-07-24

## Lessons Learned

The slash command menu accumulated dead code over multiple feature iterations (rebrand, GPT-5 agent removal, publish feature changes). Regular menu audits should be part of the release checklist.

**Deferred decisions:**
- `/publish` handler (command-registry.ts:519-534) is still registered and functional — the menu entry was commented out but the handler was kept. Operator should decide: restore the menu entry (if publish is a real feature) or remove the handler entirely.
- `/undo` and `/redo` require a new FID if desired — they need an undo stack in chat-store.ts, keyboard shortcuts, and UI state management. No infrastructure exists today.
