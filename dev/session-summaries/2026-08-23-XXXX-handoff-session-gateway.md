# Handoff — Desktop Session Gateway (FID-2026-0820-008)

**Date:** 2026-08-23 (session interrupted by operator for continuation with another model/harness)
**Status at handoff:** Implementation of FID-2026-0820-008 is **substantially complete and green**, but
**NOT closed/archived**. The full-suite cli run was still in progress when the operator stopped the session;
the last confirmed full-suite result (before my final child-test timeout/race hardening) showed **4 fails / 1
error, all in the gateway suite** — and those were the exact failures being addressed when the session ended.
See the "Resume checklist" below.

## ⚠️ Operator action required to SEE / RUN the server

- The `server` subcommand is wired: `savant-code server --port=<ephemeral>` (or `savant-free`? — **NOT** on
  savant-free; it's on the full `savant-code` CLI only).
- **Credential contract (frozen v1):** port on argv, token **env-only** via `SAVANT_GATEWAY_TOKEN`. No token →
  fail-closed exit(2). Start it with:
  ```bash
  SAVANT_GATEWAY_TOKEN=<token> bun --cwd=cli src/server-command.ts --port=0
  # ready line (stdout) → GATEWAY_READY_MARKER: {"marker":"savant-gateway-ready","port":NNN,"protocolVersion":1,"capabilities":[...]}
  ```

## What shipped (new files)

| File | Purpose |
|---|---|
| `cli/src/server/json-rpc.ts` | Frozen v1 envelope: `GATEWAY_PROTOCOL_VERSION=1`, reserved error codes (-32001..-32004, -32600..-32603), capability list `[hello, user_message, approval_response, interrupt_stream, update_setting, event]`, `success/failure/notification` helpers, `isJsonRpcMessage` guard. FID-009's Rust supervisor programs against THIS surface. |
| `cli/src/server/auth.ts` | `safeTokenEqual` (SHA-256 + timingSafeEqual, fail-closed), `isAllowedOrigin` / `isAllowedHost` (loopback-only Host), `DEFAULT_GATEWAY_ALLOWED_ORIGINS` = `tauri://localhost`, `http://tauri.localhost`, `http(s)://localhost:1420`. |
| `cli/src/server/gateway.ts` | Core `startGateway(options) -> { port, stop }`: `Bun.serve` WS on loopback, Origin/Host validation at the upgrade (403 + -32002), hello handshake (first frame, -32003 on version mismatch / -32001 on bad token), single-session `user_message` (-32004 sessionBusy), approval lifecycle via `AskUserBridge` bridge, event-stream batching (~50ms, JSON-RPC `event` notification), `interrupt_stream`, `update_setting`, reconnect recovery via `previousRun`/`continueId`/in-process lastRunState. DI: `runPrompt` injectable for tests. |
| `cli/src/server-command.ts` | `savant-code server` entrypoint: `parseGatewayPort`, `installStdinWatchdog` (primary cross-platform shutdown — SIGTERM is POSIX-only), `runServerCommand` (fail-closed no-token, prints ready line). |
| `cli/src/server/__tests__/gateway.test.ts` | 21 integration tests over real WebSocket connections (see below). |

## What changed (existing files)

- `common/src/types/print-mode.ts` — **Step 1 complete**: added `printModeApprovalRequestSchema` (`approval_request`) +
  `printModeFidQueueUpdateSchema` (`fid_update`), both folded into the `PrintModeEvent` discriminated union (Law 13 —
  only genuinely-new members; every other design-doc event maps onto a shipped printMode* schema).
- `cli/src/cli-args.ts` — added `--port <number>` option + `port?: number` in `ParsedArgs`; added `server` to the
  help-text Commands list.
- `cli/src/cli-command-dispatch.ts` — added `isServerCommand` branch (handled **before** generic non-TTY routing so a
  sidecar spawned with piped stdin isn't mistaken for a headless prompt).

## Verified green (as of handoff)

- **Gateway integration suite: 21 pass / 0 fail** (`bun test src/server/__tests__/gateway.test.ts`) — hello handshake
  (valid/bad/missing token, wrong protocolVersion, non-hello-first, pre-auth method), Origin/Host rejection (mismatched,
  missing, allowed), user_message event stream + run_complete, sessionBusy, approval lifecycle (approval_response +
  fail-closed deny-on-close), interrupt_stream (aborts + no-run reject), reconnect recovery (previousRun precedence),
  parseGatewayPort, watchdog exit-on-stdin-close, fail-closed no-token, ready-line contract.
- **cli typecheck exit 0** · **eslint --max-warnings 0** on all touched files (server/*, server-command, cli-args,
  cli-command-dispatch, print-mode).
- **common + agent-runtime typecheck exit 0** (Step 1's print-mode extension compiles cleanly).
- **Security check:** loopback-only bind confirmed — no non-loopback hostname in server code.
- prettier clean on all touched files.

## ⚠️ Known open issue (the 4 fails in the full cli suite) — MUST re-verify

The last full-suite `bun test src/` that completed showed **4 fails / 1 error, all in the gateway suite**, and **only**
these, caused by two classes I was actively fixing when the session was interrupted:

1. **Origin-rejection probe used `fetch` → leaked `globalThis.fetch` mock from another suite** (mismatched/missing
   Origin tests).
   - **Already fixed** (untested-full-suite at handoff): switched the two probes to `node:http` (`probeUpgrade`
     helper, immune to fetch mocks). ✅ Gateway suite passes standalone with this fix.
2. **Child-spawn tests (watchdog exit + ready-line) timed out under full-suite parallel load** (a fresh `bun -e`
   process importing the full CLI chain is CPU-contended; boot exceeded the original 8s poll / 5s test timeout).
   - **Already hardened** (untested-full-suite at handoff): raised poll deadline to 25s, exit wait to 10s, test timeout
     to 60s; child now emits a `WATCHDOG_ARMED` stderr marker and the test polls for it instead of a fixed delay.

**BOTH fixes pass the gateway suite standalone and typecheck/eslint; the full-suite run was interrupted before it
could confirm them.** The FIRST ACTION for the next model is to re-run the full cli suite and confirm 0 fail.

```bash
cd /c/Users/spenc/dev/savant-code/cli && bun test src/  # target: 0 fail (was 4 fail / 1 error, all gateway)
```

## Resume checklist (to close FID-2026-0820-008)

1. **Re-run full cli suite** → confirm the 4 gateway fails are gone (origin probes via node:http, child tests via
   polled markers).
2. **Update the FID** `dev/fids/FID-2026-0820-008-desktop-session-gateway.md`:
   - Fill in the `## Resolution` section (close date, fix description, tests added, verification evidence).
   - Update `## Step Status`: mark the zod schemas / WS server / JSON-RPC wrapper / backpressure+reconnect /
     `savant-code server` entrypoint / integration-tests checkboxes `[x]`.
   - Record an Implementation/Closure record noting the ADAPTATION from original plan: the event stream flush emits
     a **JSON-RPC `event` notification wrapping a batch array**, not a bare array (keeps the wire clean JSON-RPC 2.0
     for the Rust supervisor); `update_setting` is a capability-listed no-op ack in v1.
3. **Move to archive** + update the ledger:
   ```bash
   mv "dev/fids/FID-2026-0820-008-desktop-session-gateway.md" "dev/fids/archive/"
   ```
   - Remove the `-0820-008` row from `dev/fids/README.md` active table (and any stale rows — verify active table ↔
     disk 1:1).
   - Add the closure to `dev/fids/archive/README.md`.
4. **Add a CHANGELOG entry** under `## 2026-08-23` (reverse-chron; match the repo's established style).
5. **Verify the ledger**: `bun -e "import { validateActiveFidLedger } from '<root>/common/...'"` (find the exact
   import used previously — `dev/fids/` validator) + `bun run lint:md` + prettier on touched docs.

## Next FID per the master plan

FID-2026-0820-008 (Session Gateway) was the **critical-path** desktop chain step for FID-009 (Tauri shell sidecar
supervisor). After closing -008, the next pending desktop-chain FIDs are:

- **`-0820-009` Tauri shell sidecar supervisor** — programs against THIS frozen handshake contract (uses
  `GATEWAY_PROTOCOL_VERSION`, the ready line, and the reserved error codes). Also implements the credential-injection
  format (port on argv, `SAVANT_GATEWAY_TOKEN` in child env) and the parent-death watchdog expectation.
- Then `-0820-010` Chat UI, deck fixtures `-012`, packaging `-011` (operator-gated), ratchet `-0819-005` (HOLD).

## Infra lessons (this session)

- **`bun -e` hates multi-line/leading-newline scripts on Windows** — a script string beginning with `\n` prints Bun's
  help and exits 0 (silent false-pass). Use single-line scripts; import source files by absolute path.
- **`bun test` runs with `cwd=cli/`** — `process.cwd()` is NOT the repo root. Resolve the repo root from the test
  file: `path.resolve(import.meta.dir, '..','..','..','..')` (file lives at `cli/src/server/__tests__/`).
- **`import.meta.dir` under bun test** resolves to the test file's dir, NOT the workspace root.
- **Other suites leak `globalThis.fetch` mocks** into the full-suite run — use `node:http` for any probe that must
  hit the real network (fetch mocks intercept even same-loopback requests).
- **Bun's `WebSocket` client** accepts a `{ headers: { origin } }` options object at runtime, but the DOM lib type
  only shows `string[]` → cast via `as unknown as string[]`.
- **bun:test `expect(x).toBe(number)`** where `x: number | null` fails overload resolution ("type '2' not assignable
  to 'null'") — use `expect(x === 2).toBe(true)` or a boolean form.
- **TS narrows `let exitCode` captured in a closure to `null`** — avoid `as number` casts afterward; compare booleans.
- **Event batches**: terminal notification (`run_complete`) is sent synchronously at run-settle while events flush on
  the ~50ms interval — tests need a `settleGraceMs` tail window in the frame collector (`collectFrames(socket, until,
  timeout, grace)`).
