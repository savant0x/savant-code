<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Pedagogy and Contracts

**Filename:** `FID-2026-0813-012-teacher-pedagogy-contracts.md`
**ID:** FID-2026-0813-012
**Severity:** high
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — contracts precede implementation
**Master FID:** FID-2026-0813-011
**Depends On:** none

---

## Summary

Define the authoritative learning outcomes, JavaScript-only V1 boundary, public/private challenge schemas, mutation and critique contracts, sandbox threat model, privacy policy, and honest progression claims. This FID prevents generated curriculum, grading, and security assumptions from becoming implementation facts.

## Environment

- **OS:** Windows target with cross-platform capability reporting
- **Language/Runtime:** TypeScript/Bun 1.3.14; React/OpenTUI CLI
- **Tool Versions:** ECHO v0.2.0; existing ZTAP implementation
- **Commit/State:** Working-tree planning state; no teacher implementation

## Detailed Description

### Problem

The exploratory plan named `{prompt, knownGood, tests[]}` but did not define who owns pedagogy, how hidden answers remain private, what a critique must prove, or what “passed” honestly means.

### Expected Behavior

Every child FID consumes typed contracts for a target developer learner, skill taxonomy, challenge, mutation, critique, sandbox result, attempt result, privacy policy, and version hash.

### Root Cause

The earlier design began with content generation and UI before resolving trust-domain and learning-validity boundaries.

### Evidence

The authoritative homegrown architecture is `docs/design/Agent-Steering Teacher Homegrown Architecture.md`. The old fCC design is explicitly superseded. ECHO Law 12 covers sensitive-data exposure, not a blanket no-telemetry product policy; the teacher policy must be explicit.

## Impact Assessment

### Affected Components

- `docs/design/Agent-Steering Teacher Homegrown Architecture.md`
- `common/` teacher contracts
- all teacher child FIDs

### Risk Level

- [x] High: ambiguous contracts could invalidate security and grading
- [ ] Critical: no runtime code is changed by this planning FID
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor issue

## Proposed Solution

### Approach

Make the operator own skill objectives and acceptance contracts. Agents may propose artifacts, but independent validation and operator approval are required. Separate public challenge data from private answers, hidden tests, mutations, and flaw contracts.

### Steps

1. Define target learner, prerequisites, skill taxonomy, and evidence rubric.
2. Define public/private challenge, sandbox, grader, critique, and attempt schemas.
3. Define version/hash and privacy rules, including no teacher-content telemetry.
4. Define the sandbox threat model and unsupported-capability behavior.
5. Publish calibration and held-out grading threshold fields for later FIDs.

### Verification

Review every child FID against these contracts; validate serialized examples with common runtime guards; run the active FID ledger.

## Perfection Loop

### Loop 1 — RED

- **RED:** The exploratory design allowed agents to generate authoritative known-good solutions and tests, used a worker as a proposed sandbox boundary, and treated binary Adversary grading as sufficient.
- **GREEN:** Operator-owned pedagogy, private answer packs, capability-based sandbox results, structured critique evidence, and versioned attempts are required.
- **AUDIT:** The homegrown architecture and build order contain matching public/private, sandbox, grading, and claim-boundary sections.
- **ADVERSARIAL:** A generated challenge can still be wrong even when schemas validate; independent execution, mutation testing, and operator approval remain mandatory downstream.
- **CHANGE DELTA:** Converged planning revision.

### Missed Questions

1. **What learner is targeted?** → Developers and reviewers who can read basic JavaScript; beginners are a later track.
2. **What proves learning?** → Repeated correctness and detection across held-out challenges; one pass proves only one attempt.
3. **Can the UI or Forge access answers?** → No; trust domains and runtime APIs enforce this, not prompt text.
4. **What if a sandbox cannot prove its guarantees?** → Return `unavailable` and execute nothing.

### Code Verification Evidence

- [x] Build order and architecture documents exist and agree on the resolved decisions.
- [x] Existing ZTAP is archived and independently signed off; no active-run dependency is claimed.
- [ ] Runtime implementation — intentionally pending this planning FID.

### Loop 2 — Independent audit and self-correction

- **RED:** “No telemetry” could be misattributed to ECHO Law 12, and “proof of skill” could overclaim ZTAP receipts.
- **GREEN:** The contract separates teacher privacy policy from Law 12 and calls receipts process evidence only.
- **AUDIT:** `ECHO.md` defines Law 12 as sensitive-data protection; the architecture and build order use the corrected claim boundary.
- **ADVERSARIAL:** Local-only storage can still leak through logs or exports; child FIDs must test redaction and no-network behavior.
- **CHANGE DELTA:** <10% planning clarification.

### Loop 3 — Final convergence

- **RED:** No unresolved contract contradiction remains; platform capability and calibration are implementation gates.
- **GREEN:** All remaining uncertainty is represented as explicit testable gates.
- **AUDIT:** Master registry and child dependencies consume this contract FID before implementation.
- **ADVERSARIAL:** The contracts do not make the product valuable automatically; the vertical-slice FID is the required value test.
- **CHANGE DELTA:** <2%.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** The contract named calibration and repeatability but did not provide shared default thresholds.
- **GREEN:** The master/build-order defaults now require 20 repeated sandbox fixture runs, 100 labeled critique cases, 95% correct-critique acceptance, and no more than 5% vague/unrelated acceptance.
- **AUDIT:** The authoritative architecture and build order contain the same thresholds and state that they are gates, not current results.
- **ADVERSARIAL:** Fixed thresholds can still encode bad pedagogy; held-out transfer and operator-owned skill contracts remain mandatory.
- **CHANGE DELTA:** <10%.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Implemented the shared teacher contracts in `common/src/teacher/` (types + zod schemas + `./teacher` export + trust-boundary parsers).
- **Tests Added:** `common/src/teacher/__tests__/contracts.test.ts` — 5 trust-boundary guard tests.
- **Verification Evidence:** common typecheck PASS; full common suite 608 pass / 0 fail.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

A teacher feature needs pedagogical and trust contracts before it needs a corpus generator. A valid schema cannot certify valid curriculum.
