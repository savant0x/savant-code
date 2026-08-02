# FID: Release Packaging and Validation Contract

**Filename:** `FID-2026-0731-002-release-packaging-validation-contract.md`
**ID:** FID-2026-0731-002
**Severity:** high
**Status:** closed
**Created:** 2026-07-31 00:00
**Author:** Buffy

---

## Summary

The production npm package `savant-code@0.0.11`, the private internal staging package, and the SavantFree wrapper now have a coherent local validation contract. Before remediation, the staging dry-run failed because `cli/release-core/prepare-package.js` rejected `savant-code-staging`, and `wrapper-safety.test.ts` expected stale staging/SavantFree values. This FID records the evidence-backed contract correction without changing telemetry runtime behavior.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** Node-compatible CommonJS release wrappers, Bun tests
- **Tool Versions:** npm package `savant-code@0.0.11`; Bun 1.3.14
- **Commit/State:** Existing working-tree changes preserved

## Detailed Description

### Problem

The release package contracts disagree:

- `cli/release/package.json` is the production `savant-code` package and packs successfully.
- `cli/release-staging/package.json` names `savant-code-staging`; its wrapper now uses the same package identity and retains `Codecane` only as the in-app staging display name.
- `prepare-package.js` now allowlists `savant-code`, `savant-code-staging`, and `savant-free` without the duplicate production entry.
- `wrapper-safety.test.ts` now verifies the approved staging identity and the existing `cli.update_freebuff_failed` runtime event without changing telemetry code.

### Expected Behavior

Every maintained release package must have one explicit identity, package hook behavior, wrapper configuration, and test contract. Production packaging must remain unaffected. Staging must either be removed from the supported release matrix or become a coherent internal-only package. SavantFree’s identifier mismatch must be dispositioned without changing telemetry policy in this FID.

### Root Cause

Release wrappers evolved from older product names and were partially rebranded. The shared package-preparation allowlist and wrapper tests were not updated as one contract.

### Evidence

```text
Final verification:
npm pack ./cli/release --dry-run -> exit 0 (`savant-code@0.0.11`, 5 files)
npm pack ./cli/release-staging --dry-run -> exit 0 (`savant-code-staging@0.0.1`, 5 files)
npm pack ./savant-free/cli/release --dry-run -> exit 0 (`savant-free@0.0.123`, 5 files)

Focused release suite -> exit 0 (24 passed, 0 failed)
Staging manifest -> `private: true`, binary `savant-code-staging`
Staging README -> local dry-run instructions only; no public npm install command
```

## Impact Assessment

### Affected Components

- `cli/release-core/prepare-package.js`
- `cli/release/package.json`
- `cli/release-staging/package.json`
- `cli/release-staging/index.js`
- `savant-free/cli/release/index.js`
- `cli/src/__tests__/release/wrapper-safety.test.ts`
- `cli/src/__tests__/release/proxy-http-get.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

First choose and document the supported release matrix. The robust default is to preserve only packages that have a clear product identity: production `savant-code`; optionally an explicitly internal staging package; and SavantFree only when its release contract is intentionally maintained. Do not silently rename or remove a package based solely on a stale test expectation.

For any retained package, align package name, wrapper `packageName`, display name, download target, preparation allowlist, files, and tests. Treat the SavantFree telemetry identifier as a separate policy-controlled value: this FID may document the mismatch and update a test contract only after confirming the identifier is not being changed as part of the deferred telemetry decision.

### Steps

1. Read every maintained release manifest, wrapper, shared helper, and focused test 0–EOF.
2. Decide whether staging is retained, removed from the supported matrix, or renamed coherently; record the decision in this FID before editing.
3. Align the preparation allowlist and package hooks with that decision.
4. Resolve the SavantFree identifier mismatch without changing telemetry collection behavior; if policy is required, route it to FID-2026-0731-006.
5. Run focused wrapper tests and all three npm pack dry-runs.
6. Run the production binary smoke path where available.

### Verification

- `npm pack ./cli/release --dry-run` exits 0.
- Any retained staging/free package dry-run exits 0, or its removal is documented and tests no longer claim it is supported.
- `bun test cli/src/__tests__/release/wrapper-safety.test.ts cli/src/__tests__/release/proxy-http-get.test.ts cli/src/__tests__/terminal-reset-sequences.test.ts` exits 0.
- Wrapper tests verify packaged launcher precedence and lifecycle safety.
- No telemetry behavior is changed without FID-006 approval.

## Perfection Loop

### Loop 1

- **RED:** Found production pack green but staging pack failing and two wrapper-safety failures. Found contradictory staging identities and a legacy SavantFree telemetry identifier.
- **GREEN:** Bounded the work to release-contract reconciliation. Added an explicit product-matrix decision before edits and separated telemetry-policy decisions from packaging.
- **AUDIT:** Final independent review confirms the production, private staging, and SavantFree package contracts are coherent. The focused release suite passed 24/24, all three dry-runs exited 0, and staging’s private manifest/README enforce the internal-only disposition. No telemetry runtime behavior changed.
- **CHANGE DELTA:** Updated the release helper, staging manifest/wrapper/docs, and focused test contract; no telemetry runtime behavior changed.
- **Result:** `closed`; implementation and verification complete, ready for archive.

### Missed Questions

1. **Is staging public?** → Current evidence does not prove it is public; default assumption is internal-only unless release ownership confirms otherwise.
2. **Should `codecane` be restored?** → No assumption; it is a legacy test/config signal and must not override the package manifest without evidence.
3. **Does changing a telemetry event string count as telemetry-policy work?** → It can affect observability contracts; route the decision through FID-006 before changing runtime identifiers.
4. **Can production npm publication be repeated from this repository?** → Not yet proven; the FID verifies local packability and documents the publish workflow separately if needed.
5. **Do wrapper tests cover actual installed tarballs?** → Current tests inspect source/package fixtures; a packed-tarball smoke test should be added if the release path depends on it.

### Code Verification Evidence

- [x] Referenced release files exist.
- [x] Production npm package registry and dry-run evidence recorded.
- [x] Staging dry-run failure recorded from tool output.
- [x] Product matrix approved: retain `savant-code-staging` as an internal-only package; align its wrapper identity to the manifest and do not publish it as the production package.
- [x] Implementation and focused tests verified: focused wrapper/proxy/terminal-reset suite passed 24/24; production, private staging, and SavantFree pack dry-runs all exited 0.
- [x] Staging manifest is `private: true`, named `savant-code-staging`, and exposes only the `savant-code-staging` binary.
- [x] Staging README contains no public npm install command and documents local dry-run validation only.

## Resolution

- **Fixed By:** Buffy, under operator-approved FID execution
- **Fixed Date:** 2026-07-31
- **Fix Description:** Retain staging as an internal-only `savant-code-staging` package; align package preparation, wrapper identity, and focused tests while preserving the existing SavantFree telemetry identifier.
- **Tests Added:** No new tests; existing focused release tests were corrected to the approved package contract.
- **Verified By:** Independent verification: 24 focused tests passed; `savant-code@0.0.11`, `savant-code-staging@0.0.1`, and `savant-free@0.0.123` pack dry-runs exited 0; staging manifest/README checks passed.
- **Commit/PR:** Pending
- **Archived:** 2026-07-31

## Lessons Learned

- A passing production package does not make every repository release surface valid.
- Product identity must be consistent across manifests, wrappers, helper allowlists, and tests.
- Legacy telemetry identifiers require policy-aware handling, not casual string cleanup.
