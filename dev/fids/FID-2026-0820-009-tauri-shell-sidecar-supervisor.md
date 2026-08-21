# FID: Tauri Shell + Sidecar Supervisor

**Filename:** `FID-2026-0820-009-tauri-shell-sidecar-supervisor.md`
**ID:** FID-2026-0820-009
**Severity:** critical
**Status:** created
**Created:** 2026-08-20 19:04
**Parent:** FID-2026-0820-007

---

## Summary

Implement the Tauri v2 shell: Rust supervisor that spawns the Bun-compiled sidecar, injects the WS port +
bearer token into the WebView, and guarantees zombie-free lifecycle. Phase 2.

## Environment

- **Shell:** Tauri v2 (WebView2 / WKWebView / WebKitGTK)
- **Sidecar:** Bun single-file executable via `bun build --compile` (bun-windows-x64, bun-darwin-arm64,
  bun-linux-x64 targets). NOTE (2026-08-21 review): Tauri `externalBin` requires Rust-target-triple
  filenames (e.g. `savant-sidecar-x86_64-pc-windows-msvc.exe`); Bun emits its own naming (auto-appends
  `.exe` on windows targets) — the build step must RENAME outputs using `TAURI_ENV_TARGET_TRIPLE`, never
  a hardcoded triple, and must not produce `.exe.exe`
- **Toolchain:** Rust (new for this monorepo — CI impact must be planned)
- **Commit/State:** main @ v0.0.26 (working tree)

## Detailed Description

### Problem

The desktop app needs a native shell that hosts the React renderer and manages the Bun sidecar lifecycle.
The Rust layer owns window creation, tray, and process supervision.

### Expected Behavior

- Rust supervisor spawns the compiled Bun sidecar: ephemeral port as a CLI arg (`--port=<ephemeral>`) +
  the high-entropy token via child-process ENV ONLY (`SAVANT_GATEWAY_TOKEN` — never argv: process
  listings expose it; never disk/network). The supervisor generates the token itself and consumes the
  FID-008 FROZEN handshake contract (hello/version + reserved error codes)
- Registers the platform WebView origin (`tauri://localhost` macOS/Linux, `http://tauri.localhost`
  Windows, dev-server origin in dev) as the sole allowed `Origin` in the FID-008 gateway allowlist
- Port + token injected into the WebView via Tauri setup state (never via network or disk)
- Graceful termination on window close/app exit (SIGTERM to sidecar; sidecar stdin-watchdog as second line of defense)
- Boot splash with failure states (sidecar crash, port conflict, auth failure)
- WebView security: restrictive CSP, no arbitrary navigation, token never logged

### Root Cause

