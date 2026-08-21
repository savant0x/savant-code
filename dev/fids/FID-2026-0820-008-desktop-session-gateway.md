# FID: Desktop Session Gateway (WebSocket)

**Filename:** `FID-2026-0820-008-desktop-session-gateway.md`
**ID:** FID-2026-0820-008
**Severity:** critical
**Status:** created
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
  existing `zod` (^4.2.1, cli/package.json); new server entrypoint in `cli/` (e.g. `src/server.ts`),
  compiled as the sidecar entry (see FID-009's entrypoint correction)
- **Commit/State:** main @ v0.0.26 (working tree — the canonical design doc and this suite are untracked;
  master FID-007 Commit Gate applies before implementation GREEN)

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
  dev. DNS-rebinding/cross-site-WebSocket-hijacking protection is enforced SERVER-SIDE: browser SOP does
  not cover WS handshakes, and WKWebView/WebView2 do not fully implement Private Network Access
- Multiplexed JSON-RPC: requests/responses plus notification streams for token deltas, tool execution events,
  ECHO phase transitions, approval requests, FID queue updates, EHEL interventions — mapped onto the
  EXISTING `PrintModeEvent` zod schema family (`common/src/types/print-mode.ts`), extended only where
  genuinely new
- Token-stream backpressure: buffer and flush on a fixed interval (~50ms)
- Reconnect recovery (v1 scope): reuses the existing session-restore/checkpoint machinery so chat history,
  active FIDs, and goal progress are recoverable without loss; live full-resync over the wire is
  explicitly OUT of v1 scope
- Session model (frozen v1): ONE agent session per sidecar process — no multiplexed sessions or
  correlation IDs on the wire; multi-session support would be a breaking handshake revision (v2)
- Approval lifecycle: an approval request halts the stream until resolved; pending approvals survive a
  disconnect/reconnect via state-sync; gateway shutdown resolves pending approvals FAIL-CLOSED (deny +
  recorded in history)
- stdin-close watchdog: if the parent process dies, the sidecar self-terminates. This watchdog is the
  PRIMARY cross-platform shutdown path (SIGTERM graceful termination is POSIX-only; Windows relies on
  the watchdog)

### Frozen Handshake Contract (v1)

Frozen 2026-08-21 (review fold-in) so FID-009's Rust supervisor programs against a stable interface.
Changes to any of these are breaking and require a handshake major-version bump:

- **Envelope:** JSON-RPC 2.0. A `hello` request carrying `protocolVersion: 1` must be the first frame
  after the WS upgrade completes; the server replies with its version + capability list. A mismatched
  major version is rejected (see error codes) — never silently downgraded.
- **Reserved error codes (app range -32000..-32099):** `-32001` unauthorized (bad/missing token),
  `-32002` origin rejected, `-32003` unsupported protocol version, `-32004` session busy.
- **Credential injection format:** the supervisor passes the ephemeral port as the CLI arg
  `--port=<ephemeral>` (matching FID-009's supervisor step) and sets `SAVANT_GATEWAY_TOKEN` in the child
  environment; nothing secret is ever on argv, disk, or the network. The token is compared constant-time,
  fail-closed.

### Root Cause

No server mode exists (verified Loop 1: `Bun.serve` appears only in a test). The canonical blueprint selects
a localhost WebSocket (ephemeral port + bearer token) over raw stdio to avoid newline-framing corruption of
large payloads (diffs, knowledge-graph data). The gateway is a THIRD headless mode alongside the existing
`--print` (FID-2026-0806-011) and `--auto` (FID-2026-0818-002) modes — long-running, not one-shot.

### Evidence

- Design doc: `docs/design/Savant Desktop App Architecture.md` — "The Localhost WebSocket Server" section
- Operator decision (2026-08-20): no terminal interface; WebSocket bridge

## Impact Assessment

### Affected Components

- `cli/` — headless server entrypoint (third headless mode, sharing the existing headless plumbing:
  `cli/src/cli-args.ts`, `cli/src/headless-run.ts`)
- `packages/agent-runtime/` — JSON-RPC handler wrapping the step loop (the loop itself exists:
  `src/run-agent-step/`); serialization reuses the SDK-event mapping in
  `cli/src/utils/sdk-event-handlers.ts`
- `common/` — EXTENDS the existing `PrintModeEvent` discriminated union (`common/src/types/print-mode.ts`)
  with the genuinely-new schemas; no parallel event vocabulary (Law 7/13)

### Risk Level

- [x] Critical: Security-sensitive IPC boundary (localhost network socket + auth token)

## Proposed Solution

### Approach

Extend the existing zod event schemas in `common/`; implement the WS server in the sidecar entrypoint; wrap
the agent-runtime step loop as JSON-RPC handlers. Bind loopback only; authenticate on handshake; validate
origin; fail closed.

### Steps

1. Extend `common/src/types/print-mode.ts`: add ApprovalRequestEvent + FidQueueUpdateEvent (the only
   genuinely-new events); map design-doc Table 1 names onto shipped schema names (TokenStreamEvent →
   printModeText, ToolExecutionEvent → printModeToolCall/ToolResult, EhelInterventionEvent →
   printModeComplianceWarning, StateTransitionEvent → printModeFinish partial)
2. Implement WS server: ephemeral port, loopback bind, bearer-token handshake (env-only token,
   constant-time compare, fail-closed), Origin/Host allowlist validation on the upgrade, stdin-close
   watchdog (primary cross-platform shutdown)
3. Wrap agent-runtime step loop as JSON-RPC handlers implementing the frozen v1 handshake contract
   (hello/version + reserved error codes above) as the stable interface FID-009's Rust supervisor
   programs against, with streaming notifications reusing the `sdk-event-handlers.ts` SDK-event →
   structured-event mapping as the serialization reference
4. Implement token batching (~50ms flush) and reconnect recovery via the existing session-restore
   machinery (v1 scope — no live full-resync)
5. Add the `savant-code server` subcommand — a third, long-running headless mode sharing the existing
   headless plumbing; NOT a duplicate of `--print` or `--auto`
6. Integration tests: spawn gateway, authenticate, stream, reconnect, reject bad tokens, reject mismatched
   origins, stdin-close kills the process

### Verification

- `bun run --cwd=common typecheck`, `bun run --cwd=packages/agent-runtime typecheck`, and
  `bun run --cwd=cli typecheck` pass
- Integration test: unauthenticated connection rejected; valid token streams events; mismatched Origin
  rejected; stdin-close kills process
- Security check: no non-loopback bind (grep/verify server options)

## Perfection Loop

### Loop 1 — Planning

- **RED:** PASS 2026-08-20 — 6 findings (Detective, file:line evidence): FID-008-01 high — bin name
  `savant` is wrong; real bin is `savant-code` (cli/package.json:5-7, cli/src/cli-args.ts:102) and no
  `server` subcommand exists. FID-008-02 high — Step 5 ignored the existing headless plumbing: `--print`
  (cli-args.ts:148) and `--auto` (cli-args.ts:128) with `runHeadlessPrint` in cli/src/headless-run.ts.
  FID-008-03 high — Step 1 proposed a parallel event vocabulary duplicating the shipped `PrintModeEvent`
  family (common/src/types/print-mode.ts, 13 printMode* schemas); only Approval/FidQueue events are
  genuinely new. FID-008-04 medium — event serialization already exists
  (cli/src/utils/sdk-event-handlers.ts). FID-008-05 low, not an issue — "no server mode exists" verified
  TRUE. FID-008-06 low, not an issue — step loop exists; only the wrapper is new.
- **GREEN:** PASS 2026-08-20 — missed questions folded in: which bin/subcommand (`savant-code server`, new
  subcommand); reuse vs new schemas (extend PrintModeEvent — Law 7/13); relation to existing headless modes
  (third long-running mode sharing plumbing, not a duplicate); Windows shutdown without SIGTERM (stdin
  watchdog is the primary cross-platform path); token lifecycle (per-launch token via argv/env;
  rotation/reconnect auth deferred to the implementation loop with fail-closed default). Corrections
  applied: bin name fixed, Steps 1/3/5 re-scoped to reuse, dependency declarations added (zero new runtime
  deps), watchdog promoted to primary shutdown path. Note: the Thinker and Recorder agents were unavailable
  (recurring harness `ModelMessage[]` failure); the Orchestrator performed the missed-questions pass and
  applied this edit directly (documented SoD exception, LEARNINGS 2026-07-25 precedent).
- **AUDIT:** PENDING
- **ADVERSARIAL:** PENDING
- **CHANGE DELTA:** N/A — planning FID

### Loop 2 — Review Fold-In (Pre-AUDIT)

- **Fold-in:** 2026-08-21 — operator-requested review amendments applied BEFORE the pending AUDIT: Frozen
  Handshake Contract section added (hello/version + reserved error-code range), token delivery pinned
  env-only (`SAVANT_GATEWAY_TOKEN`; argv rejected — supersedes the Loop 1 GREEN argv/env decision),
  Origin/Host allowlist added to Environment/Expected Behavior/Steps 2+6, session model frozen
  (single-session-per-sidecar), approval lifecycle defined, reconnect rescoped to session-restore reuse
  (Steps 3/4 amended). Master FID-007 Loop 2 records the Manifest Sync.
- **AUDIT impact:** the pending Loop 1 AUDIT now audits the AMENDED spec above; no Loop 1 entry is
  rewritten.

### Missed Questions

> Surfaced during the Loop 1 GREEN pass; each answered with the most robust
> default derivable from inspection.

1. Which binary and subcommand host the gateway? Decision: a new
   `savant-code server` subcommand; the real bin name is `savant-code`
   (cli/package.json:5-7, cli/src/cli-args.ts:102), not `savant`.
2. New event vocabulary or extend the shipped one? Decision: extend the
   existing `PrintModeEvent` zod family (`common/src/types/print-mode.ts`);
   only ApprovalRequest and FidQueueUpdate are genuinely new (Law 7/13).
3. How does the gateway relate to `--print`/`--auto`? Decision: a third,
   long-running headless mode sharing the existing plumbing
   (cli/src/cli-args.ts, cli/src/headless-run.ts) — not a duplicate.
4. How does the sidecar shut down on Windows without SIGTERM? Decision: the
   stdin-close watchdog is the primary cross-platform shutdown path.
5. Token lifecycle? Decision: per-launch high-entropy token via argv/env,
   fail-closed; rotation/reconnect auth is deferred to the implementation
   loop with a fail-closed default. (Amended Loop 2, 2026-08-21: delivery
   is ENV-ONLY — `SAVANT_GATEWAY_TOKEN`; argv rejected due to
   process-listing exposure. Rotation/reconnect auth remains deferred,
   fail-closed.)
6. Who may connect to the gateway? Decision: bearer token (constant-time
   compare) PLUS Origin/Host allowlist validation on every upgrade
   (`tauri://localhost` / `http://tauri.localhost` / dev origin), enforced
   server-side — WebView engines cannot be trusted to block DNS rebinding
   (2026-08-21 review fold-in).
7. One session or many per sidecar? Decision: single-session-per-sidecar
   frozen for v1; multi-session would be a breaking handshake revision
   (2026-08-21 review fold-in).
8. What happens to a pending approval on disconnect/shutdown? Decision:
   survives reconnect via state-sync; gateway shutdown resolves it
   fail-closed (deny + recorded) (2026-08-21 review fold-in).

### Code Verification Evidence

Planning-stage record — status `created`: no implementation exists yet.

- RED facts verified against the working tree 2026-08-20: the real bin is
  `savant-code` (cli/package.json:5-7) and no `server` subcommand exists;
  `--print` (cli-args.ts:148) and `--auto` (cli-args.ts:128) exist with
  `runHeadlessPrint` in cli/src/headless-run.ts; the `PrintModeEvent` family
  ships 13 printMode* schemas (common/src/types/print-mode.ts); the SDK-event
  serialization reference exists (cli/src/utils/sdk-event-handlers.ts);
  `Bun.serve` WebSocket usage is test-only.
- 2026-08-21 review fold-in: the handshake-contract freeze, env-only token,
  Origin allowlist, session model, approval lifecycle, and reconnect
  rescoping are PLANNING decisions — no implementation exists yet; the
  gate-output note below is unchanged.
- Gate output: none yet — the typecheck and integration-test evidence in the
  Verification section becomes mandatory at the implementation AUDIT.

## Step Status

- [ ] Zod event/action schemas defined (extend PrintModeEvent family)
- [ ] WS server with auth + Origin validation + watchdog
- [ ] Agent-runtime JSON-RPC wrapper (frozen handshake contract)
- [ ] Backpressure batching + reconnect recovery (session-restore reuse)
- [ ] `savant-code server` headless entrypoint
- [ ] Integration tests passing

## Resolution

Not closed. Planning converged through Loop 1 GREEN plus the Loop 2 review
fold-in (missed questions answered, corrections applied); Loop 1 AUDIT and
ADVERSARIAL remain open, and implementation must not start until the master
FID-2026-0820-007 Commit Gate clears (design doc + five suite FIDs committed
to main). This section records the closed date, fix description, tests
added, and verification evidence when the phase closes.
