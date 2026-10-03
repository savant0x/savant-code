# FID: Gateway approvals survive disconnects; flush timer self-stops

**Filename:** `FID-2026-1002-007-gateway-approval-survival-flush-timer.md`
**ID:** FID-2026-1002-007
**Severity:** low
**Status:** verified
**Created:** 2026-10-02
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Two gateway hygiene defects from the T113 audit: (D4) the documented
approval contract — approvals survive a socket disconnect — is contradicted
by the implementation, which denies every pending approval on ANY socket
close with no re-approve path; (D5) the 50 ms event flush timer, once
armed, runs for the life of the process even when the buffer is empty.

## Environment

- **OS:** Windows (audit session), Bun 1.3.14
- **Language/Runtime:** TypeScript strict monorepo
- **Tool Versions:** Bun 1.3.14
- **Commit/State:** working tree, HEAD `997ce946` + uncommitted October 2
  work; no commit authorized (G2)

## Detailed Description

### Problem

1. `cli/src/server/gateway.ts:186-193` — the websocket `close` handler
   calls `denyPendingApprovals(ctx)`, resolving any pending ask_user as
   skipped. `state.ts:78-80` and the `gateway.ts:20-23` header document
   the opposite contract ("survive a socket disconnect/reconnect"), and
   "the desktop can re-approve after reconnect" names a flow that has no
   implementation.
2. `state.ts:106-109` — `ensureFlushTimer` starts a `setInterval` that
   nothing self-stops; only the facade `stop()` clears it. An idle sidecar
   wakes every 50 ms forever after its first event.

### Expected Behavior

1. A pending approval survives a socket disconnect; the reconnecting client
   re-authenticates (hello) and resolves it via `approval_response`.
   Fail-closed is preserved where it matters: leftover approvals are denied
   when the OWNING RUN settles (the run-scoped finally) and at gateway
   shutdown — the two points where an approval can never be answered
   anymore.
2. The flush timer exists only to drain the buffer; it self-stops when the
   buffer is empty and re-arms on the next push.

### Root Cause

The deny-on-close behavior was a v1 shortcut that the documentation never
caught up with (and the documented contract was never implemented). The
perpetual timer is a missing self-clear in the batching primitive.

### Evidence

Source-confirmed in the T113 audit (findings D4/D5,
`dev/session-summaries/2026-10-02-full-data-flow-audit.md`): comment and
implementation quoted at `state.ts:78-80` vs `gateway.ts:186-193`; the
timer lifecycle traced from `ensureFlushTimer` to the facade `stop()`. The
reconnect suite (`gateway-interrupt-reconnect.test.ts`) pins no
deny-on-close behavior; only `gateway-approvals.test.ts` test 2 pins it.

## Impact Assessment

### Affected Components

- `cli/src/server/gateway.ts` (close handler, header comment)
- `cli/src/server/gateway/state.ts` (flush lifecycle, comments)
- `cli/src/server/gateway/run-lifecycle.ts` (run-scoped approval cleanup)
- `cli/src/server/__tests__/gateway-approvals.test.ts` (contract re-pin)

### Risk Level

- [x] Low: mid-approval disconnects are the trigger; the fail-closed
  guarantees move to tighter lifecycle points (run settle, shutdown), and
  every approval_response still requires an authenticated hello.

## Proposed Solution

### Approach

Implement the documented contract instead of weakening the documentation:
drop the deny from the socket-close handler, deny leftovers in the owning
run's finally (and keep the shutdown deny), and self-stop the flush timer
when the buffer drains. Authorization is unaffected — a reconnected client
must re-hello with the bearer token before any RPC.

### Steps

1. `gateway.ts` close handler: remove `denyPendingApprovals(ctx)`; comment
   states the survival contract and the two remaining deny points.
2. `run-lifecycle.ts`: call `denyPendingApprovals(ctx)` in the `finally` of
   both `handleUserMessage` and `injectTriggerRun` — a settled run must
   never leave a dangling approval (empty map = no-op on the normal path).
3. `state.ts`: `flushEvents` clears the timer unconditionally (re-arm on
   next push via the unchanged `ensureFlushTimer`); update the
   `pendingApprovals` and `denyPendingApprovals` comments to the
   implemented truth.
4. Re-pin `gateway-approvals.test.ts`: survival across disconnect +
   reconnect resolution; run-settle deny with the socket still open;
   shutdown deny. Add `gateway-flush-lifecycle.test.ts` for the timer
   lifecycle (self-stop on drain, re-arm on push, empty-flush drop).

### Verification

The re-pinned approval suite proves the new contract end-to-end through a
real WebSocket; the flush-lifecycle suite pins the timer states
directly. Declared gates below.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/server/__tests__/gateway-approvals.test.ts
- gate: test cli/src/server/__tests__/gateway-flush-lifecycle.test.ts
- gate: test cli/src/server/__tests__/gateway-interrupt-reconnect.test.ts
- gate: test cli/src/server/__tests__/gateway-user-message.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:29c2c84692e90f0623d5718338e56490fc5563ad240c9696259c341034dd047a
- verified: 2026-10-03T03:14:38.600Z
- typecheck cli: exit 0
- test cli/src/server/__tests__/gateway-approvals.test.ts: exit 0
- test cli/src/server/__tests__/gateway-flush-lifecycle.test.ts: exit 0
- test cli/src/server/__tests__/gateway-interrupt-reconnect.test.ts: exit 0
- test cli/src/server/__tests__/gateway-user-message.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Audit findings D4/D5 with file:line evidence; the contract drift is pinned
by the contradiction between `state.ts:78-80` and `gateway.ts:186-193`; the
timer lifecycle by the absence of any self-clear.

