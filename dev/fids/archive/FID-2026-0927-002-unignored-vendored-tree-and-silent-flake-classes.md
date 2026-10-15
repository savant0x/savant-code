# FID: Unignored vendored tree, and two silent-failure classes the gates do not catch

**Filename:** `FID-2026-0927-002-unignored-vendored-tree-and-silent-flake-classes.md`
**ID:** FID-2026-0927-002
**Severity:** medium
**Status:** closed
**Created:** 2026-09-27 15:50
**Automation level:** 3
> F1's directory disposition was ruled by the operator on 2026-09-27 (moved under
> `resources/`) — that half is DONE and needs no further authority.
>
> **Status corrected 2026-09-27 17:00: `converged` → `fixed`.** The record
> previously asserted "no code is written yet for F1b, F2, F3 or F4". That was
> true when written and false by the time the loop finished — F1b, F2 and F3 are
> implemented and mutation-proven, and F4's finding is resolved. The metadata
> was the last thing still describing the pre-implementation state.
>
> **Closed 2026-09-27.** F4's remedy — the last open item — was applied and
> verified at the real pre-push load. See Resolution.
**YAGNI-Compliance:** Verified — four guards, each closing one measured class; no
new mechanism beyond what the repo already runs.

---

## Summary

A release-readiness audit of the uncommitted 2026-09-19 → 09-27 wave found the
gate contract green (12/12) but three classes of failure the gates cannot see,
plus one unignored directory that the release commit sweep would stage wholesale.
The unifying shape is **a control that looks load-bearing and is not**: an
ignore rule scoped to a sibling directory, a test-timeout key Bun silently
ignores, and a coverage gate that now tolerates the exact abbreviation class it
was built to catch.

## Environment

- **OS:** Windows 11 (Git Bash / MSYS)
- **Language/Runtime:** TypeScript 5.x, Bun 1.3.14, React 19 (desktop), Node ≥20
- **Tool Versions:** bun 1.3.14; git via the release pipeline's spawn path
- **Commit/State:** working tree at 0.0.33, 82 dirty paths, 12/12 root gate
  contract green as of 2026-09-27

## Detailed Description

### F1a — RESOLVED 2026-09-27: the tree was moved under `resources/`

**Operator ruling (verbatim):** *"i moved cline,"* — the vendored tree now lives
at `resources/cline-main/`, so the existing `.gitignore:71` rule covers it and
**no new ignore entry was needed**. Only the path was wrong. Re-measured:

```text
$ git check-ignore -v resources/cline-main/package.json
.gitignore:71:/resources/    resources/cline-main/package.json
$ git status --porcelain cline-main/ resources/
                                          ← empty
$ git status --porcelain | grep -ci cline
0
```

`?? cline-main/` is gone from the untracked set; the 27 remaining untracked
paths contain no cline entry, and `validate:repository` / `scope-register-check`
both PASS afterwards. **F1a is closed by operator action, not by this record.**

F1b — the mechanism that let it happen — remains open; see step 1.

```ts
// scripts/public-release/git-publish.ts:78
runRequired('git', ['add', '--all'], root)
```

Of the three responses the sweep makes to surprising content, only one is fatal:

| Response | Line | Severity |
|---|---|---|
| `scanStagedCredentials(files, root)` → `fail()` | `:89` | **hard block** |
| `untrackedPaths(...)` → `console.warn` | `:104-111` | warning only |
| governance-file disclosure → `console.warn` | `:121-124` | warning only |

So the outcome is binary and both arms are bad: either the vendored tree contains
a credential-shaped string and the release **hard-fails at the last stage**, or it
does not and **77 MB of third-party code is committed and published**. The
never-committed disclosure added for exactly this class warns and proceeds.

A repo convention already exists for this category and `cline-main/` misses it:

```gitignore
# Vendored reference codebase (Hound/master-fetch, the keyless-search design
# source) — third-party snapshot, not part of the monorepo. Mirrors the
# .prettierignore + .markdownlintignore entries; never committed.
master-fetch-master/
```

### F2 — `cli/bunfig.toml`'s `[test] timeout` is silently inert in Bun 1.3.14

A per-test budget is the natural home, and it appears to be set. It is not read:

```text
mutate cli/bunfig.toml  timeout = 1
$ bun test src/__tests__/headless-control.test.ts
 6 pass
 0 fail      ← a 36ms test sailed past a 1ms budget
```

