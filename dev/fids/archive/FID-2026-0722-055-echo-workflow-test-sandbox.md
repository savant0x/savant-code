# FID: ECHO Workflow Test Sandbox

**Filename:** `FID-2026-0722-055-echo-workflow-test-sandbox.md`
**ID:** FID-2026-0722-055
**Severity:** low
**Status:** deferred
**Created:** 2026-07-22 14:00
**Author:** Savant Orchestrator + Dev

---

## Summary

Build a small, self-contained TypeScript project inside a new `test-sandbox/` folder at the repo root. This project will serve as a disposable test bed to exercise the full ECHO Perfection Loop workflow end-to-end: Scout → Detective → Thinker → Forge → Verifier → Recorder. The sandbox has zero coupling to the main codebase — it exists purely to validate that the agent pipeline works correctly on a real (but small) codebase.

## Environment

- **OS:** Windows (production: Linux)
- **Language/Runtime:** TypeScript / Bun 1.3.11
- **Tool Versions:** ECHO Protocol v0.2.0
- **Commit/State:** Working tree (uncommitted)

## Detailed Description

### Problem

The comprehensive A-Z system test (FID-2026-0722-052) validated every individual tool and gate but never exercised the full agent pipeline on a real coding task. We need a safe, disposable codebase to test:

1. **Scout** — Can it find relevant files in a new, unfamiliar project?
2. **Detective** — Can it catalog bugs with file paths, line numbers, and grep evidence?
3. **Thinker** — Can it reason about the best fix approach via sequential thinking?
4. **Forge** — Can it write production-quality TypeScript code on the first pass?
5. **Verifier** — Can it catch issues in Forge's output?
6. **Recorder** — Can it track the FID through the full Perfection Loop?
7. **Context Pruner** — Does it work well across a multi-step session?

### Expected Behavior

The sandbox project should:

- Be a valid TypeScript package with `package.json`, `tsconfig.json`, and a `bun run typecheck` script
- Contain 2-3 small utility modules with **deliberate, realistic bugs** (off-by-one errors, missing error paths, type issues)
- Include test files that exercise the utilities
- Be fully self-contained — no imports from the main `@savant-code/*` packages
- Be easy to delete entirely when testing is complete

### Root Cause

N/A — this is a proactive test infrastructure addition, not a bug fix.

### Evidence

From the A-Z test agent feedback:
```
The FSM cycle adds ~4 extra phase transitions for what is essentially a 
read-only audit task. In a real workflow where you'd say "fix this bug" 
or "add this feature," I'd naturally cycle through RED→GREEN→AUDIT once 
and it would feel right.
```

The core tools work. The agent roster is complete. What's untested is the pipeline on real code.

## Impact Assessment

### Affected Components

- `test-sandbox/` (new directory — disposable)
- No production code affected

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Create a minimal TypeScript project with realistic bugs, then run the full Perfection Loop to find and fix them. The sandbox lives at `test-sandbox/` (root level) and will be deleted after testing.

### Steps

1. **Create sandbox structure:**
   - `test-sandbox/package.json` — standalone package, `bun run typecheck` script
   - `test-sandbox/tsconfig.json` — strict TypeScript config
   - `test-sandbox/src/utils.ts` — utility module with deliberate bugs
   - `test-sandbox/src/utils.test.ts` — test file that exposes the bugs
   - `test-sandbox/README.md` — explains the sandbox's purpose

2. **Deliberate bugs to include:**
   - **Bug 1 (Logic):** `chunkArray` has an off-by-one — drops the last element when array length is a perfect multiple of chunk size
   - **Bug 2 (Missing error path):** `safeParseJson` silently returns `null` for malformed JSON instead of throwing or returning a result type — callers can't distinguish "null value" from "parse error"
   - **Bug 3 (Type issue):** `sortBy` uses a loose comparison (`a - b`) that breaks for string fields — would fail at runtime on non-numeric sorts

3. **Run the Perfection Loop:**
   - RED: Spawn Detective to find all bugs with evidence
   - GREEN: Spawn Forge to fix all bugs
   - AUDIT: Typecheck + Verifier review
   - COMPLETE: Archive FID, delete sandbox

### Verification

- `cd test-sandbox && bun run typecheck` — zero errors
- `cd test-sandbox && bun test` — all tests pass
- Verifier agent confirms no remaining issues
- `rm -rf test-sandbox/` — clean deletion after verification

## Perfection Loop

### Loop 1

- **RED:** [Pending — Detective will catalog bugs]
- **GREEN:** [Pending — Forge will fix bugs]
- **AUDIT:** [Pending — Typecheck + Verifier]
- **CHANGE DELTA:** [Pending]

### Loop 2 (if needed)

- **RED:** [Pending]
- **GREEN:** [Pending]
- **AUDIT:** [Pending]
- **CHANGE DELTA:** [Pending]

## Resolution

- **Fixed By:** [Pending]
- **Fixed Date:** [Pending]
- **Fix Description:** [Pending]
- **Tests Added:** Yes — test-sandbox/src/utils.test.ts
- **Verified By:** [Pending]
- **Commit/PR:** [Pending]
- **Archived:** 2026-07-24

> **Note:** This FID was never implemented. The test sandbox was not needed — the A-Z System Test v7–v10 prompt suite covered the same pipeline validation without a disposable codebase. Archived as deferred.

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

[To be filled after Perfection Loop completion]

What can we learn from this finding? How can we prevent similar issues?
