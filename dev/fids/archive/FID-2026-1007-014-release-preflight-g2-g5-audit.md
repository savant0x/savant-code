# FID: Release preflight must audit G2 commit hashes and G5 bundle state

**Filename:** `FID-2026-1007-014-release-preflight-g2-g5-audit.md`
**ID:** FID-2026-1007-014
**Severity:** medium
**Status:** closed
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

Formal FID for the one unbuilt item in
`dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md`: its FID 4, a
pre-release preflight that asserts the G2 and G5 conditions before a cut. The
existing pre-audit family asserts a clean worktree and a sane push range, but
never checks that closed FIDs carry recorded commit hashes (G2) or that the most
recent bundle is verified (G5). Phase 0 and FIDs 1–3 of that build order shipped;
this is the remainder.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint`
- **Commit/State:** uncommitted working tree

## Detailed Description

### Problem

Two of the nine git-workflow laws are unenforceable at release time. A cut can
proceed with archived FIDs whose `Commit:` fields are empty (violating G2) and no
verified recovery bundle (violating G5), even though both laws state a hard
requirement. The laws are real — `ECHO.md` → "Version-Control Workflow Laws" —
and unverified at the one moment verification is possible.

### Expected Behavior

Before `public-release.ts` cuts: assert (a) the working tree is clean, (b) all
closed FIDs for the release carry recorded commit hashes, (c) the latest bundle
is verified. Fail-closed, naming exactly which condition failed.

### Root Cause

The build order specified the check as "optional but recommended"; Phase 0
(protocol adoption) and FIDs 1–3 (template, commit template, bundle script) were
higher-value and shipped first. FID 4 was never converted to a FID, so nothing
tracked it.

### Evidence

Measured 2026-10-07 — the existing pre-audit family and what it covers:

```text
scripts/public-release/pre-audit.ts:26-33
  checkWorktreeClean(root),        <- condition (a): PRESENT
  checkReleaseLock(root, version),
  checkStaleTag(root, version, ...),
  checkPushRange(root),            <- push-range sanity only
  checkConfigDirUnpolluted(),
  checkConfigDirIsolation(root),