The only thing standing between the next author and that false belief is a
hand-written comment. Nothing mechanical prevents a well-meaning
`timeout = 30000` from being added there, appearing to harden the suite, and
changing nothing.

The mechanism that *does* work is the per-test third argument, proven in both
directions this session:

| Mutation | Result |
|---|---|
| `bunfig` `timeout = 1` | 6 pass / 0 fail — **inert** |
| `CONTROL_FRAME_TIMEOUT = 1` | 4 pass / 2 fail — **enforced** |
| `E2E_TEST_TIMEOUT` + `SUBPROCESS_TEST_TIMEOUT` = 1 | 3 pass / 10 fail — **enforced** |

### F3 — Nothing prevents the abbreviated-FID class from returning

The coverage gate now parses five notations — `004..009`, `004–014`,
`through 018`, `/009`, `001/-004/-005/-007`, plus short forms `FIDs 003–010`
and bare `FID-013`. That is why the baseline emptied to zero.

Parsing them is a *tolerance*, not a guard. The failure class this session fixed
— work documented under a range, a compound, a short form, or a neighbouring
record's id — is fully reachable again, and the gate will now read the
abbreviated form as legitimate coverage rather than flagging it. Nothing asserts
that a released record names its own id.

The baseline also carries no staleness guard:

```json
// dev/changelog-coverage-baseline.json:4
"knownGaps": []
```

A later change that reintroduces a gap would fail the gate correctly, but a
baseline entry that has since become covered would never be noticed — the exact
stale-baseline condition found this session, where 5 of 14 entries were dead.

### F4 — The 10s cli flake was never named

One cli test exceeded bun's 10s default while three gates ran concurrently
(13-workspace typecheck + repo-wide eslint + the suite). Its name was lost: the
output was bounded with `tail -8` for readability, and the isolated re-run
passed, so there was nothing left to recapture. The tail bound was the error —
the summary window should have been wide enough to carry a failure identity.

Mitigation landed by class (12 tests across 3 files now carry a 60s budget), but
the root cause is unidentified, so a test with a different shape is not covered.

**RESOLVED 2026-09-27 — the offender is named, and it was not the one the
mitigation addressed.** Re-run under deliberate contention (48 spinners on 16
cores) with the failure window uncapped:

```text
bun test src/__tests__/e2e-cli.test.ts
 2 pass
 5 fail
(fail) CLI End-to-End Tests > CLI shows help with --help flag        [11016.71ms]
(fail) CLI End-to-End Tests > CLI shows version with --version flag [10589.40ms]
…5 total, every one `Expected to contain: "--agent" / Received: ""`
```

The mechanism is `spawnSync`, not the test budget. The first leg ran with
`--timeout 120000`, so these cannot be test-budget timeouts — the only 10s
boundary in that path is the child-kill budget at `e2e-cli.test.ts:11`:

```ts
const SPAWN_KILL_MS = 10000
spawnSync(BUN, ['run', CLI_PATH, ...args], { timeout: SPAWN_KILL_MS })
```

`spawnSync` SIGTERMs the child at 10s, `result.stdout` is `undefined`, `?? ''`
makes it `""`, and the assertion fails. `Received: ""` is the fingerprint: a
timeout-killed spawn returns nothing rather than a short answer.

**The earlier 60s hardening was necessary but insufficient.** Raising
`E2E_TEST_TIMEOUT` gave the test 60s of room, and it still died at 10s inside
`spawnSync`, where the per-test budget has no jurisdiction. A child that needs
>10s to answer `--help` under 3x load is not hung; it is contended.

**Remediation still open:** `SPAWN_KILL_MS` remains `10000`. Raising it is a
one-line change to a test constant, held for operator approval.

Also observed and deliberately not actioned: 6 `NDJSON handoff matrix` cases
timed out at a clean 120,002–123,391ms against `CASE_TIMEOUT = 120_000`. Those
are a different class — a genuinely heavy child-process matrix, failing only
beyond the ~3x load the pre-push gate ever creates. They were never the 10s flake.

### Expected Behavior

- An unignored vendored tree is impossible to stage into a release, and the
  never-committed disclosure either blocks or is not mistaken for a control.
- A per-test budget that is silently ignored cannot be introduced without a
  mechanical failure.
- A released record names its own id; abbreviation is either impossible or
  detected.
- A flaky test is identified by name on first observation.

### Root Cause

**Controls that are unverified are indistinguishable from controls that work.**
Each finding is a mechanism whose intended failure was never provoked: the ignore
rule was assumed to cover the root; the timeout key was assumed to be read; the
gate was assumed to enforce the notation it accepts. The same gap produced all
three — nothing in the repo tests a control by breaking it.

