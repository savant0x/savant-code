# FID: Gateway reconnect event replay (audit D6)

**Filename:** `FID-2026-1003-002-gateway-reconnect-event-replay.md`
**ID:** FID-2026-1003-002
**Severity:** low
**Status:** verified
**Created:** 2026-10-03
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

T113 audit finding D6: event batches flushed while no websocket socket is
connected are dropped, and a reconnecting desktop client has no way to
reconstruct what it missed (tokens, tool activity, cost — and since
FID-2026-1002-008, even `run_complete` can be missed with D3's containment
delivering it only to connected sockets). This FID implements the additive,
non-breaking replay shape.

## Environment

- **OS:** Windows (session), Bun 1.3.14
- **Language/Runtime:** TypeScript strict monorepo
- **Tool Versions:** Bun 1.3.14
- **Commit/State:** working tree, HEAD `997ce946` + uncommitted October
  work; no commit authorized (G2)

## Detailed Description

### Problem

`cli/src/server/gateway/state.ts` — `flushEvents` swaps the buffer and sends
to `connectedSockets`, a possibly-empty set; the same is true of
`fid-events.ts` `emitFidChanges` (FID-queue updates) and the post-hello
snapshot. A client that disconnects mid-run loses every batch flushed during
the disconnect window. The loss was accepted by design in v1
(`gateway.ts:20-24` "live full-resync ... explicitly OUT of v1 scope"), with
reconnect continuation only via `previousRun` on the next `user_message`.

### Expected Behavior

A reconnecting renderer recovers the batches it missed, in order, through
its existing event pipeline — without any breaking wire change: live
`event` notifications stay bare `PrintModeEvent[]` arrays, the envelope
shape and error codes are untouched, and `GATEWAY_PROTOCOL_VERSION` stays 1.

### Root Cause

The transport is fire-and-forget: nothing buffers what a disconnected
consumer missed, and nothing tells a reconnecting consumer where it stands.

### Evidence

Source-confirmed in the T113 audit (finding D6,
`dev/session-summaries/2026-10-02-full-data-flow-audit.md:250-263`).
Drift-guard scope verified by reading
`desktop/scripts/gateway-contract.drift.test.ts`: it pins the reserved
error codes and `GATEWAY_PROTOCOL_VERSION = 1` only — NOT the capability
list — so an additive capability + method is inside the documented
extension path (`json-rpc.ts`: "extends as the gateway grows").

## Impact Assessment

### Affected Components

