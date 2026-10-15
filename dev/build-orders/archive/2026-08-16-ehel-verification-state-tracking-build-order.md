<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Build Order — EHEL Verification State Tracking Fix

**Date:** 2026-08-16
**Status:** RESOLVED SUPERSEDED — core premise already shipped (verified 2026-08-17); Phase 2 parked
**Owner:** Nova (implementation) + ECHO harness (enforcement)
**Trigger:** Agent unable to clear Law 3 verification state when running global lint/typecheck commands

---

## Disposition

Verified 2026-08-17 against the working tree — the **core premise of
Phase 1 already ships**: `packages/agent-runtime/src/echo/enforcement.ts`
(from 2026-08-08, `56a4f04b`, v0.0.21) sets `hasVerifiedSinceLastDirty =
true` and clears the Law-3 block when a `run_terminal_command` contains
`typecheck` / `lint` / `eslint` / `test` (keyword-based, over-broad — any
command containing "test" clears every dirty file, covered or not). So a
global `eslint .` or `lint:md .` *does* clear the blocked state today;
per-file tracking stays for targeted verification. This build order is
superseded: its Phase 1 is shipped in cruder (keyword) form, and its
Phase 2 (cross-agent "Verification Evidence" section in the FID
`template`) was never done. No FID was created for this draft — the task
queue is now drain: no implementation is required; optionally tighten
the keyword match into a covered-file-type map as a standalone
todo/FID, which is strictly narrower than this draft. Do not implement
from this file.

---

## Problem

EHEL tracks verification state **per-file**, but the agent runs **global** verification commands (`eslint .`, `lint:md .`, `typecheck`). The global command passes, but EHEL doesn't map the result back to the specific files that were modified, so the per-file "unverified" flag stays set. The agent is forced to run verification per-file, per-change — which is inefficient and confusing.

**Evidence:**
- Agent spent 15+ turns trying to clear Law 3 blocks after editing 5 markdown FIDs
- Pattern observed: `eslint .` alone sometimes clears state, but `lint:md . + eslint .` in parallel does not
- Agent's own reasoning: "EHEL tracks verification state per-file, and running global commands doesn't register as verifying the specific files"
- Root cause: EHEL's verification state machine doesn't map global command success to per-file verification status

---

## Solution

Two complementary fixes:

### 1. EHEL State Tracking Fix (code)

When a global verification command succeeds, EHEL should mark all files of the relevant type as verified:

- `eslint .` passes → mark all JS/TS files as verified
- `lint:md .` passes → mark all markdown files as verified
- `typecheck` passes → mark all TS files as verified

This doesn't change the per-file tracking model — it just makes global commands actually clear the state they cover.

### 2. Cross-Agent Claim Verification (process)

The fix must also handle **cross-agent claims**. When Agent A (e.g., Detective) makes a claim and Agent B (e.g., Verifier) verifies it, the verification must be:
- **Traceable**: The verification command output is captured and stored in the FID
- **Reproducible**: Another agent can re-run the same command and get the same result
- **Cited**: The FID references the exact command and output that verified the claim

This prevents the "attribution is not a source" failure mode (Cross-Agent Claim Rule, ECHO.md line 340-357).

---

## Implementation Steps

### Phase 1: EHEL Verification State Mapping

1. In `packages/agent-runtime/src/echo/pre-write-gates.ts`, add a function that maps global verification commands to file types:
   - `eslint .` → `.ts`, `.tsx`, `.js`, `.jsx`
   - `lint:md .` → `.md`
   - `typecheck` → `.ts`, `.tsx`
2. When a global verification command succeeds, clear the "unverified" flag for all modified files of the relevant types
3. Keep per-file tracking for targeted verification (e.g., `eslint path/to/file.ts`)

### Phase 2: Cross-Agent Claim Evidence

1. Add a "Verification Evidence" section to the FID template:
   - Command run
   - Output (truncated if large)
   - Files covered
   - Timestamp
2. When a Verifier audits a claim, they must paste the exact command output that proves/disproves it
3. The Adversary re-runs a sample of verification commands to confirm reproducibility

### Phase 3: Agent Instructions Update

1. Update `ECHO.md` to clarify: "Run verification commands that cover all modified file types. Global commands are acceptable when they cover every file you changed."
2. Update the Recorder workflow to capture verification evidence in the FID
3. Add a note: "If EHEL blocks after a global verification passed, the command may not have covered all modified file types. Run additional verification for uncovered types."

### Phase 4: Verification

1. Reproduce the original bug: edit a markdown file, run `eslint .` only → verify EHEL still blocks (expected: yes, eslint doesn't cover markdown)
2. Run `lint:md .` → verify EHEL unblocks (expected: yes)
3. Edit both a `.ts` and `.md` file, run both `typecheck` and `lint:md .` → verify both clear
4. Run full gate sweep
5. Confirm the agent can now clear Law 3 blocks without per-file verification

---

## Acceptance Criteria

- [ ] Global verification commands clear per-file state for covered file types
- [ ] Cross-agent claims include verifiable command output in FID
- [ ] Agent instructions clarify global vs per-file verification
- [ ] Full gate sweep passes
- [ ] No regression in Law 3 enforcement

---

## Scope

- **In scope:** EHEL state tracking, FID template, agent instructions, tests
- **Out of scope:** Changing the per-file tracking model itself (keep it, just fix the mapping)
- **Risk:** Low — additive fix, no breaking changes

---

## Authorization

This build order does **not** authorize implementation. Operator approval required before work begins.
