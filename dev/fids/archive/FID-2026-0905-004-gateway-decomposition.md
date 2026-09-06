# FID: Gateway Decomposition — `cli/src/server/gateway.ts` (1,327 lines)

**Filename:** `FID-2026-0905-004-gateway-decomposition.md`
**ID:** FID-2026-0905-004
**Severity:** medium
**Status:** closed
**Created:** 2026-09-05 (session in progress)
**YAGNI-Compliance:** Verified

---

## Summary

`cli/src/server/gateway.ts` — the desktop session gateway (Bun-hosted
localhost WebSocket server exposing the agent runtime as JSON-RPC 2.0) — has
grown to **1,327 lines** (quality-report: 1,327 > absolute maximum 300, the
largest violation after `public-release.ts` and `office-scene.tsx`). It fuses
at least eight distinct responsibilities in one closure: the frozen v1 hello
handshake, the run lifecycle (user_message + trigger injection), the approval
fail-closed bridge, the FID-queue event watcher, event-stream batching,
trigger management RPC, scoped-thread RPC, and the `Bun.serve` transport
bridging. This is architectural debt with real review cost: every new desktop
capability lands in the same 1,300-line file. The file is the **4th of the 5
accepted-residue source monoliths** recorded in closed FID-2026-0819-005
(public-release and office-scene remain; native.ts resolved 2026-09-05 by
FID-2026-0905-001).

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun ≥ 1.3.11 (root pins 1.3.14)
- **Tool Versions:** workspace `cli` (`@savant-code/cli`)
- **Commit/State:** working tree, uncommitted (provider work from 2026-09-05
  sessions in tree; 771 changed paths) — measured on this live tree

## Detailed Description

### Problem

One 1,327-line module carries the entire gateway: transport, protocol,
security posture, run lifecycle, and three desktop-panel feature surfaces.
The closure inside `startGateway` (`gateway.ts:380`) owns all per-session
state, so every handler is a nested function — the file cannot be reviewed,
tested, or extended incrementally. New desktop features (triggers FID-2026-0824-005,
commands palette FID-2026-0901-005, scoped threads) each appended 100–200
lines here and will continue to.

### Expected Behavior

The gateway should decompose into single-responsibility stage modules — one
per concern — with `gateway.ts` remaining as a thin composition facade
(≤ 300 lines) whose **public export surface is byte-identical**
(`EVENT_FLUSH_INTERVAL_MS`, `GatewayOptions`, `GatewayTriggerManager`,
`GatewayCommandDescriptor`, `GatewayHandle`, `startGateway` — consumed by
`cli/src/server-command.ts:17` and all 9 test files through
`gateway-test-harness.ts`). The decomposition precedent is
FID-2026-0905-001 (native.ts 894 → 249): extract in dependency order behind
a pinned characterization suite, facade keeps the orchestration.

### Root Cause

Organic accretion: the gateway was authored as one closure (FID-2026-0820-008
Phase 1) and each subsequent desktop FID extended it in place instead of
introducing module seams. No baseline entry exists for the file (it predates
the ratchet), so `quality:report` flags it only against the absolute maximum.

### Evidence