- `cli/src/server/gateway/state.ts` (seq-stamped batch emission + buffer)
- `cli/src/server/gateway/replay-rpc.ts` (new — replay_events handler)
- `cli/src/server/gateway/handshake-rpc.ts` (dispatch case, hello eventSeq)
- `cli/src/server/gateway/fid-events.ts` (FID batches ride the seq'd path)
- `cli/src/server/json-rpc.ts` (capability)
- `desktop/src/lib/gateway-protocol.ts` + `gateway-protocol-inbound.ts`
  (request builder, result schema, hello eventSeq)
- `desktop/src/lib/gateway-client-connection.ts` (cursor + reconnect replay)
- `desktop/src/lib/gateway-client.ts` (onReplayGap surface)
- Tests: `cli/src/server/__tests__/gateway-replay.test.ts` (new),
  `desktop/src/lib/__tests__/gateway-client-replay.test.ts` (new)

### Risk Level

- [x] Low: the live wire format is unchanged; new surfaces are additive
  (capability, method, optional hello field); old clients ignore all three.

## Proposed Solution

### Approach

1. Server: every event batch flows through ONE seq-stamped emission
   primitive in `state.ts` — `emitEventBatch(ctx, events)` assigns a
   monotonic `batchSeq`, appends `{seq, events}` to a bounded replay
   buffer (cap 1,000 batches ≈ 50 s of flush ticks), and sends the
   unchanged `event` notification to connected sockets. `flushEvents`,
   `emitFidChanges`, and the hello FID snapshot all route through it —
   closing the same loss class for FID updates.
2. Server: new `replay_events` method (capability `'replay_events'`) —
   params `{ since: number }` (validated, else invalidRequest); the
   response is `{ batches: Array<{seq, events}>, earliestSeq, latestSeq,
   gapped }`. `gapped` is true when `since` predates the buffer's oldest
   surviving seq (the audit's "you missed N events" signal). The handler
   is synchronous, so the response snapshot is exact, and the response
   shares the client's single ordered socket — it is guaranteed to arrive
   before any batch flushed after it (no duplication, no races).
3. Hello result gains an additive `eventSeq` field (the batch counter at
   hello time). Old renderers ignore it; the desktop schema gets it as
   optional.
4. Renderer: `GatewayConnectionController` tracks a cursor — set from
   `eventSeq` on the first hello, incremented per live batch received;
   on a reconnect hello, if the server advertises `replay_events` and its
   `eventSeq` is ahead of the cursor, it fires `replay_events
   {since: cursor}` and feeds the recovered batches through the existing
   `emitEvents` seam (zero changes in `use-gateway`/`App`). A `gapped`
   response or a replay failure surfaces through a new `onReplayGap`
   listener on `GatewayClient`.

### Steps

1. `state.ts`: `REPLAY_BUFFER_CAP`, `ReplayedBatch`, `ctx.batchSeq`,
   `ctx.replayBuffer`, `emitEventBatch`; rewire `flushEvents`.
2. `fid-events.ts` + facade: `emitFidChanges(ctx)` via `emitEventBatch`;
   hello snapshot via `emitEventBatch`.
3. `json-rpc.ts`: capability; `handshake-rpc.ts`: hello `eventSeq` +
   dispatch case; new `replay-rpc.ts` handler.
4. Desktop mirror: `replayEventsRequest`, `replayResultSchema`,
   `helloResultSchema.eventSeq`; connection-controller cursor + replay;
   `GatewayClient.onReplayGap`.
5. Tests: cli replay suite (5 tests), desktop client replay suite;
   family + drift suites stay green.
6. Gates: cli + desktop typecheck, the new suites, the gateway family,
   the drift guard, quality; stamp receipt.

### Verification

The cli suite proves the wire contract end-to-end over a real WebSocket:
batches flushed during a disconnect are replayed in seq order to a
reconnecting client; the gapped case reports honestly; the hello result
carries `eventSeq`; live frames are unchanged arrays. The desktop suite
proves the client fires the replay with the right cursor on reconnect and
applies recovered batches through `onEvents`.

## Verification Gates

- gate: typecheck cli
- gate: typecheck desktop
- gate: test cli/src/server/__tests__/gateway-replay.test.ts
- gate: test cli/src/server/__tests__/gateway-handshake.test.ts
- gate: test cli/src/server/__tests__/gateway-user-message.test.ts
- gate: test desktop/src/lib/__tests__/gateway-client-replay.test.ts
- gate: test desktop/scripts/gateway-contract.drift.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:40805c3970e798b704d62a637f8d8af62ea45fba2718302b8869b16664fd77e8
- verified: 2026-10-03T06:11:43.616Z
- typecheck cli: exit 0
- typecheck desktop: exit 0
- test cli/src/server/__tests__/gateway-replay.test.ts: exit 0
- test cli/src/server/__tests__/gateway-handshake.test.ts: exit 0
- test cli/src/server/__tests__/gateway-user-message.test.ts: exit 0
- test desktop/src/lib/__tests__/gateway-client-replay.test.ts: exit 0
- test desktop/scripts/gateway-contract.drift.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Audit finding D6 with file:line evidence; the loss window is reproduced by
reading `flushEvents` (sends to a possibly-empty set) and confirmed for the
FID-update path (`emitFidChanges` has the identical shape).

### GREEN

Additive-only: capability list extension (documented path), new method,
optional hello field, no envelope/error-code/version change. The seq lives
in the SERVER's batch counter and the replay RESPONSE — never on live
frames — so the shared `PrintModeEvent` vocabulary (Law 13) is untouched.

### AUDIT

Ordering/duplication: the replay handler is synchronous (snapshot exact)
and the response shares the client's ordered socket, so a reconnecting
client receives response batches strictly before any batch flushed after
the snapshot — cursor arithmetic is exact, no duplicates. Buffer cap: 1,000
batches ≈ 50 s at the 50 ms flush tick; beyond the cap `gapped` reports
honestly instead of pretending. Fresh renderer: first hello sets the cursor
baseline from `eventSeq` — no replay (nothing before its existence is
owed). Sidecar restart: new counter < stale client cursor → re-baseline,
no replay (state is gone regardless).

### Missed Questions

1. Why not put the seq on live event frames? It would change the `event`
   params shape — breaking under the frozen contract (major-version bump,
   renderer + mirror + handshake churn). The response-carried cursor gives
   the same guarantee additively because of single-socket ordering.
2. Why count FID batches in the same seq space? Any uncounted `event`
   notification (hello snapshot, FID updates) would desync the client's
   batch count from the server counter — one seq space for every event
   frame is the invariant that makes cursor arithmetic exact.
3. What does a `gapped` response mean for the renderer? Some batches are
   unrecoverable (disconnect longer than the buffer window). v1 surfaces
   it via `onReplayGap`; UI affordances (a "reconnecting — some output
   lost" badge) are renderer work, not a wire concern.
4. Does replay replay `run_complete`? Buffered batches may include one;
   applying it through `emitEvents`... the controller routes
   `run_complete` frames to `emitRunComplete` when received live. Replay
   batches go through `emitEvents` — a replayed `run_complete` inside a
   batch would surface as a text/print event, not the terminal frame.
   Accepted: the terminal-frame miss is D3's containment scope
   (best-effort send), and the run lifecycle state is recovered via
   `previousRun`/`continueId` on the next message.
5. Multi-socket? The gateway is single-session v1; the cursor lives on the
   connection controller (one logical client). A second socket would be a
   zombie; the contract already assumes one consumer.

### Convergence

Design grounded in state.ts, fid-events.ts, handshake-rpc.ts, the drift
guard, and the desktop client stack. Additive-only, race-free by socket
ordering. Ready for implementation at level 3.

## Implementation Evidence

### Code Verification Evidence

- `cli/src/server/gateway/state.ts` — `REPLAY_BUFFER_CAP = 1_000` (:27);
  `GatewayContext.batchSeq` / `.replayBuffer` (:79, :82, initialized
  :118-119); `emitEventBatch(ctx, events)` (:133-141) assigns the
  monotonic seq, appends `{seq, events}` to the bounded buffer, shifts
  past the cap, and sends the UNCHANGED bare-array `event` notification.
  `flushEvents` routes through it.
- `cli/src/server/gateway/replay-rpc.ts` (new, 43 lines) —
  `handleReplayEvents` (:16): validates `since` (invalidRequest
  otherwise), snapshots the buffer synchronously, `gapped =
  since < latestSeq && (earliestSeq === null || since < earliestSeq - 1)`
  (:40-41), responds `{ batches, earliestSeq, latestSeq, gapped }` (:42).
- `cli/src/server/gateway/handshake-rpc.ts` — hello result gains
  additive `eventSeq: ctx.batchSeq` (:89); dispatch case `replay_events`
  (:229-233); the post-hello FID snapshot emits via `emitEventBatch`.
- `cli/src/server/gateway/fid-events.ts` — `emitFidChanges(ctx)` now
  routes changed-FID batches through `emitEventBatch` (:128), so FID
  updates share the one seq space.
- `cli/src/server/json-rpc.ts` — capability `'replay_events'` appended
  (:111).
- Desktop: `gateway-protocol-inbound.ts` helloResultSchema gains optional
  `eventSeq`; `gateway-protocol.ts` adds `replayEventsRequest` /
  `replayResultSchema`; `gateway-client-connection.ts` — `eventCursor`
  (:58, null until first hello), `trackEventCursor` (:145-166: first
  hello baselines from `eventSeq`; reconnect with `replay_events`
  capability + `eventSeq > cursor` fires `replayMissed`), `replayMissed`
  (:169-196: feeds recovered batches through the existing `emitEvents`
  seam, advances cursor to `latestSeq`, surfaces gaps), live-batch
  cursor increment (:208); `gateway-client.ts` — `onReplayGap` listener
  surface (:111, :151).
- Tests: `cli/src/server/__tests__/gateway-replay.test.ts` (new, 4
  tests, 27 asserts over a real WebSocket via the harness — no module
  mocking): disconnected batches replayed in seq order with the run held
  behind a gate; FID snapshot rides the seq space and is replayable;
  `replay_events` validation + honest gap reporting; single seq space,
  no seq leak onto the wire, buffer bounded. 4 pass / 0 fail.
  `desktop/src/lib/__tests__/gateway-client-replay.test.ts` (new, 4
  tests via the fake-transport DI): baseline + reconnect cursor math
  (5→6→replay since 6→cursor 8); gapped replay recovers what it can and
  surfaces `onReplayGap`; old sidecar without `eventSeq` keeps v1
  behavior; failed replay surfaces a gap and the client stays ready.
  4 pass / 0 fail.

### Gate Receipts

- cli typecheck: exit 0. desktop typecheck: exit 0.
- cli server suite (13 files incl. gateway-handshake +
  gateway-user-message): 51 pass / 0 fail.
- desktop full suite (68 files incl. drift guard): 425 pass / 0 fail;
  drift guard 2 pass / 0 fail (error codes + version pinned; additive
  capability inside the documented extension path).
- ESLint zero warnings on all 13 touched files; prettier clean;
  quality-report PASS (1498 baselined files); line ceiling: largest
  authored file 296 lines.

### Step Status

- [x] Step 1 — `state.ts` seq'd emission + bounded buffer:
      implemented (:27, :79-82, :118-119, :133-141).
- [x] Step 2 — FID batches + snapshot through `emitEventBatch`:
      implemented (fid-events.ts:128; handshake-rpc snapshot).
- [x] Step 3 — capability + dispatch case + `replay-rpc.ts`:
      implemented (json-rpc.ts:111; handshake-rpc.ts:89, :229-233;
      replay-rpc.ts:16-42).
- [x] Step 4 — desktop mirror + cursor + `onReplayGap`: implemented
      (gateway-client-connection.ts:58, :145-196, :208;
      gateway-client.ts:111, :151).
- [x] Step 5 — test suites: implemented (cli 4/4, desktop 4/4; family
      + drift suites green).
- [x] Step 6 — gates + receipt: implemented (stamped below).

## Resolution

- **Fix Description:** the reconnect event-loss window is closed
  additively: every `event` frame flows through one seq-stamped emission
  primitive with a bounded replay buffer; `replay_events {since}` +
  additive hello `eventSeq` + `'replay_events'` capability let a
  reconnecting desktop client recover missed batches in order through
  its existing event pipeline. Live wire format, envelope, error codes,
  and `GATEWAY_PROTOCOL_VERSION` unchanged.
- **Tests Added:** Yes — `gateway-replay.test.ts` (cli, 4 tests) and
  `gateway-client-replay.test.ts` (desktop, 4 tests), both through DI
  seams (harness / fake transport), no module mocking.
- **Verification Evidence:** cli typecheck exit 0; desktop typecheck
  exit 0; cli replay 4/4 + server family 51/0; desktop replay 4/4 +
  full desktop 425/0 + drift 2/0; ESLint zero warnings; quality PASS;
  receipt stamped by the project verifier.
- **Commit SHA:** pending — commit authority is operator-owned (G2);
  no commit made.

## Lessons Learned

PENDING — filled at closure.
