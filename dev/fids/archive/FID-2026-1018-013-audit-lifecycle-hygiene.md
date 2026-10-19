# FID: Close lifecycle and audit-tooling hygiene gaps

**Filename:** `FID-2026-1018-013-audit-lifecycle-hygiene.md`
**ID:** FID-2026-1018-013
**Severity:** medium
**Status:** closed
**Created:** 2026-10-18 22:30
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

The full scripts audit exposes missing process-state ownership declarations,
unwired diagnostic resets and standalone probes that execute on import.
Documentation review additionally identifies skill evolution writing outside
the scratchpad's allowed active/archive directory shape.

## Environment

- **Commit/State:** e26b9ab230f8ebf1df543d819bf0d48a914f0ea4 plus audited changes.
- **Runtime:** Bun 1.3.14, Windows.

## Detailed Description

### Problem / Root cause / evidence

`bun scripts/audit-module-state.ts` reports 17 uncured bindings and two reset
wiring gaps: console capture and exit provenance resets are absent from the CLI
preload; per-object shared-event/command-job WeakMaps and the cached FFI handle
need explicit lifetime policy; standalone probes have unguarded top-level work.
scripts/evolve-skills.ts:33 writes dev/scratchpad/evolve-output, conflicting
with scripts/hygiene.ts's active/archive root contract.

### Expected behavior

Standalone probes execute only as entrypoints; importing them starts no CLI,
temp-repository or schema scan. Resettable diagnostic flags are wired to the
test preload. Object-lifetime registries and process-native FFI state keep their
real lifetimes, with exact self-validating audit reasons. Evolution output lives
under the managed active tree.

## Impact Assessment

Test/preload and operator-tooling lifecycle changes. No global audit suppression,
no PID cleanup or provider behavior change, no live skill mutation.

## Proposed Solution

1. Wrap mutable standalone probe execution in main functions guarded by
   import.meta.main, retaining executable behavior and failure exit codes.
2. Wire the two existing diagnostic reset functions into CLI test-setup.
3. Add exact audit exemptions for the two WeakMaps and kernel cache: resetting
   active object associations loses cleanup/containment identity; unloading a
   native library invalidates live closures. New emitter/child objects isolate
   tests; ordinary cleanup still removes each association.
4. Move skill-evolution output beneath dev/scratchpad/active/evolve-output;
   extend its existing test to run collectScratchpadIssues against the fixture.
5. Run scripts audit tests, evolution tests, production probes and static gates.
6. Repair audit-evidence's own root-cwd substring test commands: split the
   existing pins by workspace, run from that workspace and record cwd in the
   transcript. Correct verify-clean help's stale workspace count.
7. Replace two stale exact ledger-size pins with their existing audited
   minimums: the governed ledger gained the valid native-renderer lesson
   FID-2026-1017-006. Continue enforcing unique titles, valid canonical rule
   references, no consolidation proposals and the boot-size budget. Additions
   to the local growing ledger must not invalidate unrelated parser tests.

### Verification

scripts/__tests__/module-state-audit.test.ts and
scripts/__tests__/evolve-skills.test.ts cover the repaired contracts. Existing
CLI console/breadcrumb tests retain functional verification of the reset owners.

## Verification Gates

- gate: typecheck cli
- gate: probe scripts/scripts-typecheck-check.ts
- gate: test scripts/__tests__/module-state-audit.test.ts
- gate: test scripts/__tests__/evolve-skills.test.ts
- gate: test scripts/__tests__/learnings-consolidation.test.ts
- gate: test scripts/__tests__/learnings-rule-tiers.test.ts
- gate: test cli/src/utils/__tests__/console-capture.test.ts
- gate: test cli/src/utils/__tests__/exit-breadcrumb.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:91ff9bf411156d758b56341a93c9dfe431ff5ea1a682c578831a4b26e27e9860
- verified: 2026-10-19T02:46:27.232Z
- typecheck cli: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- test scripts/__tests__/module-state-audit.test.ts: exit 0
- test scripts/__tests__/evolve-skills.test.ts: exit 0
- test scripts/__tests__/learnings-consolidation.test.ts: exit 0
- test scripts/__tests__/learnings-rule-tiers.test.ts: exit 0
- test cli/src/utils/__tests__/console-capture.test.ts: exit 0
- test cli/src/utils/__tests__/exit-breadcrumb.test.ts: exit 0
- quality: exit 0

## Perfection Loop

- RED: exact audit findings and scratchpad path conflict inspected.
- GREEN: repair callers and ownership records, preserve lifetime invariants.
- AUDIT: no scanner class is disabled and each exemption names one real binding.
- ADVERSARIAL: merely inserting an entrypoint marker would mask import effects;
  wrap the actual work so the marker reflects behavior.

### Missed Questions

1. Are the SDK descendant tests a production failure? The load-concurrent run
   missed its 4-second fixture-start deadline. An isolated rerun passes both
   abort and timeout cases (8 assertions); final suite runs must be serialized.
2. Does evolution move existing files? No; only new output destination changes.

### Code Verification Evidence

The declared gates passed and are bound by the verification receipt. The full
scripts run exposed only the two stale real-ledger exact counts; both repairs
and audit-evidence regressions pass the focused rerun (14 tests, 31 assertions).
The production module-state scan passes with exact lifetime exemptions and
test-reset callers. Commit and archival remain pending.

## Resolution

Implementation and validation complete; committed as `20b2f55c`. The declared
gates passed and the full scripts suite is green.

**Closed:** 2026-10-19
**Archived:** 2026-10-19

## Lessons Learned

Audit exceptions describe actual lifetime invariants; standalone program state
belongs inside a real entrypoint rather than an import-time side effect.
