# FID: Release-gate test isolation — root bunfig preload never demotes the release profile; CLI config-dir override silently defeated; real ~/.savant-code polluted

**Filename:** `FID-2026-0913-003-release-gate-test-isolation.md`
**ID:** FID-2026-0913-003
**Severity:** critical
**Status:** created
**Created:** 2026-09-13
**YAGNI-Compliance:** Verified — the fix is two demotion guards plus a probe
that formalizes the release's own reproduction. No new configuration
surface, no new abstraction: the demotion reuses the exact semantics
`sdk/test/setup-env.ts` already applies for `NODE_ENV`/`BUN_ENV`
(`||=`-style, explicit values win), and the pin mirrors the
`cli/src/test-env.ts` precedent from v0.0.21.
**Related:** FID-2026-0905-007 (public-release decomposition — profile
application + gate env sanitization); FID-2026-0911-002 (the OrcaRouter
pin whose live re-run failed); `cli/src/test-env.ts` (v0.0.21 — the same
failure class was already fixed *inside* the cli workspace); `config-dir.ts`
v0.0.9 (`0fcbb2a0` — the legitimate prod gate on the override);
FID-2026-0913-002 (format precedent).

---

## Summary

Two consecutive `bun run release:public` attempts for v0.0.31 failed
deterministically at the `repository-validation` gate (exit at
`Gate repository-validation failed`), while the identical gate chain passed
14 consecutive times in every local replication. Root cause found and
proven: **the fid-gate live re-run executes test gates from the repo root,
where bun loads the ROOT `bunfig.toml` — whose only test preload is
`sdk/test/setup-env.ts`. The CLI's own `cli/bunfig.toml` preload
(`test-setup.ts` → `test-env.ts`), which pins
`NEXT_PUBLIC_CB_ENVIRONMENT = 'dev'`, never loads.** Under the release's
public profile (`NEXT_PUBLIC_CB_ENVIRONMENT=prod`), `getConfigDir()`
(v0.0.9 prod gate) ignores the tests' `SAVANT_CODE_CONFIG_DIR` override, so
the pinned provider tests read and wrote the **real** `~/.savant-code/`
directory. Casualties: the gate failed (5/18 assertions), and the
operator's real `credentials.json` was overwritten with test fakes
(`test-nous-key`, `test-orcarouter-key`, `OPENROUTER_API_KEY: "stored-key"`,
…). Credentials were recovered from the live shell environment post-incident.

## Environment

- **OS:** Windows 11 (win32, Git Bash); Bun 1.3.14
- **Commit/State:** `1087099` (docs audit) on main; v0.0.31 release cut.
- **Release failures (2×):** `Gate repository-validation failed (exit)`;
  transcripts
  `%LOCALAPPDATA%/Temp/savant-public-release-0.0.31-evidence/repository-validation-{1,2}.log`
  (4 lines each — inner test output swallowed by design, exit codes only).
- **RED evidence (this session, repo root, release-shaped env — sanitized
  key envs + full public profile):**

```text
$ NEXT_PUBLIC_CB_ENVIRONMENT=prod NEXT_PUBLIC_SAVANT_CODE_APP_URL=…
  NEXT_PUBLIC_SUPPORT_EMAIL=… NEXT_PUBLIC_POSTHOG_HOST_URL=…
  NEXT_PUBLIC_WEB_PORT=3000 env -u OPENROUTER_API_KEY -u OR_MASTER_KEY \
  -u INFERENCE_API_KEY bun test cli/src/utils/__tests__/provider-setup.test.ts

error: expect(received).toBe(expected)
Expected: "stored-tokenharbor-key"
Received: "test-tokenharbor-key"
      at cli/src/utils/__tests__/provider-setup.test.ts:256:45

13 pass
 5 fail
50 expect() calls
Ran 18 tests across 1 file. [2.92s]
```

  Real-dir pollution re-confirmed in the same run —
  `credentials.json` md5 `b38b18aa…` → `375aabc7…`
  (restored from `/tmp/credentials.good.json` immediately after capture;
  `settings.json` md5 unchanged `f5d0f300…`).
- **Control (proves cwd/preload is the discriminator):** the identical
  command from `cli/` (own bunfig → pin loads) passes 18/0 under the same
  env; 14 consecutive local replications from `cli/` and via
  `validate:repository` all passed.