```text
$ bun run quality:report
- cli/src/server/gateway.ts: 1327 lines exceeds absolute maximum 300

$ grep -n "^export \|^function \|^async function \|^type \|^  function \|^  async function \|^  const \|Bun.serve\|switch (method)" gateway.ts
  82: export const EVENT_FLUSH_INTERVAL_MS = 50
  84: export type GatewayOptions        135: GatewayTriggerManager
 157: GatewayCommandDescriptor         168: GatewayHandle
 196: denyPendingApprovals             204: defaultRunPrompt
 279: defaultUpdateScopedThreadState   302: TUI_ONLY_COMMAND_IDS
 319: defaultListCommands              336: ScopedThreadRecord
 380: export async function startGateway
 428: collectFidUpdates                455: emitFidChanges
 506: pushEvent / flushEvents / ensureFlushTimer (514/528)
 538: handleHello                      588: handleUserMessage
 685: injectTriggerRun                 734: handleApprovalResponse
 763: handleInterruptStream            782: handleUpdateSetting
 796: requireTriggerManager            812–1003: triggers_* handlers (×5)
1004: handleGetScopedThreads          1045: handleUpdateScopedThreadState
1087: dispatch  (1154: switch (method) — 13 methods)
1210: AskUserBridge.subscribe         1230: Bun.serve
1302: startFidWatcher / stop          1325: return handle

Call graph (production): single caller —
  cli/src/server-command.ts:17  import { startGateway } from './server/gateway'
  cli/src/server-command.ts:171 handle.injectTriggerRun(...)
Desktop renders against the wire protocol only (gateway-client.ts), not imports.

Test surface: cli/src/server/__tests__/ — 9 files, 1,474 lines
  gateway.test.ts (233) · gateway-approvals.test.ts (112) ·
  gateway-fid-events.test.ts (109) · gateway-handshake.test.ts (130) ·
  gateway-interrupt-reconnect.test.ts (143) · gateway-origin.test.ts (78) ·
  gateway-scoped-threads.test.ts (100) · gateway-server-command.test.ts (213) ·
  gateway-user-message.test.ts (142) · gateway-test-harness.ts (214, fixture)
Per-method coverage map (grep -l per method across the suite):
  hello ×8 · user_message ×5 · approval_response ✓ · interrupt_stream ✓ ·
  update_setting ✓ · get_scoped_threads ✓ · update_scoped_thread_state ✓ ·
  list_commands ✓ · triggers_* ✓ (gateway.test.ts) · run_complete ✓ ·
  approval_request ✓ · injectTriggerRun — NO DIRECT TEST (indirect only,
  via server-command wiring)
```

## Impact Assessment

### Affected Components

- `cli/src/server/gateway.ts` (the monolith)
- `cli/src/server-command.ts` (sole production consumer — must be untouched)
- `cli/src/server/auth.ts`, `cli/src/server/json-rpc.ts` (existing siblings —
  untouched; the seams already exist, this FID extends the same pattern)
- `desktop/src/lib/gateway-client*.ts` (wire-protocol consumers — protected by
  the handshake/protocol tests; no import coupling)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: maintainability/reviewability debt; behavior preserved via a
      characterization suite with per-method coverage; no runtime defect
- [ ] Low

## Proposed Solution

### Approach

Decompose along the file's natural seams into single-responsibility modules
under `cli/src/server/gateway/` (mirroring `tool-executor/` from
FID-2026-0905-001), leaving `gateway.ts` as the composition facade. The
**seams and the per-session state ownership are the invariant**; module
names/shape may flex during implementation as long as the public export
surface and wire behavior are preserved. Every handler keeps verbatim
semantics — the extraction is structural, not behavioral.

Module map (Loop-1 draft, REVISED by Loop 2 — 7 modules + facade; the
`GatewayContext` state bundle and the ordered seams are the invariant):

1. **`gateway/types.ts`** — the exported contracts verbatim
   (`EVENT_FLUSH_INTERVAL_MS`, `GatewayOptions`, `GatewayTriggerManager`,
   `GatewayCommandDescriptor`, `GatewayHandle`) + internal shared types
   (`PendingApproval`, `ConnectionState`, `ScopedThreadRecord`, the
   `runPrompt`/`loadScopedThreads`/`updateScopedThreadState` function types)
   so stage modules never import from the facade
2. **`gateway/state.ts`** — `GatewayContext` (token, projectId, commands,
   logger, triggerManager DI, runPrompt/loadScopedThreads/updateScopedThread
   State DI, fidBus, pendingApprovals, connectedSockets, and the mutable
   run/event fields: activeRun, lastRunState, eventBuffer, flushTimer) + the
   event-batching primitives (`pushEvent`, `flushEvents`, `ensureFlushTimer`)
   + `denyPendingApprovals` (called by both socket-close and shutdown)
3. **`gateway/fid-events.ts`** — `createFidEventBus({ fidsDir, projectId,
   logger, getSockets })` returning `{ collectFidUpdates, emitFidChanges,
   seed }`; the `fidStatuses` map is ENCAPSULATED in the bus (single owner),
   not a context field