No desktop shell exists. The canonical blueprint selects Tauri v2: OS-native WebView, small footprint, and
the operator requires no terminal (so Electron's xterm.js WebGL rationale does not apply).

### Evidence

- Design doc: `docs/design/Savant Desktop App Architecture.md` — "Application Shell Architecture" and
  "Process Lifecycle and Zombie Mitigation" sections
- Operator decision (2026-08-20): Tauri v2, no terminal

## Impact Assessment

### Affected Components

- New `desktop/` workspace (src-tauri + renderer entry)
- Root CI — Rust toolchain stage; typecheck gate extends to the desktop workspace
- `cli/scripts/build-binary.ts` — reuse/extend for `bun build --compile` sidecar targets (Law 13: one build pipeline)

### Risk Level

- [x] Critical: Process supervision, security-sensitive state injection, new toolchain

## Proposed Solution

### Approach

Scaffold Tauri v2 in `desktop/`. Implement the supervisor with explicit lifecycle states
(spawning → ready → shutting down → dead) and test the zombie paths (kill -9 the parent; sidecar must exit).

### Steps

1. Scaffold Tauri v2 workspace + React 19 renderer entry
2. Extend the binary build pipeline to emit `bun build --compile` sidecar targets renamed to the Rust
   target triple (`$NAME-$TAURI_ENV_TARGET_TRIPLE[.exe]`) for Tauri `externalBin` resolution
3. Implement Rust supervisor: spawn, port (argv) + token (ENV-ONLY) generation + injection, lifecycle
   states, consumption of the FID-008 frozen handshake contract
4. Graceful shutdown + zombie tests (parent kill, normal exit, sidecar crash)
5. Boot splash with failure states
6. WebView CSP + security hardening
7. CI integration checklist (owned by this FID): runner matrix (windows-latest / macos-latest /
   ubuntu-latest), cargo cache strategy, clippy gate placement (CI-only initially), Rust toolchain
   pinning (`rust-toolchain.toml`), tauri-artifact release verification wired to the existing
   asset-verifier pattern (`scripts/public-release.ts`)
8. Unit + integration tests

### Verification

- `bun run --cwd=desktop typecheck` passes; Rust `cargo check` clean
- Zombie test: SIGKILL parent → sidecar exits within timeout
- Token never appears in argv or logs (process-listing + grep test output)
- WebView loads with CSP enforced
- CI spike checklist resolved: runner matrix, cargo caching, clippy policy, and tauri-artifact release
  verification integrated with the existing release-asset verification

## Perfection Loop

### Loop 1 — RED

- **Pre-RED review fold-in (2026-08-21):** operator-requested review amendments applied before RED:
  externalBin triple-rename requirement (Environment), env-only token injection + frozen
  handshake-contract consumption + WebView-origin registry (Expected Behavior), CI integration checklist
  step + verification bullets, folded decisions recorded below. RED/GREEN/AUDIT/ADVERSARIAL remain not
  yet run and will audit this amended spec. Master FID-007 Loop 2 records the Manifest Sync.
- **RED:** Not yet run — this FID awaits its implementation-planning session.
- **GREEN:** Not yet run.
- **AUDIT:** Not yet run.
- **ADVERSARIAL:** Not yet run.
- **CHANGE DELTA:** N/A — no document edits beyond planning scaffolding + the pre-RED fold-in above.

### Missed Questions

Not yet conducted — the Loop 1 RED/GREEN missed-questions pass runs with the
implementation-planning session. Questions already answered at authoring
time: the Rust toolchain is new to this monorepo and needs a planned CI
stage; the sidecar is a `bun build --compile` executable declared as the
Tauri `externalBin`; shutdown ordering is SIGTERM where available with the
sidecar stdin-watchdog as the second line of defense.

Folded in 2026-08-21 (operator-review, pre-RED): the sidecar binary must be
renamed to the Rust target triple (`$NAME-$TAURI_ENV_TARGET_TRIPLE[.exe]`)
because Tauri `externalBin` resolves triple-suffixed filenames while Bun
`--compile` emits its own naming; the bearer token is injected ENV-ONLY
(`SAVANT_GATEWAY_TOKEN`, never argv); this FID owns the WebView-origin
registry consumed by FID-008's allowlist; and the Rust-in-CI spike
(matrix/cache/clippy/release-verification) is scoped HERE rather than
discovered mid-Phase-2.

### Code Verification Evidence

Planning-stage record — status `created`: no implementation exists yet.

- No `desktop/` workspace exists in the working tree, and the only CI
  workflow (`.github/workflows/build-release-binaries.yml`) is pure Bun with
  zero cargo/rust/tauri matches (master FID-007 Loop 1 tool evidence,
  2026-08-20) — the scaffold step must create both.
- Gate output: none yet — `cargo check` and `bun run --cwd=desktop typecheck`
  become runnable only after the scaffold lands; they are the implementation
  AUDIT gates.

## Step Status

- [ ] Tauri workspace scaffolded
- [ ] Sidecar build targets wired (triple-renamed)
- [ ] Supervisor implemented
- [ ] Zombie-free shutdown verified
- [ ] Boot splash + failure states
- [ ] CSP hardening
- [ ] CI integration checklist resolved
- [ ] Tests passing

## Resolution

Not closed. This FID is in the authored state (status `created`); its
Perfection Loop and implementation are gated on the master FID-2026-0820-007
Commit Gate (design doc + five suite FIDs committed to main). This section
records the closed date, fix description, tests added, and verification
evidence when the phase closes.
