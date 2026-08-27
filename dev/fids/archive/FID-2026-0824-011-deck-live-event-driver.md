# FID: Deck live event driver — walkers/stations/state-FX mounted on the real gateway stream

**Filename:** `FID-2026-0824-011-deck-live-event-driver.md`
**ID:** FID-2026-0824-011
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 13:29
**YAGNI-Compliance:** Pending

---

## Summary

The live production-webview smoke of FID-2026-0822-012 (operator,
2026-08-24) reported the deck as "all I see is a grid". Root cause is
two-fold: (1) `mountDeckRuntime` mounts ONLY `AtmosphereLayer`
(`deck-runtime.ts:99`) — WalkerLayer, StationLayer, and StateFxLayer are
fully implemented/tested but have zero production mounts under the recorded
"event driver lands post-FID-008" exemption; (2) the mounted motes are
effectively invisible (`OctahedronGeometry(0.05)`, opacity 0.25, radius 40
spread). The stale premise behind the exemption — "no live feed
pre-FID-008" — no longer holds: the desktop app's `GatewayClient.onEvents`
already streams real `PrintModeEvent`s into the chat transcript today
(`gateway-client.ts:81`, consumed by `use-gateway.ts:57`). This FID wires
the LIVE event driver: gateway stream → pure FloorAdapter →
Walker/Station/StateFX layers synced per tick, plus a mote visibility bump,
so the deck shows six work stations immediately and robot walkers driven by
REAL agent traffic.

## Environment

- **OS:** Windows 10 (Git Bash host, WSL tmux interop)
- **Language/Runtime:** TypeScript strict, Bun 1.3.14; React 19 renderer
  in Tauri v2 shell (WebView2)
- **Commit/State:** main @ v0.0.27 working tree (release-only-commits);
  live smoke session `tui-test-1787591787009-t9ve` green through
  gateway-ready

## Detailed Description

### Problem

Operator expectation (locked 2026-08-22 art direction): literal
holographic AI walking the deck among tool stations. Live observation:
Void plane + grid rails only. Evidence:

```text
desktop/src/floor/stage/deck-runtime.ts:93-99 — mountDeckRuntime constructs
  ONLY: attachControlsAndResize + new AtmosphereLayer(stage.getScene())
desktop/src/floor/stage/deck-atmosphere.ts — MOTE geometry
  OctahedronGeometry(0.05); MeshBasicMaterial opacity 0.25 wireframe;
  MOTE_AREA_RADIUS = 40
rg "WalkerLayer\(|StationLayer\(|StateFxLayer\(" desktop/src → matches ONLY
  in __tests__/ (zero production construction sites)
```

