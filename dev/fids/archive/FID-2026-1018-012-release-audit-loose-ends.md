# FID: Project-wide release audit and loose-end reconciliation

**Filename:** `FID-2026-1018-012-release-audit-loose-ends.md`
**ID:** FID-2026-1018-012
**Severity:** medium
**Status:** closed
**Created:** 2026-10-18 22:20
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Audit every registered workspace and release surface, repair stale documentation
and governance records, and produce a durable release-readiness report. Baseline
static gates pass but release pre-audit exposes missing archived commit metadata,
missing recovery bundles and untracked local inputs. LIVE-004 residuals have
implementation ownership under FID-2026-1018-010 and FID-2026-1018-011.

## Environment

- **OS:** Windows
- **Language/Runtime:** Bun 1.3.14, npm 10.9.2, TypeScript 5.5.4
- **Commit/State:** e26b9ab230f8ebf1df543d819bf0d48a914f0ea4

## Detailed Description

### Problem

- SCOPE still grants write authority for archived FID-2026-1018-008.
- README.md:133 and docs/providers.md:177 promise wheel/scrollbar picker
  navigation removed by the allocator-exhaustion repair.
- SDK docs promise npm installation while the release catalog is CLI-only and
  explicitly records that the SDK scope is unpublished.
- README links to ignored local dev records are unavailable in clean clones.
- Release pre-audit reports 15 closed FIDs without a machine-readable
  Commit/State field, although git history/record prose contains evidence.
- Configured .git-bundles directory is absent despite last-backup marker.
- Release preview calls that local/default backup "OneDrive-synced" without
  observing any external sync. Report the configured destination instead.
- Session export and research document are untracked operator inputs.
- CHANGELOG.md has 308 lines of recent dated entries before the 0.0.36 heading
  at line 311. extractChangelogSection starts at that heading, so the recent
  picker/worktree/provider fixes would be omitted from public release notes
  despite a structurally passing preview. Relocate the single existing version
  heading above its recent entries; preserve all entry bodies and old versions.

### Expected Behavior

Current docs describe shipped behavior and reachable sources; historical
reports remain historical. Release gates pass on a clean, verified checkout.
Local private evidence is retained without automatic publication.

### Root Cause

Code closures were recorded in prose rather than the pre-audit's metadata
surface; hand-maintained docs and scope were not reconciled after picker and
governance changes. A backup marker alone does not establish an on-disk archive.

### Evidence

Baseline command output: full typecheck exit 0; version parity PASS;
generated provider docs current; protocol bundle current; hygiene PASS;
undeclared-imports PASS; quality PASS. Orphan sweep finds only three example
agents referenced through their examples directory in the template README.
Release pre-audit FAIL: dirty worktree, 15 G2 metadata gaps, absent bundle dir.

## Impact Assessment

Documentation, release evidence and local tracking change. Shared UI code
repairs are owned by FIDs 010/011, tooling by 013 and dependencies by 014 under
the same approved audit scope. No paid inference, external credential write
or historical report purge is authorized.

## Proposed Solution

1. Reconcile SCOPE with verified picker closure and active audit ownership.
2. Backfill archived Commit/State fields from independently inspected commits;
   never infer a hash from another session's assertion alone.
3. Correct current picker/SDK/scaffold docs and broken public source links.
   Keep directory-consumed example agents; remove only proven dead material.
4. Preserve operator input bytes, resolving their release inclusion policy;
   restore verified local recovery-bundle evidence with the existing tool.
5. Prove picker keyboard filtering/navigation with real render assertions.
6. Run full workspace tests/typecheck, scripts tests, Rust tests, lint, format,
   generation/parity/quality/hygiene checks and clean-install bundle/release
   diagnostics; repair concrete failures and publish a durable audit report.
7. Commit verified slices, push normally, archive records with commit evidence.
   Before closure, place the current version heading above its recent dated
   notes and append the five audit closure entries. Completed 2026-10-19 after
   the full CHANGELOG read (1-13,906): the 0.0.36 head moved above its recent
   entries as a byte-identical relocation, and the audit closure entries landed
   in the same slice.

### Verification

Extend cli/src/components/__tests__/model-picker-scroll.test.tsx with actual
key input and resulting selection/filter assertions. Preserve prior operator
acceptance evidence without manufacturing historical keystroke logs. Use
scripts/release-preaudit-check.ts and existing gate commands for reconciliation.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: probe scripts/scripts-typecheck-check.ts
- gate: test cli/src/components/__tests__/model-picker-scroll.test.tsx
- gate: probe scripts/release-preaudit-check.ts
- gate: probe scripts/internal-followup-check.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED / GREEN

- RED: baseline gate and pre-audit outputs collected; static orphan candidates
  traced to the template README's examples-directory consumer.
- GREEN: repair exact metadata/doc surfaces, use existing validation pipeline.
- AUDIT: clean release diagnostic requires edits finished before fingerprinting;
  don't run mutation-sensitive diagnostics concurrently with changes.
- ADVERSARIAL: docs collection status exempts Markdown style, not factual
  correctness. Do not rewrite historical measured reports as current claims.

### Missed Questions

1. Does an orphan candidate authorize deletion? No; directory-level consumers
   are real, and the three examples are retained.
2. Does acceptance prove all keyboard behavior? No; add fresh behavioral
   evidence and keep the original acceptance's limitations honest.
3. Does a local bundle prove off-machine backup? No; report the destination
   and verified contents explicitly. External sync is independently observed.

### Loop 2 — convergence

No new release machinery is needed. Existing pre-audit, frozen-install bundle,
workspace gates and diagnostics provide reproducible evidence. Recorded
presentation is authorized under the operator's project-wide cleanup request.

## Resolution

### Code Verification Evidence

Typed picker filter/navigation test and related UI regressions: 15 pass,
0 fail, 189 assertions. Baseline typecheck, quality, undeclared imports,
provider docs/protocol generation and provider catalog/window pairing pass.

Child records closed first: FID-2026-1018-010 (`0c50fa8e`), -011 (`106ee6f8`),
-013 (`20b2f55c`) and -014 (`60c50a67`). This record's documentation, release
notes and record reconciliation landed as `789ec02c`. On that committed tree the
full gate battery passed: 14-workspace plus scripts typecheck exit 0, CLI 4,233
pass / 18 skip / 0 fail, scripts 1,122 pass / 0 fail, ESLint 0 warnings,
Markdown lint exit 0 and `validate:repository` PASS; `release:preaudit:check`
reached `pre-audit: PASS — release preconditions clear`.

Closed on the committed tree. Publication, tagging and the release pipeline run
remain separate operator-gated actions; the SDK distribution stays unpublished.

**Closed:** 2026-10-19
**Archived:** 2026-10-19

## Lessons Learned

Release readiness depends on both executable behavior and truthful distribution,
documentation and recovery evidence.
