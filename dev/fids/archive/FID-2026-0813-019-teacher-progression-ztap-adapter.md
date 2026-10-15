<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Progression and ZTAP Adapter

**Filename:** `FID-2026-0813-019-teacher-progression-ztap-adapter.md`
**ID:** FID-2026-0813-019
**Severity:** medium
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — process proof is not skill proof
**Master FID:** FID-2026-0813-011
**Depends On:** FID-2026-0813-018

---

## Summary

Persist local attempt history and competency DAG edges with versioned SQLite migrations. Integrate with the existing ZTAP implementation through a narrow process-evidence adapter and label any fallback marker as `local-unverified`.

## Environment

- **OS:** Windows/Bun local-first
- **Language/Runtime:** TypeScript/Bun 1.3.14; existing ZTAP and SQLite conventions
- **Tool Versions:** ZTAP v1 receipt/export surface
- **Commit/State:** Planning-only working tree

## Detailed Description

### Problem

The exploratory design called a local receipt “proof-of-skill” and described ZTAP as conditional even though ZTAP is already implemented and independently audited in this repository.

### Expected Behavior

Progress records versioned exercise evidence, supports replay/migration/corruption handling, sends nothing to the network, and claims only that an attempt met a rubric version.

### Root Cause

Process integrity, learner identity, and general competence were conflated.

## Impact Assessment

### Affected Components

- local teacher progression database
- ZTAP adapter
- `/learn` completion state

### Risk Level

- [ ] Critical: no external authority
- [x] Medium: misleading progression or corrupt local history
- [ ] High: major feature broken
- [ ] Low: minor issue

## Proposed Solution

### Approach

Use versioned migrations and immutable attempt records. Store challenge/corpus/grader/mutation/sandbox hashes and evidence hashes. Emit ZTAP process receipts without introducing duplicate crypto.

### Steps

1. Define schema and migration version.
2. Persist attempt and competency-edge events idempotently.
3. Add corruption, replay, duplicate, and downgrade handling.
4. Adapt successful attempts to ZTAP receipts.
5. Add explicit `local-unverified` fallback behavior and no-network tests.

### Verification

Migration and replay fixtures, privacy scans, no-network tests, receipt bundle checks, and honest-copy assertions must pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** “ECHO-Verified skill %” and “proof-of-skill” overstate what ephemeral process receipts prove.
- **GREEN:** Use “completed exercise evidence” and preserve the ZTAP claim boundary.
- **AUDIT:** Existing ZTAP architecture states receipts prove mechanical process integrity, not LLM independence or identity.
- **ADVERSARIAL:** Local DB tampering remains possible; the UI must not call local state independently verified.
- **CHANGE DELTA:** Converged planning revision.

### Missed Questions

1. **What does the receipt bind?** → Attempt id, challenge/corpus/grader/mutation/sandbox versions, result, and evidence hashes.
2. **What if ZTAP is unavailable?** → Store `local-unverified`; do not silently upgrade the claim.
3. **Can raw critique be persisted?** → Only if a future privacy contract permits it; V1 stores redacted evidence hashes.

### Code Verification Evidence

- [x] Existing ZTAP archive and sign-off are present; no conditional active-build claim remains.
- [ ] Progression migrations and adapter — pending.

### Loop 2 — Independent audit and self-correction

- **RED:** A DAG can reward repetition without transfer.
- **GREEN:** Separate completion, repetition, and held-out transfer evidence.
- **AUDIT:** Build order and architecture distinguish exercise completion from mastery.
- **ADVERSARIAL:** Gamified streaks can become dark pressure; no streak is required for progression or retention.
- **CHANGE DELTA:** <10%.

### Loop 3 — Final convergence

- **RED:** No unresolved planning contradiction.
- **GREEN:** ZTAP is an adapter, not a duplicate trust system.
- **AUDIT:** Dependency on `/learn` and result contract is explicit.
- **ADVERSARIAL:** A signed local receipt remains relative to an ephemeral session key; export language must retain that warning.
- **CHANGE DELTA:** <2%.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** Progression named held-out transfer but did not specify when stronger competency state could unlock.
- **GREEN:** A single attempt records evidence only; stronger competency claims require three held-out successful exercises, and local markers remain `local-unverified`.
- **AUDIT:** The build order and architecture now contain the same progression boundary and ZTAP process-only claim.
- **ADVERSARIAL:** Three held-out passes still do not prove identity or general mastery; UI and export copy must retain the narrow claim.
- **CHANGE DELTA:** <10%.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Implemented the versioned SQLite progression store and the honest ZTAP process-evidence adapter reusing existing `signPayload`/JCS primitives. Follow-up: the adapter emits a full, self-contained `savant.teacher.attempt-receipt.v1` (role, public key, `over`, signature, signed evidence) persisted on the progression record, and the live `/learn` runtime now signs each completed attempt with an ephemeral, memory-only teacher session key and **persists it** — a terminal `passed`/`failed` attempt is written to the project-scoped SQLite store and the skill's competency edge advances (`completed` on a pass, `attempted` otherwise, never downgraded); `cancelled`/`unavailable` award no progression.
- **Tests Added:** `packages/agent-runtime/src/teacher/progression/__tests__/progression.test.ts` — 10 tests, extended with independent `verifyPayload` re-verification and `deriveCompetencyEdge` unit tests; `cli/src/teacher/__tests__/runtime.test.ts` asserts the live attempt receipt signs + verifies and the attempt is persisted as a versioned competency record; `cli/src/commands/__tests__/learn.test.ts` asserts the `/learn` result records competency through an injected store.
- **Verification Evidence:** migration, idempotency, corruption, downgrade, privacy, no-network, `ztap-signed` vs `local-unverified`, independent receipt re-verification, and competency-edge derivation all pass.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

A durable local record is useful only when its claim is narrower than its marketing.
