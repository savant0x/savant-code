<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Equivalence Grader

**Filename:** `FID-2026-0813-016-teacher-equivalence-grader.md`
**ID:** FID-2026-0813-016
**Severity:** high
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — AST is not the sole oracle
**Master FID:** FID-2026-0813-011
**Depends On:** FID-2026-0813-014, FID-2026-0813-015

---

## Summary

Implement correctness grading for steered Forge output using hidden behavioral tests, challenge contracts, resource limits, and anti-cheat fixtures. AST analysis remains diagnostic and cannot reject valid alternate implementations by itself.

## Environment

- **OS:** Windows/Bun target
- **Language/Runtime:** TypeScript/Bun 1.3.14
- **Tool Versions:** Teacher sandbox and corpus pack contracts
- **Commit/State:** Planning-only working tree

## Detailed Description

### Problem

“Tests green plus AST match” can reward hardcoding and reject correct alternative implementations. It also does not distinguish a good learner constraint from a lucky capable model.

### Expected Behavior

Correct implementations pass across hidden and property-oriented tests; hardcoding, contract violations, resource abuse, and known exploit fixtures fail with structured evidence.

### Root Cause

Source similarity was treated as correctness and learner evidence was under-specified.

## Impact Assessment

### Affected Components

- teacher equivalence grader
- private challenge packs
- sandbox result consumer

### Risk Level

- [x] High: false passes or false failures destroy trust in progression
- [ ] Critical: sandbox owned by FID-013
- [ ] Medium: feature degraded
- [ ] Low: minor issue

## Proposed Solution

### Approach

Grade behavioral contract first, anti-cheat second, and learner evidence separately. Keep test-specific checks in a versioned exploit corpus.

### Steps

1. Define hidden/property/metamorphic test inputs.
2. Validate challenge invariants and error paths.
3. Add resource and complexity budgets where pedagogically relevant.
4. Add hardcoding/exploit fixtures and alternate valid implementations.
5. Record separate correctness and anti-cheat evidence.

### Verification

Repeated deterministic runs, valid alternate implementations, known exploits, weak-test fixtures, and learner explanation cases must produce expected structured results.

## Perfection Loop

### Loop 1 — RED

- **RED:** AST comparison is too strict for valid alternatives and too weak for semantic cheating.
- **GREEN:** Hidden behavioral/property tests and exploit fixtures become primary; AST is diagnostic.
- **AUDIT:** Architecture and build order state the same separation.
- **ADVERSARIAL:** Hidden tests can still be weak; corpus mutation survival from FID-015 is a dependency gate.
- **CHANGE DELTA:** Converged planning revision.

### Missed Questions

1. **Can a different valid algorithm pass?** → Yes, if it satisfies behavior and explicit constraints.
2. **Can correctness alone award mastery?** → No; learner evidence and held-out transfer are separate.
3. **What does anti-cheat mean?** → Reject test-specific shortcuts supported by exploit fixtures, not stylistic differences.

### Code Verification Evidence

- [x] Behavior-first grading policy documented.
- [ ] Grader implementation and tests — pending.

### Loop 2 — Independent audit and self-correction

- **RED:** Complexity constraints can become arbitrary syntax policing.
- **GREEN:** Complexity limits are challenge-specific, declared in the public contract, and evidenced by measurement where feasible.
- **AUDIT:** The contract separates objective behavior from optional pedagogical constraints.
- **ADVERSARIAL:** A hidden test suite must not encode an undisclosed answer style; alternate-implementation fixtures are mandatory.
- **CHANGE DELTA:** <10%.

### Loop 3 — Final convergence

- **RED:** No planning contradiction remains.
- **GREEN:** Equivalence is positioned as onboarding, not the entire moat.
- **AUDIT:** Dependency on validated corpus and vertical slice is explicit.
- **ADVERSARIAL:** A grader pass without repeated/held-out evidence cannot unlock universal mastery claims.
- **CHANGE DELTA:** <2%.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** The grader separated behavior from AST signals but did not state the final fixture evidence required for progression.
- **GREEN:** Approved alternate implementations must pass, exploit fixtures must fail, and no progression is awarded for incomplete or non-reproducible evidence.
- **AUDIT:** The master defaults and architecture acceptance summary contain the same behavior-first and alternate-implementation requirements.
- **ADVERSARIAL:** Hidden tests can accidentally encode one answer style; every corpus pack must include alternate-implementation review before release.
- **CHANGE DELTA:** <10%.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Implemented the behavior-first equivalence grader with a deterministic hardcoding heuristic (anti-cheat is a signal, never the sole oracle).
- **Tests Added:** `packages/agent-runtime/src/teacher/grading/__tests__/grading.test.ts` (equivalence) — 5 tests.
- **Verification Evidence:** valid/alternate implementations pass; hardcoded, broken, and timed-out runs fail with structured findings.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

Source similarity is a useful signal, not a behavioral specification.
