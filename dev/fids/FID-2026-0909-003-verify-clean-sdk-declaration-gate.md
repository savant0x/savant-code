# FID: verify:clean omits the SDK declaration gate (dts compilation surface)

**Filename:** `FID-2026-0909-003-verify-clean-sdk-declaration-gate.md`
**ID:** FID-2026-0909-003
**Severity:** medium
**Status:** analyzed
**Created:** 2026-09-09 03:24
**YAGNI-Compliance:** PASS (2026-09-09 — see Loop 1)

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

**Corrected 2026-09-09 (Loop 1, codebase-grounded):** the gate chain does not
live in `scripts/verify-clean.ts` — it lives in
`assertCleanCheckoutCompiles` (`scripts/public-release/provenance.ts:135-212`),
which the release GATES stage (`assertReleaseHeadCompiles`) and `verify:clean`
share. Extending the shared chain with a plain `build:sdk` step would run the
SDK build twice inside a release cut (wasteful, and the GATES stage already
runs it with transcript capture). The design is therefore a **parameterized
gate list**: `assertCleanCheckoutCompiles` gains an options parameter carrying
the post-install gates (default: the typecheck chain, byte-identical to
today), `verify:clean` opts in to `build:sdk` appended after typecheck, and
the release path stays on the default (no duplicated work).

### Steps

1. Read `scripts/verify-clean.ts` 0-EOF and the gate-chain assembly;
   confirm `build:sdk` is absent. **Done 2026-09-09 (Loop 1):** confirmed —
   `verify:clean` delegates to `assertCleanCheckoutCompiles`; the chain is
   `git worktree prune` → `git worktree add --detach` → `bun install
   --frozen-lockfile` → `bun run typecheck` → `worktree remove --force` in a
   `finally`. `build:sdk` is absent from both call paths.
2. Parameterize the post-install gate list in `assertCleanCheckoutCompiles`
   (default unchanged: the typecheck chain); `runVerifyClean` passes
   `gates: [...typecheck, build:sdk]`. Transcript capture and fail-closed
   error shapes stay identical to the existing typecheck step.
3. RED-first pin: revert `common/src/env.ts` to `import.meta.dir` on a
   scratch worktree and assert the extended `verify:clean` fails with the
   TS2339 shape; restore and assert green. (Run AFTER FID-2026-0909-001's
   lifecycle fix — the pin creates deliberate gate failures at the shared
   Temp path; see the master plan's sequencing.)
4. Update `verify:clean`'s documented contract (`scripts/verify-clean.ts`
   header comment + HELP_TEXT, the FID-2026-0907-002 record, README/docs if
   the chain is documented) and stamp the receipt.

### Verification

Extended `verify:clean` passes on the clean committed tree; the RED pin
proves it catches the declaration-surface failure class; typecheck
scripts + eslint clean.

## Verification Gates

Declared at Loop 1 (2026-09-09), to be live-run at implementation:

1. `bun test scripts/__tests__/verify-clean.test.ts` — extended mock-runner
   suite proves the `build:sdk` gate joins the chain in order (and that the
   default chain is byte-identical for the release path).
2. `scripts/public-release-provenance.test.ts` — default-path parity pins
   stay green (no behavior change when the parameter is omitted).
3. RED pin — planted `import.meta.dir` violation fails the extended
   `verify:clean` with the TS2339 transcript (scratch worktree).
4. Live — one full `bun run verify:clean` PASS on the committed tree
   including the SDK declaration surface.
5. Root hygiene — `bun x eslint scripts/verify-clean.ts
   scripts/public-release/provenance.ts --max-warnings 0` + typecheck of the
   scripts surface via `bun run --cwd=sdk typecheck` unaffected (scripts are
   repo-root files; eslint + `bun run validate:repository` are the gates).

## Perfection Loop

### Loop 1 — RED / GREEN / AUDIT (2026-09-09, codebase-grounded)

- **RED (ground-truth verification):** every claim re-verified against the
  live code. CONFIRMED: `verify:clean` delegates its whole gate chain to
  `assertCleanCheckoutCompiles` (`scripts/verify-clean.ts:20,66`);
  `build:sdk` is absent from the chain (chain = worktree → install →
  `bun run typecheck` → cleanup, `provenance.ts:151-208`); the release
  GATES stage reaches the same function via `assertReleaseHeadCompiles`
  (`provenance.ts:120-126` ← `stages.ts`); `build:sdk` =
  `cd sdk && bun run build` (root package.json), whose declaration step is
  `dts-bundle-generator` in `sdk/scripts/build.ts` (imports at
  `sdk/scripts/build.ts:128` use the build tsconfig). The v0.0.30
  TS2339-at-cut evidence stands (transcript in the record above).
- **GREEN (design corrections from grounding):** (1) the chain lives in the
  shared provenance function, not `verify-clean.ts` — the extension must be
  parameterized or a release cut would run `build:sdk` twice (the FID's
  original Step 2 wording implied editing `verify-clean.ts` directly);
  (2) `runVerifyClean` already owns the opts-in seam (`runner` is already
  injectable, suite convention at `scripts/__tests__/verify-clean.test.ts`),
  so the gate list joins the same parameter surface; (3) the Step 3 RED pin
  has a hidden ordering constraint — it deliberately fails gates at the
  shared versioned Temp path, which is exactly FID-001's orphan bug, so the
  pin must run after FID-001's fix (recorded in the master plan).
- **AUDIT (Missed Questions answered with evidence):**
  1. *Pre-push vs verify:clean* — UNCHANGED decision, now evidenced:
     `verify:clean` is the committed-tree proof surface and the live
     baseline run cost 133.9s; adding ~7s there is proportionate, adding it
     to every pre-push is not. Operator may still choose both at
     implementation.
  2. *Sibling uncovered surfaces* — ANSWERED (closes the open question):
     `build:savant-free` (`savant-free/cli/build.ts` read 0-EOF) shells to
     `cli/scripts/build-binary.ts` — a Bun **compile** (bundler) target:
     it catches module-resolution failures but performs **no type
     checking**, and costs minutes per run. The plain-TS *type-checking*
     orphan surface is uniquely `build:sdk`. `build:savant-free` is
     therefore out of scope for this FID (wrong failure class, disproportionate
     cost); this record documents the boundary so the class is known.
- **ADVERSARIAL (self-refutation pass):** strongest objection — "the
  parameterized gate list is speculative generality." Refuted: the two
  call paths demonstrably need different gate sets today (release already
  runs build:sdk outside the chain), so the parameter encodes an existing
  difference, not a future one. Second objection — "the RED pin is
  expensive." Accepted as a constraint, not a design change: the pin is
  one scratch-worktree run and is sequenced after FID-001.
- **CHANGE DELTA:** planning record; document edits only.
- **CONVERGENCE:** delta < 2% for this pass; all RED findings resolved in
  the same pass (no oscillation). Loop closed at 1.

### Missed Questions

1. ~~Why not add the full `build:sdk` to pre-push?~~ ANSWERED (Loop 1
   AUDIT): cost-basis — `verify:clean` is the committed-tree proof surface
   (baseline run 133.9s live); ~7s belongs there, not on every push.
   Operator may still opt into both at implementation.
2. ~~Does the CLI release build have a sibling uncovered surface?~~
   ANSWERED (Loop 1 AUDIT): `build:savant-free` is a Bun compile (bundler)
   target — module-resolution failures surface there, but no type checking
   occurs; out of scope for this FID with the boundary documented.

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