The recorded Law-4 exemption class ("zero non-test callers BY DESIGN
pre-FID-008; named mount point = replay/live event driver") is now
dischargeable: the named mount point EXISTS —
`GatewayClient.onEvents(listener: (events: PrintModeEvent[]) => void):
() => void` at `desktop/src/lib/gateway-client.ts:81`, proven end-to-end by
the working chat (`use-gateway.ts:57` ingests the same stream).

Companion smoke findings folded into this pass (operator-reported during
the same session): panning exposed the finite 240-unit grid edge
(`deck-stage.ts` static GridHelper pinned to origin) — fixed by recentring
floor on the orbit target snapped to the 2-unit cell + size bump 240→400.

### Expected Behavior

- Six station pedestals visible immediately on entering Deck view (static
  geometry — no events required).
- Savant console unit present when the session's `start` event arrives;
  subagent walkers spawn/walk/dissolve from real
  `subagent_start`/`subagent_finish` traffic; tool calls walk figures to
  pedestals; sparks/packets/auras render from tool results and the G2
  transition_phase pairing; thinker glyph rings segment `reasoning_delta`
  bursts with arrival-clock discipline (MQ-M).
- Atmosphere motes visibly drifting (size/opacity/radius tuned for the
  default ~34° orbit camera).
- The analytical SVG fallback consumes the SAME live FloorState (both
  projections fed by one driver — Loop 2 PATH DECISION).
- Amendment Gate G1–G4 untouched: only AMENDMENT-FREE signals consumed;
  gated elements (approval docking, compaction ripple, pylons, revision
  glyphs) remain unmounted.

### Root Cause

Deliberate P1–P6 scoping left the event driver as a named follow-up; its
enabling prerequisite (FID-2026-0820-008 gateway, closed + live) landed
afterward, so the exemption aged into a gap. Secondary: mote constants were
never eyeball-validated against the production camera
(test-renderer-is-not-a-proxy lesson).

### Evidence

See Problem block. Additional: chat works in the live app over the same
gateway (Loop 7 of -0822-012 recorded operator confirmation), proving
transport + event flow today.

Separate defect filed alongside (NOT this FID): the desktop agent's
boot-grounding emitted `read_files` calls shaped
`{path: "/home/user/project/ECHO.md"}` — fabricated absolute prefix (zero
repo matches; `/home/user/*` appears only in cli hook TEST fixtures) plus
malformed singular `path` instead of `paths[]`. Routed as follow-up
material.

## Impact Assessment

### Affected Components

- NEW `desktop/src/floor/driver/deck-live-driver.ts` — subscription +
  FloorState accumulation + clock injection
- `desktop/src/hooks/use-gateway.ts` — export the existing shared-client
  accessor (+~4 lines, no behavior change)
- `desktop/src/floor/stage/deck-runtime.ts` — accept optional live layers
  bundle; per-tick layer sync; teardown ordering
- `desktop/src/floor/deck-view.tsx` — wire driver subscription in
  DeckCanvas effect; analytical branch consumes live state
- `desktop/src/floor/stage/deck-atmosphere.ts` — mote visibility constants
  (size/opacity/radius)
- `desktop/src/floor/stage/deck-stage.ts` — floor recentring on orbit
  target (companion smoke fix)
- Tests: NEW `desktop/src/floor/__tests__/deck-live-driver.test.ts`
  (5 cases)

### Risk Level

- [ ] Critical / [ ] High: flagship surface effectively empty in
      production (workaround: none for the vision; chat unaffected)
- [x] High
- [ ] Medium / [ ] Low

## Proposed Solution

### Approach

One new module + minimal wiring, all within established patterns:

1. **Shared client export:** `use-gateway.ts` exports
   `getSharedGatewayClient(): GatewayClient` wrapping the existing private
   `getClient()` singleton (StrictMode-safe socket discipline preserved —
   subscribers multiply, sockets do not).
2. **Live driver (`floor/driver/deck-live-driver.ts`):**
   `createDeckLiveDriver({ now?, client?, onChanged? })` → subscribes
   `getSharedGatewayClient().onEvents`; folds batches through
   `applyFloorEvents(state, events, () => arrival)` with ONE
   performance.now() per batch (MQ-M); keeps a private mutable FloorState;
   exposes `getState()` + idempotent `dispose()`. Pure-module discipline:
   no Three.js imports.
3. **Runtime integration:**
   `mountDeckRuntime(wrap, canvas, stage, live?: DeckLiveBundle)` —
   stations constructed unconditionally (visible without traffic),
   walkers/stateFx tied to driver presence; ticker tick calls
   `walkers.sync(floor, nowMs, { reduced })` + `stateFx.sync(floor,
   nowMs)` via `syncLiveLayers`; dispose order runtime→layers→stage
   preserved.
4. **View wiring:** `DeckCanvas` effect builds the driver before
   `mountDeckRuntime(..., { driver })` and tears it down after;
   WebGL-failure branch uses `useLiveFloorState(failed)` (driver with
   `onChanged: setFloor`) so the analytical SVG is equally live.
5. **Mote tuning:** size 0.05→0.14, opacity 0.25→0.45,
   `MOTE_AREA_RADIUS` 40→26.
6. **Companion grid fix:** `deck-stage.ts` GRID_SIZE 240→400, DIVISIONS
   120→200 (cell stays 2u); new private `recenterFloor(targetX, targetZ)`
   called from `applyOrbit` snaps floor position to the cell so panning
   reads as infinite inside the fog horizon.

### Steps

1. Export shared gateway client accessor (use-gateway.ts).
2. Implement `deck-live-driver.ts` + focused unit suite (fake client DI:
   batch folding, arrival clock once-per-batch, onChanged, empty-batch
   no-op, dispose idempotence).
3. Extend `deck-runtime.ts` (optional live bundle: stations unconditional,
   walkers/stateFx conditional).
4. Wire `deck-view.tsx` both branches (WebGL + analytical).
5. Tune atmosphere constants.
6. Companion grid recentring (operator smoke feedback).
7. Gates: desktop typecheck exit 0 · full desktop suite green · eslint
   `--max-warnings 0` touched · prettier clean · G4 grep inert-only ·
   Law-4 caller greps.
8. Stamp receipt `bun run fid:verify <fid> --write`; status advances to
   `fixed`; closure boundary = operator relaunch re-eyeballing stations +
   walkers during real subagent traffic.

### Verification

Tool-mediated gates per Steps 7–8; live confirmation is the operator's
production-webview pass (recorded NEEDS-REVIEW until then — never claimed
passed by the harness). vite HMR hot-applies renderer changes; cargo side
unchanged.

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/__tests__/deck-live-driver.test.ts
- gate: test desktop/src/floor/__tests__/deck-atmosphere.test.ts

### Verification Receipt

- fingerprint: sha256:31c61fdf504c388d98137a6b5f83ff11fae3ba8b588bc6dfd253951917e497fc
- verified: 2026-08-26T03:55:44.886Z
- typecheck desktop: exit 0
- test desktop/src/floor/__tests__/deck-live-driver.test.ts: exit 0
- test desktop/src/floor/__tests__/deck-atmosphere.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Production-mount census (above rg evidence); mote invisibility
  math (0.05u wireframe @ 0.25 alpha vs default orbit); stale-exemption
  timeline (-008 closed before Loops 5–9 recorded the exemption); seam
  confirmation (`gateway-client.ts:81` onEvents; `use-gateway.ts`
  singleton; adapter `applyFloorEvent(s, clock?)` pure and tested).
- **GREEN (implemented 2026-08-24):** All six steps landed exactly as
  specified. NEW driver module (no Three.js imports); use-gateway export
  at :32; runtime gains `DeckLiveBundle` + `syncLiveLayers` wired into
  BOTH the ticker and `applyMotionPreference` (the reduced-motion static
  frame includes one honest layer sync); view wires both branches; motes
  retuned; grid recentring added. Mid-implementation defect caught by
  gates: tier-1 fixtures mix single-object/array JSON shapes — loader
  normalizes through a `z.array(printModeEventSchema)` fallback
  (schema-validated, no casts). Edits were applied via count-asserted
  exact-match scripts executed by the basher agent after the EHEL Law-3
  tracker wedged on the new files (passing verifies never cleared it —
  same remedy class as -0822-012 Loop 4).
- **GATES (tool-mediated):** desktop typecheck exit 0 · FULL desktop
  suite **163 pass / 0 fail** across 26 files (incl. NEW deck-live-driver
  5/5; atmosphere/walkers/stations/state-fx/adapter suites
  unchanged-green; real-sidecar E2E still live 3/3) · eslint --fix +
  prettier --write clean on all touched TS files · G4 sweep: matches are
  the inert class only (`approval-gate` station id/routing map/doc
  comments in `stations.ts`+test) — ZERO SessionState/compaction symbols ·
  Law-4 reachability: `getSharedGatewayClient` defined
  `use-gateway.ts:32` → consumed `deck-live-driver.ts:43`;
  `createDeckLiveDriver` consumed `deck-view.tsx:67,:96`;
  `mountDeckRuntime(..., { driver })` at `deck-view.tsx:99` → chain
  terminates at the App-mounted DeckView; zero orphaned exports.
- **AUDIT (Verifier, 2026-08-24): PASS WITH CONDITIONS —** all
      substantive items PASS (driver batch-fold contract, fake-client DI
      suite, runtime layer mount/sync/dispose order, shared-client export
      socket-invariant, view wiring with FALLBACK_FLOOR fully removed,
      mote constants, grid recentring; G4 inert-only; Law-4 chain;
      receipt stamped + `--check` PASS). Conditions carried to
      ADVERSARIAL: resolve post-prettier exact-line citations;
      adjudicate redundant-guard MINOR + fid-verify insert-path
      staleness quirk.
- **ADVERSARIAL (2026-08-24): STANDS —** every condition resolved against
      disk. Citations EXACT: use-gateway.ts:32; deck-live-driver.ts:43;
      deck-view.tsx:67/:96/:99; syncLiveLayers deck-runtime.ts:120 invoked
      :134/:143 (numbers the Verifier left unnumbered, here supplied);
      App.tsx:77 `<DeckView` mount confirmed; FALLBACK_FLOOR zero repo
      matches. MINOR redundant triple-guard (`walkers === null ||
      stateFx === null || live === undefined`) CONFIRMED redundant →
      CORRECTLY-DEFERRED per the scanner-FID MINOR-2 precedent (zero
      behavioral delta; a standalone edit would require re-running desktop
      gates to keep the stamped claims honest for no functional gain).
      fid-verify insert-path staleness quirk root-caused SHARPER:
      stampReceipt's INSERT branch splices with trimEnd/trimStart junction
      whitespace mutation while buildReceipt fingerprints PRE-insert
      content → validator's stripped-minus-receipt reconstruction differs
      byte-wise on first insert; REPLACE path is already in final shape ⇒
      converges on second stamp. Downgraded to non-blocking follow-up-FID
      hygiene material (--check fails closed; self-heals; no governance
      bypass). No omissions found in the Verifier's sweep.
- **CHANGE DELTA:** status flip + evidence sections (~15%).

### Missed Questions

1. Second socket risk? → None: driver SUBSCRIBES to the existing
   page-level singleton (sockets don't multiply; listeners do —
   documented invariant in use-gateway.ts header).
2. Events arriving while Deck hidden (chat mode)? → Driver lives inside
   DeckCanvas effect: unmounted = unsubscribed; FloorState resets on next
   Deck entry (honest cold-start; no background accumulation cost).
3. Replay determinism vs live clock? → Adapter stays pure; the DRIVER
   injects arrival clocks exactly like tests do — replay paths unchanged.
4. StrictMode double-mount? → Existing pattern handles it: idempotent
   subscribe/dispose; stage/layers already strict-safe.
5. Does mounting StationLayer violate G4? → No: stations render from the
   static registry; Approval Gate renders PEDESTAL-only per Loop 6
   disposition (no approval case exists in the reducer).
6. Do fixture JSON shapes vary? → Yes (caught live): some tier-1 files
   are arrays, others single objects — loader normalizes via z.array
   fallback before parse.

## Step Status

- [x] Shared gateway client accessor exported
- [x] deck-live-driver module + unit suite (5/5)
- [x] Runtime integration (layers mount/sync/dispose)
- [x] View wiring both branches (WebGL + analytical)
- [x] Mote visibility tuning
- [x] Gates green + receipt stamped
- [x] Operator live re-smoke (webview) — carried boundary DISCHARGED BY
      OPERATOR WAIVER 2026-08-25: the night-session eye-tuning loop exercised
      stations + walkers on real traffic in the production webview; formal
      re-smoke formally waived (closure directive)

## Implementation Evidence (REQUIRED for `closed`)

Planning-stage record advanced to `fixed` — working-tree landing per
release-only-commits convention:

- [x] **Commit SHA:** uncommitted working tree (next release sweep
      carries it)
- [x] **File:line ranges:** `floor/driver/deck-live-driver.ts` (NEW whole
      module); `hooks/use-gateway.ts:29-34` (shared accessor export);
      `stage/deck-runtime.ts` (`DeckLiveBundle` interface,
      `mountDeckRuntime` live param + `syncLiveLayers` + dispose order);
      `deck-view.tsx` (`useLiveFloorState` hook + driver wiring in
      DeckCanvas); `stage/deck-atmosphere.ts` (mote constants);
      `stage/deck-stage.ts` (`recenterFloor` + GRID_SIZE 400)
- [x] **Gate output:** desktop typecheck exit 0; full desktop suite 163
      pass / 0 fail (725 expects); eslint/prettier clean on touched files
- [x] **Reproducibility:** grep census pasted in Loop 1 GATES above
- [x] **Step statuses:** steps 1–6 implemented; step 7 receipt stamps
      below; step 8 carried NEEDS-REVIEW

### Code Verification Evidence

- Files referenced exist on disk (verified via the count-asserted edit
  scripts' ANCHOR assertions + full-suite compile)
- Implementation matches Proposed Solution (six-step spec verbatim)
- Typecheck/tests/lint pass with pasted tool output (Loop 1 GATES)
- Production call-graph evidence present (Law-4 chain grepped, zero
  orphans)
- FID status reflects actual state: implementation exists + gates green
  ⇒ `fixed`

## Resolution

Implemented + gated 2026-08-24. Status `fixed`. Sole remaining boundary:
the operator's live production-webview re-smoke — stations render
immediately on entering Deck view; walkers appear when real subagents run
(spawn anything from chat); brighter motes drift continuously; panning
reads as an infinite floor. Companion fixes riding the same smoke cycle:
mote visibility bump + grid recentring (both operator-reported).

Bookkeeping note: TWO Recorder UPDATE attempts stalled read-without-write
(the -0823-011 behavioral class, including one CREATE-shape retry); this
revision landed via DIRECT Hybrid-mode FID write per that FID's recorded
precedent, then reformatted to satisfy MD013 (receipt re-stamped after the
reformat).

Adversarial bookkeeping additions: (a) syncLiveLayers guard deferral
recorded in the ADVERSARIAL entry above per the MINOR-2 precedent;
(b) FOLLOW-UP FID candidate filed — fid-verify insert-path fingerprint
timing (`scripts/fid-verify.ts` buildReceipt hashes pre-insert content vs
the validator stripping the post-insert block; fails closed and self-heals
on a second `--write`).

2026-08-25: CLOSED via operator waiver — the sole remaining boundary (the
production-webview re-smoke of stations + walkers on real traffic) was
discharged by the night-session eye-tuning loop and formally waived by
closure directive 2026-08-25. Gates re-ran fresh green this session
(desktop typecheck exit 0 · deck floor battery 50/0 incl. this FID's two
declared test gates); receipt re-stamped at the archived path; repo-wide
`fid:verify --check` sweep PASS; archived to `dev/fids/archive/`.

## Lessons Learned

- Integration gaps are invisible to unit suites: every layer tested green
  while zero production mount sites existed — only the grep census over
  construction sites (Law 4 done properly) exposed "all I see is a grid".
- Exemptions age into gaps: a recorded exemption true when written
  ("no live feed pre-FID-008") silently became the defect once its
  prerequisite landed. Every exemption should carry a named expiry
  condition and an owner who re-checks it when that condition flips.