4. **`gateway/run-lifecycle.ts`** — `defaultRunPrompt` (the SDK-client path
   with the P18/P19 parity comments) + `handleUserMessage` +
   `injectTriggerRun` + `handleApprovalResponse` + the AskUserBridge
   subscription wiring (approvals belong to the run domain)
5. **`gateway/triggers-rpc.ts`** — `requireTriggerManager` + the five
   triggers_* handlers (stateless over the `GatewayTriggerManager` DI)
6. **`gateway/scoped-threads-rpc.ts`** — both scoped-thread handlers + the
   DB-backed defaults (`defaultLoadScopedThreads`,
   `defaultUpdateScopedThreadState`)
7. **`gateway/commands-registry.ts`** — `TUI_ONLY_COMMAND_IDS`,
   `defaultListCommands`, `handleListCommands`
8. **`gateway/handshake-rpc.ts`** — `handleHello` + the hello-first/auth/id
   framing + the 13-method `dispatch` router, as `createDispatch(ctx)`

**Loop-2 decision — the `Bun.serve` transport block STAYS in the facade.** It
is the composition itself (binds dispatch + state + ws handlers); extracting
it would parameterize the facade into a husk. Facade budget without dispatch:
destructure + context/state assembly + Bun.serve + fidWatcher/stop/handle ≈
200 lines. Contingency (pre-authorized flex): if the facade still exceeds
300, extract the websocket handler object as `transport.ts` (Q10-style).

The facade keeps: `startGateway` composition, option destructuring, context
assembly, `Bun.serve`, fidWatcher wiring, `stop`, handle return. Public
exports re-exported from `gateway/types.ts` byte-identically — the single
production caller (`server-command.ts:17`) and the harness import paths are
untouched.

### Steps

1. **RED (characterization baseline):** the 9 existing test files ARE the
   characterization suite. Run the full `cli/src/server/__tests__/` suite on
   the monolith and record exact pass/expect totals. Close the one coverage
   gap the map exposed: add direct pins for `injectTriggerRun` (busy-guard
   rejection, prompt-required rejection, accepted-then-async-settle ordering,
   never-throw on run failure) in a new test file on the harness. All green
   **before any extraction**.
2. **GREEN wave 1 (leaf modules):** extract types.ts, commands-registry,
   scoped-threads-rpc, triggers-rpc — facade delegating. Gates after: cli
   typecheck + full server suite.
3. **GREEN wave 2 (stateful core):** extract state, fid-events, run-lifecycle
   — gates after.
4. **GREEN wave 3 (protocol):** extract handshake-rpc (`createDispatch`);
   facade ≤ 300 lines. Gates after.
5. **AUDIT:** cli typecheck, full cli server suite (totals must equal the RED
   baseline + the new pins), `bun x eslint` on touched tree + repo
   `--max-warnings 0`, lint:md, prettier, `quality:report` (gateway.ts
   unlisted), baseline regeneration if applicable, Law-4 grep (single
   production caller unchanged; no direct `./gateway` imports beyond
   `server-command.ts:17`).
6. **Closure:** G2 commit hash (operator executes git), FID → `closed`,
   archive + CHANGELOG per Auto-Archive.

### Step Status (anti-deferral ledger)

- [x] Step 1 (RED) — `implemented`: baseline 35/0 / 163 expects across 10
      files (9 existing + gateway-inject-trigger.test.ts, 5 pins), green on
      the monolith from both cwds before any extraction; stable 3× repeat.
- [x] Step 2 (Wave 1) — `implemented`: types.ts (148), commands-registry
      (47), triggers-rpc (206), scoped-threads-rpc (154); suite 35/0 after.
- [x] Step 3 (Wave 2) — `implemented`: state.ts (140), fid-events.ts (142),
      run-lifecycle.ts (249) + ceiling contingency default-run-prompt.ts
      (86, pre-authorized); suite 35/0 after.