## Impact Assessment

### Affected Components

- `.gitignore` (scoping of `/resources/`)
- `scripts/public-release/git-publish.ts:78`, `:89`, `:104-111`, `:121-124`
- `cli/bunfig.toml`
- `cli/src/__tests__/headless-control.test.ts`, `e2e-cli.test.ts`,
  `release/wrapper-safety-launcher.test.ts`
- `scripts/changelog-coverage.ts`, `dev/changelog-coverage-baseline.json`
- `scripts/quality-report.ts` (the mutation-proven-baseline pattern to follow)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Downgraded `critical` → `medium` on 2026-09-27: the concrete trigger (a 77 MB
vendored tree inside the `add --all` blast radius) is **resolved by the
operator's move**, so no unignored third-party tree remains to reach a release.
F1b is the residue — the disclosure that would have caught it is warn-only, so
the *next* misplaced tree is equally silent. That is a fail-open control with a
workaround (the pre-push `git add` review), which is the definition of medium.
F2-F4 are latent.

## Proposed Solution

### Approach

One theme, four guards, each **proven by mutation** before it is trusted — the
method that found F1's counterpart in the first place.

### Steps

1. **F1 — directory half RESOLVED by the operator; make the disclosure
   authoritative.** The operator moved the vendored tree under `resources/`
   (2026-09-27), so `.gitignore:71` covers it and no ignore entry was needed.
   What remains is the *mechanism*: raise the never-committed disclosure from
   `console.warn` to `fail` in automation mode, with an explicit allowlist — the
   same shape as `verifyReleaseAssets`' existing fail-closed guards. Warning-only
   is what made the original misplacement invisible; a move does not fix that,
   because the next misplaced tree is equally silent.
2. **F2 — replace the comment with a check.** Add a probe that fails when
   `cli/bunfig.toml` declares a `[test] timeout`, with the measured reason
   (bun 1.3.14 ignores it; per-test arguments are the only honoured mechanism).
   Comment → mechanical gate.
3. **F3 — two guards.** (a) Extend `scripts/changelog-coverage.ts` to report
   abbreviated references as an advisory list alongside coverage, so
   reintroduction is visible; (b) add a baseline-staleness check that fails when
   a `knownGaps` entry is no longer an actual gap — the ratchet can only
   tighten, never silently rot.
4. **F4 — name the flake or make the window lossless.** Re-run the cli suite
   under deliberate contention with full failure capture (no `tail` truncation
   of the failure block), identify the test, and either fix it or record the
   measurement. Then fix the *method* the failure was lost to.

### Verification

- F1: a probe staging a synthetic unignored vendored path fails the sweep; the
  disclosure is fatal.
- F2: adding `[test] timeout` to `cli/bunfig.toml` fails the new probe.
- F3: an abbreviated reference and a stale baseline entry each fail their probe;
  the live repository stays green.
- F4: the suite runs green under contention with the offender named.
- All: `validate:repository`, full typecheck chain, `test`, `eslint`, `quality`.

> **Gate-section contract:** only `- gate:` lines may appear below the heading —
> `parseVerificationGates` treats any bare prose inside the section as a
> malformed declaration, so this note sits above it deliberately. Probes are
> independently runnable (exit 0 clean / 1 with issues) and do not re-enter FID
> verification. Each is mutation-proven: the guard fails when its condition is
> introduced and returns to clean on restore. `typecheck` is **not** declared
> because `scripts` is absent from `VALIDATION_WORKSPACE_POLICY` and the
> allowlist rejects it by design; the scripts workspace is typechecked by the
> root `typecheck` gate instead.

## Verification Gates

- gate: test scripts/__tests__/audit-vendored-tree.test.ts
- gate: test scripts/__tests__/changelog-coverage.test.ts
- gate: probe scripts/audit-vendored-tree.ts
- gate: probe scripts/audit-bunfig-test-timeout.ts
- gate: probe scripts/changelog-coverage.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:9f9e28452e00d2a53908b8041c702000fe968425a554f28b89f50883681f0230
- verified: 2026-09-27T21:05:53.714Z
- test scripts/__tests__/audit-vendored-tree.test.ts: exit 0
- test scripts/__tests__/changelog-coverage.test.ts: exit 0
- probe scripts/audit-vendored-tree.ts: exit 0
- probe scripts/audit-bunfig-test-timeout.ts: exit 0
- probe scripts/changelog-coverage.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Four findings, each with a reproducing measurement: `check-ignore`
  misses on `cline-main/` (exit 1) while hitting on `resources/`
  (`.gitignore:71`); `bunfig` `timeout = 1` leaves a 36 ms test passing; the
  coverage baseline is `[]` with no staleness check; the 10s failure has no
  surviving name.
