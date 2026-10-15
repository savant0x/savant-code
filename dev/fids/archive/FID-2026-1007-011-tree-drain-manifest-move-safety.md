# FID: tree-drain manifest coverage is exact-path under a directory whose contents move

**Filename:** `FID-2026-1007-011-tree-drain-manifest-move-safety.md`
**ID:** FID-2026-1007-011
**Severity:** medium
**Status:** closed
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

`scripts/tree-drain.ts` is a fail-closed commit grouper: it aborts unless every
changed path belongs to exactly one commit group
(`scripts/tree-drain.ts:43-83`). Its manifest covered `dev/build-orders/` with
three **exact file paths**. Any move within that directory — which the build-order
cleanup requires, and which the directory's lifecycle mandates — turns the old
path into an unmatched change and aborts the tool with `UNCOVERED PATHS`. The
  manifest has no regression test: `scripts/` contains 36 `*.test.ts` files and
  none covers the drain manifest, so the contract's coverage invariant is
  unenforced.

## Environment

- **OS:** Windows (win32), PowerShell 7
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint` (`--max-warnings 0`)
- **Commit/State:** uncommitted working tree

## Detailed Description

### Problem

The manifest binds paths that are expected to move. The tool's own guarantee —
"every changed path must belong to EXACTLY one group" — is only satisfiable as
long as those paths stay put.

### Expected Behavior

A group covers a directory whose membership changes, and the invariant is
pinned by a test so a future narrowing to exact paths fails loudly.

### Root Cause

The manifest was authored for a single drain event (`v0.0.27 → v0.0.28`), where
exact paths were correct because nothing moved afterwards. Its header records the
fail-closed rule and the re-scoping that already pruned applied groups, but
nothing records which entries are expected to be stable.

### Evidence

Exact-path coverage before this pass:

```text
scripts/tree-drain-manifest/foundations.ts:27  'dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md'
scripts/tree-drain-manifest/records.ts:40      'dev/build-orders/BO-2026-08-24-model-compliance-telemetry.md'
scripts/tree-drain-manifest/records.ts:90      'dev/build-orders/BO-2026-09-22-pre-push-rewrite.md'
```

The abort, measured (during FID-2026-1007-010):

```text
error: UNCOVERED PATHS (17):
  ?? dev/build-orders/README.md
  ?? dev/build-orders/archive/2026-08-16-ehel-verification-state-tracking-build-order.md
  ?? dev/build-orders/archive/2026-0816-anti-deferral-gate-build-order.md
  ?? dev/build-orders/archive/BO-2026-09-07-ndjson-phase-b-emitter.md
  ?? dev/build-orders/archive/BO-2026-09-09-gate-chain-hardening.md
