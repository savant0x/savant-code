# FID: Current-Version A–Z Evidence and Version Synchronization

**Filename:** `FID-2026-0731-003-current-version-az-evidence.md`
**ID:** FID-2026-0731-003
**Severity:** high
**Status:** fixed
**Created:** 2026-07-31 00:00
**Author:** Buffy

<!-- prettier-ignore -->

---

## Summary

The repository’s current product version is `0.0.11`, and npm `latest` is
`0.0.11`, but the principal launch A–Z prompt and report still target v0.0.9.
The prior report contains a Go recommendation and stale version-consistency
claims, so it cannot certify the current package. This FID creates a fresh
v0.0.11 A–Z specification and evidence report, reconciles version-bearing
project metadata, and clearly labels manual or environment-dependent tests as
deferred rather than passing.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript/Bun monorepo
- **Tool Versions:** Savant-Code `0.0.11`; FreeBuff ECHO v0.1.2
- **Commit/State:** Existing working-tree changes preserved

## Detailed Description

### Problem

`dev/test-prompts/release-az-test-fid-2026-0728-launch-tracks.md` and its report
target v0.0.9. `dev/test-prompts/release-az-test-fid-2026-0728-008.md` and its
report also target v0.0.9. Before this pass, `protocol.config.yaml` reported
`0.0.9` while `package.json`, `cli/package.json`, `sdk/package.json`, `VERSION`,
and the public README reported `0.0.11`. The project-version field is now
synchronized to `0.0.11`; its independent protocol-version field remains
`0.2.0`. Historical reports therefore cannot serve as current release evidence.

### Expected Behavior

A current A–Z audit must:

1. Target exactly the version under audit (`0.0.11` unless a later release is
   explicitly selected).
2. Test build/type safety, packaging, runtime behavior, safety controls,
   onboarding, privacy claims, docs, FID state, and rollback readiness.
3. Include exact command output or file evidence for every result.
4. Mark unavailable Savant-Code local/BYOK platform/manual tests as
   `DEFERRED`, not `PASS`; record future first-party backend,
   auth/model-selection, and recurrence tests for the later free product as
   explicitly post-launch and outside the immediate Savant-Code gate. No
   external FreeBuff hosting or partnership is assumed.
5. Produce a fresh report with a defensible Go/No-Go recommendation.

### Root Cause

Release documents were updated at different times and historical reports were
retained as if they were current certification.

### Evidence

```text
Current version evidence:
- root package.json -> 0.0.11
- cli/package.json -> 0.0.11
- sdk/package.json -> 0.0.11
- VERSION -> 0.0.11
- npm latest -> 0.0.11
- protocol.config.yaml project.version -> 0.0.11 after this pass; protocol.version remains 0.2.0

Historical A–Z evidence:
- launch-track prompt/report -> historical v0.0.9
- history-session prompt/report -> historical v0.0.9
- prior report claims all version metadata was 0.0.9 and recommends GO; that decision is superseded and not reused
```

## Impact Assessment

### Affected Components

- `protocol.config.yaml`
- `VERSION` and package manifests
- `dev/test-prompts/release-az-test-fid-2026-0728-launch-tracks.md`
- `dev/test-prompts/release-az-test-fid-2026-0728-008.md`
- `dev/scratchpad/release-az-test-fid-2026-0728-launch-tracks-report.md`
- `dev/scratchpad/release-az-test-fid-2026-0728-008-report.md`
- Fresh v0.0.11 A–Z prompt/report paths to be approved

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Keep historical reports immutable as historical records, but create a new
current-version audit prompt and report. Decide whether `protocol.config.yaml`
should follow the release version or remain a protocol/project baseline; the
default for launch clarity is to synchronize its project version to the audited
package version while preserving protocol version `0.2.0` separately. Do not
declare Go until all required evidence is current and green.

### Steps

1. Inventory every current version source and classify historical versus active.
2. Define the v0.0.11 A–Z matrix, including packaging and the FID master gate.
3. Run each tier with exact output capture.
4. Execute Savant-Code local/BYOK interactive CLI smoke tests where possible;
   label unavailable OS/platform tests honestly. Track future first-party
   backend/auth/model-selection/recurrence tests for the later free product
   separately as post-launch work; no external FreeBuff hosting or partnership
   is assumed.
5. Publish a fresh report with blockers, pre-existing issues, deferred tests,
   and recommendation.
6. Re-read the prompt/report and compare every expected version literal.

### Verification

- No active launch prompt claims to certify v0.0.9 as current.
- Current version sources agree or have documented intentional scope.
- Every A–Z test has PASS, FAIL, or DEFERRED evidence.
- A fresh v0.0.11 report recommends No-Go if any release, safety, privacy-claim,
  or FID gate is unresolved.
