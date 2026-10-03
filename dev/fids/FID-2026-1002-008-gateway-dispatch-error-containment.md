# FID: Gateway dispatch error containment (audit D3)

**Filename:** `FID-2026-1002-008-gateway-dispatch-error-containment.md`
**ID:** FID-2026-1002-008
**Severity:** medium
**Status:** verified
**Created:** 2026-10-02
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

T113 audit finding D3: the desktop gateway's RPC dispatch has no error
containment. A handler throw escapes into Bun's websocket message callback
(uncaught exception, process-teardown class on the sidecar), and the
`void`-ed async `user_message` handler turns any rejection into an unhandled
promise rejection — including the pre-try `loadMostRecentChatState` read and
the acceptance `send`, which sit outside the try that guards the run itself.

## Environment

- **OS:** Windows (audit session), Bun 1.3.14
- **Language/Runtime:** TypeScript strict monorepo
- **Tool Versions:** Bun 1.3.14
- **Commit/State:** working tree, HEAD `997ce946` + uncommitted October 2
  work; no commit authorized (G2)

## Detailed Description

### Problem

1. `cli/src/server/gateway/handshake-rpc.ts:115` dispatches `user_message`
   as `void handleUserMessage(...)`; a rejection inside the async handler
   escapes as an unhandled promise rejection.
2. `handleUserMessage` (`run-lifecycle.ts`) guards only the run itself with
   try/catch — the continueId `loadMostRecentChatState` read and the
   acceptance `send` sit outside it; a throw there rejects the `void`-ed
   promise.
3. The websocket `message` handler (`gateway.ts`) wraps only `JSON.parse`;
   the dispatch call itself is unguarded, so a synchronous handler throw
   escapes into Bun's websocket handler. The only dispatch targets without
   internal try/catch are `handleTriggersSetEnabled` and
   `handleTriggersDelete` (`triggers-rpc.ts`) — their siblings (scoped
   threads, triggers_list/create/set_recurrence) already contain themselves.
4. `handleHello` sends the post-hello FID snapshot from a detached
   `setTimeout(0)` — a throw in the timer callback is an uncaught exception.

### Expected Behavior

No frame, handler, or timer failure may escape the transport boundary. A
failing handler answers its request with a JSON-RPC error frame or the
terminal `run_complete {ok:false}` notification, using only the frozen v1
vocabulary (`internalError: -32603` is already reserved in `json-rpc.ts`
and mirrored by the drift-guarded `desktop/src/lib/gateway-protocol.ts` —
no wire-contract change, no protocolVersion bump).

### Root Cause

Error containment was applied per-handler where each was written (scoped
threads, most trigger handlers) but never enforced at the dispatch boundary,
and the async run handler's pre-run path predates its try block.

### Evidence

Source-confirmed in the T113 audit (finding D3,
`dev/session-summaries/2026-10-02-full-data-flow-audit.md:185-212`):
`handshake-rpc.ts:115` (`void handleUserMessage`), `gateway.ts:159-167`
(message handler), `run-lifecycle.ts:24/:37` (pre-try statements),
`handshake-rpc.ts:69-77` (detached setTimeout). No fault-injection run was
executed in the audit; this FID adds it. Test-strategy constraint verified
by reading: `loadMostRecentChatState` is fully self-catching (returns null
on any error, `run-state-storage/load.ts`) and `loadFidInventory` is Law-14
never-throws (`fid-loader.ts`), so those two paths have no natural fault —
their containment is pinned by direct handler units through DI seams
(`send`, `bus`) instead of module mocking.

## Impact Assessment

### Affected Components

- `cli/src/server/gateway/handshake-rpc.ts` (dispatch boundary, hello timer)
- `cli/src/server/gateway/run-lifecycle.ts` (user_message containment)
- `cli/src/server/gateway.ts` (transport backstop)
- `cli/src/server/gateway/rpc-containment.ts` (new — containment helpers)
- `cli/src/server/__tests__/gateway-dispatch-containment.test.ts` (new)

### Risk Level

- [x] Medium: an uncaught exception in the sidecar's websocket handler can
  tear down the process; a `void`-ed rejection wedges the desktop client on
  a dead run until its own reconnect, and a failed acceptance send wedges
  the single session busy.

## Proposed Solution

### Approach

Contain at every layer with the existing frozen vocabulary:

1. `handshake-rpc.ts`: the dispatch body runs inside a containment wrapper
   (`rpc-containment.ts` → `containDispatch`) — a handler throw becomes
   `failure(id, internalError, 'Gateway handler failed: …')` carrying the
   request id (null when the frame carried none); the `void`-ed
   `handleUserMessage` call gains a rejection backstop
   (`runMessageContained`) emitting `run_complete {ok:false}`; the hello
   `setTimeout` callback is contained and logged.
2. `run-lifecycle.ts` `handleUserMessage`: outer try/catch around the whole
   body with phase flags — pre-acceptance throws answer the still-open
   request with `failure(id, internalError)` and clear the session's
   `activeRun` (only when this handler owns it); post-acceptance throws emit
   the terminal `run_complete {ok:false}` (suppressed when a terminal frame
   already went out). Every containment send is guarded (`safeSend`).
