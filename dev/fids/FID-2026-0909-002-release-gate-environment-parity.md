# FID: Release-gate environment parity — three live-caught environment-dependent defects

**Filename:** `FID-2026-0909-002-release-gate-environment-parity.md`
**ID:** FID-2026-0909-002
**Severity:** medium
**Status:** analyzed
**Created:** 2026-09-09 03:17
**YAGNI-Compliance:** PASS (2026-09-09 — see Loop 1)

---

## Summary

The release pipeline's GATES stage runs the test battery in a materially
different environment than any dev or pre-push run: a PowerShell-spawned
Windows env block (case-preserving `Path`), the sanitized secret-stripped
gate environment, and the SDK build's plain-TS declaration pass. During the
v0.0.30 cut this environment surfaced three real, live defects that every
local gate (typecheck ×12, full test suite, eslint, `verify:clean`) passed.
All three are now fixed; this FID records the class and proposes the
structural guard so the next environment-only defect is caught before a
cut, not during one.

## Environment

- **OS:** Windows 11 (win32) — release shell: PowerShell
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14
- **Tool Versions:** dts-bundle-generator (SDK build), sanitized gate env
- **Commit/State:** HEAD `aab5109` → `05e2e1a` across the cut attempts

## Detailed Description

### Problem

Three distinct environment-dependent defects, each invisible locally and
fatal in the gate:

1. `common/src/env.ts:44` used Bun-only `import.meta.dir`; the SDK build's
   dts-bundle-generator step recompiles common under a plain-TS program
   without Bun types → `TS2339` at `build:sdk`.
2. `cli/src/server/__tests__/gateway-server-command.test.ts:85/158`
   spawned children by bare `'bun'` → `uv_spawn` ENOENT under the gate's
   sanitized spawn environment (PATH-resolvable in dev shells only).
3. `evals/v2/tests/tempdir-sandbox.test.ts:72-80` spread `process.env`
   into a plain object before the allowlist; the spread materializes
   Windows-cased keys (`Path` in PowerShell, `PATH` in Git Bash) and the
   case-sensitive plain-object lookup missed `PATH` → assertion failure.

### Expected Behavior

The codebase must behave identically across every environment the release
pipeline legitimately runs in: Git Bash dev shells, PowerShell release
shells, the sanitized secret-stripped gate env, and compiled/plain-TS
compilation surfaces.

### Root Cause

No local gate exercises the release-gate environment. Each defect violated
the `no-environment-dependent-guards` canonical rule (launch-environment
or runtime-specific behavior), but the rule was prompt-enforced, not
mechanically checked at the surfaces that matter.

### Evidence

```text
# Layer 1 — build:sdk gate (build-sdk-1.log):
../common/src/env.ts(44,46): error TS2339: Property 'dir' does not exist
  on type 'ImportMeta'.

# Layer 2 — test gate (test-1.log):
ENOENT: no such file or directory, uv_spawn 'bun'  (×2, lines 85/158)

# Layer 3 — test gate, next run (test-1.log):
expect(env.PATH).toBeTruthy()  →  Received: undefined

# Fixes landed (all verified green in-session):
2b22103 fix(common): cross-runtime env bootstrap anchor
87bcc44 fix(cli): env-independent gateway test spawns
05e2e1a fix(evals): fixture-based env-allowlist test
```

## Impact Assessment

### Affected Components

- `common/src/env.ts` (fixed)
- `cli/src/server/__tests__/gateway-server-command.test.ts` (fixed)
- `evals/v2/tests/tempdir-sandbox.test.ts` (fixed)
- Release pipeline GATES stage (structural gap — open)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

The three instances are fixed, but the class recurs: any future
runtime-specific or launch-env-dependent code reaches the cut undetected
and burns a full release round-trip per instance.

## Proposed Solution

### Approach

Add a gate-environment parity guard so the env-sensitive slice of the test
battery runs under the release-like environment (PowerShell-launched,
sanitized secret-stripped env) as a local pre-gate — or, minimally, a
mechanical grep gate banning the known classes: bare runtime-name spawns
in tests (`spawn('bun'`), Bun-only `import.meta` properties in SDK-reachable
common sources, and unguarded `process.env` spreads feeding env-filtering
functions. Operator decides the scope at GREEN.