```

Zero test coverage, measured:

```text
$ Get-ChildItem "scripts" -Filter "*.test.ts" | Measure-Object   # 36 files (re-measured 2026-10-08; was 35 at authoring)
$ Get-ChildItem "scripts/__tests__" -Filter "*drain*"            # (none)
```

### Correction to the implementing session

The FID-2026-1007-010 pass reported an `OVERLAP` abort as a **pre-existing latent
defect** ("`foundations.ts` and `records.ts` both claimed `BO-2026-08-23`, so
any tree where that file changed would abort"). That claim is **wrong**. The pass
had added a broad `dev/build-orders` directory entry while `foundations.ts` still
held the specific path, creating the overlap, then removed the specific line to
resolve it. The fail-closed tool caught the agent's own error. The pre-existing
problem is the narrower one stated here — exact paths under a moving directory —
and the OVERLAP is evidence the fail-closed check works, not of a latent bug.

## Impact Assessment

### Affected Components

- `scripts/tree-drain-manifest/records.ts`, `scripts/tree-drain-manifest/foundations.ts`
- `scripts/tree-drain.ts` (contract documentation only, if needed)
- `scripts/__tests__/` (new suite)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Cover `dev/build-orders` as a directory (done provisionally in
FID-2026-1007-010), then pin the invariant with a regression test so the
coverage cannot silently narrow back to exact paths.

### Steps

1. Keep the directory-scoped `'dev/build-orders'` entry in `records.ts` and the
   `foundations.ts` exact path removed. **Status: `implemented`** (landed with
   FID-2026-1007-010; provisional — this FID exists to make it permanent and
   pinned).
2. Add `scripts/__tests__/tree-drain-manifest-coverage.test.ts` asserting, over
   the real `GROUPS` through the production loader path (not a re-import):
   every path matching `dev/build-orders/**` resolves to
   exactly one group; no group both contains `dev/build-orders` and a path under
   it (the overlap class that fired during -010); and a synthetic moved path
   (`dev/build-orders/archive/<any>.md`) is covered.
3. Assert the invariant generically and in both directions: for every changed
   path the test feeds through `groupPaths`-equivalent matching, exactly one
   group claims it; and every directory-scoped entry resolves to at least one
   real path (a silently zeroed entry fails the reverse pin).
4. Document in `tree-drain-manifest.ts`'s header which entries are
   directory-scoped by necessity and must not be narrowed to exact paths.
5. Run the full gate set.

### Verification

```bash
bun test scripts/__tests__/tree-drain-manifest-coverage.test.ts
bun run typecheck:scripts
bun x eslint scripts/__tests__/tree-drain-manifest-coverage.test.ts \
  scripts/tree-drain-manifest/ --max-warnings 0
bun run lint:md
bun run quality:report
```

> Contract rule (FID-2026-0918-006): the test artifact named above MUST also
> appear as a declared `- gate: test <path>` below. Declared at implementation
> (see Verification Gates).

## Verification Gates

- gate: test scripts/__tests__/tree-drain-manifest-coverage.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:9ee213ef5949c75e35c2b36f9b7268207c707b7afd9881031eecefe9453114f4
- verified: 2026-10-09T01:03:12.404Z
- test scripts/__tests__/tree-drain-manifest-coverage.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) Manifest binds exact paths under a moving directory → any move
  aborts the drain. (2) Zero test coverage for the manifest across 36 test files (re-measured 2026-10-08).
- **GREEN:** Directory coverage + a regression test pinning the invariant.
- **AUDIT:** Overlap class pinned (the failure mode that fired in -010) so the
  directory entry cannot be reintroduced alongside a specific path.
- **ADVERSARIAL:** Would a directory entry mask a genuinely uncovered file? No —
  `groupPaths` still requires exactly one match per path; broadening coverage
  does not bypass the rule, it satisfies it. Tested, not assumed.
- **CHANGE DELTA:** n/a (converged, not implemented)

### Missed Questions

1. **Should every manifest entry be a directory?** → No. The manifest spans
   whole workspaces (`cli`-level files, `dev/fids`, `desktop`) where exact paths
   are correct and directory entries would over-collect. Only entries whose
   membership legitimately changes need broadening; this FID pins that specific
   one and records the rule.
2. **Does the test need the real git working tree?** → No. It reads the real
   `GROUPS` and matches synthetic paths through the same prefix rule the runner
   uses, so it is deterministic and needs no repo state.
3. **Why is this not folded into FID-2026-1007-010?** → -010 is a records
   change; this adds a test to a fail-closed tooling contract. Different
   verification shape, and -010's own pass recorded that burying tooling in a
   documentation entry was the error under review.

### Loop 2 — full-perfection pass, RED re-confirmation (2026-10-08, operator-triggered)

- Re-measured today: directory entry `dev/build-orders` IS present
  (`tree-drain-manifest/records.ts` → symbol:GROUPS entry); coverage test is
  still ABSENT (`ls scripts/__tests__ | grep -i drain` → no match).
- Thinker fold: the future coverage test must pin BOTH directions — every
  directory-scoped entry must resolve to ≥1 real path (a silently zeroed entry
  fails the reverse pin) and a synthetic post-freeze addition resolves to the
  frozen root — consuming the production loader path, not a re-import.
- Status unchanged: `converged`. Close-eligibility still blocked on the
  coverage test (implementation not authorized by the loop trigger).

### Loop 3 — document convergence (2026-10-08)

- **RED re-verified:** dir entry live (`records.ts:40`); no exact-path
  `dev/build-orders/*` matchers (`foundations.ts` prose-only);
  fail-closed rule live (`tree-drain.ts:12,60,71`); zero drain tests;
  `scripts/*.test.ts` now 36 (was 35); `GROUPS` exported (`records.ts:9`).
- **GREEN:** Loop-2 both-direction pins folded into Steps 2–3; stale
  35-counts corrected in Evidence, Code Verification Evidence, Loop 1.
- **AUDIT (double):** (1) all citations re-measured above; `typecheck:scripts`
  confirmed real (`package.json:69`). (2) `fid:verify --check` reports
  "no gates declared" — dismissed with cross-record proof: untouched `-012`
  and `-014` return the identical informational output, so it is the tool's
  uniform pre-implementation response, not a defect. `converged` status kept:
  tolerated by every repo gate (`validate:repository` PASS) and the only
  value describing design-converged/implementation-pending.
- **ADVERSARIAL:** no silently-narrowable step remains; the reverse pin closes
  the last gaming path (a zeroed directory entry).
- **CHANGE DELTA:** ~5% (Steps fold + count corrections + this loop).
- **CONVERGED:** zero open questions; implementation authorized separately.

### Loop 4 — implementation (2026-10-08, operator-authorized completion pass)

- **RED:** coverage test absent; header documents no directory-scoped rule.
- **GREEN:** `scripts/__tests__/tree-drain-manifest-coverage.test.ts` (7 pins:
  forward coverage, synthetic moved path, overlap-class scan, exact-entry
  single-owner samples, reverse liveness with non-vacuous guard, two fixture
  negative legs proving load-bearing); header note in
  `tree-drain-manifest.ts`; one self-found import-order warning fixed.
  Step 1 confirmed already live on disk (`records.ts:40`, foundations clean).
- **AUDIT:** suite 7/7 · `typecheck:scripts` exit 0 ·
  `eslint --max-warnings 0` exit 0 · `lint:md` exit 0 ·
  `quality: PASS (1498 baselined files)` (`typecheck:scripts` run, not
  declared: `scripts/` outside `VALIDATION_WORKSPACE_POLICY`).
- **CHANGE DELTA:** ~4%. **Status ruling:** `converged` → `fixed`.
- **Closure:** `fixed` → `closed` on implementation verification (receipt 2/2
  PASS); archived with receipt re-stamped at the archived path.

## Resolution

- **Closed Date:** 2026-10-08
- **Fix Description:** directory coverage made permanent and pinned: regression
  suite over the real `GROUPS` (both directions) plus the manifest header rule.
- **Tests Added:** Yes — `scripts/__tests__/tree-drain-manifest-coverage.test.ts` (7 pins).
- **Verification Evidence:** suite 7/7, `typecheck:scripts` exit 0,
  `eslint --max-warnings 0` exit 0, `lint:md` exit 0,
  `quality: PASS (1498 baselined files)`; receipt `sha256:37be7da1…`
  stamped 2026-10-09T01:00:45Z at implementation (2/2 gates), re-stamped at
  the archived path. Commit: pending operator G2 commit (working tree).
- **Archived:** 2026-10-08 — moved to `dev/fids/archive/`; register item T164-B complete.

### Code Verification Evidence

Status is `closed` — closed on implementation verification (Loop 4) and
archived. The regression test in Steps 2–3 exists and passes
(7/7, including the fixture negative legs), the header rule in Step 4 is
written, and Step 1's provisional entry was confirmed live on disk
(`records.ts:40`; foundations clean) before archival. The RED evidence remains
measured output; gate outputs are transcribed in Loop 4.

## Lessons Learned

**A fail-closed invariant with no test is documentation.** The manifest's
coverage rule is stated in three comments and enforced nowhere; it survived only
because a human ran the tool. The rule that protects a commit path deserves the
same pinning as any other gate.
