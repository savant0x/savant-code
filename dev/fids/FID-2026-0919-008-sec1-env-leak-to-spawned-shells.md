# FID: Full Process Environment Handed To Every Spawned Shell

**Filename:** `FID-2026-0919-008-sec1-env-leak-to-spawned-shells.md`
**ID:** FID-2026-0919-008
**Severity:** high
**Status:** verified
**Created:** 2026-09-19
**YAGNI-Compliance:** Confirmed (Loop 3 — allowlist constant + two call
sites; no per-deployment config surface until asked)

---

## Summary

Every shell spawned by `run_terminal_command` and `run_readonly_command`
inherits the *entire* agent process environment: `getSystemProcessEnv()`
returns `process.env` verbatim, which carries every provider credential the
CLI resolved (`SAVANT_CODE_API_KEY`, `INFERENCE_API_KEY`,
`TOKENROUTER_API_KEY`, `TOKENHARBOR_API_KEY`, `NVIDIA_API_KEY`,
`CLOUDFLARE_API_TOKEN`, `COMMAND_CODE_API_KEY`, `BYOK_OPENROUTER_API_KEY`,
ChatGPT OAuth override — all enumerated in `sdk/src/env.ts`). One `env` or
`printenv` — whether malicious, prompt-injected, or accidental (`set -x`)
— puts all of them into the tool result, message history, and every child
that inherits history (FID-2026-0919-009).

## Environment

- **OS:** win32 (Git Bash) / POSIX
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** sdk tool surface (`sdk/src/tools/run-terminal-command.ts`),
  agent-runtime readonly handler (`run-readonly-command.ts` → bash.ts in CLI router)
- **Commit/State:** branch `main`, uncommitted working tree; verified against
  live source 2026-09-19 (Task 66 audit)

## Detailed Description

### Problem

`sdk/src/tools/run-terminal-command.ts:44-47`:

```typescript
const processEnv = {
  ...getSystemProcessEnv(),
  ...(env ?? {}),
} as NodeJS.ProcessEnv
```

`sdk/src/env.ts:50-52`:

```typescript
export const getSystemProcessEnv = (): NodeJS.ProcessEnv => {
  return process.env
}
```

The merged env is passed to `spawn(shell, [...shellArgs, command], { env:
processEnv, ... })` (same file, `spawn(...)` call in the SYNC path). Every
credential-bearing variable in the parent process is therefore readable by
the command and everything it launches. The CLI's bash router
(`cli/src/commands/router/bash.ts:55`) spreads the same
`getSystemProcessEnv()` for interactive bash.

### Expected Behavior

A spawned command shell receives only what commands need to function —
`PATH`, `HOME`/`USERPROFILE`, `SystemRoot`/`COMSPEC`/`PATHEXT` (Windows),
`MSYS` handling already present, `LANG`/`TMPDIR`/`TEMP`/`TMP`, and the
SDK's own non-secret knobs. Credential variables never cross the boundary.

### Evidence

```text
sdk/src/tools/run-terminal-command.ts:44-47  env spread (verbatim above)
sdk/src/env.ts:50-52                         getSystemProcessEnv = process.env
sdk/src/env.ts                               credential getters:
  getSavantCodeApiKeyFromEnv (API_KEY_ENV_VAR)
  getInferenceApiKeyFromEnv (INFERENCE_API_KEY)
  getByokOpenrouterApiKeyFromEnv (BYOK_OPENROUTER_ENV_VAR)
  getChatGptOAuthTokenFromEnv
cli/src/commands/router/bash.ts:55           same spread for interactive bash
docs/security-audit-orchestrator-agent-flow.md  SEC-1 (verified 2026-09-19)
```

## Impact Assessment

### Affected Components

- `sdk/src/tools/run-terminal-command.ts` — spawn env
- `cli/src/commands/router/bash.ts` — interactive bash router
- `sdk/src/env.ts` — the identity of `getSystemProcessEnv`
- Any logger path that records command output at error level (compounds
  FID-2026-0919-011 / SEC-4: a leaked secret rides telemetry)