3. `injectTriggerRun`'s detached run IIFE: the run-settle
   `denyPendingApprovals` cleanup is contained (same class — a finally
   throw would escape the `void`-ed promise); uses the same contained-deny
   helper as `handleUserMessage`.
4. `gateway.ts`: outer try/catch backstop in the websocket `message`
   handler — nothing a frame does may escape into Bun's handler.
5. Fault-injection tests through the harness DI seams only (no module
   mocking): a throwing `triggerManager` exercises the dispatch boundary
   over a real WebSocket (`triggers_set_enabled` / `triggers_delete`, the
   two uncontained handlers); a rejecting `runPrompt` pins the
   post-acceptance path end-to-end plus session unwedging; direct handler
   units pin the two no-natural-fault seams (selective-throwing `send` →
   `-32603` failure frame; throwing `bus.collectFidUpdates` → hello still
   succeeds).

Ceiling note: the 300-line quality ceiling forces a mechanical
de-duplication in `handshake-rpc.ts` — the five repetitive
`requireTriggerManager` case blocks collapse through a shared
`withTriggerManager` guard (same file family, no behavior change).

### Steps

1. New `gateway/rpc-containment.ts`: `safeSend`, `containDispatch`,
   `runMessageContained`, `containUserMessageFailure`,
   `denyPendingApprovalsContained`, `withTriggerManager`.
2. `handshake-rpc.ts`: wire the dispatch wrapper, the user_message
   backstop, the hello-timer containment, and the trigger-guard collapse.
3. `run-lifecycle.ts`: restructure `handleUserMessage` with the outer
   containment catch (`accepted` / `terminalSent` / `ownsActiveRun` flags);
   swap both run-settle deny calls to the contained variant.
4. `gateway.ts`: backstop try/catch in the websocket `message` handler.
5. New `gateway-dispatch-containment.test.ts` (5 fault-injection tests).
6. Gates: cli typecheck + the gateway test family + quality; stamp receipt.

### Verification

The new suite pins each containment branch: dispatch catch (real socket,
natural DI fault, connection-survival follow-up), rejection backstop,
post-acceptance `run_complete {ok:false}` + session unwedge, pre-acceptance
`-32603` failure frame + unwedge, and hello-timer containment. Declared
gates below.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/server/__tests__/gateway-dispatch-containment.test.ts
- gate: test cli/src/server/__tests__/gateway-user-message.test.ts
- gate: test cli/src/server/__tests__/gateway-approvals.test.ts
- gate: test cli/src/server/__tests__/gateway-flush-lifecycle.test.ts
- gate: test cli/src/server/__tests__/gateway-interrupt-reconnect.test.ts
- gate: test cli/src/server/__tests__/gateway-handshake.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:391e680c09f60eefca01156330c65cb2e0acce6577ddc561b78aef16bc00576e
- verified: 2026-10-03T04:34:57.217Z
- typecheck cli: exit 0
- test cli/src/server/__tests__/gateway-dispatch-containment.test.ts: exit 0
- test cli/src/server/__tests__/gateway-user-message.test.ts: exit 0
- test cli/src/server/__tests__/gateway-approvals.test.ts: exit 0
- test cli/src/server/__tests__/gateway-flush-lifecycle.test.ts: exit 0
- test cli/src/server/__tests__/gateway-interrupt-reconnect.test.ts: exit 0
- test cli/src/server/__tests__/gateway-handshake.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Audit finding D3 with file:line evidence (see Detailed Description). The
fault surface was verified by reading: `handleTriggersSetEnabled` and
`handleTriggersDelete` are the only dispatch targets without internal
try/catch; `loadMostRecentChatState` and `loadFidInventory` self-catch, so
no natural fault exists on those paths.

### GREEN

Containment uses only the frozen vocabulary. Design refinement over the
audit sketch: a PRE-ACCEPTANCE `user_message` failure answers the
still-open request with `failure(id, internalError)` instead of a bare
`run_complete {ok:false}` — the desktop client's pending request resolves
either way, but a `run_complete` for a run that was never accepted could
mislead the renderer's run state machine, while a JSON-RPC failure for an
unanswered request is the contractually expected shape (identical to the
existing `sessionBusy` / `invalidRequest` handling). POST-ACCEPTANCE
failures keep `run_complete {ok:false}` — the accepted contract.

### AUDIT

Connection survival: after a contained failure the per-socket state
(`helloReceived` / `authed`) is untouched, so a follow-up request on the
same socket must succeed — pinned by the suite. The double-`run_complete`
hazard (a throw in the inner finally after a terminal frame was sent) is
suppressed by the `terminalSent` flag. The `runMessageContained` backstop
cannot double-emit: the handler's own containment resolves the promise. The
`ownsActiveRun` flag prevents the containment cleanup from clearing a
concurrent run's `activeRun` (busy-guard send fault).

### Missed Questions

