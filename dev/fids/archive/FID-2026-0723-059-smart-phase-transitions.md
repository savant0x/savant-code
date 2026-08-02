# FID: Smart Phase Transitions (Skip Phases When Appropriate)

**Filename:** `FID-2026-0723-059-smart-phase-transitions.md`
**ID:** FID-2026-0723-059
**Severity:** medium
**Status:** closed
**Created:** 2026-07-23 02:15
**Author:** Savant

---

## Summary

The current ECHO Perfection Loop follows a rigid FSM: idle → red → green → audit → complete. Every complex task goes through all phases even when some are unnecessary. Smart phase transitions allow skipping phases when appropriate: skip RED when issues are already known, skip GREEN deliberation for obvious fixes, skip full AUDIT for trivial changes.

## Environment

- **OS:** Windows (production: Linux)
- **Language/Runtime:** TypeScript / Bun 1.3.11
- **Tool Versions:** ECHO Protocol v0.2.0
- **Commit/State:** Working tree (uncommitted)

## Detailed Description

### Problem

For a simple fix (e.g., changing a string constant), the current flow is:
```
idle → red (analyze what?) → green (plan what?) → audit (verify obvious change) → complete
= 4 phase transitions + 4 LLM calls
```

### Expected Behavior

```
idle → green → complete
= 2 phase transitions + 2 LLM calls (for trivial changes)
```

### Root Cause

The ECHO Protocol doesn't define criteria for when phases can be skipped. The system prompt only shows the full loop path.

### Evidence

```text
# Current system prompt (savant.ts line ~597):
`For the full loop: transition_phase(red) → transition_phase(green) → spawn Forge → spawn Verifier.`

# ECHO.md Perfection Loop FSM:
idle → red → green → audit → complete

# No criteria defined for when phases can be skipped
```

## Impact Assessment

### Affected Components

- `agents/savant/savant.ts` — Instructions prompt for phase transitions
- `ECHO.md` — Phase transition rules

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Low: Minor issue, cosmetic, or edge case
- [x] Medium: Feature degraded, workaround exists

## Proposed Solution

### Approach

Define criteria for when phases can be skipped, while maintaining ECHO Protocol correctness.

### Steps

1. **Update `agents/savant/savant.ts`** — Add smart phase transition rules:
   ```
   ## Smart Phase Transitions

   Skip RED when:
   - Issues are already known from prior analysis (user described the bug)
   - Creating new files (nothing to analyze)
   - Small changes (< 3 files) with no existing code to audit

   Skip GREEN deliberation when:
   - The fix is obvious (typo, missing import, constant change)
   - User provided exact code to write

   Skip full AUDIT when:
   - Change is < 10 lines AND single file AND no new APIs
   - Typecheck/lint already pass inline
   - Pure refactors with no behavioral change

   Always run:
   - Typecheck/lint verification (Law 3)
   - Call-graph reachability for new functions (Law 4)
   ```

2. **Update `ECHO.md`** — Document smart phase transitions:
   ```
   ### Phase Skipping Rules

   | Phase | Skip When | Still Required |
   |-------|-----------|----------------|
   | RED | Issues known, new files, < 3 files | Law 2 (Present Before Act) |
   | GREEN deliberation | Fix is obvious, user provided exact code | Law 2 |
   | Full AUDIT | < 10 lines, single file, typecheck passes | Law 3 (Verify Before Proceed) |

   Law 3 (Verify Before Proceed) is NEVER skipped — verification always happens.
   ```

### Verification

- `cd packages/agent-runtime && bun run typecheck` — zero errors
- Grep verification: phase transition rules present in savant.ts and ECHO.md

## Perfection Loop

### Loop 1

- **RED:** [Pending]
- **GREEN:** [Pending]
- **AUDIT:** [Pending]
- **CHANGE DELTA:** [Pending]

## Resolution

- **Fixed By:** [Pending]
- **Fixed Date:** [Pending]
- **Fix Description:** [Pending]
- **Tests Added:** No (prompt-only changes)
- **Verified By:** [Pending]
- **Commit/PR:** [Pending]
- **Archived:** [Pending — set when moved to `dev/fids/archive/` after implementation + verification]

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

[To be filled after Perfection Loop completion]