- [x] Step 4 (Wave 3) — `implemented`: handshake-rpc.ts (285,
      createDispatch); facade gateway.ts 1,327 → 236 lines (≤ 300).
- [x] Step 5 (AUDIT) — `implemented`: cli typecheck 0; server suite 35/0 /
      163 expects from BOTH cwds (parity with RED baseline); full cli
      workspace suite 3,478 pass / 1 fail (the fail is the PRE-EXISTING
      untracked provider-drift test provider-setup-gateway.test.ts — fails
      in isolation on the untouched tree, recorded as R4 [OPEN-OUT-OF-SCOPE]);
      eslint full repo `--max-warnings 0` exit 0; prettier clean; lint:md
      exit 0; quality:report 17 → 16 violations with `cli/src/server/
      gateway.ts` UNLISTED and no new entries; Law-4 grep: single production
      caller unchanged (`server-command.ts:17`).
- [x] Step 6 (Closure) — `implemented` 2026-09-05: commit hash stamped
      below (G1 amendment permits agent commits); `closed` + archive +
      CHANGELOG entry recorded.

### Verification

Double audit: (1) static — cli typecheck + eslint + lint:md + prettier;
(2) runtime — the 9-file gateway suite plus the new injectTriggerRun pins,
with pre/post-extraction total parity, exactly the FID-2026-0905-001 method.
Behavioral invariants pinned by the existing suite: frozen hello-first
handshake, fail-closed approval denial on close/stop, ~50 ms batched event
flush (single JSON-RPC notification frame), single-session guard,
Origin/Host upgrade rejection, FID-queue change events.

Verification Gates are declared now (FID-2026-0823-009); the receipt is
stamped when status reaches `fixed`/`verified`. The gates below cover the
currently-existing suite; the RED step's new `gateway-inject-trigger.test.ts`
gate is ADDED to this list when RED creates the file (the validator requires
declared gate paths to exist on disk).

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/server/__tests__/gateway.test.ts
- gate: test cli/src/server/__tests__/gateway-handshake.test.ts
- gate: test cli/src/server/__tests__/gateway-user-message.test.ts
- gate: test cli/src/server/__tests__/gateway-approvals.test.ts
- gate: test cli/src/server/__tests__/gateway-inject-trigger.test.ts

### Verification Receipt

- fingerprint: sha256:703ddf86b0887c11502e4fa3a74a7732a7de2163703c0621e6b0470d321c3ecf
- verified: 2026-09-06T00:05:19.375Z
- typecheck cli: exit 0
- test cli/src/server/__tests__/gateway.test.ts: exit 0
- test cli/src/server/__tests__/gateway-handshake.test.ts: exit 0
- test cli/src/server/__tests__/gateway-user-message.test.ts: exit 0
- test cli/src/server/__tests__/gateway-approvals.test.ts: exit 0
- test cli/src/server/__tests__/gateway-inject-trigger.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Monolith inventoried (anchors above). Findings: (1) eight
  responsibilities in one closure; (2) `injectTriggerRun` has **no direct
  test coverage** — busy-guard, prompt-required, and acknowledge-then-run
  ordering are only indirectly exercised through server-command wiring; (3)
  no baseline entry exists for the file (absolute-max flagging only); (4) the
  existing 9-file suite is a strong characterization base — per-method
  coverage confirmed by grep map, so RED scope is the injectTriggerRun gap
  plus recorded baseline totals; (5) **the shared harness has a latent race
  that makes `gateway.test.ts` flaky under the repo-root gate runner** (see
  below).

