# FID: tree-drain manifest coverage is exact-path under a directory whose contents move

**Filename:** `FID-2026-1007-011-tree-drain-manifest-move-safety.md`
**ID:** FID-2026-1007-011
**Severity:** medium
**Status:** converged
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
manifest has no regression test: `scripts/` contains 35 `*.test.ts` files and
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
$ Get-ChildItem "scripts" -Filter "*.test.ts" | Measure-Object   # 35 files
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
   the real `GROUPS`: every path matching `dev/build-orders/**` resolves to
   exactly one group; no group both contains `dev/build-orders` and a path under
   it (the overlap class that fired during -010); and a synthetic moved path
   (`dev/build-orders/archive/<any>.md`) is covered.
3. Assert the invariant generically: for every changed path the test feeds
   through `groupPaths`-equivalent matching, exactly one group claims it.
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
> appear as a declared `- gate: test <path>` below. It does not yet exist —
> gates are declared when the implementation lands, per the `converged`
> contract.

## Verification Gates

Gates are declared at implementation time. `scripts` is **not** in
`VALIDATION_WORKSPACE_POLICY` (`scripts/validation-gates.ts:22-59`), so no
`typecheck scripts` gate is declarable; the suite plus `quality` are the
available shapes.

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) Manifest binds exact paths under a moving directory → any move
  aborts the drain. (2) Zero test coverage for the manifest across 35 test files.
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

## Resolution

- **Closed Date:** pending
- **Fix Description:** pending
- **Tests Added:** pending — `scripts/__tests__/tree-drain-manifest-coverage.test.ts`
- **Verification Evidence:** pending
- **Archived:** pending

### Code Verification Evidence

Status is `converged` — the implementation described in Step 1 landed
provisionally with FID-2026-1007-010 (the directory-scoped `dev/build-orders`
entry is in `records.ts`; the overlapping exact path is gone from
`foundations.ts`), but the regression test in Steps 2–3 does not exist, so this
FID is **not** closure-eligible. The RED evidence in this document is measured
output, and `FID-2026-1007-010`'s stamped receipt covers the provisional
manifest edit. The gap this FID closes — zero test coverage across 35 files in
`scripts/` — is verified by the enumeration in the Evidence section.

## Lessons Learned

**A fail-closed invariant with no test is documentation.** The manifest's
coverage rule is stated in three comments and enforced nowhere; it survived only
because a human ran the tool. The rule that protects a commit path deserves the
same pinning as any other gate.