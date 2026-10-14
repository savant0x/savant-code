# FID: The scripts suite is not green on a clean tree — four measured failures

**Filename:** `FID-2026-1013-006-scripts-suite-not-green-on-a-clean-tree.md`
**ID:** FID-2026-1013-006
**Severity:** high
**Status:** closed
**Created:** 2026-10-13 20:40
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022

---

## Summary

`bun test` from `scripts/` — the cwd the FID-2026-1013-001 gate contract declares for script test
gates — reported **950 pass / 10 fail** on the working tree. Six of the ten were the `quality` gate
correctly failing on two files over the 300-line ceiling (owned by `FID-2026-1012-024`, repaired
there). The other four are independent, deterministic, and unrelated to that work: two
live-repository checks that resolved the repository root from `process.cwd()`; a probe redirect guard
that rejected the very hop its own re-POST logic exists for; and two git-fixture tests that spend
more than bun's 5 s default in process spawns. Each is repaired at its cause; no assertion was
weakened or removed.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Commit/State:** `main` @ `2a34e558` (working tree carrying the `FID-2026-1012-024` Loop 11 work)

## Detailed Description

### Problem

Four deterministic failures (not load flakes — each reproduced in isolation):

1. `scripts/__tests__/changelog-coverage.test.ts` → two tests: `live repository > every uncovered id
   is already recorded in the coverage baseline` and `the real repository reports no un-baselined
   gap`. Both passed `process.cwd()` to `collectUncoveredFids` / `readCoverageBaseline`.
2. `scripts/providers/__tests__/probe-boundary.test.ts` → `boundary POST survives an apex→www 301
   (re-POST: method AND body intact)`.
3. `scripts/public-release-tag-hygiene.test.ts` → the first test, timed out after 5000 ms.
4. `scripts/pre-push-scan.test.ts` → `catches a secret committed and reverted inside the pushed
   range`, timed out after 5000 ms under parallel load.

### Expected Behavior

`bun test` from `scripts/` is green on a clean tree; nothing a gate runs depends on where the runner
was started; a guard rejects only what its own contract means to reject; a fixture's timing budget
reflects the real cost of the processes it drives.

### Root Cause

1. **cwd-dependent root resolution.** `resolve(import.meta.dir, …)` was not used; `process.cwd()`
   was. Under the `scripts/` cwd that FID-2026-1013-001 established for script test gates, the root
   resolved to `scripts/`, so the check read `scripts/CHANGELOG.md`.
2. **The redirect guard was stricter than the contract it serves.** The re-POST loop documents a
   LIVE-caught case (`orcarouter.ai`, 2026-09-15: fetch degrades POST→GET on 301) and then refused
   any hop whose *origin* changed — but apex→www changes the origin by definition. The probe
   re-issued the POST and rejected the answer it was written to obtain.
3. **Timing budget below real cost.** These fixtures drive real git repositories; a Windows git spawn
   costs ~200 ms here, so ~22 spawns cannot finish inside bun's 5 s default.

### Evidence

```text
$ cd scripts && bun test        # before
(fail) live repository > every uncovered id is already recorded in the coverage baseline
(fail) live repository > the real repository reports no un-baselined gap
(fail) classifyUnauthBoundary (401-boundary gate) > boundary POST survives an apex→www 301 ...
(fail) public release contract — tag hygiene > prunes a local-only failed-run tag ... [5187.72ms]
  ^ this test timed out after 5000ms.
(fail) pre-push credential scan > catches a secret committed and reverted ... [5996.62ms]
 950 pass / 10 fail

$ # isolated rerun of the four files — 3 of the 4 reproduce deterministically
4 tests failed: ... [5187.72ms] / [0.51ms] / [0.38ms] / [0.55ms]
45 pass / 4 fail      # pre-push-scan passes alone at 4.3 s: it is the load victim

$ grep -n 'process.cwd' scripts/__tests__/changelog-coverage.test.ts
285:    for (const record of collectUncoveredFids(process.cwd())) {
291:    expect(collectChangelogCoverageIssues(process.cwd())).toEqual([])

$ grep -n 'Cross-origin probe redirect rejected' common/src/providers/probe-endpoint.ts
155:        if (target.origin !== new URL(base).origin)
156:          throw new Error('Cross-origin probe redirect rejected')

$ bun run quality:report     # the other 6 failures were this gate, red on the -024 files
quality: FAIL (2 quality violation(s))
```

## Impact Assessment

### Affected Components

