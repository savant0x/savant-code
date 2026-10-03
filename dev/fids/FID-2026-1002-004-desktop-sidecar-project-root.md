# FID: Desktop sidecar receives SAVANT_PROJECT_ROOT; release fails closed

**Filename:** `FID-2026-1002-004-desktop-sidecar-project-root.md`
**ID:** FID-2026-1002-004
**Severity:** high
**Status:** verified
**Created:** 2026-10-02
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

No project path ever crosses the desktop→sidecar boundary: the Tauri
supervisor spawns the sidecar with only `--port` + token, and the sidecar
anchors its entire agent to `findGitRoot(process.cwd()) ?? cwd`. A release
GUI launch inherits the install directory — not a git repo — so the
fallback anchors the agent, file tools, Law 15 worktree baseline, FID rail,
and per-project data keys to the wrong tree. Fix: the supervisor resolves
and passes the project root as `SAVANT_PROJECT_ROOT` (env-only) and
declares its build profile; the sidecar fails closed in release when no
root was passed.

## Environment

- **OS:** Windows (audit session), Bun 1.3.14, Tauri v2 (Rust sidecar
  supervisor)
- **Language/Runtime:** TypeScript strict monorepo + Rust (tauri crate)
- **Tool Versions:** Bun 1.3.14
- **Commit/State:** working tree, HEAD `997ce946` + uncommitted October 2
  work; no commit authorized (G2)

## Detailed Description

### Problem

`build_spawn_spec` (`desktop/src-tauri/src/gateway.rs:76-83`) carries only
`--port=<n>` and the token; `spawn_sidecar`
(`desktop/src-tauri/src/supervisor.rs:214-236`) never sets a working
directory or a project env. `resolveServerProjectRoot`
(`cli/src/server-command.ts:47-58`) falls back to `findGitRoot(cwd)`,
then cwd. A full-tree grep finds zero project-path plumbing in
`desktop/src` (the renderer receives only port + token via
`gateway-config.ts`).

### Expected Behavior

The supervisor is the single root authority: it resolves the git root of
its own cwd (walking up for `.git` as dir or worktree file) and passes it
env-only; it also declares `SAVANT_DESKTOP_PROFILE=release|dev` from
`cfg!(debug_assertions)`. The sidecar uses the passed root and fails
closed — before any bind, with a clear operator-facing message — when the
profile is `release` and no root override resolves. Dev and manual CLI
runs keep today's resolution byte-for-byte.

### Root Cause

FID-2026-0901-004 anchored the sidecar to `findGitRoot(cwd)` to fix the
dev-only "locked to src-tauri" symptom; the release topology (GUI launch,
inherited install-dir cwd) was never covered, and the env seam that
already exists (`PROJECT_ROOT_ENV`) has no producer.

### Evidence

Source-confirmed in the T113 audit (finding D1,
`dev/session-summaries/2026-10-02-full-data-flow-audit.md`), including the
measured negative (zero `projectRoot` references in `desktop/src`) and the
spawn-path trace. The env seam and git-root resolution are exercised by
`gateway-server-command.test.ts:39-47`.

## Impact Assessment

### Affected Components

- `desktop/src-tauri/src/gateway.rs` (SpawnSpec + env constants + tests)
- `desktop/src-tauri/src/supervisor.rs` (find_git_root + env wiring + tests)
- `desktop/src-tauri/src/lib.rs` (root resolution at the spawn site)
- `cli/src/server-command.ts` (release fail-closed gate)

### Risk Level

- [x] High in release desktop sessions (agent anchored to the install
  directory); no data loss — wrong-root operations fail loudly or touch
  the wrong tree read-only.

## Proposed Solution

### Approach