$ Select-String -Path "scripts/public-release/pre-audit*.ts" -Pattern "bundle|Commit:|fid:verify"
(no output)                        <- conditions (b) and (c): ABSENT
```

The template carries the field the audit would check
(`templates/FID-TEMPLATE.md:32` — `- **Commit/State:** [Git SHA or state
description]`), and the bundle script exists
(`scripts/git-bundle-backup.ts`, archived `FID-2026-0905-008`), so both
conditions are checkable against artifacts that already exist.

## Impact Assessment

### Affected Components

`scripts/public-release/pre-audit-local.ts` (or a new sibling module),
`scripts/public-release/pre-audit.ts`, `scripts/git-bundle-backup.ts` (read-only
marker access), `scripts/validate-repository.ts` (wiring), `scripts/__tests__/`.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

> The build order ranked this "low risk — additive check". The rating here is
> medium because the audit runs against the **release** path, where a false
> positive blocks a cut and a false negative lets one through.

## Proposed Solution

### Approach

Extend the pre-audit family with two checks, keeping the existing six intact and
the runner's fail-closed contract unchanged.

### Steps

1. G2 check: for each FID in `dev/fids/archive/` whose `**Status:** closed`, read
   the `Commit/State` field; report every record whose field is empty or absent.
   Scope the window (the source order said "this week"; decide the window at
   GREEN) so the check stays fast and its output actionable.
2. G5 check: read the bundle marker's last verified ref and confirm
   `git bundle verify` passes for it, or report the absence of a baseline bundle.
3. Wire both into `runPreAudit` (`pre-audit.ts:26-33`) as additional result
   objects; keep the existing `blocked` severity semantics.
4. RED pins: a fixture register with an empty `Commit/State` field produces a
   `block` finding naming the file; a fixture with populated fields does not; a
   missing/stale bundle marker produces a `block` finding.
5. Never modify `public-release.ts` behavior (the source order's boundary).

### Verification

```bash
bun test scripts/__tests__/public-release-preflight-g2.test.ts scripts/__tests__/public-release-preflight-g5.test.ts
bun run typecheck:scripts
bun x eslint scripts/public-release/ --max-warnings 0
bun run lint:md
bun run validate:repository
bun run quality:report
```

> Contract rule (FID-2026-0918-006): the test artifacts named above MUST also
> appear as declared `- gate: test <path>` below. Declared at implementation
> (see Verification Gates; one suite split in two under the 300-line cap).

## Verification Gates

- gate: test scripts/__tests__/public-release-preflight-g2.test.ts
- gate: test scripts/__tests__/public-release-preflight-g5.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:d9724ec0d8bed0da3f1b7ef355a8f532f9c454948250affba50b61f679a45d31
- verified: 2026-10-09T01:31:12.261Z
- test scripts/__tests__/public-release-preflight-g2.test.ts: exit 0
- test scripts/__tests__/public-release-preflight-g5.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Conditions (b) and (c) have no implementation anywhere in the
  pre-audit family; conditions (a) is already satisfied.
- **GREEN:** Not reached — implementation is not authorized by this record.
- **AUDIT / ADVERSARIAL:** Not reached.
- **CHANGE DELTA:** n/a

### Missed Questions

1. **How wide should the G2 window be?** → Undecided. "All closed FIDs" is
    O(archive) — 505 records re-measured 2026-10-08 (was 496 at authoring) — and would report centuries of
   history at every cut. A release-window scan is the useful reading, but the
   window boundary needs an explicit decision at GREEN, not a default.
2. **Does `Commit/State` accepting a free-text state description weaken the
   check?** → Yes, materially: the template permits
   `[Git SHA or state description]`, so a record can satisfy the field without a
   hash. The check can only assert the field is non-empty; asserting it is a SHA
   is a separate decision about the template's wording.
3. **Should G5 fail when no bundle has ever been created?** → Presumably yes
   (recovery point of record absent), but the source order says "latest bundle
   verified", which is vacuously true when there is none. Needs an explicit
   rule, not a fallback.

### Loop 2 — full-perfection pass, GREEN fold (2026-10-08, operator-triggered)

RED re-confirmed today: `runPreAudit` still iterates exactly six checks
(`checkWorktreeClean`, `checkReleaseLock`, `checkStaleTag`, `checkPushRange`,
`checkConfigDirUnpolluted`, `checkConfigDirIsolation`); no `bundle`/`Commit:`/
`fid:verify` reference in any pre-audit file. `scripts/git-bundle-backup.ts`
exists.

GREEN fold — missed questions answered:

1. Enforcement point named: the new checks join the `runPreAudit` result list
   (an executed rejection path, not prose), each emitting a `block` finding that
   names the failing artifact.
2. Proof artifact: the gate run's own output is the evidence (receipt pattern);
   the check is falsifiable by construction (fixture register cases).
3. G2 window default (code-derivable): closed FIDs whose closure postdates the
   last release tag — bounded and actionable, O(release) not O(archive).
4. G2 predicate stated exactly: a non-empty `Commit/State` field. The template
   permits a free-text state description, so hash-shape validation is a separate
   template-wording decision, not folded silently.
5. G5 explicit rule: a missing bundle is a `block` (recovery point of record
   absent) — "latest bundle verified" must not be vacuously true.
6. Law 7 check: reuse `scripts/changelog-coverage.ts` and the FID ledger before
   adding parallel logic.

Named operator decisions (not picked silently): G2 window scope; G5 staleness
constant; enforcement layer (pre-audit vs pre-push hook).

### Loop 3 — document convergence (2026-10-08)

- **RED re-verified:** `runPreAudit` still six checks (`pre-audit.ts:26-33`,
  same names); zero `bundle`/`Commit:`/`fid:verify` references across
  `pre-audit*.ts`; `git-bundle-backup.ts`, `changelog-coverage.ts`, and the
  template `Commit/State` field (`templates/FID-TEMPLATE.md:32`) all present.
  Archive count now 505 (was 496) — corrected in Missed Q1.
- **GREEN:** Loop-2 answers stand. Open items are operator-sovereign, recorded
  as blocked rather than defaulted: G2 window scope (default stated, not
  picked); G5 staleness constant; enforcement layer; template hash-shape
  wording.
- **AUDIT (double):** (1) citations re-measured above. (2) `fid:verify --check`
  informational "no gates declared" — the uniform pre-implementation response
  proven identical on untouched `-012`/`-016`; not a defect.
- **Status ruling:** `created` → `analyzed` (Loop-2 GREEN fold complete;
  implementation not started; precedent: `-012` Loop 2 ruling).
- **CHANGE DELTA:** ~4%. **CONVERGED:** zero open questions; implementation
  authorized separately.

### Loop 4 — implementation (2026-10-08, operator-authorized completion pass)

- **RED:** no G2/G5 check anywhere in the pre-audit family (six checks only).
- **GREEN:** `scripts/public-release/pre-audit-g2-g5.ts` (`checkG2CommitHashes`,
  `checkG5BundleState`, injected git runner; `BACKUP_MARKER_TAG` /
  `latestIncrementalFile` reused from `git-bundle-backup.ts`, `parseFidStatus`
  from the enforcement authority) wired into `runPreAudit`; 20-pin suite
  across two files (ratchet split of the 309-line combined suite);
  `dev/preaudit-g2-commit-baseline.json` grandfathering pre-gate gaps.
- **AUDIT — live runs reshaped the design twice (SELF-CORRECT):**
  1. Naive unknown-date handling: 152 blocks over pre-template history →
     filename-date fallback (FID-2026-0928-013 precedent) → 18 blocks.
  2. October-record audit: 8 carry bare `commit <sha>` status lines →
     status-line source added; Resolution-prose mining REJECTED
     (false-positive proof: `f099ded8`); pre-gate remainder (10)
     grandfathered with staleness enforcement. Live G2 now 0 findings.
  3. G5 live: marker present, bundles verify, marker-behind-HEAD warns —
     designed behavior. "0.00MB" display was PowerShell rounding (direct
     `git bundle verify` passes on both files).
  4. Full `release:preaudit --check` cannot complete here: PRE-EXISTING
     `checkPushRange` scans the 157-ahead push range (>300 s) — unrelated to
     this change, recorded for the operator.
- **AUDIT gates:** suites 20/20 · `typecheck:scripts` exit 0 ·
  `eslint --max-warnings 0` exit 0 · `lint:md` exit 0 ·
  `validate:repository` PASS (incl. the file-cap ratchet that forced the
  split) · `quality: PASS (1498 baselined files)` (`typecheck:scripts` run,
  not declared: `scripts/` outside `VALIDATION_WORKSPACE_POLICY`).
- **Baselined pre-gate gaps (10):** `-1003-004`, `-1004-003`, `-1004-004`,
  `-1007-008`, `-1007-009` (no hash found anywhere), `-1008-001`
  (`4e1ab59b`), `-1008-002` (`d6d544b4`), `-1008-003` (`a9ae21d0`),
  `-1008-004` (`742d919f`), `-1008-005` (`9a07792e`) — Resolution-only
  hashes, backfill candidates for a later pass.
- **CHANGE DELTA:** ~5%. **Status ruling:** `analyzed` → `fixed`.
- **Closure:** `fixed` → `closed` on implementation verification (receipt 3/3
  PASS); archived with receipt re-stamped at the archived path.

## Resolution

- **Closed Date:** 2026-10-08
- **Fix Description:** G2/G5 pre-audit family: closed-FID commit-hash audit
  (windowed, baselined) and bundle-marker verification, wired into
  `runPreAudit` as blocking checks.
- **Tests Added:** Yes — `public-release-preflight-g2.test.ts` (14 pins) and
  `public-release-preflight-g5.test.ts` (6 pins).
- **Verification Evidence:** suites 20/20, `typecheck:scripts` exit 0,
  `eslint --max-warnings 0` exit 0, `lint:md` exit 0,
  `validate:repository` PASS, `quality: PASS (1498 baselined files)`; live
  G2 0 findings (152 → 18 → 0 across two design corrections), live G5
  0 blocks + 1 designed warn; receipt `sha256:d9f1adba…`
  stamped 2026-10-09T01:28:45Z at implementation (3/3 gates), re-stamped at
  the archived path. Commit: pending operator G2 commit (working tree).
- **Source:** `dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md` (FID 4)
- **Archived:** 2026-10-08 — moved to `dev/fids/archive/`; register item T164-E complete.

### Code Verification Evidence

Status is `closed` — closed on implementation verification (Loop 4) and
archived. Both checks exist, are wired into `runPreAudit`, and pass
their suites (20/20) plus the live-tree probes in Loop 4. The finding was an
**absence** check; the Evidence section's search patterns were re-run green
except for the two new modules (the fix itself). An absence-shaped check is
only as good as the exact search that produced it, so the pattern list is
recorded here and the enumerated file list in Evidence, not summarized.

## Lessons Learned

**A law with no enforcement point is decorative.** G2 and G5 have been stated
in `ECHO.md` since 2026-08-27 and remain unenforced at the only point where they
could be checked. The gap was created by classifying the enforcement work as
"optional but recommended" in the build order and never re-raising it.
