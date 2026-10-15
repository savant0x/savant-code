# FID: Desktop Session Gateway (WebSocket)

**Filename:** `FID-2026-0820-008-desktop-session-gateway.md`
**ID:** FID-2026-0820-008
**Severity:** critical
**Status:** closed
**Created:** 2026-08-20 19:04
**Parent:** FID-2026-0820-007

---

## Summary

Implement the headless session gateway: a Bun-hosted localhost WebSocket server exposing the agent runtime
as JSON-RPC with structured event streaming. This is Phase 1 — shell-agnostic and the first implementation
target.

## Environment

- **Runtime:** Bun 1.3.14 (pinned)
- **Protocol:** JSON-RPC 2.0 over localhost WebSocket (Bun native `Bun.serve` WebSocket handler — first
  production use in this repo; existing usage is test-only)
- **Security:** ephemeral port (CLI arg — not secret) + high-entropy bearer token delivered **env-only**
  (`SAVANT_GATEWAY_TOKEN`; argv rejected — process listings expose command lines on multi-user systems);
  bind 127.0.0.1 only; Origin/Host validation on every WS upgrade (see Expected Behavior)
- **Dependency declarations (master FID-007 rule):** zero new runtime dependencies — Bun native WS + the
  existing `zod` (^4.2.1, cli/package.json); new server entrypoint in `cli/`, compiled as the sidecar entry
  (see FID-009's entrypoint correction)
- **Commit/State:** main @ v0.0.27 working tree (release-only-commits convention)

## Detailed Description

### Problem

The Bun agent runtime (bun:sqlite native deps) cannot be embedded in the Tauri Rust host. A bridge is needed
between the desktop UI and a sidecar subprocess. The operator requires NO stdio-framing ambiguity and NO
terminal emulation: all agent output is structured events.

### Expected Behavior

- `savant-code server` CLI mode (new subcommand alongside `login`) starts the gateway
- Binds `ws://127.0.0.1:<ephemeral-port>`; requires bearer token on handshake (constant-time compare);
  rejects unauthenticated connections AND connections with a missing/mismatched `Origin`/`Host` header.
  Allowlist: `tauri://localhost` (macOS/Linux), `http://tauri.localhost` (Windows), dev-server origin in
  dev. DNS-rebinding/cross-site-WebSocket-hijacking protection is enforced SERVER-SIDE
- Multiplexed JSON-RPC mapped onto the EXISTING `PrintModeEvent` zod schema family
  (`common/src/types/print-mode.ts`), extended only where genuinely new
- Token-stream backpressure: buffer and flush on a fixed interval (~50ms)
- Reconnect recovery (v1 scope): reuses the existing session-restore/checkpoint machinery; live
  full-resync over the wire is explicitly OUT of v1 scope
- Session model (frozen v1): ONE agent session per sidecar process
- Approval lifecycle: an approval request halts the stream until resolved; pending approvals survive a
  disconnect/reconnect via state-sync; gateway shutdown resolves pending approvals FAIL-CLOSED (deny +
  recorded in history)
- stdin-close watchdog: if the parent process dies, the sidecar self-terminates (PRIMARY cross-platform
  shutdown path; SIGTERM graceful termination is POSIX-only)

### Frozen Handshake Contract (v1)

Frozen 2026-08-21 so FID-009's Rust supervisor programs against a stable interface:

- **Envelope:** JSON-RPC 2.0. A `hello` request carrying `protocolVersion: 1` must be the first frame
  after the WS upgrade completes; the server replies with its version + capability list. A mismatched
  major version is rejected (-32003) — never silently downgraded.
- **Reserved error codes (app range -32000..-32099):** `-32001` unauthorized (bad/missing token),
  `-32002` origin rejected, `-32003` unsupported protocol version, `-32004` session busy.
- **Credential injection format:** the supervisor passes the ephemeral port as the CLI arg
  `--port=<ephemeral>` and sets `SAVANT_GATEWAY_TOKEN` in the child environment; nothing secret is ever
  on argv, disk, or the network. Constant-time compare, fail-closed.

### Root Cause

No server mode existed (verified Loop 1: `Bun.serve` appeared only in a test). The localhost WebSocket
(ephemeral port + bearer token) avoids newline-framing corruption of large payloads. The gateway is a THIRD
headless mode alongside `--print` (FID-2026-0806-011) and `--auto` (FID-2026-0818-002) — long-running,
not one-shot.

### Evidence

- Design doc: `docs/design/Savant Desktop App Architecture.md` — "The Localhost WebSocket Server" section
- Operator decision (2026-08-20): no terminal interface; WebSocket bridge

## Impact Assessment

### Affected Components

- `cli/` — headless server entrypoint (third headless mode sharing the existing headless plumbing)
- `common/` — extends the existing `PrintModeEvent` discriminated union; no parallel event vocabulary

### Risk Level

- [x] Critical: Security-sensitive IPC boundary (localhost network socket + auth token)

## Proposed Solution

Extend the existing zod event schemas in `common/`; implement the WS server in the sidecar entrypoint; wrap
the agent-runtime step loop as JSON-RPC handlers. Bind loopback only; authenticate on handshake; validate
origin; fail closed.

### Steps

1. Extend `common/src/types/print-mode.ts`: ApprovalRequest + FidQueueUpdate events (only genuinely-new)
2. WS server: ephemeral port, loopback bind, bearer-token handshake, Origin/Host allowlist, stdin watchdog
3. JSON-RPC wrapper implementing the frozen v1 handshake contract
4. Token batching (~50ms flush) + reconnect recovery via session-restore reuse
5. `savant-code server` subcommand — third long-running headless mode
6. Integration tests over real WebSocket connections

### Verification

- Full cli suite 0 fail; typecheck/eslint/prettier green
- Integration tests: unauthenticated rejected; valid token streams events; mismatched Origin rejected;
  stdin-close kills process
- Security check: loopback-only bind confirmed

## Perfection Loop

### Loop 1 — Planning

- **RED:** PASS 2026-08-20 — 6 findings (Detective, file:line evidence): bin name corrected to
  `savant-code`; Steps re-scoped to reuse the existing PrintModeEvent family, sdk-event-handlers
  serialization, and headless plumbing; dependency declarations added (zero new runtime deps); watchdog
  promoted to primary shutdown path.
- **GREEN:** PASS 2026-08-20 — missed questions folded in (subcommand shape, schema reuse, third-mode
  relationship, Windows shutdown, token lifecycle).
- **AUDIT:** PASS 2026-08-21 (program-wide pass) — spec audited against refreshed ground truth.
- **ADVERSARIAL:** UPHELD 2026-08-21 — load-bearing citations disk-resolved; no findings.

### Loop 2 — Review Fold-In (Pre-AUDIT)

- **Fold-in:** 2026-08-21 — Frozen Handshake Contract added; token delivery pinned ENV-ONLY;
  Origin/Host allowlist; single-session model; approval lifecycle fail-closed; reconnect rescoped.

### Loop 3 — Program-Wide Pass (2026-08-21)

- Ground-truth refresh tool-verified; missed question 9 added (final shared history as response
  source-of-truth, RELAY-5). AUDIT PASS / ADVERSARIAL UPHELD recorded above.

### Missed Questions

1. Binary/subcommand? → new `savant-code server` subcommand.
2. New event vocabulary or extend shipped? → extend PrintModeEvent family (Law 7/13).
3. Relation to `--print`/`--auto`? → third long-running mode sharing plumbing.
4. Windows shutdown without SIGTERM? → stdin-close watchdog is primary.
5. Token lifecycle? → per-launch high-entropy token, ENV-ONLY delivery, fail-closed; rotation deferred.
6. Who may connect? → bearer token (constant-time) PLUS Origin/Host allowlist, enforced server-side.
7. One session or many? → single-session-per-sidecar frozen for v1.
8. Pending approval on disconnect/shutdown? → survives reconnect; shutdown resolves FAIL-CLOSED.
9. Response source-of-truth through inline subagent spawns? → final shared history, never generator
   return alone (RELAY-5).

## Code Verification Evidence

Implementation landed in the working tree (release-only-commits convention):

- New: `cli/src/server/json-rpc.ts` (GATEWAY_PROTOCOL_VERSION=1, reserved error codes -32001..-32004 /
  -32600..-32603, capability list, success/failure/notification helpers), `cli/src/server/auth.ts`
  (safeTokenEqual SHA-256+timingSafeEqual fail-closed; isAllowedOrigin/isAllowedHost loopback-only;
  DEFAULT_GATEWAY_ALLOWED_ORIGINS), `cli/src/server/gateway.ts` (startGateway: loopback WS upgrade
  validation 403/-32002, hello handshake -32001/-32003, single-session user_message -32004, AskUserBridge
  approval lifecycle with deny-on-close, ~50ms event-batch flush as JSON-RPC notification, interrupt_stream,
  reconnect recovery via previousRun/continueId/in-process state, DI runPrompt),
  `cli/src/server/stdin-watchdog.ts` (extracted light module, see Resolution),
  `cli/src/server/__tests__/gateway.test.ts` (21 integration tests over real WebSocket connections).
- Changed: `cli/src/server-command.ts` (parseGatewayPort, installStdinWatchdog re-export, runServerCommand
  fail-closed exit(2) without token, GATEWAY_READY_MARKER stdout line), `cli/src/cli-args.ts` (--port
  option + `server` help-text command), `cli/src/cli-command-dispatch.ts` (isServerCommand branch handled
  BEFORE generic non-TTY routing), `common/src/types/print-mode.ts` (printModeApprovalRequestSchema +
  printModeFidQueueUpdateSchema folded into the PrintModeEvent discriminated union).
- Law-4 grep: `installStdinWatchdog` referenced only at stdin-watchdog.ts:17 (def), server-command.ts:19
  (import) / :22 (re-export) / :89 (call), and the test suite. No orphaned consumers.
- Gate outputs (2026-08-23, tool-mediated): full cli suite `bun test src/` → **3316 pass / 18 skip /
  0 fail**, exit 0 (51.63s) including all 21 gateway integration tests under full-suite parallel load;
  cli typecheck exit 0; eslint --max-warnings 0 on all touched files; prettier clean; common +
  agent-runtime typecheck exit 0 (prior session); security check: loopback-only bind confirmed.

## Step Status

- [x] Zod event/action schemas defined (extend PrintModeEvent family)
- [x] WS server with auth + Origin validation + watchdog
- [x] Agent-runtime JSON-RPC wrapper (frozen handshake contract)
- [x] Backpressure batching + reconnect recovery (session-restore reuse)
- [x] `savant-code server` headless entrypoint
- [x] Integration tests passing

## Resolution

Closed 2026-08-23. Implemented across the 2026-08-22/23 sessions per the frozen v1 handshake contract;
closure was gated on the last two failing full-suite tests, both fixed this session.

Recorded ADAPTATIONS from the original plan:

1. The event stream flush emits a **JSON-RPC `event` NOTIFICATION wrapping a batch array**, not a bare
   array — keeps the wire clean JSON-RPC 2.0 for FID-009's Rust supervisor.
2. `update_setting` ships as a capability-listed NO-OP ACK in v1.
3. `installStdinWatchdog` extracted VERBATIM into `cli/src/server/stdin-watchdog.ts` (light standalone
   module) with a re-export from server-command.ts preserving the public surface — done so the watchdog
   integration test's fresh Bun process avoids booting the heavy gateway import graph.

Closure blocker root-caused and fixed (append-to-disk probe evidence, per LEARNINGS kill-proof-probe
practice): the two child-spawn tests were NOT slow boots — the ready-line child exited code 1 ~600ms after
spawn. Captured stderr: `NEXT_PUBLIC_SAVANT_FREE_APP_URL ... Invalid URL ... Invalid environment
configuration (common/src/env.ts:74)`. Root cause: `use-usage-query.test.ts`'s afterEach restored an
originally-UNSET `NEXT_PUBLIC_SAVANT_FREE_APP_URL` by assignment; `process.env.X = undefined` coerces to
the STRING "undefined", poisoning every subsequently spawned child's zod env validation under the shared
full-suite process. Fix: restore by DELETING the key when the original was undefined (else assign
faithfully). Kept hardening: fail-fast rejection when a spawned child exits before printing its marker
(with captured stderr/stdout in the failure message), light-module watchdog import, ready-line poll 25s→50s
/ test timeout 90s. Temporary diagnostic probes removed after diagnosis (tsc exit 0 proves zero residue).

Verifier AUDIT PASS 2026-08-23 — all five checklist items (verbatim-extraction consistency, wiring,
fail-fast assertion strength, delete-vs-assign correctness, leftover-probe NO-MATCH by compiler proof,
frozen-contract untouched). Minor non-blocking notes carried: named timing consts if the file is touched
again; optional future sanitized-env spawn hardening for other leak classes.