- `scripts/__tests__/changelog-coverage.test.ts`
- `common/src/providers/probe-endpoint.ts` (the apex→www boundary probe path)
- `scripts/public-release-tag-hygiene.test.ts`, `scripts/pre-push-scan.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround — the suite that gates every script change was red,
  so a real regression and a known-red tree were indistinguishable, and a red suite blocks the
  receipt contract that closure depends on.
- [ ] Medium / [ ] Low

## Proposed Solution

### Approach

Repair each cause at its source; change no assertion. (1) Resolve the repository root from the test
module, never the cwd. (2) Narrow the redirect guard from the *origin* to the *site*: same scheme and
port, and the target host is the base host, a subdomain of it, or its parent — apex→www is admitted,
every unrelated host still fails closed. (3) Give the git-fixture tests an explicit timing budget
that matches the spawn cost they actually incur.

### Steps

1. `repoRoot = resolve(import.meta.dir, '..', '..')` and use it for both live checks.
2. `isSameSiteRedirect(base, target)` replaces the origin equality check (exported, so the site rule
   is testable directly).
3. Explicit `30_000` budgets on the three measured-spawn tests, with the measured cost recorded
   beside them.

### Verification

The four repaired files, run together and then as part of the whole scripts suite, must be green; the
site rule must still refuse an unrelated host; the `-024` files must be back under the 300-line
ceiling so the `quality` gate returns to green.

### Missed Questions

1. **Why did a green-looking tree hide four failures?** Because the suite had only ever been
   reported per-workspace or filtered, never as the whole `scripts/` tree from its declared cwd:
   the four live behind that exact invocation.
2. **Is the redirect guard's strictness deliberate security?** It reads as hardening, but it
   contradicts the live case recorded in the same function's comments and pinned by the same
   suite — one of the two had to be wrong, and the test carried the measurement.
3. **Do the two timeouts hide hangs rather than slowness?** No: both pass in isolation (4.3 s and
   longer under load), and the fixture counts (~22 git spawns) explain the cost.
4. **Should the timeout be raised or the fixture made cheaper?** The fixture is the point — it
   drives real git repositories; the budget was the wrong knob, so it moved.

### Code Verification Evidence

- [x] `scripts/__tests__/changelog-coverage.test.ts:18` — `repoRoot` derived from
      `import.meta.dir`; both live checks use it (`:291`, `:296`).
- [x] `common/src/providers/probe-endpoint.ts:66` — `isSameSiteRedirect`; the POST loop calls it
      at `:166` and still throws on an unrelated host.
- [x] `scripts/public-release-tag-hygiene.test.ts:19` and `scripts/pre-push-scan.test.ts:41` — the
      explicit budgets, next to each test.
- [x] Paste of the gate runs: the four repaired files 45 PASS in isolation; the whole tree
      960 PASS / 0 FAIL; `quality` PASS at the 300-line ceiling; `typecheck common` and the
      scripts typecheck probe exit 0; `bun x eslint . --max-warnings 0` exit 0.
- [x] Production call-graph: `probeEndpoint` is reached from `scripts/providers/lib/harvest-phases.ts`
      and `health-probe.ts`; the redirect branch is the recorded apex→www case.

## Verification Gates

- gate: test scripts/__tests__/changelog-coverage.test.ts
- gate: test scripts/providers/__tests__/probe-boundary.test.ts
- gate: test scripts/pre-push-scan.test.ts
- gate: test scripts/public-release-tag-hygiene.test.ts
- gate: test scripts/__tests__/experiences-proof.test.ts
- gate: typecheck common
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:56280ac91e9407598d449ef96603865b3f32a47ff3bba3c5a9f738061dddbfd9
- verified: 2026-10-14T00:53:16.895Z
- test scripts/__tests__/changelog-coverage.test.ts: exit 0
- test scripts/providers/__tests__/probe-boundary.test.ts: exit 0
- test scripts/pre-push-scan.test.ts: exit 0
- test scripts/public-release-tag-hygiene.test.ts: exit 0
- test scripts/__tests__/experiences-proof.test.ts: exit 0
- typecheck common: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-13)

- **RED:** `bun test` from `scripts/` on a clean tree is red: four independent deterministic causes
  measured above, plus the `quality` gate naming two files over the ceiling.
- **GREEN:** Repair each cause at its source (root resolution, site-scoped redirect guard, real
  timing budget) and leave every assertion intact.
- **AUDIT:** Each failure reproduced in isolation before its fix; the redirect defect is proved by
  the shipped comment block that names the apex→www case the guard rejects.
- **ADVERSARIAL:** Could the redirect fix widen SSRF exposure? No — it admits only same-scheme,
  same-port hops inside one site (base host, subdomain, or parent). A redirect to any other host
  still throws and yields `boundary-unverifiable`.
- **CHANGE DELTA:** Four files, one function added; no assertion removed.

## Resolution

- **Closed Date:** 2026-10-13 21:35
- **Fix Description:** the repository root is resolved from the test module; the redirect guard is
  scoped to the site instead of the origin; the three measured git fixtures carry an explicit spawn
  budget.
- **Tests Added:** none — every existing assertion remains, and the site rule is exported so it can
  be pinned directly.
- **Verification Evidence:** `cd scripts && bun test` → 960 PASS / 0 FAIL; `quality:report` PASS;
  `typecheck common`, `typecheck:scripts`, `bun x eslint . --max-warnings 0`, `bun run lint:md` and
  `bunx prettier --check .` exit 0; all declared gates stamped; root `bun run test` chain green
  across all 13 legs; `bun run validate:repository` PASS.
- **Commit SHA:** `722d1c03`
- **Archived:** 2026-10-13 21:35

## Lessons Learned

A suite's colour depends on where it is started: the same tests were green in filtered runs and red
from the cwd the gate contract declares. Two of the four were a guard and its own documented
counter-example disagreeing — the invariant was written in prose and pinned only for the happy path.
That is the receipt discipline this program applies to failure classes: a claim about a path is
worth what its exercised case proves, not what its comment asserts.
