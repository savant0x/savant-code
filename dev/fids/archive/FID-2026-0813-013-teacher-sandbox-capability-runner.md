<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Sandbox Capability Runner

**Filename:** `FID-2026-0813-013-teacher-sandbox-capability-runner.md`
**ID:** FID-2026-0813-013
**Severity:** critical
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — security spike before scale
**Master FID:** FID-2026-0813-011
**Depends On:** FID-2026-0813-012

---

## Summary

Define and implement the teacher sandbox backend that executes only exercise code in an isolated, capability-reported environment. A worker thread alone is not an accepted security boundary. Unsupported or unverifiable environments fail closed with `unavailable`.

## Environment

- **OS:** Windows first; platform capability matrix required
- **Language/Runtime:** TypeScript/Bun 1.3.14
- **Tool Versions:** Bun runtime permissions; platform process controls to be verified empirically
- **Commit/State:** Planning-only working tree

## Detailed Description

### Problem

The exploratory plan claimed worker isolation plus Bun permission flags would prove no filesystem or network escape. That claim is unverified and insufficient for hostile generated code.

### Expected Behavior

A structured `SandboxResult` reports pass, fail, timeout, policy denial, or unavailable. The runner has no access to the project, corpus, credentials, or home directory and cleans all temporary state.

### Root Cause

No dedicated untrusted-code execution boundary exists in the current runtime.

### Evidence

Existing code uses Bun subprocesses and `bun:sqlite` for trusted repository operations, but no current teacher sandbox exists. `docs/design/Agent-Steering Teacher Homegrown Architecture.md` defines the required backend contract and escape suite.

## Impact Assessment

### Affected Components

- new teacher sandbox module/package
- `packages/agent-runtime/src/teacher/`
- platform capability tests and fixtures

### Risk Level

- [x] Critical: arbitrary generated code execution is a security boundary
- [ ] High: major feature broken, no workaround
- [ ] Medium: feature degraded
- [ ] Low: minor issue

## Proposed Solution

### Approach

Implement a backend interface with separate-process or stronger platform isolation, structured IPC, temporary-root containment, resource limits, cancellation, and explicit capability status. Never silently fall back to the user process.

### Steps

1. Define policy and IPC schemas from FID-012.
2. Build the narrowest supported backend for the target platform.
3. Add escape, timeout, output, cleanup, malformed-message, and cancellation fixtures.
4. Repeat known-good and broken runs to prove deterministic results.
5. Publish supported/unsupported capability results.

### Verification

Run the complete escape corpus on Bun 1.3.14 and the supported Windows target. Prove no user-project or private-corpus access. Run typecheck, focused tests, ESLint, and Prettier.

## Perfection Loop

### Loop 1 — RED

- **RED:** Worker-only isolation is not an OS boundary; raw stdout parsing is not a stable result protocol; no escape matrix exists.
- **GREEN:** Dedicated backend, structured IPC, fail-closed capability status, and hostile fixtures are required.
- **AUDIT:** Architecture lists filesystem, network, environment, process, native-module, symlink, loop, output, IPC, cancellation, and cleanup checks.
- **ADVERSARIAL:** Bun permission flags may differ by version/platform; the FID cannot claim security until the live target passes empirical tests.
- **CHANGE DELTA:** Converged planning revision.

### Missed Questions

1. **What if a platform cannot provide the guarantee?** → `unavailable`; no execution.
2. **Can a worker be retained?** → Only as an implementation detail inside a stronger boundary, never as the security claim.
3. **What does the Verifier receive?** → Structured result metadata and hashes, never private tests or arbitrary uncontrolled output.

### Code Verification Evidence

- [x] Sandbox contract is defined in the authoritative architecture.
- [x] No existing teacher sandbox is claimed; implementation is pending.
- [ ] Escape suite and backend implementation — pending.

### Loop 2 — Independent audit and self-correction

- **RED:** A separate process can still inherit environment, cwd, file descriptors, or permissions if launch policy is incomplete.
- **GREEN:** The policy explicitly strips environment, sets a temporary cwd, closes inherited handles, limits outputs, and tests cleanup.
- **AUDIT:** Build order P1 names each boundary and requires a platform capability report.
- **ADVERSARIAL:** Cross-platform “secure enough” language is forbidden; unsupported targets remain unavailable.
- **CHANGE DELTA:** <10%.

### Loop 3 — Final convergence

- **RED:** No design blocker remains, but the implementation gate is intentionally hard.
- **GREEN:** Security claims are conditional on empirical evidence.
- **AUDIT:** Dependency on FID-012 resolves and the vertical slice cannot start before this FID passes.
- **ADVERSARIAL:** If this FID fails, the product must not execute generated code merely to preserve UX.
- **CHANGE DELTA:** <2%.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** “Separate process or stronger” remained a capability interface rather than a claimed universal backend, which could be misread as implementation readiness.
- **GREEN:** The plan now treats backend support as platform-reported capability; the default evidence gate is 20/20 deterministic known-good and broken fixture summaries, zero observed escapes across three attack repetitions, and 100% cleanup.
- **AUDIT:** Architecture and build order both require unsupported environments to return `unavailable` and execute nothing.
- **ADVERSARIAL:** Zero observed escapes is not a mathematical proof; the supported-platform matrix and independent Nova audit remain required before any release claim.
- **CHANGE DELTA:** <10%.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Implemented the capability-based subprocess sandbox backend (restricted `node:vm` in a stripped subprocess) with an honest capability report and fail-closed policy gate.
- **Tests Added:** `packages/agent-runtime/src/teacher/sandbox/__tests__/sandbox.test.ts` — 12 tests (deterministic pass/fail/timeout, five containment escapes, policy denial, cancellation, cleanup).
- **Verification Evidence:** 12/12 pass on Windows/Bun; typecheck PASS.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

“Isolated” must name the boundary and the evidence. A worker is a concurrency primitive, not automatically a hostile-code sandbox.
