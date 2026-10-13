# FID: The lesson-to-feature pipeline is red with no owner and no gate

**Filename:** `FID-2026-1012-015-lessons-feature-pipeline-red-and-ungated.md`
**ID:** FID-2026-1012-015
**Severity:** high
**Status:** closed
**Created:** 2026-10-12 19:05
**Closed:** 2026-10-13
**Commit:** 6b847099fcdcc9c9b8e1660b86bf31c3b68311f7
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-012, FID-2026-1012-014, FID-2026-1012-016

---

## Summary

`bun run lessons:features --check` fails: `lesson-features: FAIL (37 lessons, 6 candidates)`,
exit 1, with 7 admission issues naming lesson titles the store can no longer resolve (the same 7
recorded in `FID-2026-1012-012`). The check is registered only as a package script
(`package.json:62`), so nothing in `validate:repository`, `protocol.config.yaml` or the pre-push
hook references it: the failure cannot red the repository, and its only surface is one
fail-open advisory line in the SessionEnd review (`scripts/session-end-review.ts:246`). The
active FID queue is empty and `SCOPE.md` names no item for the pipeline, so a red check that
gates nothing is owned by nobody (review §3 E1; features F5, F6).

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `bun 1.3.14`; `scripts/lesson-feature-pipeline.ts`
- **Commit/State:** `main` @ `14d48820`

## Detailed Description

### Problem

The lesson→feature pipeline has a check that is red and unreachable at the same time.

- `bun run lessons:features --check` prints
  `lesson-features: FAIL (37 lessons, 6 candidates)` and exits **1**, with 7 admission issues.
  Every one names a lesson title that now lives only in `dev/LEARNINGS-RETIRED.md`.
- The command has `--check` and `--write` modes, and `--write` publishes the report to
  `dev/feature-pipeline/report.md` **only when the review is clean** — so the report on disk is
  older than the ledger it describes, and the artifact a reader consults cannot say so.
- It is declared only as a package script (`package.json:62`). A grep of
  `scripts/validate-repository.ts`, `protocol.config.yaml` and the pre-push hook finds no
  reference, so a FAIL here is not a repository failure: it is a fact that exists only for a
  human who happens to read the session-end output.
- The one place it does surface is the SessionEnd review: `scripts/session-end-review.ts:246`
  calls `featureRoutingNotes(root)`, which returns the single advisory line
  `FEATURE-REVIEW: N admission issue(s); run bun run lessons:features --check.` — and its own
  comment states that an invalid store must never disable the hook's other work. It is
  fail-open by design, which is correct for a hook and insufficient as the only notice.
- Nothing owns it: the active FID queue is empty and `SCOPE.md` carries no item naming the
  pipeline, so the red has no record, no register line and no gate.

The store itself is otherwise healthy in shape: `LF-001` and `LF-002` are `implemented` (closed
under `FID-2026-1012-007` and `-008`), and `LF-003`/`LF-004`/`LF-005`/`LF-006` are `draft` and
cannot be re-admitted while admission fails.

### Expected Behavior

A store that feeds product work is either green or red where someone is forced to see it. A
failing admission check is a repository failure with a named owner, the published report is
regenerated from the state it claims to describe, and the fail-open session-end line stays a
notice rather than the enforcement.

### Root Cause

The check exists but sits outside the gate battery, so its failure is a fact only a human
reading session-end output can notice, and nothing owns the store's own consistency. The
admission failure itself has a separate cause, owned elsewhere: retirement moved lesson titles
into the archive while the store still cites them by title (`FID-2026-1012-012`).

### Evidence

```text
$ bun run lessons:features --check
lesson-features: FAIL (37 lessons, 6 candidates)
LF-001: Missing lesson: Files over the 100k-character tool read limit break every in-place edit path
LF-003: Missing lesson: A retry that re-emits the same oversized tool call is not recovery
LF-003: Missing lesson: A suppression key that can legitimately be null cannot distinguish "inactive" from "active with no identity"
LF-005: Missing lesson: The test renderer is not a proxy for the production renderer
LF-005: Missing lesson: A FID's Verification section is a contract — each promised test must exist before "verified"
LF-006: Missing lesson: A ledger ruling inherits the freshness of its evidence
LF-006: Missing lesson: A policy scrub must sweep the rule text and its generator anchors, not just the artifacts
exit 1

$ grep -n 'lessons:features' package.json
62:    "lessons:features": "bun scripts/lesson-feature-pipeline.ts"

$ grep -rn 'lesson-feature-pipeline' scripts/validate-repository.ts protocol.config.yaml
(no matches — the check is not wired into any repository gate or hook)
```