### Risk Level

- [x] High: all provider credentials are one `printenv` away from the model
  context; enforcement cost after disclosure is unrecoverable (keys must be
  rotated); no exploit skill required

## Proposed Solution

### Approach

Allowlist-based child env, applied at the single spawn chokepoint:

1. Introduce `buildChildEnv(overrides)` in `sdk/src/env.ts`:
   copy only allowlisted keys from `process.env` (PATH, HOME, USERPROFILE,
   SystemRoot, COMSPEC, PATHEXT, MSYS, LANG, TMPDIR, TEMP, TMP,
   USERNAME/LOGNAME, SHELL, TERM, plus `SAVANT_CODE_APP_URL` — non-secret),
   then apply the caller's explicit `env ?? {}` on top (unchanged override
   semantics).
2. Use it in `run-terminal-command.ts` (replacing the spread) and
   `cli/src/commands/router/bash.ts`.
3. Keep `getSystemProcessEnv()` exported (telemetry/tests read it) but stop
   using it for child-process construction.
4. Tests: child env contains allowlisted keys; credential vars absent even
   when set in parent; explicit `env` overrides still win.

Alternatives considered and rejected:

- *Blocklist of credential keys* — the same failure mode as SEC-4: naming
  is not exhaustive (`PRINTENV`-able env has no schema); allowlist is the
  safe default.
- *Empty env* — breaks Windows shells (SystemRoot) and PATH resolution.

### Steps

1. [x] DONE — `buildChildEnv` + `CHILD_ENV_ALLOWLIST` in `sdk/src/env.ts`
   (shell basics, Windows requirements, temp dirs, non-secret
   SAVANT_CODE_APP_URL).
2. [x] DONE — `run-terminal-command.ts` routed through `buildChildEnv`
   (MSYS merge preserved, override semantics unchanged);
   `cli/src/commands/router/bash.ts` routed through the SDK-exported
   `buildChildEnv()` (previously passed the FULL env as explicit
   overrides — the stronger of the two leak paths).
3. [x] DONE — `sdk/src/__tests__/child-env-allowlist.test.ts` via the
   REAL spawn path: sentinel credential absent from the child (`printenv`
   NOT_SET), PATH non-empty, explicit overrides win.
4. [x] DONE — call-site docblocks cite this FID; exported from the sdk
   public surface (`index.ts`) for the CLI import.

### Verification

- New sdk suite green (pasted output); typecheck sdk; eslint
  `--max-warnings 0`; quality gate.
- Manual proof on this machine: parent env with a sentinel credential var;
  spawned `run_terminal_command` running `env | grep SENTINEL` returns
  nothing while `echo $PATH` still works.

## Verification Gates

- gate: typecheck sdk
- gate: test sdk/src/__tests__/child-env-allowlist.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:c1b6a45bb7c7de154c16aa344c0647a2209f82e9b49a1f5af5f7ed17b8430312
- verified: 2026-09-19T04:01:54.955Z
- typecheck sdk: exit 0
- test sdk/src/__tests__/child-env-allowlist.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Finding verified against live source (file:line above); report
  SEC-1; remediation design converged.
- **GREEN:** Allowlist design above. Not implemented; awaiting operator
  approval.
- **AUDIT:** Document-level double audit (markdownlint + manual re-read;
  evidence re-verified on disk 2026-09-19).
- **ADVERSARIAL:** Could the allowlist break legitimate workflows (docker,
  npx, custom toolchains needing custom vars)? Yes — mitigations: caller
  `env` overrides remain first-class; unknown-but-needed vars surface as
  fast command failures with obvious remediation (documented, operator can
  extend the allowlist constant). Does this break test mocks that rely on
  env inheritance? Tests inject `env` explicitly today.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Should `buildChildEnv` live in sdk (shared) or agent-runtime? → sdk: both
   call sites already depend on sdk or duplicate it (bash.ts).
2. Interactive user bash (operator-driven) — same policy? → Yes; the
   operator's own shell is not the threat model, but the tokens are: a
   model-driven `printenv` through that router leaks identically.