- The report does not inherit a prior Go decision.

## Perfection Loop

### Loop 1

- **RED:** Found stale historical v0.0.9 prompts/reports and a
  `protocol.config.yaml` project-version mismatch against v0.0.11 package
  metadata.
- **GREEN:** Synchronized only `project.version` to `0.0.11`, preserved protocol
  version `0.2.0`, created fresh v0.0.11 prompt/report files, and separated
  PASS/FAIL/DEFERRED evidence.
- **AUDIT:** Fresh evidence passed npm version, all three package dry-runs, five
  workspace typechecks, and 29 focused tests.
  Permission/sandbox/onboarding/health checks were source/registration checks
  backed by existing tests/evidence, not fresh end-to-end behavioral runs; they
  are qualified accordingly.  Savant-Code local/BYOK interactive and cross-platform checks remain DEFERRED
  and remain current evidence gaps. The WSL/tmux launch smoke rendered the CLI,
  but the final persistent-socket capture did not show submitted command/status
  output; a first explicit-socket attempt failed before a pane could be
  captured, and a corrected attempt exited before producing a pane snapshot.
  Those are tooling/launch failures and non-evidence, not passing application
  results. Future first-party backend/auth/model-selection/recurrence checks for
  the later free product are explicitly post-launch and are not Savant-Code
  promotion blockers; no external FreeBuff hosting or partnership is assumed.
  Remaining launch/FID gates are subject to current findings.
- **CHANGE DELTA:** Documentation/config evidence only; no runtime code changed.
- **Result:** `fixed`, with fresh evidence recorded and launch promotion still
  blocked by other child/master gates.

### Missed Questions

1. **Should historical v0.0.9 reports be deleted?** → No; preserve them as
   historical evidence and supersede them with a v0.0.11 report.
2. **Does every workspace package need version 0.0.11?** → Only publish/release
   artifacts need synchronization unless a workspace versioning policy says
   otherwise; document intentional `0.0.1` internal packages.
3. **Can a deferred Savant-Code local interactive or platform test be treated as
   a pass?** → No; it remains a current release-evidence gap. Future
   first-party backend/auth/model-selection/recurrence tests for the later free
   product are different: they are intentionally post-launch and outside the
   immediate Savant-Code gate. No external FreeBuff hosting or partnership is
   assumed.
4. **What is the authoritative release version?** → The audited npm/package
   release and `VERSION`, currently `0.0.11`; any exception must be documented.
5. **What if a fresh A–Z run finds unrelated failures?** → Record them
   immediately in a new FID or link an existing one; do not skip them.

### Code Verification Evidence

- [x] Current and historical prompt/report paths exist.
- [x] Version mismatch is grounded in repository/npm evidence.
- [x] Fresh v0.0.11 prompt/report created and executed.
- [x] Required version, packaging, typecheck, focused-test, and source-check
      output captured.
- [x] Historical v0.0.9 reports explicitly treated as superseded evidence.
- [ ] Savant-Code local/BYOK interactive and cross-platform checks completed
      (DEFERRED where unavailable).
- [x] Future first-party backend/auth/model-selection/recurrence checks for the
      later free product are explicitly classified as post-launch and excluded
      from the immediate Savant-Code gate; no external FreeBuff hosting or
      partnership is assumed.
- [ ] Fresh evidence is sufficient for promotion (blocked by unresolved current
      Savant-Code child/master gates).

## Resolution

- **Fixed By:** Buffy, current-version evidence audit
- **Fixed Date:** 2026-07-31
- **Fix Description:** Synchronized the project version in
  `protocol.config.yaml` to `0.0.11` while preserving protocol `0.2.0`; created
  and executed a fresh v0.0.11 A–Z prompt/report; preserved historical v0.0.9
  records as superseded.
- **Tests Added:** Fresh A–Z prompt/report; 29 focused release/settings tests
  and command-backed evidence recorded in the report.
- **Verified By:** Independent basher execution: npm latest 0.0.11;
  production/staging/SavantFree pack exit 0; common, agent-runtime, SDK, CLI,
  and llm-providers typechecks exit 0; focused tests 29/29.
- **Commit/PR:** Working tree evidence pass (uncommitted; no commit authorized)
- **Archived:** Pending final master Go/No-Go and resolution of documented
  Savant-Code launch gates; future first-party free-product backend validation
  is a later post-launch track

## Lessons Learned

- Versioned evidence expires when the shipped artifact changes.
- Historical “Go” reports must never be reused as current release certification.
- A–Z audits must distinguish behavioral verification from file-presence checks
  and deferred manual work.
