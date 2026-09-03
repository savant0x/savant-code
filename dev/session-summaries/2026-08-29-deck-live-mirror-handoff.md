# Session Handoff — 2026-08-29 — Deck live-mirror still UNTESTED (root cause fixed)

**Status:** DEEP-WORK COMPLETE on the deck's event-mirroring pipeline. THE ROOT-CAUSE
BUG IS FIXED and verified by the full 244-test suite, but the operator has NOT yet
been able to visually confirm the deck animating during a live chat run. Handing off
with a single clean verification test remaining.

---

## The one-sentence summary the next session needs

The deck was never animating because the **floor event adapter was discarding the
orchestrator's own `tool_call` events** — the live orchestrator emits them with
`agentId: 'orchestrator-N'` (NOT `undefined`), and since the orchestrator never emits
a `subagent_start`, no walker record existed, so the adapter's old rule
("drop any call whose owning walker isn't active") threw every one away. Result:
`walkers=0 | tools=0 | pulse=0` on every batch, so the deck had literally nothing to
mirror. Now fixed: unmatched-caller tool calls route to Savant at the console.

## What was fixed this session (all gates green: 244/0 tests, tsc, eslint, prettier)

1. **FLOOR-ADAPTER ROOT-CAUSE (the big one)** — `desktop/src/floor/adapter/floor-adapter.ts`
   `tool_call` handler: any call whose owning active walker isn't found (incl. the
   orchestrator's `orchestrator-N`) now materializes/routes to the **Savant** walker
   and sets a station target. Prior behavior dropped them → empty floor state.
   - New test pinned: `attributed call to an UNKNOWN agent routes to Savant` (was
     `...is still dropped (purity contract)`). Note: `read_files` routes to
     `file-forge`, not cartography.

2. **Session-scoped driver** — `desktop/src/floor/driver/deck-live-driver.ts` +
   `deck-view.tsx`: the deck's event driver is now created once (`getSharedDeckDriver`)
   and never disposed, so it accumulates events even while the Chat tab is visible.
   `useLiveFloorState` subscribes via `driver.onChanged` and seeds from `getState()`.

3. **Render on state change even when the ticker is parked** —
   `desktop/src/floor/stage/deck-runtime.ts`: runtime subscribes to the driver's
   `onChanged` and does an immediate sync+render per folded batch, so reduced-motion /
   throttled-rAF can never leave the floor frozen at the mount-time state.

4. **Activity semantics (screensaver removed)** — idle cast no longer wanders; cast
   stands at pads (dimmed) until a live contract. Standby emissive lowered to 0.22,
   active stays 2.2 (dim standby vs. full holographic).

5. **World-scale coherence** — cast normalized to 6 units (was 25×2.5=62 giants that
   overlapped); walk speed 3.0 u/s (contract), wander removed; nameplate plane y=5.5
   (single shared band); station pedestals scaled 1.4×.

6. **Layout** — pad ring 12→9 (full circle around Savant, no "moon shape"); all cast
   figures `faceTowards` the console.

7. **Diagnostics left in place** (REMOVE before release if noisy):
   - `deck-live-driver.ts`: `[deck] batch: N events | savant= | walkers= | tools= |
     pulse= | phase=` per batch.
   - `deck-runtime.ts`: `[deck] cast N/10 mounted` (only when < full).
   - `deck-walkers.ts`: `[deck] mount <role>: glb|fallback` per figure.

## Diagnostics that were MISLEADING (do not re-chase)

- `[deck] cast 0/10 mounted` in the console is a RED HERRING — it's logged once at
  mount before the async `figureFactory` resolves. The console simultaneously showed
  `mount savant: glb … adversary: glb` (all 10, ×2 from StrictMode dev), proving the
  cast DID mount. The real signal was zero walkers/tools in the batch lines.

## The ONE remaining test (operator: not yet run — "I'm done for today")

1. Relaunch is already current (desktop + sidecar running with the fix).
2. Open **Deck** tab.
3. In Chat send a tool-using prompt (e.g. "list the files in root").
4. Expected: **Savant leaves the console and walks to File Forge** (read/list tools),
   station flips BUSY, nameplate ACTIVE, lane + packet flows, returns home on `finish`.
5. Tell of success: `[deck] batch:` lines now read `tools=N in-flight | walkers=1
   active` instead of all zeros.

---

## UNRELATED but hijacking every live test: ECHO bootstrap loop

The chat agent in fresh sessions repeatedly hits `[ECHO Enforcement] BLOCKED: Must
read ECHO.md 0-EOF before using tools` and auto-ends via the anti-runaway guard. This
is an **upstream sidecar/runtime bootstrap bug** — the agent refused to pass its own
boot-read gate, so runs produced retry churn instead of clean tool execution. This is
NOT a deck issue but it made deck verification hard (a blocked run has little real
tool traffic to mirror). HIGH-PRIORITY next task: investigate why a fresh session's
already-booted agent trips the ECHO read gate and loops.

## Also observed this session (operator, not yet fixed)

- "suggest followups" UI chips were folded into / not full options in the tab.
- The operator suggested "automated by tmux" as a possible fix path — NOT applicable
  here (pure WebGL/react render issue, no tmux needed).

## Files changed (this feature area)

- `desktop/src/floor/adapter/floor-adapter.ts` (+ test)
- `desktop/src/floor/driver/deck-live-driver.ts`
- `desktop/src/floor/deck-view.tsx`
- `desktop/src/floor/stage/deck-runtime.ts`
- `desktop/src/floor/stage/deck-walkers.ts`
- `desktop/src/floor/stage/deck-stations.ts`
- `desktop/src/floor/stage/deck-robots.ts`
- `desktop/src/floor/stage/deck-stage.ts`
- `desktop/src/floor/stage/deck-atmosphere.ts`
- `desktop/src/floor/roles.ts`
- `desktop/src/floor/stage/hologram-material.ts`
- `desktop/src/floor/deck-accents.ts` (new)
- tests under `desktop/src/floor/__tests__/` (deck-*, floor-adapter, roles)

FID: `dev/fids/FID-2026-0828-002-deck-live-fidelity.md` — needs a resolution entry +
archive once the operator confirms the live mirror visually.