**RED finding 5 — `request()` race in `gateway-test-harness.ts` (blocking the
verification receipt):** `collectFrames` (harness :117-165) pushes every
inbound frame, and `request()` (:151-166) returns `frames[0]` — the first
frame received after the listener attaches, not the first frame matching the
request id. From `cli/` (the workspace convention) `dev/fids` does not exist,
so the gateway emits no event notifications and `frames[0]` is always the
id-matched response. From the repo root (what `fid:verify` uses —
`scripts/fid-verify.ts:118-126` runs `bun test <path>` with `cwd: root`), the
hello handler schedules the fid-snapshot notification
(`gateway.ts:573-580`, `setTimeout(…, 0)`; 3 active FIDs exist on disk), and
under load that macrotask can land inside a later request's collect window —
that request's `frames[0]` is then the notification, `.result` reads
`undefined`, and the assertion fails. Evidence: `fid:verify --write` failed
twice at `gateway.test.ts:180` (`triggers_delete` response read as
`undefined`) while the same file passed 3/0 from `cli/` every time
(8/8 direct runs); from root it is genuinely timing-flaky (measured 3 fail /
7 green across repeated root runs, both observed failures immediately after
`fid:verify` typecheck load); probe `dev/scratchpad/gateway-cwd-probe.ts`
replayed the exact wire sequence with a raw frame tap and confirmed the
gateway always answers `{id: 6, result: {deleted: true}}` — the server is
correct, the test helper loses the response. Proposed RED fix (1 line):
`request()` returns the id-matched frame —
`return frames.find((frame) => (frame as { id?: unknown }).id === id)` —
restoring the helper's documented contract ("resolve with the single response
frame") without touching any gateway code.

- **GREEN:** Module map proposed (8 modules + facade, seams = invariant).
  Steps sequenced waves-first-stateless so each gate run has a minimal
  behavioral delta.
- **AUDIT:** Evidence from tool output only: quality:report line, anchor grep
  with line numbers, single-caller grep, per-method test-coverage grep map,
  suite line counts. All cited above.
- **ADVERSARIAL:** (a) "Extraction could reorder flush/halt semantics" →
  mitigated: fail-closed + batching invariants already pinned by the
  approvals/fid-events/handshake suites; handlers move verbatim. (b) "Desktop
  could break" → it consumes the wire protocol, not imports; handshake/origin
  suites pin the wire. (c) "Facade misses 300 again" → contingency: dispatch
  router extraction (step 4 flexes). (d) "server-command.ts drift" →
  gateway-server-command.test.ts (213 lines) pins the wiring; Law-4 grep
  re-run at audit.
- **CHANGE DELTA:** ~15% (initial authoring pass)

### Missed Questions

1. *Why gateway.ts before public-release.ts?* → Sequencing: public-release.ts
   is the landing zone for FID-2026-0903-001 (desktop packaging auto-release
   integration, scheduled for the next release cut). Decomposing it now
   would collide with in-flight release-pipeline work; gateway.ts has no
   pending FID interaction and the strongest existing test suite of the five
   residues (9 files, per-method coverage).
2. *Does extraction change the module-level export surface?* → No. All six
   public exports stay in `gateway.ts` (re-exported from the new modules);
   the single production caller and the harness import unchanged.
3. *New directory (`gateway/`) vs flat siblings (like `auth.ts`,
   `json-rpc.ts`)?* → `gateway/` — 8+ modules would flood `cli/src/server/`;
   the `tool-executor/` precedent (FID-2026-0905-001) kept the facade beside
   its stage modules, which is the established pattern.
4. *What if the RED pass finds more coverage gaps than injectTriggerRun?* →
   Same disposition as -0905-001: each gap found during RED is either closed
   with a pin on the monolith or, if unreachable through public params,
   recorded with the exact search as evidence and deferred to the extracted
   module's own test (DI-first, no mocking).
5. *Does the uncommitted provider drift block this?* → No — `cli/src/server/`
   is untouched by the drift (13 drift violations live in common/sdk/cli-utils
   provider files). The gateway suite is runnable green on the current tree;
   baseline totals recorded at RED make parity measurable regardless.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA (G2):** `7e4be78` — feat(cli): session wave
      decomposition and command surface growth (FID-2026-0905-003/-006);
      **closed 2026-09-05**. Prior note (pre-drain): closure `blocked` on the
      G2 commit hash (operator executes git) — resolved by the 2026-09-05 G1
      amendment (agents permitted local commits + push).
