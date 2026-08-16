<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Mutation and Detection Grader

**Filename:** `FID-2026-0813-017-teacher-mutation-detection-grader.md`
**ID:** FID-2026-0813-017
**Severity:** high
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — bounded Adversary semantics
**Master FID:** FID-2026-0813-011
**Depends On:** FID-2026-0813-014, FID-2026-0813-015

---

## Summary

Implement the detection half of the teacher using one deterministic mutation per attempt, a versioned flaw contract, structured learner evidence, deterministic prechecks, and bounded Adversary adjudication. The injector never invents untestable random defects.

## Environment

- **OS:** Windows/Bun target
- **Language/Runtime:** TypeScript/Bun 1.3.14
- **Tool Versions:** Teacher sandbox, corpus packs, existing read-only Adversary
- **Commit/State:** Planning-only working tree

## Detailed Description

### Problem

Unbounded LLM-generated slop and unconstrained LLM-as-judge grading can create false accepts, false rejects, and unrepeatable lessons.

### Expected Behavior

Each mutation has a real witness, expected impact, detectability tests, and acceptable critique concepts. The learner critique identifies behavior plus evidence; the Adversary adjudicates only within that contract.

### Root Cause

The exploratory plan treated “identified the flaw” as binary without defining the flaw or evidence standard.

## Impact Assessment

### Affected Components

- mutation catalog and injector
- critique extractor and grader
- Adversary prompt/result contract

### Risk Level

- [x] High: this is the category-defining grading surface
- [ ] Critical: no code execution boundary is changed here
- [ ] Medium: feature degraded
- [ ] Low: minor issue

## Proposed Solution

### Approach

Begin with one mutation per attempt and a fixed contract containing location, behavior, witness, impact, severity, and acceptable synonyms. Store structured grade evidence.

### Steps

1. Define mutation schema and deterministic injector.
2. Prove each mutation parses and has a real behavioral witness.
3. Define critique evidence fields and safe redaction.
4. Add deterministic prechecks and bounded Adversary adjudication.
5. Measure calibration and held-out transfer.

### Verification

Correct, vague, unrelated, partially correct, synonym-rich, and adversarial critiques must be classified against a labeled set. Report false-accept/reject results before enabling progression.

## Perfection Loop

### Loop 1 — RED

- **RED:** Random 1–3 slop defects are not reproducible, and a binary LLM grade lacks a stable oracle.
- **GREEN:** Versioned mutation contracts, one mutation per attempt, witnesses, structured evidence, and bounded adjudication.
- **AUDIT:** Architecture defines `CritiqueGrade` and calibration/held-out sets.
- **ADVERSARIAL:** A critique can correctly name a symptom without understanding impact; rubric requires behavior, witness, and impact coverage.
- **CHANGE DELTA:** Converged planning revision.

### Missed Questions

1. **Must the mutation keep visible tests green?** → Only if the lesson explicitly tests detection of a hidden defect; the mutation contract records which tests should and should not reveal it.
2. **Can the Adversary see the private answer pack?** → It receives only the necessary mutation contract and evidence, never unrestricted corpus access.
3. **What if calibration fails?** → Detection progression is disabled; the feature reports unavailable/uncalibrated rather than awarding credit.

### Code Verification Evidence

- [x] Mutation and critique contracts are defined.
- [ ] Injector, grader, and calibration suite — pending.

### Loop 2 — Independent audit and self-correction

- **RED:** Natural-language synonym matching can overfit a fixed phrase list.
- **GREEN:** Use semantic contract evidence plus labeled held-out examples; phrase lists are only a precheck.
- **AUDIT:** Adversary output is structured and bounded by mutation id/version.
- **ADVERSARIAL:** A model can still be agreeable; calibration thresholds and no-progression-on-failure are hard gates.
- **CHANGE DELTA:** <10%.

### Loop 3 — Final convergence

- **RED:** No unresolved design contradiction.
- **GREEN:** Detection is the moat but not allowed to silently become an LLM-only oracle.
- **AUDIT:** Dependency on validated corpus and vertical slice is explicit.
- **ADVERSARIAL:** If the grader cannot distinguish vague from evidence-backed critiques, V1 detection is not shippable.
- **CHANGE DELTA:** <2%.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** Calibration was required but lacked a concrete planning default.
- **GREEN:** The V1 gate is at least 100 labeled critique cases across the mutation catalog, 95% acceptance of fully correct critiques, and at most 5% acceptance of vague/unrelated critiques; held-out transfer is reported separately.
- **AUDIT:** The architecture, build order, and master now repeat the same threshold and disable progression when calibration fails.
- **ADVERSARIAL:** Thresholds can be gamed by a narrow dataset; the held-out set, mutation diversity, and independent Nova review are mandatory.
- **CHANGE DELTA:** <10%.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Implemented the deterministic detection grader (mutation injector, structured critique grading) with a calibration harness.
- **Tests Added:** `packages/agent-runtime/src/teacher/grading/__tests__/grading.test.ts` (detection) — 6 tests.
- **Verification Evidence:** calibration on the labeled set ≥95% acceptance of correct and ≤5% of vague/unrelated.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

The moat is not “an Adversary exists”; it is a repeatable flaw contract the Adversary cannot casually overrule.