### Steps

1. Inventory: grep the repo for the three banned patterns and record the
   residual hit list (expect: zero after the three fixes).
   **Done 2026-09-09 (Loop 1) — result is NOT zero; corrected expectation:**
   - **Bare-runtime test spawns** (`spawn('bun'` / `spawnSync('bun'`):
     exactly ONE production hit — `scripts/public-release-pinned-bun.test.ts:54`
     probes `spawnSync('bun', ['--version'])` after `ensurePinnedBunOnPath()`.
     This is the pinned-runtime CONTRACT test itself (its own comment:
     "Environment-dependent by design ... the same fail-closed contract the
     release gate enforces"). It asserts the environment on purpose — it is
     a probe, not a defect. The guard needs an explicit, reasoned exemption
     entry rather than a rewrite of the contract test.
   - **Bun-only `import.meta.dir` in SDK-reachable production sources:**
     zero defects. Repo-wide hits (~118) are concentrated in Bun-runtime
     surfaces (test files, `scripts/`, `cli/src` runtime, desktop scripts)
     where `import.meta.dir` is legal; `common/src` production is clean
     (`env.ts` hits are comments explaining the fix). The banned class must
     be scoped to `common/src` non-test production files (the dts program's
     input set), not the whole repo.
   - **`process.env` spreads:** ~25 hits, overwhelmingly test fixtures
     (saving/restoring env — legitimate) and production child-spawn env
     passthroughs (`command-runner.ts`, `hooks/runner.ts` — legitimate;
     they pass the env THROUGH, they don't case-depend on its shape). The
     v0.0.30 defect class was specifically a spread into a PLAIN OBJECT
     followed by case-sensitive key lookup. A grep ban on `...process.env`
     cannot distinguish these; class 3 needs the behavioral probe (or
     stays covered by the env-bootstrap suite) — see the surface choice
     below.
2. Choose the guard surface: extend `verify:clean` (already owns the
   committed-tree compile proof) vs a new `scripts/` audit gate wired into
   `validate:repository` (same pattern as the exit-code-masking audit).
   **Loop 1 recommendation: `validate:repository`** — the gate is a cheap
   static audit, and `verify:clean` is the slow (134s) committed-tree proof
   where a static grep adds cost, not coverage. The exit-code-masking
   precedent (FID-2026-0907-002: pure detector + git-ls-files collector +
   `audit.exit-code-masking` wiring) is the exact template. OPERATOR
   DECISION at GREEN (as the FID reserves); class-3 scope rides the same
   decision: minimal gate (classes 1-2 grepped, class 3 documented as
   covered by the env-bootstrap behavioral suite) vs a sanitized-env
   behavioral probe (larger scope, its own FID if chosen).
3. Implement the guard RED-first with a failing fixture. (Unchanged;
   detector pins: planted `spawn('bun'` in a test, planted
   `import.meta.dir` in a `common/src` production file, exemption honored
   for the pinned-bun probe.)
4. Record the guard in this FID's Verification Gates and stamp the receipt.
   (Unchanged.)

### Verification

The guard fails on a planted violation and passes on the clean tree;
`validate:repository` live re-runs it green; a subsequent release cut's
GATES stage produces no new environment-dependent failures.

## Verification Gates

Declared at Loop 1 (2026-09-09), to be live-run at implementation
(surface choice pending operator GREEN):

1. Guard unit suite (RED-first): planted class-1 + class-2 violations are
   detected with file:line precision; the pinned-bun contract probe is
   honored via its exemption entry; a clean fixture set passes.
2. `validate:repository` wiring: guard findings appear as
   `audit.gate-env-parity` issues; clean tree PASSes end-to-end.
3. `bun x eslint` on the new audit module + suite `--max-warnings 0`;
   `bun run lint:md` if docs change.
4. Prove-the-guard leg: temporarily revert one fixed file's guard-relevant
   hunk (e.g. re-introduce `import.meta.dir` in `common/src/env.ts` on a
   scratch worktree) and show the guard fails the validation run; restore
   and show green.

## Perfection Loop

### Loop 1 — RED / GREEN / AUDIT (2026-09-09, codebase-grounded)

- **RED (ground-truth verification):** the three fix commits are verified
  present and shape-correct (`2b22103` env.ts +15/−1, `87bcc44` gateway
  test +2/−2, `05e2e1a` tempdir-sandbox +9/−2). The Step-1 inventory ran
  (results above): ONE residual documented-contract spawn site (the
  pinned-bun contract probe), zero SDK-reachable `import.meta.dir`
  production defects, and a `...process.env` population that confirms a
  grep ban for class 3 is not mechanically expressible without massive
  false positives. The FID's "expect: zero" was wrong by one legitimate
  site — recorded, not papered over.
- **GREEN (design corrections from grounding):** (1) the guard's class-2
  scope is `common/src` non-test production files (the dts program's
  input set) — a repo-wide ban would flag ~118 legal Bun-runtime sites;
  (2) class 1 carries one explicit exemption (pinned-bun contract probe,
  reasoned in the exemption entry); (3) class 3 cannot be a grep — the
  minimal gate covers classes 1-2 mechanically and documents class 3 as
  behaviorally pinned by the env-bootstrap suite, with the sanitized-env
  behavioral probe recorded as the operator's optional larger-scope
  alternative; (4) recommended surface: `validate:repository` (audit
  precedent), operator decides at GREEN per the FID's own reservation.
- **AUDIT (status verification):** the three instance fixes are NOT
  re-claimed here — each was verified green in-session by its own gates
  (build:sdk exit 0; gateway suite; evals suite 166/0) and this record's
  open work is only the structural guard. Status `analyzed` (not `fixed`)
  is the honest ledger state: the class-level remediation does not exist
  yet.
- **ADVERSARIAL (self-refutation pass):** strongest objection — "a grep
  gate is security theater: it bans toy patterns while the real defect
  (env-shape dependence) is semantic." Partially accepted: true for class
  3 (hence no class-3 grep), but classes 1-2 are mechanical because the
  failure modes are mechanical (uv_spawn resolves PATH or it doesn't;
  `import.meta.dir` exists in Bun or it doesn't). The v0.0.30 incident
  proves both classes ship silently through every existing gate — a
  narrow grep is the cheapest control that moves the detection from
  release-night to commit-time. Second objection — "two audit gates in
  validate:repository is precedent creep." Refuted: the exit-code-masking
  gate demonstrates the pattern is additive, testable, and green; the
  wiring cost is one import + one issues-array spread.
- **CHANGE DELTA:** planning record; document edits only.
- **CONVERGENCE:** all RED findings resolved in one pass (no
  oscillation); delta < 2% for this pass. Loop closed at 1.

### Missed Questions

1. Why did v0.0.29 pass? — Its cut predates the `.env.local` bootstrap leg
   (FID-2026-0906-007) that introduced the `import.meta.dir` site, and the
   spawn/casing tests passed in whatever shell that cut used. The class
   was always present; the v0.0.30 environment (PowerShell + the new
   bootstrap) exposed it.
2. Is PowerShell itself the problem? — No: the pipeline legitimately runs
   from any shell. The defects were code that assumed one shell's
   environment shape; that assumption is the defect.

### Code Verification Evidence

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present for new or repaired wiring
- [ ] FID status reflects the actual implementation state

## Lessons Learned

A release gate is an environment, not just a gate list. Any behavior that
depends on the launching shell's env casing, PATH resolution, secret
presence, or compilation program is a defect the dev environment cannot
see. Prefer `process.execPath` over bare runtime names, standard
`import.meta.url` over runtime-specific properties, and fixture envs over
host-env spreads in tests.

## Resolution

- **Closed Date:** (pending)
- **Fix Description:** (pending — the structural parity guard)
- **Tests Added:** (pending)
- **Verification Evidence:** (pending)
- **Archived:** (pending)