- [x] **File:line ranges:** `cli/src/server/gateway.ts` (facade, 236 lines:
      startGateway composition + Bun.serve transport + stop/handle);
      `cli/src/server/gateway/types.ts` (public contracts + internal types);
      `gateway/state.ts` (GatewayContext + pushEvent/flushEvents/
      ensureFlushTimer/denyPendingApprovals); `gateway/fid-events.ts`
      (createFidEventBus, fidStatuses encapsulated);
      `gateway/run-lifecycle.ts` (user_message/injectTriggerRun/interrupt/
      approvals/bridge subscription); `gateway/default-run-prompt.ts`
      (SDK-client run path with P18/P19 parity);
      `gateway/triggers-rpc.ts` (5 handlers + requireTriggerManager);
      `gateway/scoped-threads-rpc.ts` (2 handlers + DB defaults);
      `gateway/commands-registry.ts` (TUI_ONLY_COMMAND_IDS + registry);
      `gateway/handshake-rpc.ts` (handleHello + createDispatch 13-method
      router); `cli/src/server/__tests__/gateway-inject-trigger.test.ts`
      (5 RED pins); `gateway-test-harness.ts` request() id-match fix (RED
      finding 5).
- [x] **Gate output:** typecheck cli exit 0; server suite 35 pass / 0 fail /
      163 expect() across 10 files (both cwds); eslint `--max-warnings 0`
      exit 0 (full repo); lint:md exit 0; prettier clean; quality:report —
      `cli/src/server/gateway.ts` no longer listed (was 1,327 > 300), no new
      violations from the 8 extracted modules or the 241-line test file;
      fid:verify receipt stamped 6/6 PASS (below).
- [x] **Reproducibility:** `wc -l cli/src/server/gateway.ts` → 236;
      `ls cli/src/server/gateway/` → 8 modules; `grep -rn "startGateway"
      cli/src --include=*.ts | grep -v __tests__` → server-command.ts only;
      `bun test cli/src/server/__tests__/` → 35/0 from the repo root.
- [x] **Step statuses:** all six steps accounted (Step Status ledger above);
      only Step 6 is `blocked` on the operator's G2 commit hash.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`gateway.ts` measured
      1,327 pre / 236 post; `server-command.ts:17/:171` grep-verified; 9 test
      files wc-verified; all 8 stage modules on disk)
- [x] Implementation matches the Proposed Solution — 7 planned modules + the
      pre-authorized default-run-prompt contingency; seams and state
      ownership per the Loop-2 contract; public export surface re-exported
      byte-identically
- [x] Typecheck/tests/lint pass with pasted tool output — see Gate output
      above and the stamped receipt
- [x] Production call-graph evidence — Law-4 grep at audit: single caller
      `server-command.ts:17` unchanged; no production imports of stage
      modules outside the facade
- [x] FID status reflects the actual implementation state — `analyzed` →
      `fixed` on implementation + gates; `closed` only at G2

### Loop 2 — Independent audit and self-correction

