# FID: Release-gate environment parity — three live-caught environment-dependent defects

**Filename:** `FID-2026-0909-002-release-gate-environment-parity.md`
**ID:** FID-2026-0909-002
**Severity:** medium
**Status:** created
**Created:** 2026-09-09 03:17
**YAGNI-Compliance:** Pending

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
2. Choose the guard surface: extend `verify:clean` (already owns the
   committed-tree compile proof) vs a new `scripts/` audit gate wired into
   `validate:repository` (same pattern as the exit-code-masking audit).
3. Implement the guard RED-first with a failing fixture.
4. Record the guard in this FID's Verification Gates and stamp the receipt.

### Verification

The guard fails on a planted violation and passes on the clean tree;
`validate:repository` live re-runs it green; a subsequent release cut's
GATES stage produces no new environment-dependent failures.

## Verification Gates

Pending — declared at GREEN when the guard surface is chosen (live re-run
by `validate:repository` from status `fixed` onward).

## Perfection Loop

### Loop 1 — RED

- **RED:** Three environment-dependent defects cataloged with gate
  transcripts during the v0.0.30 cut attempts (2026-09-09); evidence above.
- **GREEN:** The three instances fixed and verified in-session (commits
  `2b22103`, `87bcc44`, `05e2e1a`; each with full gate evidence in the
  session record). The structural parity guard is the open work.
- **AUDIT:** Each fix ran the exact failing gate green locally
  (build:sdk exit 0; gateway suite 6/0; evals suite 166/0) plus typecheck
  ×12, eslint, prettier.
- **ADVERSARIAL:** Not started (planning record).
- **CHANGE DELTA:** N/A (planning record; the fixes' deltas were
  +15/−1, +2/−2, +9/−2 respectively).

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