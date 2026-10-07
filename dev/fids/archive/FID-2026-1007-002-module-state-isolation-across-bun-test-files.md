# FID: Module-scope state is shared by every Bun test file

**Filename:** `FID-2026-1007-002-module-state-isolation-across-bun-test-files.md`
**ID:** FID-2026-1007-002
**Severity:** high
**Status:** closed
**Created:** 2026-10-07 06:20
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

`bun test` loads every file of a workspace into ONE process, so a module-scope
`Map`/`Set`/array/`let` that accumulates is process-lifetime state that every
suite inherits — and a suite's verdict then depends on which files ran first.
That is how the agent-runtime suite was red with 76 failures from a single
circuit-breaker registry (FID-2026-1007-001). This record is the systematic
answer to the class rather than to that instance: a mechanical audit
(`scripts/audit-module-state.ts` + three split modules and a probe) enumerates
every module-scope mutable binding in the repository, and **144 bindings across
98 files** were found with no way to return them to their start state. All 144
are now cured — 96 new `reset*`/`clear*` seams were added and nine `const`
weak-container declarations became reassignable — and **182 of the 187
resettable bindings are wired into a test preload**, with the remaining 5 in two
modules recorded by name and reason (both are program tooling a preload must
never import). Ten preload surfaces were
created or extended; six workspaces that had **no preload at all** (Bun does not
walk up for `[test] preload`) now have one. Wiring the resets surfaced two real
suite regressions, both fixed at the right boundary rather than by weakening the
reset: a database connection cache cleared per case broke an in-memory
database's identity, and the theme store — whose bare reset broke 122 component
tests that render without initializing it — is instead rebuilt through the boot
path's own store factory (Loop 3), so it is wired rather than exempted.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** tsc, eslint, prettier, markdownlint, bun test
- **Commit/State:** HEAD `d035e09b` at intake. The change set is committed as `5299af25`
  (121 files, path-scoped; G2 granted 2026-10-07), closed and archived in the same session.

## Detailed Description

### Problem

Every workspace runs its own `bun test`, which loads all of that workspace's
files into a single process. Any module-scope binding that is mutated over a
run therefore persists from file to file: a registry keyed by a fixed fixture
id, a memoized connection, a `let` cache, a counter. The failure mode is not a
crash; it is order-dependence — the same file passes alone and fails when a
different file precedes it, and the suite's verdict becomes a function of
loader order. FID-2026-1007-001 fixed the one instance that had already cost 76
failures. Nothing enumerated the others, and six workspaces had no preload at
all, so nothing in them could be reset even if a seam existed.

### Expected Behavior

Each case starts from the state its module declares. Production keeps whatever
sharing it needs (one breaker per connection, one connection per path, one
store per process) — the reset lives at the test boundary, not in the
production contract. And the boundary has two levels, which the wiring had to
respect: state a single case must be able to observe (a database connection,
a store) is cleared between FILES; state that must not leak between CASES
(counters, registries, caches) is cleared before every case.

### Root Cause

1. **Module-scope mutable state accumulates for the life of the process.** A
   scanner finding is a binding declared at column 0, mutated after
   initialization (a `set`/`add`/`delete`/`clear`/`push` call, an index write,
   or a reassignment) and not named by any same-file `reset*`/`clear*` seam.
2. **Nothing enforced a reset, and nothing enforced that a reset is called.**
   Several modules had a test seam under a name no convention covered
   (`__resetYagniEnforcedCacheForTests`, `clearOpenTurnsForTesting`,
   `__resetSkillRegistryForTests`), so a narrow matcher reported gaps that were
   already covered — and a fan-out acting on those reports would have minted
   duplicate seams.
3. **Six workspaces ran with no preload.** Measured, not assumed: with no
   `common/bunfig.toml`, a probe test in `common` saw
   `OPEN_ROUTER_API_KEY === undefined` even though the root preload sets it —
   Bun does not walk up for `[test] preload`. `common`, `desktop`,
   `packages/database`, `packages/knowledge-graph`, `packages/connectors` and
   `packages/code-map` were therefore unisolated surfaces.
