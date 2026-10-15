<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Vertical-Slice Exercise

**Filename:** `FID-2026-0813-014-teacher-vertical-slice-exercise.md`
**ID:** FID-2026-0813-014
**Severity:** high
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — value gate before corpus scale
**Master FID:** FID-2026-0813-011
**Depends On:** FID-2026-0813-012, FID-2026-0813-013

---

## Summary

Build one human-authored JavaScript challenge through a complete headless exercise lifecycle: learner constraints, Forge output, sandbox execution, one controlled mutation, learner critique, bounded adjudication, attempt result, cancellation, retry, timeout, and cleanup. This is the product-value gate before a generated corpus or OpenTUI surface.

## Environment

- **OS:** Windows target; cross-platform engine contract
- **Language/Runtime:** TypeScript/Bun 1.3.14
- **Tool Versions:** Existing agent runtime, ECHO, and ZTAP adapter boundary
- **Commit/State:** Planning-only working tree

## Detailed Description

### Problem

The prior sequence scaled the course generator before proving that steering and detection form a useful, gradeable exercise.

### Expected Behavior

One exercise runs without touching the user project, returns objective evidence, distinguishes correct/broken/mutated output, and leaves ordinary chat state intact.

### Root Cause

No dedicated headless exercise state machine currently owns this lifecycle.

### Evidence

The homegrown architecture defines `ready → steering_submitted → forge_running → sandbox_running → equivalence_review → detection_review → learner_critique → adjudication → result`.

## Impact Assessment

### Affected Components

- new teacher exercise engine
- agent-runtime teacher orchestration
- common teacher event contracts

### Risk Level

- [x] High: this is the first end-to-end value and isolation boundary
- [ ] Critical: sandbox security is owned by FID-013
- [ ] Medium: feature degraded
- [ ] Low: minor issue

## Proposed Solution

### Approach

Use a deterministic fixture challenge and an immutable attempt id. Keep the engine headless and inject only public challenge data plus structured sandbox evidence into the appropriate agents.

### Steps

1. Implement the exercise FSM and immutable attempt contract.
2. Run a correct and broken learner attempt through the sandbox.
3. Apply one registered mutation and collect critique evidence.
4. Add timeout, cancellation, retry, cleanup, and chat-isolation paths.
5. Produce a result suitable for progression and ZTAP adaptation.

### Verification

Focused tests cover every FSM transition, invalid transition, timeout, cancellation, retry, cleanup, and trust-domain boundary. Run one manual headless smoke test only after automated gates pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** “Learner assumes Orchestrator” was not mapped to a dedicated exercise state; the UI was asked to own too much lifecycle behavior.
- **GREEN:** Headless engine owns execution and evidence; UI is deferred.
- **AUDIT:** Architecture and build order place this slice after sandbox and before generator/UI.
- **ADVERSARIAL:** A successful Forge result can still be luck; the slice requires learner explanation/evidence and a detection attempt.
- **CHANGE DELTA:** Converged planning revision.

### Missed Questions

1. **Does a retry overwrite history?** → No; every retry gets a new attempt id.
2. **Does exercise code touch the repository?** → No; only temporary sandbox workspaces.
3. **What happens on unavailable sandbox?** → Exercise ends honestly as unavailable and awards no pass.

### Code Verification Evidence

- [x] State machine and result contracts are specified.
- [ ] Engine implementation and tests — pending.

### Loop 2 — Independent audit and self-correction

- **RED:** Adversarial output and critique could leak private mutation details into chat history.
- **GREEN:** Events are bounded and redact private pack fields; only rubric-safe evidence crosses the learner boundary.
- **AUDIT:** Trust-domain table and attempt schema record this boundary.
- **ADVERSARIAL:** Redaction must be tested against errors and stdout, not only normal messages.
- **CHANGE DELTA:** <10%.

### Loop 3 — Final convergence

- **RED:** No remaining planning contradiction.
- **GREEN:** Vertical slice is explicitly a gate, not a reduced product scope.
- **AUDIT:** Dependencies are acyclic and ordered after the sandbox.
- **ADVERSARIAL:** If the slice does not show repeatable learner value, corpus generation stops and the concept is reconsidered.
- **CHANGE DELTA:** <2%.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** The vertical slice described lifecycle coverage but did not explicitly require the shared repeatability and no-credit-on-unavailable rules.
- **GREEN:** The slice now consumes the 20-run deterministic fixture gate and must award no progression on sandbox unavailability or incomplete evidence.
- **AUDIT:** Dependencies remain `012 → 013 → 014`; corpus scale and UI remain downstream.
- **ADVERSARIAL:** One slice can prove integration mechanics but not product-market value; repeatable learner outcomes and held-out transfer remain later evidence.
- **CHANGE DELTA:** <10%.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Implemented the headless exercise engine (FSM, grader seams, cancellation/retry/timeout/cleanup, evidence hashing).
- **Tests Added:** `packages/agent-runtime/src/teacher/exercise/__tests__/engine.test.ts` — 11 lifecycle tests.
- **Verification Evidence:** 11/11 pass covering correct/broken/mutated/vague, unavailable, cancellation, retry, event ordering, and redaction.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

A complete tiny exercise is more informative than a large unvalidated curriculum generator.