Advisory-only surface (`scripts/session-end-review.ts:246`): `...featureRoutingNotes(rootDir)`,
whose producer returns
`FEATURE-REVIEW: ${review.issues.length} admission issue(s); run bun run lessons:features --check.`
and is documented as never disabling the hook's other work.

Store state (`dev/feature-pipeline/candidates.json`): `LF-001`, `LF-002` `implemented`;
`LF-003`, `LF-004`, `LF-005`, `LF-006` `draft`.

## Impact Assessment

### Affected Components

- `scripts/lesson-feature-pipeline.ts` (the check and the report writer)
- `dev/feature-pipeline/candidates.json` and `dev/feature-pipeline/report.md` (the store and its
  published view)
- `scripts/validate-repository.ts` (the gate battery it is absent from)
- `scripts/session-end-review.ts` (the advisory line that is currently the only notice)
- `SCOPE.md` (no register item owns the pipeline)
- `FID-2026-1012-012` (owns the title-resolution fix this record depends on)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Fix the store's references first, then make the check enforceable, and keep the fail-open
notice as a notice. Order matters: adding the gate before the admission issues are resolved
would red the repository on a store that is already known red.

### Steps

1. **Resolve the 7 admission issues through `FID-2026-1012-012`'s live+retired title index.**
   This record declares that dependency explicitly: it cannot go green before that index exists,
   and it must not paper over the missing titles by rewriting the candidates' citations to
   titles that happen to be live today.
2. **Then** wire `lessons:features --check` into `validate:repository`, so a ledger/consumer
   divergence cannot sit red and unowned. The gate is added in the same pass that turns the
   check green, never before.
