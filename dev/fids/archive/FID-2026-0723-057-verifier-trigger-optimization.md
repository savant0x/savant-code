# FID: Verifier Trigger Optimization

**Filename:** `FID-2026-0723-057-verifier-trigger-optimization.md`
**ID:** FID-2026-0723-057
**Severity:** high
**Status:** closed
**Created:** 2026-07-23 01:30
**Author:** Savant

---

## Summary

The Verifier agent (code reviewer) trigger is subjective and non-compliant with ECHO.md. The current prompt says "Skip this step only if the change is extremely straightforward and obvious" — leaving the decision entirely to model judgment with no objective criteria. Hybrid Mode (Savant writes directly) skips the Verifier entirely, violating ECHO.md's Double Audit requirement. The Verifier's instructionsPrompt doesn't reference the Audit Checklist.

## Environment

- **OS:** Windows (production: Linux)
- **Language/Runtime:** TypeScript / Bun 1.3.11
- **Tool Versions:** ECHO Protocol v0.2.0
- **Commit/State:** Working tree (uncommitted)

## Detailed Description

### Problem

The Verifier agent trigger has 5 compliance gaps with ECHO.md:

1. **Hybrid Mode skips Verifier entirely** — Step prompt says "For direct writes, verify with typecheck/lint in parallel using bashers" with no Verifier. Violates Double Audit (two independent methods required).

2. **"Extremely straightforward and obvious" is subjective** — The model decides what's trivial, leading to inconsistent review coverage. No objective threshold.

3. **Verifier prompt doesn't reference Audit Checklist** — The Verifier's `instructionsPrompt` focuses on general code review but doesn't check against ECHO.md's 14-item Audit Checklist.

4. **No call-graph reachability check** — ECHO.md Law 4 requires grep for callers after wiring features. Neither bashers nor Verifier enforce this.

5. **No criteria for when Verifier is mandatory vs optional** — The current system leaves it entirely to model judgment.

### Expected Behavior

- Verifier is spawned based on objective, measurable criteria
- Hybrid Mode includes Verifier for non-trivial changes (satisfying Double Audit)
- Verifier prompt references the ECHO Audit Checklist
- Call-graph reachability (Law 4) is enforced for new functions/APIs

### Root Cause

The Verifier trigger was designed for the old Forge-only architecture. The hybrid mode refactor (FID-2026-0723-002) added direct writing but didn't update the review requirements to match ECHO.md's Double Audit rule.

### Evidence

```text
# Current Verifier trigger in savant.ts (line 354):
'- Spawn the Verifier to review code changes after implementation. (Skip this step only if the change is extremely straightforward and obvious.)'

# Current step prompt (line ~384):
'If you spawned Forge to implement changes, also spawn the Verifier to review. For direct writes, verify with typecheck/lint in parallel using bashers.'

# Verifier agent (verifier.ts line 29):
instructionsPrompt: `You are a subagent that reviews code changes and gives helpful critical feedback. Do not use any tools.`
# No reference to Audit Checklist, no ECHO compliance checks

# ECHO.md Double Audit (line 41):
| **Double Audit** | Every change verified by two independent methods (static analysis + runtime tests). Self-reporting is prohibited. |

# ECHO.md Audit Checklist (line 550, 14 items):
- Code compiles and runs
- All tests pass
- Type checking passes
- Lint checks pass
- No magic numbers or strings
- All names follow language conventions
- Error handling is comprehensive
- Documentation covers public API
- Security implications documented
- Performance characteristics noted
- No TODO comments without FID references
- File length within limits
- Implementation matches the converged FID spec
- Forge is not the agent that ran this audit
```

## Impact Assessment

### Affected Components

- `agents/savant/savant.ts` — Verifier trigger instructions
- `agents/verifier/verifier.ts` — Verifier instructionsPrompt
- `ECHO.md` — Documentation update for Hybrid Mode audit

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Replace subjective Verifier trigger with objective criteria. Enhance Verifier prompt with Audit Checklist. Add call-graph reachability enforcement.

### Steps

1. **Update `agents/savant/savant.ts`** — Replace vague "skip if straightforward" with objective criteria:
   - < 10 lines AND single file AND no new imports: Optional (bashers only)
   - 10-50 lines OR 2-3 files: Required
   - > 50 lines OR > 3 files: Required + call-graph grep
   - New function/API added: Required + call-graph grep
   - Security-sensitive code: Required
   - FID-Bound Execution (Forge): Always required

2. **Update `agents/verifier/verifier.ts`** — Add Audit Checklist to instructionsPrompt:
   ```
   Before providing your review, check against the ECHO Audit Checklist:
   - [ ] No magic numbers or strings (all constants extracted)
   - [ ] All names follow language conventions
   - [ ] Error handling is comprehensive (Law 14)
   - [ ] No type safety shortcuts (Law 6)
   - [ ] No TODOs without FID references (Law 5)
   - [ ] Implementation matches the converged FID spec (if applicable)
   ```

3. **Update `ECHO.md`** — Document Hybrid Mode audit requirements and call-graph reachability (Law 4) enforcement.

### Verification

- `cd packages/agent-runtime && bun run typecheck` — zero errors
- `bun x eslint agents/savant/savant.ts agents/verifier/verifier.ts --max-warnings 0` — zero warnings
- Grep verification: all 3 files updated

## Perfection Loop

### Loop 1

- **RED:** 5 compliance gaps identified with grep evidence from `savant.ts` (lines 345, 354, 370, 378, 611), `verifier.ts` (line 29), and `ECHO.md` (lines 41, 550). The Verifier trigger is subjective ("skip if straightforward"), Hybrid Mode skips Verifier entirely (violating Double Audit), Verifier prompt lacks Audit Checklist, no call-graph reachability enforcement, and no objective criteria for when Verifier is mandatory.
- **GREEN:** 3 files to update: (1) `savant.ts` — replace subjective trigger with objective criteria table (< 10 lines optional, 10-50 lines required, > 50 lines + call-graph, new API + call-graph, security always, Forge always). (2) `verifier.ts` — add 6-item Audit Checklist to instructionsPrompt. (3) `ECHO.md` — document Hybrid Mode audit requirements and Law 4 enforcement.
- **AUDIT:** All changes are prompt/documentation only — zero runtime code modifications. Approach aligns with ECHO.md: Double Audit satisfied (bashers = static analysis + Verifier = code review), Law 4 enforced (call-graph grep for new functions), Audit Checklist integrated into Verifier prompt. No contradictions with existing ECHO.md sections.
- **CHANGE DELTA:** 0% runtime code, 100% prompt/documentation

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-07-23 02:00
- **Fix Description:** Replaced subjective Verifier trigger with objective criteria (10+ lines, 2+ files, new API, security, user request, Forge usage), enhanced Verifier prompt with 6-item ECHO Audit Checklist, documented Hybrid Mode audit requirements and Double Audit enforcement in ECHO.md
- **Tests Added:** No (prompt-only changes)
- **Verified By:** Typecheck (packages/agent-runtime) + code-reviewer-mimo (2 rounds, all findings addressed)
- **Commit/PR:** Pending
- **Archived:** 2026-07-23

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

The Verifier trigger was a leftover from the old Forge-only architecture. When Hybrid Mode was introduced (FID-2026-0723-002), the review requirements weren't updated to match ECHO.md's Double Audit rule. Always audit cross-cutting concerns (like verification) when introducing architectural changes.
