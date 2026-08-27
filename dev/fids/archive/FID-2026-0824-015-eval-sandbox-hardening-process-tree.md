# FID: Eval Sandbox Hardening — Process Tree, Env Allowlist, Safe Mode (Increment 1)

**Filename:** `FID-2026-0824-015-eval-sandbox-hardening-process-tree.md`
**ID:** FID-2026-0824-015
**Severity:** high
**Status:** fixed
**Created:** 2026-08-24 17:16
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-013` (inherits amendments A1–A8).

---

## Summary

The default `TempDirSandbox` provides filesystem isolation only. Its timeout
`kill()` terminates just the shell process (orphaning grandchildren — admitted
in-code), `buildEnv` inherits the full host environment, the runner injects no
permission-mode constraint, and large outputs have no disk-log capture path. The
blueprint's Phase-1 framing ("replace the Docker stub") is stale per amendment A1;
the real work is this narrower hardening set so agent-generated code runs with
bounded blast radius on a Windows host.

## Environment

- **OS:** Windows 11 primary dev host (Job Objects / tree-kill semantics matter here)
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned)
- **Tool Versions:** `@savant-code/evals` 0.0.27; node:child_process spawn in tempdir.ts
- **Commit/State:** main @ v0.0.27 prep (working tree, release-only-commits)

## Detailed Description

### Problem

1. Timeout teardown kills only the shell (`tempdir.ts` timeout handler calls
   `child.kill()`); background servers/spawned toolchains survive the sandbox.
2. `buildEnv` returns `{ ...process.env, ...overrides }` — host secrets leak into
   every eval command's environment.
3. `SavantAgentRunner` passes no permission-mode to the run config; an eval'd agent
   can invoke destructive shell capabilities against the host.
4. Output capture is memory-only; no durable log file exists for >8KB assertions.

### Expected Behavior

Teardown ends the whole process tree; env is deny-by-default; eval runs are forced
into safe mode at the runner boundary; outputs are streamable to bounded log files.

### Root Cause

MVP scoping — the code comments defer isolation to "a future Docker/Firecracker
sandbox," which A1 retires as the plan of record.

### Evidence

```text
evals/v2/src/sandboxes/tempdir.ts   timeout handler — child.kill() comment admits partial kill
evals/v2/src/sandboxes/tempdir.ts   buildEnv — full process.env spread ("leaks host env")
evals/v2/src/runner.ts              RunnerConfig DEFINED here — no permissionMode
evals/v2/src/runners/savant.ts      consumer — extends it, passes none into client.run()
```

## Impact Assessment

### Affected Components

- `evals/v2/src/sandboxes/tempdir.ts`, `sandbox.ts` (interface options)
- `evals/v2/src/runners/savant.ts`, `runner.ts` (RunnerConfig)
- `.savantignore` / fixture copying path if setup seeding gains exclusions

### Risk Level

- [ ] Critical / [x] High: sandbox-escape class (blueprint risk register) — agent-
      generated code executes on the operator host with inherited secrets
- [ ] Medium / [ ] Low

## Proposed Solution

### Approach

Platform-honest teardown + minimal-env construction + explicit safe-mode injection.
No new dependencies unless GREEN proves Bun-native APIs insufficient (YAGNI gate).

### Steps

1. Teardown helper with capability probe at GREEN: Windows Job Objects
   (kill-on-close, assigned at spawn) vs documented `taskkill /T /F` fallback;
   POSIX detached process-group kill(-pgid). Environment-dependent behavior is
   forbidden (LEARNINGS: no-environment-dependent-guards) — probe, don't assume.
2. Replace `buildEnv` spread with a deny-by-default allowlist builder (PATH,
   SYSTEMROOT, SYSTEMDRIVE, TEMP/TMP, APPDATA minimal set + explicit overrides).
3. Add `permissionMode?: 'safe'` to RunnerConfig; SavantAgentRunner defaults eval
   runs to safe and threads it into the SDK run config boundary.
4. Optional per-command log-file capture (bounded size) appended alongside the
   in-memory stream for >8KB output assertions.
5. Tests: orphan-process teardown proof (live Windows), allowlist unit tests,
   teardown idempotence, log-capture truncation bound.

### Verification

Gates below plus a live teardown demonstration on Windows recorded in-loop.

## Verification Gates

- gate: typecheck evals
- gate: test evals/v2/tests/tempdir-sandbox.test.ts
- gate: test evals/v2/tests/harness.test.ts

### Verification Receipt

- fingerprint: sha256:beb5e1a054d529114fcd21d372ba7cde2406d43ef7f406168293d874d300b94e
- verified: 2026-08-25T06:04:52.851Z
- typecheck evals: exit 0
- test evals/v2/tests/tempdir-sandbox.test.ts: exit 0
- test evals/v2/tests/harness.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Grounding citations above (working-tree reads, 2026-08-24).
- **GREEN:** Solution specified; Job-Objects-vs-taskkill decision deferred to GREEN
  behind a capability probe (most robust default: prefer OS job objects, fall back
  to tree-kill with the choice logged).
- **AUDIT:** Batched suite Verifier (2026-08-24): FAIL (receipts-pending absent) →
  discharged same session; Step-2 indentation nit fixed.
- **ADVERSARIAL:** CONFIRMED against disk (2026-08-24): tempdir.ts timeout handler
  kills only the shell under "Best-effort termination…" comment; buildEnv spreads
  process.env under a leak-admitting comment; DockerSandbox.runCommand throws stub
  error. ADJUSTED — RunnerConfig is DEFINED in evals/v2/src/runner.ts (no
  permissionMode); runners/savant.ts is the consumer extending it; Evidence relabeled
  accordingly (definition + consumer cited separately).
- **CHANGE DELTA:** Initial authorship (n/a).

### Loop 2 — GREEN (2026-08-25)

- NEW `sandboxes/process-tree.ts`: capability-probed teardown — win32 →
  `taskkill /PID <pid> /T /F`; POSIX → detached process-group SIGKILL with a
  direct-kill fallback; idempotent, never throws. `probeTeardownMechanism()`
  caches the platform decision (probe-don't-assume discipline).
- `tempdir.ts`: timeout handler now calls killProcessTree (was shell-only
  child.kill()); spawn gains POSIX detached group + windowsHide; buildEnv's
  full-host spread replaced by exported deny-by-default
  `buildAllowlistedEnv` over PATH/PATHEXT/COMSPEC/SystemRoot/SYSTEMROOT/
  SystemDrive/SYSTEMDRIVE/TEMP/TMP/APPDATA/LOCALAPPDATA/HOME (+ overrides);
  optional bounded log capture (`logFile`/`maxLogBytes`, default 1 MB,
  head+tail truncation marker) flushed BEFORE resolve so callers see the
  durable file immediately.
- `runner.ts` RunnerConfig += `permissionMode?: 'safe'`; `runners/savant.ts`
  injects it into client.run(), defaulting every eval run to safe mode.
- Tests: tempdir-sandbox.test.ts grows allowlist strip/keep/override plus a
  live runCommand leak-probe, teardown idempotence, bounded-log truncation
  marker, killProcessTree dead-PID no-throw, and THE LIVE WINDOWS ORPHAN-
  PROCESS PROOF: a bun grandchild writes its PID then sleeps; the timeout
  fires; tasklist polling confirms the PID is gone (~4 s) — the exact orphan
  class child.kill() produced.
- Cross-stream note: concurrent FID-2026-0825-001 landed compactAndStop
  writers without its AgentState field mid-flight, breaking this workspace's
  typecheck; resolved by keeping THEIR field definition once it landed
  (duplicate removed) — fix-forward per FID-2026-0823-009 precedent.
- **CHANGE DELTA:** one new module + four src files touched (~+150 lines),
  test suite ~+140 lines.

### Code Verification Evidence

Implemented 2026-08-25 (Loop 2). Fresh outputs at flip: typecheck evals exit
0; tempdir-sandbox suite **11 pass / 0 fail including the live Windows
orphan-process teardown proof**; sibling suites metrics+trace+schema+
metrics-fsm 44/0; harness:v2 baseline 5/0; eslint --max-warnings 0 ×6 files;
prettier clean ×8 files. Law-4 consumption: killProcessTree is called from
the tempdir timeout handler; buildAllowlistedEnv is consumed at spawn-env
construction; permissionMode threads RunnerConfig → SavantAgentRunner →
client.run().

## Resolution

- **Closed Date:** (pending) — **Archived:** (pending)

## Lessons Learned

(pending — captured at closure)