### GREEN

Survival is implemented with a tighter fail-closed lifecycle rather than a
documentation rollback: approval lifetime == owning-run lifetime ∪ gateway
lifetime. The bridge remains single-pending, so at most one approval can
be outstanding; the map cleanup cannot strand a second approval.

### AUDIT

Auth is unaffected: `approval_response` requires a hello-authenticated
socket (`handshake-rpc.ts:104-110`), so a reconnecting client re-presents
the bearer token. The run-scoped finally cannot deny a legitimately
pending approval: when the run settles, the ask_user bridge promise can no
longer be delivered to any client that could answer it (the tool result is
already fixed by the run's outcome), so deny IS the correct terminal state.

### Missed Questions

1. Can an approval outlive its run and still be answered? No — the run's
   tool handler awaits the bridge promise; once the run settles (completed,
   failed, aborted), that tool call's outcome is fixed. A surviving approval
   with no run would be a phantom the client could "resolve" with no effect.
2. Does dropping deny-on-close wedge the single session? No — the client
   can always `interrupt_stream`; the abort resolves the abort-aware
   client-tool bridge, the run settles, and the finally denies leftovers.
3. Does the desktop renderer rely on deny-on-close today? The renderer
   re-requests pending state via the normal event stream; no desktop-side
   code inspects approval denial-on-close (grep: `pendingApprovals` appears
   only in the gateway server tree and its tests).
4. Is a second approval possible while one is pending? The bridge is
   single-pending (`ask-user-bridge.ts`: one `pendingRequest`); a second
   request overwrites `pendingRequest` — the gateway's map may then hold a
   stale approvalId whose bridge entry was replaced. Run-settle cleanup
   denies the whole map, bounding the staleness to the run's lifetime;
   the resolve path keys on the map entry, so a stale id simply fails
   `Unknown approvalId` — fail-closed.

### Convergence

Plan grounded in the implementing modules and the harness. Ready for
implementation at level 3.

## Implementation Evidence

### Code Verification Evidence

- `cli/src/server/gateway.ts:191-197` — the socket `close` handler no
  longer denies pending approvals; its comment now states the survival
  contract and the two remaining deny points. The header comment above
  `Bun.serve` still documents survival; now the code agrees.
- `cli/src/server/gateway/run-lifecycle.ts:99-106` (`handleUserMessage`
  finally) and `:169-172` (`injectTriggerRun` finally) — leftover approvals
  are denied fail-closed when the owning run settles; the `state.ts`
  import was extended with `denyPendingApprovals` (`:12-18`).
- `cli/src/server/gateway/state.ts:82-89` — `pendingApprovals` comment
  documents the implemented contract; `:120-131` —
  `selfStopFlushTimer` added; `:133-152` — `flushEvents` clears the timer
  on every flush (empty buffer → self-stop; non-empty → drain + stop, with
  the next `pushEvent` + `ensureFlushTimer` re-arming); `:156-163` —
  `denyPendingApprovals` comment names the run-settle/shutdown owners.
- Tests: `gateway-approvals.test.ts` re-pinned — the deny-on-close test is
  replaced by a survival test (disconnect mid-approval, bridge promise
  unresolved after 60 ms, fresh socket re-hello, original approvalId
  resolves) and a run-settle deny test (fake run settles with the socket
  open → skipped). `gateway-flush-lifecycle.test.ts` is new (5 tests: arm
  on push, self-stop on drain, no resurrect after drain, re-arm after
  drain, single JSON-RPC batch frame). Gateway family: 41 pass / 0 fail
  across 11 files.

### Step Status

- [x] Step 1 — close handler survival: implemented (`gateway.ts:191-197`).
- [x] Step 2 — run-settle deny: implemented (`run-lifecycle.ts` finally ×2).
- [x] Step 3 — flush self-stop + comment truthing: implemented
      (`state.ts:82-89, 120-163`).
- [x] Step 4 — re-pinned/new tests: implemented
      (`gateway-approvals.test.ts`, `gateway-flush-lifecycle.test.ts`).

## Resolution

- **Fix Description:** the documented approval-survival contract is now
  implemented (deny moved to run-settle + shutdown); the flush timer
  self-stops when the buffer drains and re-arms on push.
- **Tests Added:** Yes — approval survival + run-settle deny re-pins and a
  new flush-lifecycle suite.
- **Verification Evidence:** cli typecheck exit 0; gateway family 41/0;
  approvals 3/0; flush-lifecycle 5/0; quality gate 0; receipt stamped by
  the project verifier.
- **Commit SHA:** pending — commit authority is operator-owned (G2); no
  commit made.
