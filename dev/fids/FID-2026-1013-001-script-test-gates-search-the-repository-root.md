# FID: Script test gates search the repository root

**Filename:** `FID-2026-1013-001-script-test-gates-search-the-repository-root.md`
**ID:** FID-2026-1013-001
**Severity:** medium
**Status:** verified
**Created:** 2026-10-13 09:40
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022

## Summary

FID receipt execution runs script test paths from the repository root. Bun uses
substring filters, so repository copies and unrelated ignored trees participate
in discovery. Focused script tests complete from scripts/ while receipt workers
remain in root discovery for minutes. Apply the existing workspace isolation
contract to the scripts tree even though it is not a registered Bun workspace.

## Environment

- **OS:** Windows 11, PowerShell
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Commit/State:** existing mixed working tree; commits held by the operator

## Detailed Description

### Problem and evidence

`scripts/fid-verify.ts:resolveGate` chooses test cwd only from WORKSPACES.
Scripts is absent from that list. A captured child command is
`bun.exe test scripts/__tests__/learnings-projection.test.ts`, with root cwd.
The combined learning suites complete from scripts/ (35 pass); root receipt
workers linger while discovering the same paths. AGENTS.md documents this Bun
substring-filter hazard and requires suites to run from their workspace root.

### Expected Behavior and Root Cause

Script test gates use scripts/ as cwd and strip scripts/ from the filter.
Typecheck workspace admission remains tied to the registered workspace policy.

## Impact Assessment

### Affected Components

- scripts/fid-verify.ts
- scripts/__tests__/fid-verify.test.ts

### Risk Level

- [x] Medium: verification is unreliable and unnecessarily broad.

## Proposed Solution

### Steps

1. Include scripts in test-root resolution, preserving longest-prefix matching.
2. Pin argv, cwd and unchanged receipt labels for script tests.
3. Run the runner suite, scripts typecheck, quality and affected FID gates.

### Verification

`scripts/__tests__/fid-verify.test.ts` must assert script-root isolation while
retaining its existing workspace and command-injection checks.

## Verification Gates

- gate: test scripts/__tests__/fid-verify.test.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:0bef9c19c81403bfaa2a80e0f0ff9898d49ed1988fce58a59a91ae607852890e
- verified: 2026-10-13T15:31:15.643Z
- test scripts/__tests__/fid-verify.test.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — Converged implementation contract

- **RED:** The runner's test branch excludes scripts from root resolution;
  direct script-cwd tests pass while receipt discovery remains active.
- **GREEN:** Extend the existing test-root selection with scripts; retain
  workspace admission for typechecks and every receipt's repo-relative label.
- **AUDIT:** Existing runner tests cover argv safety and workspace isolation;
  extend that suite for scripts before implementation verification.
- **ADVERSARIAL:** Scripts must not become an allowlisted typecheck workspace.
  Do not remove gates or manufacture receipts to avoid discovery.
- **CHANGE DELTA:** Recorded presentation before source writes.

### Missed Questions

1. Why include scripts when it is not a registered workspace? Test discovery
   needs its directory boundary; typecheck admission still uses the workspace
   policy and the scripts tree still declares its independent typecheck probe.
2. Does this prove a class stopped recurring? No. It proves gate argv/cwd
   isolation and reliable verification of the current source; observation remains
   the class lane's responsibility.

### Code Verification Evidence

`scripts/fid-verify.ts:resolveGate` includes scripts in test-root selection only.
The runner regression suite passes 25 tests, including script argv/cwd and stable
receipt labels. FID-014 and FID-012 gates now complete and stamp live receipts;
typecheck workspace admission remains unchanged. Quality passes at 300 lines for
the runner test. Formal closure remains blocked by the operator's commit hold.

## Resolution

Implemented and verified. Formal closure requires a commit and remains blocked by the
operator's explicit no-commit hold. No push or release is authorized.
