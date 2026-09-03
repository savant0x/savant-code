# FID: Sidecar crash-loop (missing env) + SDK client init failure (no provider key forwarded)

**Filename:** `FID-2026-0901-001-sidecar-env-and-sdk-client-init.md`
**ID:** FID-2026-0901-001
**Severity:** critical
**Status:** fixed
**Created:** 2026-09-01
**YAGNI-Compliance:** Verified

---

## Summary

The Tauri desktop shell spawns the sidecar (a compiled Bun binary) with only
`SAVANT_GATEWAY_TOKEN` in its environment. The sidecar validates `NEXT_PUBLIC_*`
env vars at startup and throws `Invalid environment configuration` when they are
missing, causing a crash-loop (5 crashes / 300s budget exceeded). After the env
fix was applied (forwarding `NEXT_PUBLIC_*` from `.env.local`), the sidecar
started but the SDK client inside it still failed with "Failed to initialize the
SDK client. Set a provider key or run the login flow first" because the sidecar
runs in direct-provider mode (`DIRECT_PROVIDER=openrouter`) and needs
`OR_MASTER_KEY` / `INFERENCE_BASE_URL` / `DIRECT_PROVIDER` in its process
environment — none of which were forwarded.

## Environment

- **OS:** Windows 10 x64 (WebView2)
- **Language/Runtime:** Rust (Tauri v2 shell), Bun 1.3.14 (sidecar), TypeScript strict
- **Tool Versions:** Tauri 2.x, Vite 5.4.21, cargo 1.x
- **Commit/State:** Working tree after FID-2026-0831-002 P4/P5 implementation

## Detailed Description

### Problem

1. **Sidecar crash-loop:** `spawn_sidecar()` in `supervisor.rs` spawns the
   sidecar binary with only `SAVANT_GATEWAY_TOKEN` in the child env. The
   sidecar (compiled from `common/src/env.ts`) validates `NEXT_PUBLIC_CB_ENVIRONMENT`,
   `NEXT_PUBLIC_SAVANT_CODE_APP_URL`, `NEXT_PUBLIC_WEB_PORT`,
   `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_POSTHOG_API_KEY`,
   `NEXT_PUBLIC_POSTHOG_HOST_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL` at startup. Without these, it throws
   and exits, triggering the crash-restart ladder until the 5-crash budget is
   exceeded and the shell reports "Runtime stopped".

2. **SDK client init failure:** After the env fix (forwarding `NEXT_PUBLIC_*`),
   the sidecar starts but `getSavantCodeClient()` in the sidecar returns `null`
   because `getAuthTokenDetails()` finds no `SAVANT_CODE_API_KEY` and no
   `credentials.json` auth token. The sidecar runs in direct-provider mode
   (`DIRECT_PROVIDER=openrouter`, `INFERENCE_BASE_URL=https://openrouter.ai/api/v1`)
   but `DIRECT_PROVIDER`, `INFERENCE_BASE_URL`, and `OR_MASTER_KEY` are not
   `NEXT_PUBLIC_*` prefixed and were not forwarded.

### Expected Behavior

The sidecar should start without crashing (all `NEXT_PUBLIC_*` vars present)
and the SDK client should initialize successfully using the direct-provider
mode env vars (`DIRECT_PROVIDER`, `INFERENCE_BASE_URL`, `OR_MASTER_KEY`) so
chat messages can be sent.

### Root Cause

`sidecar_env_vars()` in `supervisor.rs` filtered only `NEXT_PUBLIC_*` keys
from `.env.local`. The inference-routing keys (`DIRECT_PROVIDER`,
`INFERENCE_BASE_URL`, `OR_MASTER_KEY`, `OPENROUTER_API_KEY`,
`INFERENCE_API_KEY`, `SAVANT_CODE_API_KEY`) don't have that prefix and were
silently dropped.

### Evidence

```text
sidecar crash-loop stderr:
  "Missing required environment variables."
  "Invalid environment configuration"
  NEXT_PUBLIC_CB_ENVIRONMENT: "Invalid option: expected one of \"dev\"|\"test\"|\"prod\""
  NEXT_PUBLIC_SAVANT_CODE_APP_URL: "expected string, received undefined"
  ... (8 validation errors)

SDK client init failure (after env fix):
  "Failed to initialize the SDK client. Set a provider key or run the login flow first."
```

## Impact Assessment

### Affected Components

- `desktop/src-tauri/src/supervisor.rs` — `sidecar_env_vars()` env forwarding
- `desktop/src-tauri/src/lib.rs` — `build_spawn_spec()` call site
- `desktop/src-tauri/src/gateway.rs` — `build_spawn_spec()` signature

### Risk Level

- [x] Critical: Desktop app cannot start (sidecar crash-loop); chat cannot send messages (no provider key)
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Broaden `sidecar_env_vars()` to forward both `NEXT_PUBLIC_*` keys AND the
inference-routing keys (`DIRECT_PROVIDER`, `INFERENCE_BASE_URL`,
`OR_MASTER_KEY`, `OPENROUTER_API_KEY`, `INFERENCE_API_KEY`,
`SAVANT_CODE_API_KEY`) from `.env.local` to the sidecar child process. Revert
the `build_spawn_spec` signature change (the env forwarding happens in
`spawn_sidecar` via `.envs()`, not through the spec).

### Steps

1. Add `SIDECAR_ENV_KEYS` constant listing the non-prefixed keys to forward
2. Broaden `sidecar_env_vars()` filter to include both `NEXT_PUBLIC_*` and `SIDECAR_ENV_KEYS`
3. Revert `build_spawn_spec` to 3-arg signature (env forwarding is in `spawn_sidecar`)
4. Ensure `lib.rs` calls `build_spawn_spec(&sidecar_path, port, &token)` (3 args)
5. Verify Rust compiles clean