Env-only delivery (mirrors GATEWAY_TOKEN_ENV's frozen argv rule), single
root authority in the supervisor, and a fail-closed sidecar gate that
fires only for supervised release launches — never for dev shells or
manual `savant-code server` runs.

### Steps

1. `gateway.rs`: add `PROJECT_ROOT_ENV` + `DESKTOP_PROFILE_ENV`
   constants; extend `SpawnSpec` with `project_root: Option<String>`;
   `build_spawn_spec` takes it; update the spec tests (token still never
   on argv; root never on argv).
2. `supervisor.rs`: add `find_git_root` (ancestor walk for `.git`, dir or
   file — worktrees/submodules); `spawn_sidecar` sets
   `SAVANT_PROJECT_ROOT` when present and always sets
   `SAVANT_DESKTOP_PROFILE` from `cfg!(debug_assertions)`; unit tests for
   the ancestor walk (temp dirs).
3. `lib.rs`: resolve the git root once before the supervision loop and
   pass it into every `build_spawn_spec` call (the loop may rebuild the
   spec after crashes — same root).
4. `cli/src/server-command.ts`: export
   `isReleaseSidecarMissingProjectRoot(env)` (pure); in
   `runServerCommand`, after the token check, fail closed (exit 2) when
   the profile is `release` and no `SAVANT_PROJECT_ROOT` override
   resolves — before `setProjectRoot`/bind/ready-line.
5. Tests: TS — the pure gate (release+missing → true; dev/absent-profile
   or root-present → false); Rust — `find_git_root` nested-dir + worktree
   file + miss; spec carries the root.

### Verification

`cargo test` in `desktop/src-tauri` (profile, spec, git-root); the CLI
gateway server-command suite for the pure gate; typecheck cli. Declared
gates below.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/server/__tests__/gateway-server-command.test.ts
- gate: probe scripts/desktop-cargo-test-probe.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:e2945a351fefa7cc0eebe4b60e26808774cb435b0066884c7eea9c555d432f71
- verified: 2026-10-03T03:13:59.052Z
- typecheck cli: exit 0
- test cli/src/server/__tests__/gateway-server-command.test.ts: exit 0
- probe scripts/desktop-cargo-test-probe.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Audit finding D1: the boundary carries no project path (`gateway.rs:76-83`,
`supervisor.rs:214-236`, zero `desktop/src` plumbing); release anchoring
established by source mechanism. The `SAVANT_PROJECT_ROOT` consumer exists
and is tested; the producer does not exist.

### GREEN

The supervisor already owns every child-process surface (token env,
`.env.local` forwarding, stdio drains) — the project root is one more env
pair from the same authority. Fail-closed is scoped to the supervised
release profile so no dev or manual-run behavior changes.

### AUDIT

Auth/argv invariants hold: the root and profile are env-only (the frozen
v1 rule "nothing secret on argv" is unaffected — the root is not secret
but stays off argv anyway, matching the token's discipline); the
`token_is_exposed_on_argv` detector still covers the whole spec. The
sidecar's fail-closed gate runs BEFORE any bind or ready line, so a
mis-anchored session can never start silently.

### Missed Questions

1. Why not `current_dir()` on the Command instead? Setting the sidecar's
   cwd would mask the missing-project contract and re-introduce the
   FID-2026-0901-004 failure shape in reverse; env keeps the launch
   topology visible and the resolution single-sourced.
2. What if the user launches the release shell from INSIDE a repo? The
   supervisor's git-root walk succeeds and passes the root — the session
   works, exactly like dev.
3. What should the release failure look like to the user? The sidecar
   exits 2 with a stderr message before binding; the supervisor's
   crash/restart ladder marks the gateway Dead with the last stderr line
   surfaced by the existing drain; the desktop shows the offline/dead
   state. Repair = launch the shell from a repo or pass
   SAVANT_PROJECT_ROOT (a future project picker owns the UX).
4. Does the profile env leak anywhere sensitive? It is a constant string
   set by the supervisor; it appears only in the child env, never logged
   by value.
5. Why a `probe` gate for cargo? The FID gate executor's allowlist covers
   workspace test runners; `cargo test` is wired through a scratchpad
   probe script (the FID-2026-0823-009 allowlisted `probe` shape) that
   shells the exact command and fails on non-zero exit.

### Convergence

The producer/consumer pair is symmetric, env-only, and fail-closed in
exactly the release topology that was broken. Ready for implementation at
level 3.

## Implementation Evidence

### Code Verification Evidence

- `desktop/src-tauri/src/gateway.rs:16-33` — `PROJECT_ROOT_ENV` and
  `DESKTOP_PROFILE_ENV` constants added beside `GATEWAY_TOKEN_ENV`;
  `SpawnSpec` gains `project_root: Option<String>` (`gateway.rs:56-64`);
  `build_spawn_spec` takes it and keeps both secret-bearing values off
  argv (`gateway.rs:92-105`); the spec test now also asserts the root
  never appears on argv (`gateway.rs:155-170`).
- `desktop/src-tauri/src/supervisor.rs:223-253` — `spawn_sidecar` sets
  `SAVANT_DESKTOP_PROFILE` from `desktop_profile()` (`cfg!(debug_assertions)`
  → `dev`/`release`) and `SAVANT_PROJECT_ROOT` only when the spec carries
  one; `desktop_profile` (`:268-276`), `find_git_root` (ancestor walk
  accepting a `.git` dir OR worktree file, `:278-291`), and
  `resolve_shell_project_root` (`:297-303`) added with three unit tests
  (nested walk-up, worktree file, miss outside any repo).
- `desktop/src-tauri/src/lib.rs:22-26, 104-115, 133` — the shell resolves
  the project root ONCE before the supervision loop and passes it into
  every `build_spawn_spec` call across the crash/restart ladder; the
  launch log names the root (or the fail-closed marker) for diagnosability.
- `cli/src/server-command.ts:11-19, 41-54, 99-113` — `DESKTOP_PROFILE_ENV`
  documented; pure gate `isReleaseSidecarMissingProjectRoot` (release
  profile + no non-blank override → true; dev/absent profile or rooted
  launch → false); `runServerCommand` exits 2 with an operator-facing
  message BEFORE any bind or ready line.
- `scripts/desktop-cargo-test-probe.ts` (new) — the allowlisted probe
  shape: shells `cargo test` in `desktop/src-tauri`, exit 0 clean /
  non-zero with output, never re-enters FID verification.
- Test evidence: `cargo test` 17 passed / 0 failed (incl. the three new
  `find_git_root` tests and the updated spec-argv tests); CLI gateway
  server-command suite 7 pass / 0 fail (incl. the new gate test);
  typecheck cli exit 0.
- Verification limits (unchanged from the audit): the release-anchoring
  failure itself is established by source mechanism; no installed release
  shell was launched live in this session. The fail-closed gate and the
  supervisor pass-through are pinned by executable tests on both sides of
  the boundary.

### Step Status

- [x] Step 1 — SpawnSpec + env constants + spec tests: implemented
      (`gateway.rs`).
- [x] Step 2 — find_git_root + env wiring + unit tests: implemented
      (`supervisor.rs`).
- [x] Step 3 — root resolution at the spawn site: implemented (`lib.rs`).
- [x] Step 4 — sidecar fail-closed gate + pure helper: implemented
      (`cli/src/server-command.ts`).
- [x] Step 5 — TS + Rust tests + probe: implemented
      (`gateway-server-command.test.ts`, `supervisor.rs` tests,
      `scripts/desktop-cargo-test-probe.ts`).

## Resolution

- **Fix Description:** the desktop supervisor resolves and passes the
  project root env-only and declares its build profile; the sidecar fails
  closed before binding when a release launch arrives with no root.
- **Tests Added:** Yes — 3 Rust unit tests (git-root walk/worktree/miss),
  spec-argv root exclusion pin, TS release-gate test, cargo-test probe
  gate.
- **Verification Evidence:** all four declared gates exit 0 (typecheck
  cli; server-command suite; cargo probe; quality); receipt stamped by
  the project verifier.
- **Commit SHA:** pending — commit authority is operator-owned (G2); no
  commit made.
