# FID: verify:clean omits the SDK declaration gate (dts compilation surface)

**Filename:** `FID-2026-0909-003-verify-clean-sdk-declaration-gate.md`
**ID:** FID-2026-0909-003
**Severity:** medium
**Status:** created
**Created:** 2026-09-09 03:24
**YAGNI-Compliance:** Pending

---

## Summary

`verify:clean` (FID-2026-0907-002) proves the committed tree compiles via a
detached worktree plus the workspace typecheck chain — but the typecheck
chain compiles each workspace with its own tsconfig, where `common` loads
Bun types. The SDK release build's declaration step
(`dts-bundle-generator` in `sdk/scripts/build.ts`) recompiles the SDK-
reachable common sources under a plain-TS program **without** Bun types —
a distinct compilation surface no local gate exercises. Consequence: the
v0.0.30 cut failed at `build:sdk` (`TS2339` on `common/src/env.ts:44`)
although every local gate, including `verify:clean`, was green.

## Environment

- **OS:** Windows 11 (win32)
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14
- **Tool Versions:** dts-bundle-generator (SDK release build)
- **Commit/State:** v0.0.30 cut, HEAD `aab5109` (2026-09-09)

## Detailed Description

### Problem

The v0.0.30 release run failed at the `build:sdk` gate with:

```text
../common/src/env.ts(44,46): error TS2339: Property 'dir' does not exist
  on type 'ImportMeta'.
❌ TypeScript declaration bundling failed: Compiled with errors
```

The same tree passed `bun run typecheck` (×12 workspaces, exit 0) and
`bun run verify:clean` — because both compile `common` with Bun types
loaded, which the declaration pass does not.

### Expected Behavior

The committed-tree compile proof should cover every compilation surface a
release consumes — including the SDK's plain-TS declaration program — so a
declaration-surface blocker fails locally (or at the pre-push gate) rather
than at the cut.

### Root Cause

`verify:clean`'s gate chain mirrors the workspace typecheck scripts, which
is necessary but not sufficient: the dts pass is a second compiler
configuration over the same sources, and it is currently exercised only
inside the release pipeline itself.

### Evidence

```text
# Release receipt gate attempt (build-sdk-1.log, v0.0.30 cut 2026-09-09):
📝 Generating and bundling TypeScript declarations...
../common/src/env.ts(44,46): error TS2339: Property 'dir' does not exist
  on type 'ImportMeta'.
❌ TypeScript declaration bundling failed: Compiled with errors
# durationMs: 7011  — while local `bun run typecheck` was exit 0 on the
# same commit.
```

## Impact Assessment

### Affected Components

- `scripts/verify-clean.ts` (gate chain — the gap)
- `sdk/scripts/build.ts` (the uncovered surface)
- Release pipeline GATES stage (downstream victim)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

The same structural class as the v0.0.24 phantom-dependency incident
(FID-2026-0816-001): a compile surface consumed only by the release
pipeline, invisible to every pre-release gate. Fixing after the cut costs
a release round-trip; the guard is cheap.

## Proposed Solution

### Approach

Extend `verify:clean`'s committed-tree proof to include the SDK build (or,
for a cheaper chain, a standalone `build:sdk` invocation — its
`durationMs` was ~7s) so the declaration surface compiles on every clean
verification. The build already runs green post-fix (2b22103), so the
addition is a pure gate-chain extension with no code change expected.

### Steps

1. Read `scripts/verify-clean.ts` 0-EOF and the gate-chain assembly;
   confirm `build:sdk` is absent.
2. Add `build:sdk` (root script: `cd sdk && bun run build`) to the chain
   after the typecheck gates, with its transcript captured like the
   others.
3. RED-first pin: revert `common/src/env.ts` to `import.meta.dir` on a
   scratch branch/worktree and assert the extended `verify:clean` fails;
   restore and assert green.
4. Update `verify:clean`'s documented contract (FID-2026-0907-002 record,
   README/docs if the chain is documented) and stamp the receipt.

### Verification

Extended `verify:clean` passes on the clean committed tree; the RED pin
proves it catches the declaration-surface failure class; typecheck
scripts + eslint clean.

## Verification Gates

Pending — declared at GREEN once the chain extension is implemented
(live re-run by `validate:repository` from status `fixed` onward).

## Perfection Loop

### Loop 1 — RED

- **RED:** Gap cataloged 2026-09-09 after the v0.0.30 `build:sdk` gate
  failure (evidence above): the declaration surface is release-pipeline-
  only, uncovered by `verify:clean`.
- **GREEN:** Not started (the env.ts instance is fixed via 2b22103; this
  FID's open work is the gate-chain extension).
- **AUDIT:** Not started.
- **ADVERSARIAL:** Not started.
- **CHANGE DELTA:** N/A (planning record).

### Missed Questions

1. Why not add the full `build:sdk` to pre-push? — Cost: the gate runs on
   every push and the build takes ~7s plus dist churn; `verify:clean` is
   the committed-tree proof surface where compile coverage belongs.
   Operator may prefer both; decision at GREEN.
2. Does the CLI release build have a sibling uncovered surface? — Open
   question for GREEN: inventory whether `build:savant-free` (or the
   binary build) introduces additional compiler configurations beyond the
   typecheck chain, and cover any found in the same step.

### Code Verification Evidence

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present for new or repaired wiring
- [ ] FID status reflects the actual implementation state

## Lessons Learned

"Compiles" is not one claim. Each compiler configuration a release
consumes (workspace tsconfigs, plain-TS declaration programs, bundled
targets) is a separate surface that needs its own gate in the committed-
tree proof — otherwise the release pipeline is the only place the surface
is ever compiled.

## Resolution

- **Closed Date:** (pending)
- **Fix Description:** (pending)
- **Tests Added:** (pending)
- **Verification Evidence:** (pending)
- **Archived:** (pending)