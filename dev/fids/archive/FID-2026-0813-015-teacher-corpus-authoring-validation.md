<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Corpus Authoring and Validation

**Filename:** `FID-2026-0813-015-teacher-corpus-authoring-validation.md`
**ID:** FID-2026-0813-015
**Severity:** high
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — generated corpus is not self-authorizing
**Master FID:** FID-2026-0813-011
**Depends On:** FID-2026-0813-012, FID-2026-0813-014

---

## Summary

Build a build-time authoring pipeline in which the operator defines skills and agents propose challenge artifacts. Independent validation executes known-good solutions, runs mutation tests, checks private-data isolation, hashes manifests, and creates a reviewed public/private runtime pack.

## Environment

- **OS:** Windows target; local-first
- **Language/Runtime:** TypeScript/Bun 1.3.14; SQLite runtime artifact
- **Tool Versions:** Existing database/SQLite conventions
- **Commit/State:** Planning-only working tree

## Detailed Description

### Problem

The exploratory design made agent-generated known-good solutions and tests the apparent source of truth and stored all fields in one corpus DB.

### Expected Behavior

The operator owns pedagogy; agents propose artifacts; validation proves behavior, mutation detectability, isolation, and deterministic packaging before approval.

### Root Cause

Generation, grading authority, and runtime storage were conflated.

### Evidence

The authoritative architecture separates `PublicChallenge` from `PrivateChallengePack` and treats SQLite as a generated runtime artifact.

## Impact Assessment

### Affected Components

- build-time teacher authoring tool
- common manifest validation
- `.savant/teacher/` runtime pack generation

### Risk Level

- [x] High: bad tests or leaked answers invalidate the product
- [ ] Critical: execution boundary owned by FID-013
- [ ] Medium: feature degraded
- [ ] Low: minor issue

## Proposed Solution

### Approach

Use versioned source manifests and content-addressed private packs. Require operator approval and independent validation; never let runtime generation silently alter the shipped corpus.

### Steps

1. Define source manifest and pack builder.
2. Add known-good repeatability and broken-variant tests.
3. Add mutation survival and weak-test detection.
4. Add private-answer reachability and redaction scans.
5. Build SQLite runtime artifact with version/hash metadata.

### Verification

Corpus fixtures must pass the full validation pipeline, produce stable hashes, and show no private field in Forge, learner, UI, or ordinary chat payloads.

## Perfection Loop

### Loop 1 — RED

- **RED:** One corpus DB permits known-good and hidden tests to become reachable through path, import, or error leakage.
- **GREEN:** Public/private packs and build-time approval are mandatory.
- **AUDIT:** Architecture and build order agree on source manifests versus SQLite runtime artifact.
- **ADVERSARIAL:** An independent agent can still generate a plausible but pedagogically invalid challenge; operator approval and held-out review remain required.
- **CHANGE DELTA:** Converged planning revision.

### Missed Questions

1. **Can tests be visible?** → Only explicitly public guidance; grading tests remain private unless the challenge contract says otherwise.
2. **Can the runtime generate new lessons?** → No in V1; generation is build-time and approval-gated.
3. **What proves a test is useful?** → Known-good passes and meaningful mutation variants fail.

### Code Verification Evidence

- [x] Source/runtime split and validation gates are documented.
- [ ] Authoring pipeline and validation suite — pending.

### Loop 2 — Independent audit and self-correction

- **RED:** SQLite files are difficult to review and can become stale relative to source manifests.
- **GREEN:** Manifest and pack hashes are stored and checked at runtime/build time.
- **AUDIT:** Build order requires deterministic hashes and pack validation.
- **ADVERSARIAL:** Hashes prove bytes, not pedagogy; operator review remains a hard gate.
- **CHANGE DELTA:** <10%.

### Loop 3 — Final convergence

- **RED:** No unresolved contract issue.
- **GREEN:** Authoring is explicitly after the vertical slice.
- **AUDIT:** Dependencies resolve to contracts and slice evidence.
- **ADVERSARIAL:** If authoring cannot produce mutation-detectable challenges, scale is blocked.
- **CHANGE DELTA:** <2%.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** Manifest hashes and mutation witnesses were required, but the minimum repeatability gate was implicit.
- **GREEN:** Every approved challenge now inherits 20-run known-good repeatability, stable result summaries, and a tested witness for every registered mutation.
- **AUDIT:** The build order states these as corpus-release gates and keeps SQLite as a generated artifact.
- **ADVERSARIAL:** Stable bytes can still encode bad pedagogy; operator approval and held-out review remain non-automated gates.
- **CHANGE DELTA:** <10%.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Implemented the source manifest, content-addressed pack builder, and sandbox-backed validation pipeline (known-good repeatability, mutation witnesses, isolation scan).
- **Tests Added:** `packages/agent-runtime/src/teacher/corpus/__tests__/corpus.test.ts` — 12 tests.
- **Verification Evidence:** 12/12 pass; 20-run repeatability, stable hashes, mutation witness, and isolation leak detection.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

Generated educational content needs a release process, not merely a generator.