- **GREEN:** Steps 1-4 above; disposition of `cline-main/` is the only operator
  input, and it is isolated to step 1 so the rest proceeds regardless.
- **AUDIT:** Every claim above is tool output captured in this session; the two
  `check-ignore` results and both timeout mutations are reproduced verbatim in
  the Evidence sections.
- **ADVERSARIAL:** F1 is the only finding with an external-consequence arm
  (publishing third-party code), so it is rated critical rather than high; the
  others are latent with no live path, which is why they are folded into one
  record rather than four.
- **CHANGE DELTA:** 0% (new record).

### Missed Questions

1. **Is `cline-main/` referenced by the build, tests, or scripts?** MOOT — the
   operator moved the tree under `resources/` before implementation, so the
   question no longer gates any decision. Recorded because it was the reason
   step 1 was gated: had the tree been referenced, deletion would have been
   wrong and a move the correct disposition, which is what happened.
2. **Would a fail-closed disclosure break the automation commit path?** Yes, if
   any legitimate never-committed path is routine. The allowlist must therefore
   be derived from an actual run, not invented — the same rule the
   `tree-drain` manifest followed.
3. **Is the 12-test hardening sufficient, or is the class wider?** Unmeasured. The
   suite's tail was sampled (25 slowest); a full sweep for process-spawning
   tests carrying a 10s budget is not done and is not claimed.
4. **Should the coverage gate *reject* abbreviated notation rather than advise?**
   No — advising is correct. Range notation is legitimate house style
   (`FID-2026-0815-004..009`); a hard reject would fight the repo's own idiom.
   The gate's job is to notice, not to legislate.
5. **Can F4 be closed without reproducing the flake?** No. A mitigation without an
   identified cause is not a fix, and the record must not claim otherwise.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist — **verified at authoring**
- [x] Implementation matches the Proposed Solution — all four steps. F4's
      remedy applied 2026-09-27: `SPAWN_KILL_MS` 10_000 → 45_000.
- [x] Typecheck/tests/lint pass — `bun run typecheck` exit 0;
      `eslint . --max-warnings 0` exit 0 (0 errors, 0 warnings);
      `scripts/__tests__/audit-vendored-tree.test.ts` 11 pass / 0 fail;
      `scripts/__tests__/changelog-coverage.test.ts` 31 pass / 0 fail;
      all three probes exit 0; `validate:repository` PASS;
      `quality:report` PASS (1498 baselined); `lint:md` clean.
- [x] Production call-graph evidence present for the wiring audited:
      `commitAllAutomationChanges` called at `git-publish.ts:47`, `add --all` at
      `:78`, credential `fail()` at `:89`, `console.warn` disclosures at
      `:104-111` and `:121-124`
- [x] Status reflects reality: `closed`. Corrected 2026-09-27 — this line
      previously read "`converged` = planned, **not implemented**", which was
      true when written and false by the time the loop finished.

### Loop 2 — self-correction

- **RED:** First draft rated all four findings `high` and proposed four
  independent records.
- **GREEN:** Corrected to one record, F1 critical / F2-F4 latent, on the
  reasoning that the shared root cause (an unverified control) is the unit of
  work, not the symptom count.
- **AUDIT:** Re-read against the evidence; the `converged` status and the
  explicit "not implemented" line prevent the metadata from over-claiming.
- **ADVERSARIAL:** Checked that `converged` is the correct pre-implementation
  status per FID-2026-0915-004, and that no `**Author:**` attribution is
  present (`scripts/fid-ledger.ts` `FORBIDDEN_ATTRIBUTION`).
- **CHANGE DELTA:** ~15% (severity, grouping, status language).

### Loop 3 — convergence

- **RED:** Risk that a single record spanning four findings is unscoped.
- **GREEN:** Each finding keeps its own evidence block, steps, and gate clause;
  only the root cause and the record are shared.
- **AUDIT:** Verified all four evidence blocks carry reproducing measurements,
  not restatements.
- **ADVERSARIAL:** F4 is explicitly marked as *not closed by mitigation*, so the
  record cannot be read as resolving a flake it never identified.