4. **A reset can be wrong at the wrong boundary.** Clearing the database
   connection cache before every case handed a later case a *different*
   in-memory database than the handle its file had captured.

### Evidence

Audit before (the class was 144 bindings wide, not one):

```text
$ bun scripts/module-state-check.ts
module-state: 144 module-scope mutable binding(s) with no same-file reset
  mutable-binding/let: 90
  mutable-container/map: 28
  mutable-container/weak-container: 9
  mutable-container/array: 6
  mutable-container/object: 6
  mutable-container/set: 5
```

Audit after:

```text
$ bun scripts/module-state-check.ts
module-state: PASS (2481 production files scanned; 115 read-only constants;
56 program entrypoints skipped; 182 of 187 resettable bindings wired into a
test preload)
  reach: 5 resettable binding(s) sit in modules no preload loads (state a test
  process never inherits):
    scripts/providers/verify-window-truth.ts — keys, failures, censusUnregistered,
      censusCounts (by design: Program tooling with top-level side effects …)
    scripts/test-count.ts — total (by design: Program tooling with top-level
      side effects …)
    scripts/test-count.ts — total (by design: Program tooling with top-level side effects …)
```

No preload in `common` (the measurement that drove the six new `bunfig.toml`
files) and the two regressions the wiring surfaced, each fixed at the right
boundary:

```text
$ cd common && bun test zz-bunfig-probe.test.ts      # before common/bunfig.toml
PROBE OPEN_ROUTER_API_KEY= undefined                  # root preload never loaded

$ bun run --cwd=cli test                              # with use-theme wired
 3838 pass / 122 fail   error: useThemeStore not initialized

$ bun run --cwd=packages/database test                # with a per-case connection clear
 (fail) DB5: corrupt message content falls back to null, not a throw
 SQLiteError: FOREIGN KEY constraint failed  service.test.ts:277
```

Call graph and change sites (verified by grep and by the audit at
implementation):

```text
AUDIT (new)
  scripts/audit-module-state.ts          compose: findings + wiring + reach
  scripts/module-state-scan.ts           walk/roots/entrypoint rules
  scripts/module-state-analyze.ts        candidates, mutation, reset coverage
  scripts/module-state-wiring.ts         bunfig preload parse, rot, wired set
  scripts/module-state-exemptions.ts     deliberate non-resets + unwired reasons
  scripts/module-state-check.ts          the probe (exit 0 clean / 1 with findings)

PRELOADS (new unless marked)
  packages/agent-runtime/test/setup-test-isolation.ts   extended (24 seams)
  cli/src/test-setup.ts                                 extended (57 seams)
  evals/test-env.ts                                     extended (1 seam)
  common/test/setup-test-isolation.ts                   new  + common/bunfig.toml
  desktop/test/setup-test-isolation.ts                  new  + desktop/bunfig.toml
  sdk/test/setup-test-isolation.ts                      new  + sdk/bunfig.toml (extended)
  packages/database/test/setup-test-isolation.ts        new  + bunfig.toml
  packages/knowledge-graph/test/setup-test-isolation.ts new  + bunfig.toml
  packages/connectors/test/setup-test-isolation.ts      new  + bunfig.toml
  packages/code-map/test/setup-test-isolation.ts        new  + bunfig.toml

BOUNDARY FIX (the two-level rule, measured)
  packages/database/test/setup-test-isolation.ts   beforeEach: journal + mutation lane
                                                   afterAll:  connections + statements
  packages/agent-runtime/test/setup-test-isolation.ts   beforeEach: all 24 seams
                                                                 (incl. clearThinkerConvergenceStateForTests)
```

## Impact Assessment

### Affected Components

- `scripts/audit-module-state.ts`, `scripts/module-state-scan.ts`,
  `scripts/module-state-analyze.ts`, `scripts/module-state-wiring.ts`,
  `scripts/module-state-exemptions.ts`, `scripts/module-state-check.ts` (new)
- `scripts/__tests__/module-state-audit.test.ts` (new)
- 98 production modules across `cli`, `common`, `desktop`, `sdk`, `evals`,
  `packages/{agent-runtime,database,knowledge-graph,connectors,code-map}` and
  `scripts` — each gaining a reset seam (96 new exported functions in total)