3. Windows `MSYS=disable_pcon` merge order? → Preserved: allowlist copy
   first, MSYS merge second, caller overrides last.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending G2 (operator commit withheld; no silent
  deferral — presented at turn end)
- [x] **File:line ranges:** `sdk/src/env.ts` (`buildChildEnv` +
  allowlist), `sdk/src/tools/run-terminal-command.ts` (spawn site),
  `cli/src/commands/router/bash.ts` (router), `sdk/src/index.ts`
  (export), `sdk/src/__tests__/child-env-allowlist.test.ts` (new)
- [x] **Gate output:** receipt below — typecheck/test/quality all exit 0
- [x] **Reproducibility:** `bun test sdk/src/__tests__/child-env-allowlist.test.ts`
  → 3 pass / 0 fail (real spawn path, sentinel-based)
- [x] **Step statuses:** all 4 steps `implemented` (operator-approved
  2026-09-19; no deferrals)

### Code Verification Evidence

- [x] Files referenced in this FID exist and contain the quoted code
  (verified by read 2026-09-19)
- [x] Implementation matches Proposed Solution (allowlist; Loop 2 audit)
- [x] Typecheck/tests/lint pass with pasted output (receipt below)
- [x] No production call-graph change proposed (env construction inside
  two spawn sites)

### Loop 2 — Independent audit and self-correction

- **RED:** Leak paths confirmed at both spawn sites; the bash router was
  the stronger path (full env as explicit overrides).
- **GREEN:** Implemented as proposed; one widening during implementation:
  `buildChildEnv` is exported from the sdk public surface so the CLI
  router shares the exact same policy (initial plan duplicated the logic).
- **AUDIT:** Static: typecheck sdk+cli exit 0; eslint 0; quality PASS;
  receipt gates exit 0. Manual re-read of the allowlist constant checked
  each key against the credential inventory in this same file — no
  credential var is allowlisted.
- **ADVERSARIAL:** (1) Breakage probe: commands needing non-allowlisted
  vars (e.g. a user's custom toolchain var) fail fast with an empty-
  value error — documented remediation: caller passes `env` explicitly.
  (2) Windows `findWindowsBash` uses the child env — SystemRoot/PATH
  allowlisted, live test proves bash starts. (3) Residual risk honestly
  noted: allowlisted vars can carry sensitive values on exotic setups
  (e.g. PATH hijack); out of scope — that is machine-compromise territory,
  not process-boundary scope.
- **CHANGE DELTA:** `env.ts` +55 lines (allowlist + builder);
  `run-terminal-command.ts` spread replaced; `bash.ts` router rewired;
  `index.ts` +1 export; 1 new test file (3 tests, real-spawn).

### Loop 3 — Final convergence

- **RED:** Converged — both leak paths closed with sentinel proof.
- **GREEN:** Converged — allowlist live at both sites (uncommitted,
  G2-pending).
- **AUDIT:** Converged — receipt gates exit 0; eslint 0; lint:md clean.
- **ADVERSARIAL:** Converged — three challenges resolved.
- **CHANGE DELTA:** Final: see Loop 2; none after receipt stamp.

## Resolution

- **Closed Date:** pending G2 commit (operator authorization)
- **Fix Description:** Allowlisted child env at the spawn chokepoint and
  the CLI bash router; credentials never cross the process boundary;
  explicit caller overrides unchanged
- **Tests Added:** `sdk/src/__tests__/child-env-allowlist.test.ts` (3,
  real-spawn sentinel proof)
- **Verification Evidence:** receipt below; sentinel live proof in
  Loop 2/summary
- **Archived:** pending G2 (moves to `dev/fids/archive/` with the commit)

## Lessons Learned

An allowlist boundary must exist where the privileged resource crosses a
trust boundary — process env to child process is one. Passing "everything,
minus what we remembered to remove" inverts the failure mode from
availability to confidentiality, and confidentiality failures here are
unrecoverable (rotated keys, notified customers).