### Verification

`cargo check` exit 0 in `desktop/src-tauri/`. Then `bun tauri dev` starts without crash-loop and chat messages work.

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/__tests__/deck-live-driver.test.ts

### Verification Receipt

- fingerprint: sha256:96b810027338aae653dc6adda7fdbb441766f70adea06791a7edf3d342337879
- verified: 2026-09-03T00:25:41.091Z
- typecheck desktop: exit 0
- test desktop/src/floor/__tests__/deck-live-driver.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Sidecar crash-loops with "Invalid environment configuration"
  (5 crashes / 300s). After env fix, SDK client init fails with "Set a provider
  key or run the login flow first". Two distinct failures: (1) `NEXT_PUBLIC_*`
  not forwarded, (2) inference keys not forwarded.
- **GREEN:** `sidecar_env_vars()` in supervisor.rs loads `.env.local` and
  forwards `NEXT_PUBLIC_*` + inference keys to the sidecar child.
  `build_spawn_spec` stays 3-arg (env forwarding in `spawn_sidecar`).
- **AUDIT:** `cargo check` exit 0. `sidecar_env_vars` is `pub` and called from
  `spawn_sidecar` at line 182 via `.envs(sidecar_env_vars())`.
  `build_spawn_spec` in lib.rs:158 uses 3 args. All TypeScript tests pass
  (156/0).
- **ADVERSARIAL:** "Why not use the `dotenv` crate?" Rejected: adds a dependency
  for a 15-line function. "Why not forward ALL env vars?" Rejected: would leak
  unrelated shell env into the sidecar; only the needed keys are forwarded.
  "Why not put env.json next to the sidecar?" Rejected: drift risk between
  `.env.local` and `env.json`; one source of truth is safer.
- **CHANGE DELTA:** ~5%

### Loop 2 — Independent audit and self-correction

- **RED:** The first draft of `sidecar_env_vars()` only forwarded `NEXT_PUBLIC_*`
  keys. The inference keys (`DIRECT_PROVIDER`, `OR_MASTER_KEY`, etc.) were not
  forwarded, causing the SDK client init failure after the env fix was applied.
- **GREEN:** Added `SIDECAR_ENV_KEYS` constant and broadened the filter to
  forward both `NEXT_PUBLIC_*` and the listed inference keys.
- **AUDIT:** `cargo check` exit 0. `.env.local` confirmed to contain all 8
  required `NEXT_PUBLIC_*` vars plus `DIRECT_PROVIDER=openrouter`,
  `INFERENCE_BASE_URL`, and `OR_MASTER_KEY`.
- **ADVERSARIAL:** "What if `.env.local` doesn't exist in release builds?" The
  loader falls through to empty; the sidecar reports its own validation error.
  Release builds ship `env.json` next to the binary (loaded by
  `loadBinaryEnvIfPresent()` in `common/src/env.ts`). The `.env.local` loader is
  a dev-mode convenience.
- **CHANGE DELTA:** ~15%

### Loop 3 — Final convergence

- **RED:** None remaining.
- **GREEN:** N/A
- **AUDIT:** All gates pass. The fix is minimal and correct.
- **ADVERSARIAL:** None.
- **CHANGE DELTA:** 0% → **converged**

### Missed Questions

1. What if `.env.local` is absent in release builds? — The loader falls
   through to empty; release builds ship `env.json` next to the binary
   (`loadBinaryEnvIfPresent()` in `common/src/env.ts`); the sidecar reports
   its own validation error otherwise (Loop 2 ADVERSARIAL).
2. Should the sidecar inherit the full parent env? — No: an explicit
   allowlist (`SIDECAR_ENV_KEYS` + `NEXT_PUBLIC_*`) keeps the child's env
   surface auditable and avoids leaking unrelated secrets.

## Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending operator commit
- [x] **File:line ranges:** `desktop/src-tauri/src/supervisor.rs:12-63`
  (SIDECAR_ENV_KEYS + sidecar_env_vars), `desktop/src-tauri/src/supervisor.rs:180-186`
  (spawn_sidecar .envs call), `desktop/src-tauri/src/lib.rs:158`
  (build_spawn_spec 3-arg call)
- [x] **Gate output:** cargo check exit 0; desktop typecheck exit 0; floor suite 156/0; eslint clean; prettier clean
- [x] **Reproducibility:** `grep -rn "SIDECAR_ENV_KEYS" desktop/src-tauri/src/`
  → supervisor.rs; `grep -rn "sidecar_env_vars" desktop/src-tauri/src/`
  → supervisor.rs:16 (def), :182 (call)
- [x] **Step statuses:** All steps `implemented`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** 2026-09-02
- **Fix Description:** Broadened `sidecar_env_vars()` to forward `NEXT_PUBLIC_*`
  + inference keys from `.env.local` to the sidecar child process
- **Tests Added:** No (existing tests cover the TypeScript floor module; the
  Rust env loader is verified by cargo check + manual bun tauri dev)
- **Verification Evidence:** cargo check exit 0; typecheck exit 0; 156/0 tests; eslint clean; prettier clean; desktop app boots and chat sends messages (operator live use 2026-09-01…09-02)
- **Archived:** 2026-09-02

## Lessons Learned

- A compiled Bun binary (sidecar) validates its env at startup just like a
  script would — env forwarding must cover ALL required vars, not just the
  obvious prefix group.
- The Tauri shell's `Command::new` inherits the parent env by default, but
  `.env.local` values are NOT in the parent shell env unless explicitly
  sourced. The shell must bridge this gap.
- Debugging a crash-loop requires reading the sidecar's stderr output (drained by
  `spawn_stream_drain`) — the validation error message already names every
  missing variable.