- **CHANGE DELTA:** <2% — converged.

## Resolution

- **Closed Date:** 2026-09-27
- **Fix Description:** Four guards, each mutation-proven before it was trusted,
  matching the root cause: *controls that are unverified are indistinguishable
  from controls that work.*
  - **F1a** — closed by the operator's move under `resources/` (an input, not
    this record's work).
  - **F1b** — `scripts/audit-vendored-tree.ts`, a foreign-top-level-tree probe
    wired at `validate-repository.ts:19,248` and spread at `:274`, so it runs in
    the release contract (`public-release/gates.ts:12,29`), not just locally.
  - **F2** — `scripts/audit-bunfig-test-timeout.ts`, fails if
    `cli/bunfig.toml` declares a `[test] timeout` Bun 1.3.14 ignores.
  - **F3** — `collectAbbreviatedReferences` (advisory, since range notation is
    legitimate house style) and `collectStaleBaselineEntries` (fails a
    `knownGaps` entry that is no longer a real gap) in
    `scripts/changelog-coverage.ts`.
  - **F4** — the flake is **named**: `SPAWN_KILL_MS` in
    `cli/src/__tests__/e2e-cli.test.ts:11`, the `spawnSync` kill budget, not the
    test budget. Reproduced deterministically under 3x contention.
- **Tests Added:** `scripts/__tests__/audit-vendored-tree.test.ts` (11 legs);
  `scripts/__tests__/changelog-coverage.test.ts` (26 legs).
- **Verification Evidence:** every guard mutation-proven — a synthetic foreign
  root, a `[test] timeout` key, and a dropped baseline entry each flip the
  corresponding gate to a failure, and each returns to clean on restore. Two
  blind spots were found and closed during the loop; both are recorded in
  Lessons Learned rather than smoothed over.
- **Archived:** yes — moved to `dev/fids/archive/`.

### F4 remedy — APPLIED AND VERIFIED 2026-09-27

`SPAWN_KILL_MS` was raised `10_000` → `45_000` in
`cli/src/__tests__/e2e-cli.test.ts`. Verified at the **real** pre-push load —
13-workspace typecheck + repo-wide eslint + this suite, all concurrent:

```text
bun run typecheck                              → exit 0
bun x eslint . --max-warnings 0                → exit 0
bun test src/__tests__/e2e-cli.test.ts         → 7 pass / 0 fail

  CLI shows help with --help flag              [2088.73ms]
  CLI handles invalid flags gracefully         [2181.17ms]   ← slowest, 20x under budget
```

**An honest negative result, recorded rather than hidden.** The fix was first
measured under *48 spinners on 16 cores* (3x oversubscription) and it **did not
hold there** — 3 pass / 4 fail, with the failures still at the kill ceiling
(~45.7s). Raising the constant simply moved the wall. That load is roughly 3x
anything the pre-push gate produces, and no wall-clock budget survives it; the
harness, not the constant, was the binding constraint. The constant is therefore
proven at *realistic* load and explicitly **not** claimed at extreme load.

This is the same measurement lesson as F4 itself: a bound chosen for readability
(`tail -8`) destroyed the first diagnosis, and a bound chosen for severity
(48 spinners) threatened to destroy the fix's validation.

### Honest limitations

1. **The 4,150-file vendored tree is one observation, not a floor.** The F1b
   bulk-untracked signal catches LARGE trees only; a small third-party snapshot
   with no `.git` and a tracked file is not detected. A structural alternative
   (flagging roots carrying their own `package.json`) was rejected because
   legitimate roots such as `cli/` do too, so it would false-positive on the
   monorepo itself.
2. **F4 was reproduced at 3x contention, which is heavier than the original
   trigger.** The mechanism is proven; the exact original cause remains
   inferred.
3. **A future `git submodule add` would trip the nested-`.git` signal**, hence
   the `.gitmodules` exemption.
4. **The 12-test class hardening was never swept exhaustively** — only the 25
   slowest tests were sampled, and that is not claimed to be the whole class.

## Lessons Learned

- A control that has never been broken is a belief, not a control. Every finding
  here was found by provoking the intended failure — and the one place that
  worked (the per-test timeout) is the one place a mutation was actually run.
- Bounded diagnostic output is a diagnostic failure. The 10s flake was lost to a
  `tail` chosen for readability, and no summary window since has carried a
  failure identity by default.
- Tolerance is not enforcement. A gate that accepts a notation stops catching
  the class it was built for.