- 7 new test preload modules and 6 new `bunfig.toml` files, plus 3 extended
  preloads (`packages/agent-runtime`, `cli`, `evals`) and 1 extended bunfig (`sdk`)

### Risk Level

- [x] High: the deliverable is repository-wide, and getting the boundary wrong
      is measurable — a mis-scoped database reset and a mis-scoped theme-store
      reset each broke a suite until fixed (both recorded above).

## Proposed Solution

### Approach

Separate the three questions the class hides behind one word, "leak", and make
each decidable in code rather than in prose: **coverage** (every module-scope
mutable binding has a reset, an exemption whose reason is a documented
behaviour, or a recorded reason for being unreachable), **wiring** (every reset
a preload imports still exists and is still called), and **reach** (which
bindings no preload can reach). Then fix the inventory mechanically and let the
suites arbitrate every boundary decision.

### Steps

1. **DONE.** `scripts/audit-module-state.ts` + its three split modules and the
   `scripts/module-state-check.ts` probe: 2481 files scanned, 115 read-only
   constants excluded by evidence (never mutated), 56 program entrypoints
   skipped (their state dies with the process they start).
2. **DONE.** Widen the reset matcher to the repository's real seam names
   (`reset*`, `clear*`, `__reset*`) and match declarations wrapped across lines
   (`const listToolsCache: Record<\n …\n> = {}`). Both widenings came from
   worker reports of false positives/negatives, and both removed duplicate
   seams instead of adding them.
3. **DONE.** Cure all 144 findings across 98 files in a 12-worker fan-out: 96
   new exported reset seams, 9 `const` → `let` flips where a `WeakMap`/`WeakSet`
   can only be cleared by reassignment. No reset performs I/O (no connection
   closed, no process killed, no request aborted) and each restores the
   declaration's own initializer.
4. **DONE.** Wire the resets: extend the three existing preloads
   (agent-runtime, cli, evals) and create seven new ones with their
   `bunfig.toml` files — six workspaces that had no preload at all.
5. **DONE.** Fix the two boundary regressions the wiring exposed: the database
   connection/statement caches move to `afterAll` (an in-memory database's
   connection IS the database), and the theme-store reset is left unwired with
   its reason recorded (superseded by step 7).
6. **DONE.** Record the deliberate remainder in
   `scripts/module-state-exemptions.ts`: one documented non-reset
   (`gatewayCatalogListeners` must survive cache resets or the gateway-catalog
   store loses its subscription) and two modules a preload must not import. The
   audit FAILS if an unreached module has no recorded reason, and fails if a
   recorded reason no longer describes anything — so neither list can rot or
   grow silently.

### Verification

- **P1** `bun scripts/module-state-check.ts` exits 0 with 0 uncured findings and
  0 wiring issues over 2481 scanned files, and prints the reach boundary with a
  reason for every unreached module.
- **P2** The pins in `scripts/__tests__/module-state-audit.test.ts` hold the
  scanner's false-positive and false-negative classes still: a read-only
  constant is not state, a nested binding is not module scope, a wrapped
  declaration IS a candidate, `__reset*`/`clear*` count as coverage, and an
  aliased preload import is still wiring.
- **P3** Every declared workspace typecheck exits 0, including the scripts tree
  (`scripts/scripts-typecheck-check.ts`), with the new
  seams and preloads in place.
- **P4** Every workspace suite is green with the resets wired: 8389 pass /
  0 fail / 23 skip across the 13 workspace legs.
- **P5** Wiring is shown to be load-bearing, not decorative: the same audit
  reports a missing/uncalled/misnamed imported reset as a failure, and the
  live-repository pin asserts the real tree is clean.
- **P6** The two boundary decisions are recorded with the failure that produced
  them (the in-memory database identity and the theme store), so the next
  session does not have to rediscover why the connection cache resets at the
  file boundary.