1. Can the dispatch catch fire on the `hello` path and corrupt
   `helloReceived` / `authed`? `handleHello` sets `helloReceived` before
   assigning `authed`; if its send throws, `authed` stays false and the
   catch emits `failure(id, internalError)` — the client re-hellos. The
   flags only ever move toward authenticated; no corruption.
2. Is a synchronous `runPrompt` throw contained? Yes — the awaited call
   inside the inner try converts a sync throw into the inner catch →
   `run_complete {ok:false}` (pinned by the rejecting-runPrompt test).
3. Why a boundary catch instead of containing every handler? The contained
   handlers already do; the boundary is the single enforcement point that
   makes future handler regressions survivable — and the only place that
   can answer generically with the request id.
4. Does the `gateway.ts` backstop ever fire? Not while `containDispatch`
   guards the boundary (its containment send is guarded); it exists for the
   process-teardown class — Bun surfaces any escape as an uncaught
   exception.
5. Why is `denyPendingApprovals` contained in the run-settle finallys? A
   bridge fault there would escape the `void`-ed promises on BOTH run paths
   (user_message pre-D3; injectTriggerRun even post-D3, whose IIFE has no
   outer catch). The contained variant keeps the fail-closed deny, logs a
   bridge fault, and never rejects.

### Convergence

Design grounded in all four touched modules plus the harness; faults chosen
through natural DI seams only; line-count pressure resolved mechanically
(withTriggerManager de-duplication). Ready for implementation at level 3.

## Implementation Evidence

### Code Verification Evidence

- `cli/src/server/gateway/rpc-containment.ts` (new, 166 lines) — the
  containment module: `containDispatch` (:44, boundary catch → guarded
  `failure(id, internalError)` carrying the request id),
  `runMessageContained` (:76, the `void`-ed rejection backstop →
  `run_complete {ok:false}`), `containUserMessageFailure` (:97, the
  phase-flag frame picker), `denyPendingApprovalsContained` (:139,
  contained run-settle deny), `withTriggerManager` (:150, the
  ceiling-driven trigger-guard de-duplication), `safeSend` (:27,
  best-effort send).
- `cli/src/server/gateway/handshake-rpc.ts:90-101` — hello timer
  contained; `:190-200` — user_message fired via `runMessageContained`;
  `:228-252` — the five trigger cases collapsed onto
  `withTriggerManager`; `:267-283` — the contained `dispatch` boundary
  wrapping `dispatchFrame` (:121).
- `cli/src/server/gateway/run-lifecycle.ts:29-153` — `handleUserMessage`
  restructured: whole-body try, phase flags (`accepted` /
  `terminalSent`), acceptance-before-claim ordering (:88-95) so a dead
  acceptance send can never strand the session slot, outer catch →
  `containUserMessageFailure` (:141-153); run-settle deny contained in
  both finallys (:138, :209).
- `cli/src/server/gateway.ts:183-201` — websocket `message` transport
  backstop.
- Tests: `cli/src/server/__tests__/gateway-dispatch-containment.test.ts`
  (new, 5 fault-injection tests): dispatch catch over a real socket
  (throwing `triggerManager.setEnabled` / `.delete` — the two uncontained
  handlers) with a connection-survival follow-up request; rejecting
  `runPrompt` → acceptance + `run_complete {ok:false}` + session
  unwedge; selective-throwing `send` → `-32603` failure frame, never
  rejects, slot never wedged; throwing `bus.collectFidUpdates` → hello
  timer contained. Result: 5 pass / 0 fail. Gateway family
  (user-message, approvals, flush-lifecycle, interrupt-reconnect,
  handshake): 21 pass / 0 fail.

### Step Status

- [x] Step 1 — `rpc-containment.ts`: implemented (166 lines).
- [x] Step 2 — `handshake-rpc.ts` wiring: implemented (:90-101,
      :190-200, :228-252, :267-283).
- [x] Step 3 — `run-lifecycle.ts` restructure + contained deny:
      implemented (:29-153, :138, :209).
- [x] Step 4 — `gateway.ts` backstop: implemented (:183-201).
- [x] Step 5 — fault-injection suite: implemented (5 pass / 0 fail).
- [x] Step 6 — gates + receipt: implemented (stamped below).

## Resolution

- **Fix Description:** the gateway RPC boundary is fully contained —
  handler throws become `-32603` failures or terminal
  `run_complete {ok:false}` notifications on the frozen v1 vocabulary;
  the `void`-ed run handler and the hello timer cannot escape; the
  websocket transport has a backstop. No wire-contract change.
- **Tests Added:** Yes — `gateway-dispatch-containment.test.ts` (5
  fault-injection tests through harness DI seams, no module mocking).
- **Verification Evidence:** cli typecheck exit 0; containment suite 5
  pass / 0 fail; gateway family 21 pass / 0 fail; ESLint zero warnings;
  quality PASS; receipt stamped by the project verifier.
- **Commit SHA:** pending — commit authority is operator-owned (G2); no
  commit made.

## Lessons Learned

PENDING — filled at closure.