## Detailed Description

### Problem

`scripts/fid-verify.ts` `runGates()` spawns every declared
`gate: test <path>` as `['bun','test',arg]` with `cwd: root`. Bun resolves
`bunfig.toml` from the invocation cwd: the ROOT bunfig's
`[test] preload = ["./sdk/test/setup-env.ts"]` applies. That bootstrap
sets `NEXT_PUBLIC_CB_ENVIRONMENT: 'test'` **only when unset**
(`if (!process.env[key])`), so under the release profile — applied by
`applyPublicProfile()` before the gates run — the environment stays
`prod`. `getConfigDir()` then honors its v0.0.9 production gate and ignores
`SAVANT_CODE_CONFIG_DIR`, defeating the isolation override in every CLI
test that relies on it (23+ files under `cli/src`).

Consequences: (a) fid-gate live re-runs of CLI pins fail under the release
profile — release-blocking, opaque (transcripts carry no inner output);
(b) far worse, any such run **writes test fakes into the operator's real
credentials store**.

### Expected Behavior

A test suite must never read or write the real `~/.savant-code/` directory,
regardless of the inherited environment. The fid-gate live re-run of every
declared CLI pin must pass under the exact release environment.

### Root Cause

Environment-demotion responsibility was placed in per-workspace bootstraps
(`cli/src/test-env.ts` v0.0.21, `sdk/test/setup-env.ts` partial) but the
repo-root execution path used by `fid:verify`/`validate:repository` (and
therefore the release's `repository-validation` gate) never demotes an
inherited `prod`. The v0.0.21 fix proved the failure class once; the root
path re-introduced it for every workspace-crossing invocation.

### Evidence

See RED block above. Mechanism chain verified by reading this session:
`scripts/fid-gates.ts` (C3 live re-run) → `scripts/fid-verify.ts`
`runGates` (`cwd: root`, no env control) → root `bunfig.toml`
(`preload = ["./sdk/test/setup-env.ts"]`) → `sdk/test/setup-env.ts`
(defaults skipped when already set — `prod` survives) →
`cli/src/utils/config-dir.ts` lines 20–26 (override ignored when
`NEXT_PUBLIC_CB_ENVIRONMENT === 'prod'`) →
`cli/src/utils/provider-key-store.ts` `saveProviderApiKey()` writes
`getConfigDir()/credentials.json` → real file.

## Impact Assessment

### Affected Components

- `sdk/test/setup-env.ts` — add the `NEXT_PUBLIC_CB_ENVIRONMENT` demotion
  (mirrors its existing `NODE_ENV ||= 'test'` charter).
- `scripts/fid-verify.ts` `runGates()` — pin `NODE_ENV=test` +
  `BUN_ENV=test` into spawned gate env (defense in depth; also covers
  future `bun run` probe gates).
- NEW `scripts/probes/release-gate-isolation-probe.ts` — executable RED→
  GREEN proof: spawns the pinned provider-setup test from repo root under
  the exact sanitized release profile env, asserting (1) the pin passes,
  (2) the config-dir override is honored (log evidence), (3) the real
  config dir is byte-identical before/after (self-restoring on mismatch).

### Risk Level

- [x] Critical: the defect destroyed operator credentials during a release
      attempt and blocks the release itself; any future release run
      reproduces both until fixed.
- [ ] High
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Three minimal layers, no behavior change to any shipped binary:

1. **sdk/test/setup-env.ts** (the root preload): at the end, demote an
   inherited `prod` environment —
   `process.env.NEXT_PUBLIC_CB_ENVIRONMENT = 'test'` unless the process is
   not a test runtime (guard: only when already running under `bun test`,
   detected via `NODE_ENV === 'test' || BUN_ENV === 'test'` which the file
   itself establishes one statement earlier). Explicit per-test values set
   *after* preload (sdk credentials tests) still win.
2. **scripts/fid-verify.ts** `runGates()`: spawn with
   `env: { ...process.env, NODE_ENV: 'test', BUN_ENV: 'test' }` — the gate
   executor itself declares the runtime, independent of which bunfig a
   child resolves.
3. **Probe** (`gate: probe scripts/probes/release-gate-isolation-probe.ts`):
   the release-shaped regression test, wired into this FID's verification
   gates so the C3 live re-run fails closed if any layer regresses.

### Steps

1. [x] **RED (done):** release-shaped repro from repo root fails 5/18 and
       pollutes the real credentials file (pasted above; md5 deltas
       recorded). Controls: same command from `cli/` passes; 14 local
       replication passes.
2. [ ] **GREEN-A:** demotion in `sdk/test/setup-env.ts`.
3. [ ] **GREEN-B:** `runGates()` env pin in `scripts/fid-verify.ts`.
4. [ ] **GREEN-C:** probe script + gate declaration (below).
5. [ ] **VERIFY:** probe exit 0; repro command now exits 0 with **zero**
       real-dir writes (md5s unchanged); `bun test scripts/` green;
       `validate:repository` exit 0; typecheck ×4 unchanged-green; the
       provider-setup pin re-run under profile env from `cli/` still 18/0.
6. [ ] **GOVERNANCE:** ledger row, receipt, CHANGELOG 0.0.31 entry.

### Verification

Dual-method: Method 2 runtime — the probe IS the runtime proof (exact
release env, exact cwd, exact failing pin, byte-level no-pollution
assertion). Method 1 static — scripts typecheck via
`bun test scripts/` (scripts has no separate tsconfig gate) + full
`validate:repository`.

## Verification Gates

- gate: probe scripts/probes/release-gate-isolation-probe.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test scripts/__tests__/fid-verify.test.ts
- gate: typecheck cli

### Verification Receipt

(stamped by `bun run fid:verify --write` after GREEN)

## Perfection Loop

### Loop 1 — Authoring (2026-09-13)

- **RED:** two deterministic release-gate failures + reproducible 5/18 pin
  failure + real-credentials pollution, all captured above.
- **GREEN:** the three layers in Steps 2–4.
- **AUDIT (planned):** probe green; repro md5-neutral; suites green;
  validator exit 0.
- **ADVERSARIAL (planned):**
  (a) *"Does demoting `prod` break sdk credentials tests that test prod
  behavior?"* — no: they set explicit values inside each test
  (`createTestEnv({ NEXT_PUBLIC_CB_ENVIRONMENT: 'prod' })`), which
  override anything the preload did.
  (b) *"Why not fix `config-dir.ts` to honor the override in prod?"* —
  the prod gate is a deliberate shipped-binary safety property (v0.0.9);
  removing it would let a stray env var redirect a production install's
  config. Test isolation belongs to the test runtime, not the runtime
  config resolver.
  (c) *"Why not just delete the inherited env in the release gates like
  `sanitizedGateEnv` does for keys?"* — that protects secrets, but
  deleting `NEXT_PUBLIC_CB_ENVIRONMENT` in gate envs would change
  defaults-detection semantics everywhere; demotion to `'test'` is the
  honest declaration ("this is a test runtime") and is what
  `IS_TEST`/env-boundary consumers expect.
  (d) *"Does the probe itself pollute when the code is broken?"* — it
  captures the real dir's bytes before spawning and restores them on
  mismatch, then exits 1: self-healing evidence.
- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *Why did `settings.json` survive the release runs but `credentials.json`
   did not?* — the release's snapshot/restore (`local-state.ts`) covers
   only `settings.json`; credentials were never in its scope. Widening the
   snapshot to credentials is deliberate scope here? No — with isolation
   fixed, tests cannot reach the real dir at all; snapshotting credentials
   would papers over the class instead of fixing it. Noted as a hardening
   option for FID-2026-0905-007's author to consider.
2. *Why did `provider-commands`/wizard tests not fail in the same runs?*
   — the release gate chain re-runs only *declared* pins of active
   fixed/verified FIDs; only the OrcaRouter FID pins CLI provider tests
   today.
3. *Why didn't the `--diagnose` mode catch this?* — it runs the same gate
   chain from the same root with the same env, but never applies the
   public profile, so the discriminator was absent. Documented in
   FID-2026-0905-007's diagnostic contract: profile-less by design.
4. *Could the release have shipped?* — no mutations occurred in either
   failed run (receipts confirm AUTHENTICATION + PREFLIGHT + gates only;
   no tag, no push, no npm publish). The gate did its fail-closed job.
5. *Windows angle?* — none: the mechanism is cwd/bunfig resolution, OS
   independent; the Windows-specific note in `config-dir.ts` (homedir
   caching) is unrelated.

## Lessons Learned

(updated at closure)
