# FID: Verification harness has unwired resets and stale policy/evidence pins

**Filename:** `FID-2026-1012-025-verification-harness-drift.md`
**ID:** FID-2026-1012-025
**Severity:** medium
**Status:** converged
**Created:** 2026-10-12
**Automation level:** 3
**Master FID:** FID-2026-1012-022
**YAGNI-Compliance:** Verified

## Summary

The master's broad verification found two production reset seams absent from their
workspace test preloads, one skill-command pin that contradicts an operator ruling,
and one test still reading a removed scratchpad census. Repair these verification
defects before using the broader battery to assess the remediation program.

## Root cause and evidence

- `scripts/__tests__/module-state-audit.test.ts` fails its real-repository check:
  `clearModelAutoWire` and `resetComplianceCaptureCache` exist but no preload calls them.
  Their modules own `pending` and `enabledCache`; neither has an import-time side effect
  that prevents legitimate preload wiring.
- `scripts/__tests__/skills-check-false-command-words.test.ts` expects Tauri to fail
  admission, but `scripts/skills-check-policy.ts` explicitly allowlists it under the
  operator's 2026-10-03 ruling. Preserve that ruling and restore a distinct forbidden
  command as the negative control.
- `scripts/__tests__/window-coverage-check.test.ts` points at a removed scratchpad
  file. The production loader already exports `DEFAULT_CENSUS_PATH`, pointing to the
  durable measured `common/src/constants/provider-catalog-census.json`.
- Two changelog failures came from running root-owned script tests in `scripts/`;
  they pass from repository root. Four gate-control timeouts pass without competing
  heavy gate processes: 12 PASS in 14.52 seconds. Neither finding warrants source changes.

## Implementation contract

1. Import and call each existing reset in its own workspace's `beforeEach` preload.
2. Replace the stale forbidden Tauri pin with a forbidden signing command, and add
   a positive Tauri pin so the policy ruling remains tested.
3. Consume the loader's durable census path in the real-fixture pin; preserve the
   missing-file and malformed-shape negative controls.
4. Run the root-owned harness suites at repository root, relevant workspace suites,
   full typecheck, lint and quality. Commit implementation before receipt and archival.

## Impact and boundaries

Only test isolation and test assertions change. Production policy, caches, model
selection and census data retain their current behavior. No production failure class
is declared repaired by this FID. No timeout budget is inflated to hide contention.
No extra abstraction or test-only production seam is needed: both reset seams exist.

## Perfection Loop

### Loop 1 — Current-tree investigation

- **RED:** Three real harness tests fail from the correct roots, naming the precise
  missing wiring and stale assertions above. The underlying modules and preloads
  were read in full before this design.
- **GREEN:** Four scoped files consume existing authoritative seams and constants;
  add the policy's positive control without weakening the forbidden-command check.
- **AUDIT:** The module-state scanner directly checks actual preload imports and calls.
  Production census path exists with measured positive codecraft rows. Tauri's explicit
  dated allowlist ruling is present in the policy source.
- **ADVERSARIAL:** A generic exemption would leave state leaking; a dummy census would
  hide evidence rot; removing the failing policy test would lose negative coverage.
  Existing seams and the durable measured source answer all three objections.
- **Missed question:** Did working-directory errors or CPU contention establish a defect
  in gate implementations? No: the corrected-root and isolated runs refute those claims.
- **CHANGE DELTA:** Pre-write design only; no harness source changed in this loop.

## Verification Gates

Declare the concrete gates and stamp their receipt after implementation.

## Resolution

Open, converged. This finding is retained under the master's level-3 authorization.