- **RED:** Loop-1 design audited against the file internals. Four findings:
  (1) the draft had no cross-stage state contract — settled as a
  `GatewayContext` bundle created by the facade, passed to every stage
  factory; mutable run/event fields (`activeRun`, `lastRunState`,
  `eventBuffer`, `flushTimer`) live on the context and are touched only by
  their owning module (run-lifecycle, state); (2) approval handling sat
  orphaned between handshake and run concerns — moved into run-lifecycle (it
  resolves the halted run's ask_user; same domain); (3) extracting the
  `Bun.serve` transport would hollow the facade — REJECTED; transport stays
  in the facade, with a pre-authorized websocket-handler extraction as
  contingency only; (4) the draft leaked `fidStatuses` onto the shared
  context — encapsulated in a `fidBus` (single owner) instead.
- **GREEN:** Module map revised (7 modules + facade, types.ts added so no
  stage imports from the facade); steps re-sequenced leafs-first; dispatch
  owned by `handshake-rpc.ts` as `createDispatch(ctx)`; facade budget ≈200
  lines with the Q10-style contingency recorded.
- **AUDIT:** Four post-fix answers (1–4 above) — one is a change of the
  module map the fixes were applied to, three are Loop-1 fallbacks re-tested
  and failing (no state contract / no dispatch owner / transport question
  unanswered). Evidence for each is in the module-map comments themselves
  (verbatim-semantics invariants, single-caller constraint, ~50ms batching,
  fail-closed approval contract).
- **ADVERSARIAL:** (a) "The context bundle is a god-object that just moves
  the monolith" → mitigated: it holds only per-session state + the DI
  seam types; every behavior stays in its single-responsibility module, and
  the dispatch/facade stay thin; the 9-file suite pins all wire behavior.
  (b) "Approval moved domains breaks the fail-closed contract" → no code
  changes: handlers move verbatim, denyPendingApprovals stays on state
  (called by facade stop + ws close), approvals suite pins it.
  (c) "`dispatch` in handshake-rpc means the facade no longer owns routing"
  → the facade owns composition, not routing; `createDispatch(ctx)` is a
  pure function of the context — server-command and the desktop are wire-
  level consumers, unaffected. (d) "Facade blows 300 on comments" → the
  P18/P19 parity comments ride with `defaultRunPrompt` into run-lifecycle;
  facade budget ≈200.
- **CHANGE DELTA:** ~40% (module map + steps + state contract rewritten)

### Loop 3 — Final convergence

- **RED:** Re-audit of the Loop-2 state contract: no open design issues.
  Remaining risk inventory: (a) verbatim-move discipline for the two DB
  defaults and five triggers handlers; (b) the once-only flushTimer/stop
  semantics (already pinned by gateway-fid-events + origin suites); (c) the
  `as never` approval_request payload cast must survive the move (types.ts
  carries it verbatim). No new gaps found.
- **GREEN:** No corrections required — Loop 2 accepted. One convergence
  refinement: Step 3's gates re-run the RED baseline totals explicitly
  (30/0/150) so AUDIT parity is measured, not asserted.
- **AUDIT:** Convergence check: change delta this loop <2% (comment-level
  edits only). The three-question convergence test passes: no new issues,
  corrections applied, evidence chain complete (anchors, single caller,
  per-method coverage map, receipt 5/5 PASS, race finding + fix recorded).
- **ADVERSARIAL:** Final challenge: is the RED baseline strong enough to
  detect a semantic drift during extraction? Count: 30 tests / 150 expects
  across 9 files cover every RPC method, the handshake ordering, origin/host
  rejection, approval fail-closed, event batching, and FID-queue events; the
  new inject-trigger pins (RED step 1) add the acknowledge-then-run and
  busy-guard coverage. Verdict: sufficient for a structural extraction with
  verbatim moves.
- **CHANGE DELTA:** <2% (converged)

## Resolution

- **Closed Date:** 2026-09-05
- **Fix Description:** `cli/src/server/gateway.ts` (1,327 lines) decomposed
  into a 236-line facade plus 8 stage modules under `cli/src/server/gateway/`
  (types, state, fid-events, run-lifecycle, default-run-prompt,
  triggers-rpc, scoped-threads-rpc, commands-registry, handshake-rpc) with a
  byte-identical export surface; per-session state consolidated in a
  GatewayContext bundle; the RED finding (request() id-match) fixed in
  gateway-test-harness.ts and pinned by 5 new inject-trigger tests.
- **Tests Added:** Yes — `gateway-inject-trigger.test.ts` (5 tests); server
  suite parity 35 pass / 0 fail / 163 expect() across 10 files.
- **Verification Evidence:** cli typecheck 0; eslint `--max-warnings 0`;
  prettier clean; lint:md 0; quality:report — gateway.ts unlisted, no new
  entries; fid:verify receipt stamped 6/6 PASS; commit `7e4be78`.
- **Archived:** 2026-09-05 (moved to `dev/fids/archive/`)

## Lessons Learned

- Extract a shared state contract (the GatewayContext bundle) before moving
  any stage — retrofitting ownership after the first module lands causes
  cross-domain writes (the fidBus encapsulation fixed exactly this).
- A thin facade owns composition, not routing: `createDispatch(ctx)` as a
  pure function of the context keeps wire-level consumers untouched while
  letting handlers live in their domain modules.