3. Keep the SessionEnd advisory as the notice it is: it must stay fail-open (an invalid store
   must not disable the hook's other work) and must never become the enforcement point.
4. Re-admit the four `draft` candidates only when the store is green, and add the feature
   candidates that F1/F2/F4 describe — the boot digest, rule tiering and reference integrity —
   as products, so the pipeline carries the work rather than only the ledger repairs.
5. Name the owning record for any future failure: a check that can fail needs a surface where
   the failure is somebody's item, not a line in a log.

### Verification

This record is pre-implementation: the checks below are the plan, and the covering gates are
declared (with their receipts) when the artifacts exist.

- `bun run lessons:features --check` exits 0 over the reconciled store, with the four `draft`
  candidates still present and their citations resolving through the index from step 1.
- Removing one cited lesson from the resolved set fails the check (the failure mode is
  recoverable into the gate, not deleted to make it pass).
- `bun run validate:repository` runs the pipeline check and fails when it is red: proved by
  driving the gate with a seeded store, then restoring the real one.
- The report written by `--write` matches the state it describes, and a stale report is
  detectable rather than silently older than the store.
- No route is left where a red admission check produces zero visible failures: the gate is the
  enforcement and the session-end line remains advisory.

## Verification Gates

- gate: test scripts/__tests__/lesson-feature-pipeline.test.ts
- gate: test scripts/__tests__/lesson-feature-check.test.ts
- gate: probe scripts/lesson-feature-check.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:59aae57ca03b18fde8d24f5888d3337d1848be90f90329e91ca6a6b668aa0425
- verified: 2026-10-13T15:31:27.644Z
- test scripts/__tests__/lesson-feature-pipeline.test.ts: exit 0
- test scripts/__tests__/lesson-feature-check.test.ts: exit 0
- probe scripts/lesson-feature-check.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** `lessons:features --check` FAIL (37 lessons, 6 candidates), exit 1, 7 admission
  issues across `LF-001/-003/-005/-006`; the check is a package script only — absent from
  `validate:repository`, `protocol.config.yaml` and the pre-push hook; its sole surface is one
  fail-open advisory line at `session-end-review.ts:246`; no active FID and no register item
  names the pipeline; `--write` skips the report whenever the review is unclean.
- **GREEN:** resolve the citations through the live+retired index owned by
  `FID-2026-1012-012`, then make the check a repository gate, keep the advisory fail-open,
  re-admit the drafts only when green, and give the pipeline a named owner.
- **AUDIT:** the FAIL line, the exit code, the 7 issues, the `package.json:62` registration and
  the absence of any gate reference were each measured at `HEAD` `14d48820`; the advisory path
  was read in `session-end-review.ts` rather than inferred from documentation.
- **ADVERSARIAL:** (a) does adding the gate create a chicken-and-egg red? Only if it is added
  before step 1 — the ordering is the fix, and the record says so. (b) Is the failure in the
  check or in the store? In the store's citations; the check correctly reports a reference it
  cannot resolve, and step 1 must fix resolution rather than relax the assertion. (c) Should
  the 7 issues simply be deleted? No — each names a real lesson that exists and is cited
  deliberately; deleting the citation would discard the evidence the candidate was built on.
  (d) Does making this a gate slow the release path? The check is a read-only review over a
  6-candidate store; measured cost belongs in the implementation pass, not in this claim.
- **CHANGE DELTA:** ~0% of implementation. This record is authoring-only (converged RED/GREEN
  plan); the change delta applies in the implementation pass.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** Real admission remains red: seven issues, exit 1. This FID now owns the
  check; empty-queue/no-owner wording is an old snapshot. `--write` still skips a red report.
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md`: resolve titles first,
  then wire a standalone pipeline probe into repository validation. Fingerprint live,
  retired and manifest inputs; render red reports deterministically and retain exit 1.
  Keep drafts as drafts and keep SessionEnd fail-open.
- **AUDIT:** Existing admission fixtures pass in the 45-test baseline while the
  real store fails; `validate:repository` passes because this check is unwired.
- **ADVERSARIAL / missed question:** Can the repository validator be this FID's probe?
  No, it re-enters FID verification. Use the independent planned probe named in the
  shared artifact table, with malformed-store and stale-report negative controls.
- **CHANGE DELTA:** Planning correction only; no gate is wired onto the known-red store.

### Missed Questions

### Loop 3 — Recorded implementation contract (2026-10-13)

- **RED:** FID-012 has repaired admission (74 titles / six candidates), and
  FID-016's exact inventory has zero merge proposals. The report remains stale;
  its fingerprint covers only the old live catalog, and red reviews cannot write
  it. No independent report/admission collector is wired into repository validation.
- **GREEN:** Fingerprint live + retired catalog inputs and the manifest separately
  from readiness's catalog hash. Regenerate report output for red and green states,
  retaining exit 1 on red. Add a standalone collector/probe that rejects malformed
  stores, missing/stale reports and admission issues. Call the same collector from
  repository validation after regenerating the real report. Preserve every draft
  state and existing candidate link; no readiness or implementation is inferred.
- **AUDIT:** Extend the existing admission suite and add
  `scripts/__tests__/lesson-feature-check.test.ts` for archive/manifest freshness,
  stale report refusal and deterministic red publication. Declare the standalone
  `scripts/lesson-feature-check.ts` probe, never the recursive repo validator.
- **ADVERSARIAL:** A generated red report is still red; writing it must not gain
  admission or alter candidate state. Missing stores fail the enforced checker,
  while the existing optional SessionEnd notice remains fail-open.
- **CHANGE DELTA:** Recorded before source writes under automation level 3.

### Loop 4 — Product candidate accounting (2026-10-13)

- **RED:** Original step 4 also requires the F1/F2/F4 repairs to be represented
  in the product pipeline; the existing six candidates do not name those owners.
- **GREEN:** Add LF-007 / LF-008 / LF-009 as routed candidates owned by the already
  approved FID-010 / FID-014 / FID-013 respectively, with real lesson citations
  and source evidence. Preserve the six existing candidates and all four draft
  states. No candidate is marked ready or implemented under the no-commit hold.
- **AUDIT:** Rerun admission/report checks and regenerate the deterministic report.
  Owning FIDs must exist uniquely; no implementation commit is fabricated.
- **ADVERSARIAL:** Routed ownership records the approved program, not closure.
  These candidates cannot become implemented until their owners close with real
  recorded commits. Existing draft investigations remain visible.
- **CHANGE DELTA:** Candidate metadata and generated report only.

1. Why is a red check in a repository with a hard gate battery not a release blocker? → Because
  it was never declared as a gate; the battery is built from declared checks, and a package
  script nobody references is invisible to it. The fix is declaration, not a new mechanism.
2. Does the pipeline need a per-candidate owner, or one owner? → One owner for the store's
  consistency (this record), plus the existing per-candidate `fid` field for routed work; the
  pipeline already requires a single unambiguous FID owner for a routed item.
3. Should the store block on a red ledger at all, given the ledger moves every session? → Yes,
  but through resolution rather than freezing: the store cites lessons by title, so the
  retirement-aware index (`FID-2026-1012-012`) is what makes "cited lesson" a stable claim.

### Code Verification Evidence

Current implementation evidence (2026-10-13) supersedes the historical baseline below.

- [x] `reviewFeaturePipeline` hashes live and retired catalogs; the report's
      `sourceFingerprint` also covers manifest bytes. Draft readiness and closed-FID
      implementation proof remain independent checks.
- [x] `writeFeatureReport` publishes deterministic red and green reports without
      mutating the store. Three new checker tests and ten admission tests pass;
      red publication stays a failed admission.
- [x] `collectFeaturePipelineIssues` is called by the standalone probe and
      `scripts/validate-repository.ts`. Real probe: PASS (0 issues). Missing/stale
      reports and malformed/missing stores fail; SessionEnd remains advisory.
- [x] Real report regenerated with 74 titles / 37 governed lessons / nine candidates.
      Four drafts stay draft; both implemented candidates retain their real recorded
      commits. Three new routed candidates name FID-010, FID-014 and FID-013;
      existing candidate links and approval states were preserved.
- [x] Formal closure: closed 2026-10-13 at `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7`; local commits were authorized, push and release remain operator-owned.

- [x] Every cited path exists at `main` @ `14d48820`, read directly at review time; the raw
      measurements live in `docs/design/learnings-boot-loading-and-lifecycle-review.md` §2/§3,
      which this record expands.
- [x] Measurements re-checked: `bun run lessons:features --check` prints
      `lesson-features: FAIL (37 lessons, 6 candidates)` and exits 1 with the 7 admission
      issues; `package.json:62` is the only registration (`scripts/validate-repository.ts`,
      `protocol.config.yaml` and the pre-push hook contain no reference); the only surfacing is
      the fail-open advisory at `scripts/session-end-review.ts:246` (`featureRoutingNotes`);
      the active FID queue and `SCOPE.md` name no owner.

## Boundaries

- No store, ledger or script content was changed by this record; the run above is the state at
  `HEAD` `14d48820`.
- The 7 issues are described as the pipeline reports them; their root cause and its fix are
  owned by `FID-2026-1012-012`, and this record does not restate that analysis beyond the
  dependency.
- This record does not claim the store's candidates are correct or product-ready, only that its
  admission check is red and that the red is unowned.
- The SessionEnd advisory is documented here as fail-open behaviour read from the producer's own
  contract; no live session-end hook run was executed in this pass.

## Resolution

**Implemented; closed 2026-10-13 at `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7`, once all 5 declared gates re-ran green.**

Admission and report freshness are now repository checks through one independent
collector. Fingerprints cover both lesson stores and the candidate manifest; reports
remain truthful on red and preserve failure exits. Existing draft/implemented states
and citations remain intact; LF-007 through LF-009 account for the approved boot,
canonical-rule and reference-integrity repairs as routed work. Local commits were
authorized on 2026-10-13; push and release remain operator-owned.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the review).
- **Design record:** `docs/design/learnings-boot-loading-and-lifecycle-review.md` §3 row E1,
  §4 features F5 and F6.
- **Ordering:** Depends on FID-2026-1012-012's live+retired title index; the gate must NOT be
  wired into `validate:repository` before those 7 issues are resolved, or the repository reds
  on a known-red store.
- **Archived:** 2026-10-13 — all 5 declared gates re-ran green on the closure tree before closure; the implementation commit is recorded in the metadata above.
