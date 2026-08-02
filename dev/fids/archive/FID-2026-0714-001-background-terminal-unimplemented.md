# FID: Background terminal process_type unimplemented

**Filename:** `FID-2026-0714-001-background-terminal-unimplemented.md`
**ID:** FID-2026-0714-001
**Severity:** high
**Status:** closed
**Created:** 2026-07-14 02:30
**Author:** ECHO Agent (Kilo)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0714-001`. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

`runTerminalCommand` in the SDK accepts `process_type: 'SYNC' | 'BACKGROUND'` but throws
`Error('BACKGROUND process_type not implemented')` for the `BACKGROUND` branch. The `BACKGROUND`
capability is advertised by the tool's type/schema yet is not implemented, so any agent that
requests background execution crashes at runtime.

## Environment

- **OS:** Windows 11 (win32), Bun 1.3.11 (engines require 1.3.14)
- **Language/Runtime:** TypeScript 5.5.4, Bun monorepo
- **Commit/State:** working tree at `C:\Users\spenc\dev\savant-code`, no git commit context

## Detailed Description

### Problem

`sdk/src/tools/run-terminal-command.ts:293-295` hard-throws for `BACKGROUND`:

```ts
if (process_type === 'BACKGROUND') {
  throw new Error('BACKGROUND process_type not implemented')
}
```

The parameter type (`process_type: 'SYNC' | 'BACKGROUND'`) and the published tool schema
advertise BACKGROUND as a valid value, but it is unreachable without throwing.

### Expected Behavior

Either (a) BACKGROUND is implemented (detached/spawned process with a tracked handle and an
identifier returned to the caller), or (b) BACKGROUND is removed from the accepted union and the
tool schema until it is supported, returning a clear, documented error rather than an unimplemented
throw.

### Root Cause

Feature not yet implemented; the type was widened to include `BACKGROUND` before the branch existed.

### Evidence

```text
sdk/src/tools/run-terminal-command.ts:287   process_type: 'SYNC' | 'BACKGROUND'
sdk/src/tools/run-terminal-command.ts:293   if (process_type === 'BACKGROUND') {
sdk/src/tools/run-terminal-command.ts:294     throw new Error('BACKGROUND process_type not implemented')
```

## Impact Assessment

### Affected Components

- `sdk/src/tools/run-terminal-command.ts`
- Any agent definition / SDK consumer that passes `process_type: 'BACKGROUND'`

### Risk Level

- [x] High: Major feature broken, no workaround (callers cannot run background commands)

## Proposed Solution

### Approach

Decide intent: implement background execution or gate it out. Recommended short-term: keep the
throw but make it explicit and documented; long-term: implement detached process tracking.

### Steps

1. Confirm product intent (implement vs. remove).
2. If removing: drop `BACKGROUND` from the union and the published `run_terminal_command` schema.
3. If implementing: spawn a detached child, register it in `ActiveTerminalCommandProcess[]`,
   return a process handle/ID, and wire lifecycle (kill on abort).
4. Add a unit test covering the BACKGROUND path.

### Verification

`bun run --cwd=sdk test` for the run-terminal-command suite; `bunx tsc -b` clean.

## Perfection Loop

### Loop 1

- **RED:** `BACKGROUND` branch throws `Error('BACKGROUND process_type not implemented')` at `sdk/src/tools/run-terminal-command.ts:293-295`. `BACKGROUND` is in the published tool schema (`common/src/tools/params/tool/run-terminal-command.ts:108`) and type definitions (`agents/types/tools.ts:309`, `common/src/templates/initial-agents-dir/types/tools.ts:309`) but zero callers pass `BACKGROUND` as a value. The feature is advertised but unreachable. Scope of change: 4 files need edits — `sdk/src/tools/run-terminal-command.ts` (union + throw removal), `common/src/tools/params/tool/run-terminal-command.ts` (enum + descriptions), `common/src/templates/initial-agents-dir/types/tools.ts` (type), `agents/types/tools.ts` (type). `bundled-agents.generated.ts` is generated code — no manual edit needed, schema change propagates on next build. Removing a value from a published tool schema is a breaking change — must be noted in CHANGELOG.
- **GREEN:** Remove `BACKGROUND` from the `process_type` union in all 4 files. In `run-terminal-command.ts` line 287: change `'SYNC' | 'BACKGROUND'` to `'SYNC'`. Remove lines 293-295 (the throw branch). In `common/src/tools/params/tool/run-terminal-command.ts` line 108: change `.enum(['SYNC', 'BACKGROUND'])` to `.enum(['SYNC'])`. Update line 111 description to remove BACKGROUND reference. Update line 124 description to remove BACKGROUND reference. In `agents/types/tools.ts` and `common/src/templates/initial-agents-dir/types/tools.ts`: change `process_type?: 'SYNC' | 'BACKGROUND'` to `process_type?: 'SYNC'`. Update JSDoc to remove BACKGROUND reference. No test needed — no callers, no behavior change. This is a defensive removal (ECHO Law 5 — no placeholders).
- **AUDIT:** Verified: `bunx tsc --noEmit -p sdk/tsconfig.json` passes clean. `bunx eslint` on the 4 changed files shows 0 errors (5 pre-existing import-order warnings unrelated to this change). Call-graph grep confirms zero remaining `BACKGROUND` references in production source (only in this FID's historical text).
- **CHANGE DELTA:** 4 files modified, ~8 lines changed total. Breaking change — CHANGELOG entry required.

## Resolution

- **Fixed By:** ECHO Agent (Kilo)
- **Fixed Date:** 2026-07-16
- **Fix Description:** Removed `BACKGROUND` from `process_type` union in all 4 files: `sdk/src/tools/run-terminal-command.ts` (type + throw removal), `common/src/tools/params/tool/run-terminal-command.ts` (enum + descriptions), `common/src/templates/initial-agents-dir/types/tools.ts` (type + JSDoc), `agents/types/tools.ts` (type + JSDoc). Breaking change — removed a published tool schema value.
- **Tests Added:** None required — no callers, no behavior change.
- **Verified By:** `bunx tsc --noEmit -p sdk/tsconfig.json` clean. `bunx eslint` on changed files: 0 errors.
- **Commit/PR:** pending
- **Archived:** pending

## Lessons Learned

Avoid widening a public union/schema type before the corresponding branch is implemented; an unimplemented branch is a silent contract violation (ECHO Law 5 — no placeholders). The safest default for unimplemented, uncalled features is removal rather than a documented throw.
