<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Integration and Security Audit

**Filename:** `FID-2026-0813-020-teacher-integration-security-audit.md`
**ID:** FID-2026-0813-020
**Severity:** critical
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — audit owns no product implementation
**Master FID:** FID-2026-0813-011
**Depends On:** FID-2026-0813-013, FID-2026-0813-016, FID-2026-0813-017, FID-2026-0813-018, FID-2026-0813-019

---

## Summary

Perform the final independent audit of the complete teacher feature: trust-domain isolation, sandbox capability, corpus secrecy, grading calibration, exercise lifecycle, UI zero authority, progression privacy, ZTAP claim boundary, call-graph reachability, and repository quality. This FID is the final implementation gate and does not authorize release.

## Environment

- **OS:** Windows target and declared supported platforms
- **Language/Runtime:** TypeScript/Bun 1.3.14; OpenTUI/React 19
- **Tool Versions:** ECHO v0.2.0; ZTAP implementation
- **Commit/State:** Planning-only working tree

## Detailed Description

### Problem

The feature crosses runtime execution, cryptography, grading, CLI UI, persistence, and privacy. Local child tests can pass while the integrated trust boundary is wrong.

### Expected Behavior

The complete feature passes independent static, dynamic, adversarial, call-graph, privacy, and repository gates. Any unavailable or unproven capability is surfaced honestly and blocks unsafe execution.

### Root Cause

Cross-cutting trust failures occur between otherwise green components.

## Impact Assessment

### Affected Components

- all teacher modules and FIDs
- ECHO/runtime call graph
- CLI command and overlay
- corpus/progression artifacts

### Risk Level

- [x] Critical: integration failure could execute hostile code or award false competency
- [ ] High: major feature broken
- [ ] Medium: feature degraded
- [ ] Low: minor issue

## Proposed Solution

### Approach

Run independent adversarial verification after all children pass. Re-run sandbox escape tests, private-data scans, grading calibration, lifecycle tests, static zero-authority scans, no-network checks, and repository gates.

### Steps

1. Verify every production entry point and consumer call graph.
2. Re-run sandbox and trust-domain attack suites.
3. Re-run correctness/detection calibration and held-out tests.
4. Verify UI authority and progression privacy.
5. Verify documentation, configuration, package boundaries, and release claims.
6. Request Nova implementation audit before closure.

### Verification

`bun run typecheck`; root tests; ESLint zero warnings; targeted Markdownlint; Prettier; focused teacher suites; static import scans; platform sandbox matrix; no-network test; FID ledger; independent Nova response.

## Perfection Loop

### Loop 1 — RED

- **RED:** Child-level evidence could not prove cross-domain isolation, target-platform sandbox guarantees, or honest progression claims by itself.
- **GREEN:** Add a final integration FID with explicit cross-domain and claim-boundary gates.
- **AUDIT:** Master registry makes this the terminal dependency after sandbox, graders, UI, and progression.
- **ADVERSARIAL:** A green test suite can share a bug with the implementation; independent fixtures and Nova review remain required.
- **CHANGE DELTA:** Converged planning revision.

### Missed Questions

1. **Who may approve a generated corpus?** → Operator approval after independent validation.
2. **What happens if a child is unavailable?** → The integrated feature remains unavailable; no partial unsafe mode.
3. **Can release follow local tests?** → No; Nova and operator release gates remain separate.
4. **Does Free variant ship automatically?** → No; separate compatibility decision.

### Code Verification Evidence

- [x] Child registry and integration gates are defined.
- [ ] Implementation and independent audit — pending.

### Loop 2 — Independent audit and self-correction

- **RED:** The old coordination note described ZTAP as active and its CLI footprint as absent.
- **GREEN:** The new build order states ZTAP is complete, archived, and consumed through an adapter.
- **AUDIT:** ZTAP archive and Nova implementation sign-off are present in the live tree.
- **ADVERSARIAL:** Documentation drift can reappear; the integration audit includes source/build-order/config parity.
- **CHANGE DELTA:** <10%.

### Loop 3 — Final convergence

- **RED:** No architecture blocker remains; implementation evidence is intentionally absent.
- **GREEN:** Security and calibration failures now fail the feature rather than being deferred as polish.
- **AUDIT:** All dependencies resolve through the master registry.
- **ADVERSARIAL:** This FID can certify integration only after independent runtime evidence; planning convergence is not ship authorization.
- **CHANGE DELTA:** <2%.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** The final audit listed calibration and sandbox evidence but did not explicitly own the shared quantitative threshold review.
- **GREEN:** FID-020 now consumes the 20-run, zero-escape, mutation, 100-case calibration, and held-out transfer evidence from all children.
- **AUDIT:** FID-020 is the terminal dependency and requires no child to be marked implementation-complete without those outputs.
- **ADVERSARIAL:** The integrated feature remains blocked by any one failed child, unavailable sandbox capability, private-data leak, or calibration failure.
- **CHANGE DELTA:** <10%.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Performed the cross-cutting integration audit: end-to-end pipeline run plus trust-domain and call-graph static scans.
- **Tests Added:** `packages/agent-runtime/src/teacher/__tests__/integration-audit.test.ts` — 5 tests.
- **Verification Evidence:** full pipeline corpus→sandbox→engine→progression→ZTAP passes; typecheck ×4, `validate:repository` PASS, ESLint zero warnings; Nova audit still pending.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

Security, grading validity, and claim honesty are integration properties, not optional polish after the UI works.