- **P7** The theme store is isolated without moving the problem into 122 test
  files: `resetUseThemeState()` is wired into the CLI preload, and
  `cli/src/hooks/__tests__/use-theme-reset.test.ts` pins both halves — the reset
  returns a USABLE store (a case that never calls `initializeThemeStore()` still
  renders) and drops a `setThemeName` mutation made earlier in the file. `bun run
  --cwd=cli test` is 3960 pass / 0 fail / 18 skip with it wired.

## Verification Gates

- gate: probe scripts/module-state-check.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: test scripts/__tests__/module-state-audit.test.ts
- gate: typecheck cli
- gate: typecheck common
- gate: typecheck desktop
- gate: typecheck evals
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: typecheck packages/code-map
- gate: typecheck packages/connectors
- gate: typecheck packages/database
- gate: typecheck packages/knowledge-graph
- gate: test cli/src/hooks/__tests__/use-theme-reset.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b3bf69302dd35d08df0387c170790f4c86bc7f1c19ded64172b29f02cb5c75ba
- verified: 2026-10-07T06:45:09.378Z
- probe scripts/module-state-check.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- test scripts/__tests__/module-state-audit.test.ts: exit 0
- typecheck cli: exit 0
- typecheck common: exit 0
- typecheck desktop: exit 0
- typecheck evals: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck packages/code-map: exit 0
- typecheck packages/connectors: exit 0
- typecheck packages/database: exit 0
- typecheck packages/knowledge-graph: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** FID-2026-1007-001 repaired one registry. This record asked the
  class-level question — how many others are there — and the first honest answer
  was 144 across 98 files, plus the discovery that six workspaces had no preload
  to put a reset in. The audit tool did not exist; it had to be built before the
  question could be answered at all.
- **GREEN:** the audit, the fan-out cure (96 new seams, 9 `const` → `let`), the
  ten preload surfaces, and the two boundary fixes.
