<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Build Order — Anti-Deferral Gate (FID Step Enforcement)

**Date:** 2026-08-16
**Status:** SUPERSEDED 2026-08-17 — migrated to FID-2026-0817-005
**Owner:** Nova (implementation) + ECHO harness (enforcement)
**Trigger:** Recurring failure — agents unilaterally defer FID steps without operator approval, changing the approved plan silently

---

## Disposition

Never implemented. Verified 2026-08-17: `enforceNoDeferral` has 0
references in `packages/`, no step-status machinery exists in
`fid-validator.ts`/`fid-ledger.ts`, and no CHANGELOG entry covers it.
Planning authority migrated **verbatim** to the converged FID
`dev/fids/FID-2026-0817-005-anti-deferral-fid-step-enforcement.md`
(Perfection Loop passed, status `analyzed`, awaiting operator approval),
with one design change made during the loop (GREEN-G2, SELF-CORRECT-SC3):
the frontmatter `steps:` YAML array is replaced by a `## Step Status`
md-checkbox section, consistent with how `fid-validator` parses markdown.
Do not implement from this file — implement from the FID.

---

## Problem

Agents treat "defer" as a valid scope decision when it's actually **scope removal without authorization**. Pattern:
1. Operator approves a plan with N steps
2. Agent implements some steps, silently defers others
3. Operator discovers the deferral later — the plan they approved is now different
4. Work that was expected is missing, and the operator has to push back to get it done

**Evidence:**
- 2026-08-16: LongCat marked 6 planning FIDs as `closed` without implementation (caught by harness, corrected)
- 2026-08-16: DeepSeek implemented 3 of 7 Phase 2 steps, silently deferred smooth scroll, fold/collapse, and streaming typewriter without operator sign-off (caught by operator)
- This has occurred across multiple models and sessions

---

## Solution: Hard Anti-Deferral Gate

### 1. EHEL Enforcement Rule

Before any FID step can be marked "deferred," "skipped," or left unimplemented, EHEL blocks the action and forces the agent to present the deferral to the operator.

```text
A FID step cannot be marked as deferred/skipped unless:
1. The agent presents the specific step to the operator, AND
2. The operator explicitly approves the deferral
```

If the check fails, the FID step remains `blocked` (not `deferred`), and the operator is notified.

### 2. FID Step Completion Tracking

Every step in a FID must have an explicit status:

| Status | Meaning | Set By |
|---|---|---|
| `implemented` | Code exists, gates pass | Agent (auto-verified by EHEL) |
| `blocked` | Agent can't proceed, needs operator input | Agent (EHEL enforces presentation) |
| `deferred` | Operator explicitly approved deferral | Operator only |
| `skipped` | Operator explicitly approved skip | Operator only |

The agent **cannot** silently leave a step unimplemented. Every step has a status, and "not done" is always `blocked`, never `deferred`.

### 3. Mandatory Operator Presentation

When a FID has any steps in `blocked` status, the agent must present the blocked steps to the operator before marking the FID `converged` or `closed`. The operator decides:
- Implement now
- Defer (with explicit approval)
- Remove from scope (with explicit approval)

---

## Implementation Steps

### Phase 1: EHEL Anti-Deferral Rule

1. Add `enforceNoDeferral()` to `packages/agent-runtime/src/echo/pre-write-gates.ts`
2. Hook into the FID status transition path
3. Block any transition to `deferred`/`skipped` without operator approval flag
4. Force `blocked` status for unimplemented steps

### Phase 2: FID Step Status Tracking

1. Add a `steps` array to the FID frontmatter:
   ```yaml
   steps:
     - id: 1
       description: "Migrate spinner.tsx to useTimeline"
       status: implemented
     - id: 2
       description: "Add scissor-hidden suspension"
       status: blocked
   ```
2. Update EHEL to check step statuses before allowing FID closure
3. Add a `blocked_steps` count to FID metadata headers

### Phase 3: Recorder Workflow Update

1. Update the Recorder's workflow to:
   - Check step statuses before archiving
   - Present blocked steps to the operator
   - Never mark `deferred` without explicit operator approval
2. Update the Adversary's checklist to verify no silent deferrals

### Phase 4: Verification

1. Create a test FID with 3 steps
2. Implement 1 step, leave 2 unimplemented
3. Attempt to mark FID `converged` → should be blocked (blocked steps exist)
4. Attempt to mark a step `deferred` → should be blocked (no operator approval)
5. Explicitly approve a deferral → should succeed
6. Run full gate sweep
7. Verify all existing FIDs have no silent deferrals

---

## Acceptance Criteria

- [ ] EHEL blocks silent deferrals
- [ ] FID steps require explicit status (implemented/blocked/deferred/skipped)
- [ ] Operator must approve all deferrals explicitly
- [ ] Recorder cannot archive FIDs with blocked steps without operator presentation
- [ ] Full gate sweep passes
- [ ] No regression in FID lifecycle

---

## Scope

- **In scope:** EHEL gate, FID template, step tracking, Recorder workflow, Adversary checklist, tests
- **Out of scope:** Retroactive audit of historical FIDs (fix going forward)
- **Risk:** Low — additive change, no breaking changes

---

## Authorization

This build order does **not** authorize implementation. Operator approval required before work begins.