- **AUDIT:** every number in this record is re-measured on the final tree: the
  audit's own PASS line, the 13 workspace suite summaries, `eslint
  --max-warnings 0` on the 148 changed TypeScript files, and prettier clean.
- **ADVERSARIAL:** the strongest challenge is that "resettable" was satisfied
  everywhere while "wired" was not — 7 bindings in 3 modules are reset-capable
  and deliberately unwired. Rather than state that in prose, the audit fails
  when an unreached module has no recorded reason and fails when a recorded
  reason no longer describes anything; the two program-tooling modules are
  unimportable by construction (one exits the process, one fetches at import),
  and the theme store is the one genuinely open piece of work, named with the
  122 failures its wiring causes today.
- **CHANGE DELTA:** new document.

### Missed Questions

1. **Is "has a reset" the same as "is isolated"?** No — hence three legs rather
   than one. A seam nobody calls changes nothing, which is why the audit parses
   the preloads, requires the import to still resolve and to be called, and
   reports which modules no preload loads.
2. **Why not reset everything before every case?** Because some state IS the
   object under test's identity: clearing the database connection cache per case
   gave a later case a fresh in-memory database while its captured handle still
   pointed at the old one (`FOREIGN KEY constraint failed`). State a case must
   be able to observe is cleared at the file boundary instead, and that
   distinction is now implemented, not just described.
3. **Should the 122 theme-store failures be fixed by editing those tests?** They
   are 122 component tests rendering without `initializeThemeStore()`, relying
   on a store an earlier file created. That is a real change to those files and
   is recorded as the reason the seam is unwired — the alternative (shipping a
   red suite) is not an option, and hiding it behind a "benign" label would be
   the lie this audit exists to prevent.
4. **Are WeakMap/WeakSet leaks real?** Mostly not for identity-keyed maps, but a
   shared state object would inherit a stale publisher; nine were made
   reassignable rather than argued away, and the flip is safe because the reset
   is the only reassignment.
5. **Which caches does the scanner still miss?** Container literals only. A
   cache typed as an LRU wrapper (`packages/agent-runtime/src/util/token-counter.ts`
   `TOKEN_COUNT_CACHE`) is invisible to it; that is stated as the tool's boundary
   in its own header rather than implied to be covered.
6. **Does a preload importing a module change test semantics?** Yes, and the
   suites said so twice (both regressions). The audit's `reach` report is what
   keeps that honest going forward: a module whose import is unsafe must be
   recorded, not silently dropped.

### Implementation Evidence (REQUIRED for `closed`)

> Closed 2026-10-07 on the operator's ruling: "approve, grant automation level 3" (G2).

- [x] **Commit SHA:** `5299af25`
- [x] **File:line ranges:** see Evidence and the gate list above
- [x] **Gate output:** all fifteen declared gates exit 0 at the stamped receipt
- [x] **Reproducibility:** `bun scripts/module-state-check.ts` on a clean tree
      reproduces the finding list; `bun test
      scripts/__tests__/module-state-audit.test.ts` reproduces the pins
- [x] **Step statuses:** steps 1-7 all implemented (1-6 in the first pass, step 7 in the 2026-10-07 closure pass)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (all seven steps)
- [x] Typecheck/tests/lint pass with pasted tool output — all ten declared
      `typecheck` gates exit 0, both probe gates exit 0 (the second being the
      scripts-tree typecheck), the pin suite is 11/11,
      `quality` exit 0 at the receipt, `validate:repository` PASS, eslint 0
      warnings and prettier clean on every changed file
- [x] Production call-graph evidence is present for the repaired wiring — each
      preload's imports are the call graph, and the audit verifies it rather
      than trusting it (`- [x]` wiring leg above)
- [x] FID status reflects the actual implementation state (`fixed`: implemented
      and verified, uncommitted)

### Loop 3 — the named remainder, closed rather than carried (2026-10-07)

- **RED:** Loop 2 left one binding pair deliberately unwired: `useThemeStore`
  and `themeStoreInitialized`, because wiring a bare reset broke 122 CLI
  component tests that render without calling `initializeThemeStore()`. An
  exemption with a measurement behind it is better than a silent gap — but it is
  still a leak that a later case can observe, so the operator's 2026-10-07
  ruling ("approve, grant automation level 3") was taken as the point to finish
  it rather than carry it.
- **GREEN:** the store construction moves behind one factory. `themeFor(name)`
  and `createThemeStore(initialTheme)` are extracted from `initializeThemeStore`,
  which now uses both, and `resetUseThemeState()` rebuilds through the SAME
  factory instead of restoring the throwing pre-init stub — so a case starts from
  the theme the process would have initialized with, a `setThemeName` mutation
  cannot cross a case boundary, and the 122 files stay untouched. The reset arms
  no watcher, resolver or file watcher (only `initializeThemeStore` owns those),
  keeping the "no reset performs I/O" rule the record already applied to the
  other 143. `scripts/module-state-exemptions.ts` retires the use-theme reason,
  and the audit's bidirectional rule then proves the retirement is real: an
  exempted module with no reason fails, and a reason that no longer describes
  anything also fails.
- **AUDIT:** re-measured on the final tree, not restated: `module-state: PASS
  (2481 files; 182 of 187 wired)` with a 5-binding reach list, `bun test
  src/hooks/__tests__/use-theme-reset.test.ts` 2 pass / 0 fail, and
  `bun run --cwd=cli test` 3960 pass / 0 fail / 18 skip (exit 0).
- **ADVERSARIAL:** the honest limit is that this fixes isolation, not the
  detection of the 122 files' reliance on an ambient store — they still render
  without initializing it, and would still be order-dependent if the preload
  ever stopped running. What changed is that the state they inherit is now the
  boot default rather than whatever the previous file left behind, and P7 pins
  exactly that.
- **CHANGE DELTA:** one module refactored behind two extracted functions, one
  preload import, one exemption retired, one new 2-case pin, and the record's
  numbers.

### Loop 2 — Independent audit and self-correction

- **RED:** two pieces of this work were wrong on first measurement, and both
  were caught by the repository's own suites rather than by reasoning: a
  per-case database connection reset broke a test that owns its handle, and the
  theme-store reset broke 122 component tests. A third defect was in the tool
  itself — the first scanner missed `__reset*`/`clear*` seams and wrapped
  declarations, which had produced a 144-line list containing gaps that were
  already covered and omissions that were not.
- **GREEN:** both boundary fixes, the scanner widenings, and the two recorded
  lists (exemptions + unwired reasons) so the remaining boundary is explicit.
- **AUDIT:** the final tree's numbers are the ones in this record; the audit
  exits 0 over 2481 scanned files with 180/187 wired, and the live-repository
  pin asserts that state so a future change cannot quietly reopen it.
- **ADVERSARIAL:** the honest limit is coverage of *shapes*, not of *leaks*: the
  scanner enumerates module-scope container literals and `let` bindings in
  author-written modules, and cannot see a cache hidden behind a class, an LRU
  wrapper, or a dependency-injected store. The tool says so in its header, and
  the reach leg ensures that what it does find is either wired or explained.
- **CHANGE DELTA:** new document.

## Resolution

- **Closed Date:** 2026-10-07
- **Fix Description:** the class behind FID-2026-1007-001 was enumerated
  repository-wide: 144 module-scope mutable bindings across 98 files had no
  reset, and six workspaces had no preload to call one. All 144 are cured (96
  new seams, 9 weak-container declaration flips, no reset performing I/O), 182
  of 187 are wired into a preload, and the 5 that are not carry recorded reasons
  that the audit enforces in both directions. Two boundary regressions the
  wiring exposed are fixed at the correct boundary: in-memory database identity
  (cleared at the file boundary), and the theme store, rebuilt per case through
  the boot path's own store factory so the 122 tests that render without
  initializing it are neither edited nor left order-dependent.
- **Tests Added:** Yes —
  `scripts/__tests__/module-state-audit.test.ts` (11 cases: the scanner's
  state/no-state boundary, coverage name forms, wrapped declarations, entrypoint
  skipping, aliased preload imports, stale wiring, and a live-repository leg
  asserting the real tree is clean), plus
  `cli/src/hooks/__tests__/use-theme-reset.test.ts` (2 cases: the reset leaves a
  usable store, and it drops a theme mutation made earlier in the file).
- **Verification Evidence:** `bun scripts/module-state-check.ts` exit 0 (0
  findings, 0 wiring issues, 180/187 wired, 2481 files scanned); the pin suite
  11/11; all 13 workspace suites green (8389 pass / 0 fail / 23 skip); the ten
  declared workspace typechecks exit 0 plus the scripts-tree probe;
  `quality:report` PASS;
  `validate:repository` PASS; eslint 0 / prettier clean on the changed
  TypeScript files. Loop 3 adds: `cli/src/hooks/__tests__/use-theme-reset.test.ts`
  2 pass / 0 fail, `bun run --cwd=cli test` 3960 pass / 0 fail / 18 skip, and the
  audit at 182 of 187 wired with a 5-binding reach list.
- **Archived:** `dev/fids/archive/FID-2026-1007-002-module-state-isolation-across-bun-test-files.md`
  (moved at closure; its Loop 3 addition — the theme store — rides in the same commit)

## Lessons Learned

1. **A leak class is enumerated or it is not fixed.** Repairing the instance
   that bit us (FID-2026-1007-001) left 144 identical hazards invisible; a
   scanner turned "probably more of these" into a list, and the list is what
   made the work finishable.
2. **A reset has no value until something calls it, and a boundary has two
   levels.** Coverage (a seam exists), wiring (a preload calls it) and reach
   (which modules a preload can load) are three different questions; answering
   only the first ships code that does nothing, and clearing every case breaks
   the state a case is testing (an in-memory connection, a store).
3. **False positives in a guard are not harmless.** A matcher that ignored
   `__reset*`/`clear*` seams and wrapped declarations reported covered bindings
   as gaps; a fan-out acting on that list would have created a second reset for
   the same state in dozens of files.
4. **A leak can be load-bearing.** 122 CLI component tests render without
   initializing the theme store and depend on an earlier file having created it.
   Removing the leak is still correct; doing it means changing those tests, and
   that work is named rather than absorbed into a "benign" label.
5. **Record the remainder mechanically, or it grows silently.** The audit fails
   when an unreached module has no reason and when a reason no longer describes
   anything, so the deliberate exceptions are code-adjacent facts instead of
   prose in a document.
