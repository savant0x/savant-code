# FID-2026-0829-001 — Deck visual activity: 1:1 chat→deck visual response

> **State:** managed by the operator under `dev/scratchpad` → this FID documents
> the fundamental gap between the chat's tool activity and the 3D deck's visual
> feedback. The deck currently shows no visible response to any chat action.
>
> **Kind:** defect + visual-fidelity + product-gap bundle (RED-phase evidence
> below). This FID exists to run the full Perfection Loop (RED → GREEN → AUDIT
> → ADVERSARIAL) before any deck code changes land.

**Filename:** `FID-2026-0829-001-deck-visual-activity.md`
**ID:** FID-2026-0829-001
**Severity:** critical
**Status:** fixed
**Created:** 2026-08-29
**Parent:** FID-2026-0822-012 (command deck), FID-2026-0828-002 (live fidelity)

## Summary

The deck showed no visible response to chat actions (frozen agents, dead
stations, no action indicators). All 6 activity layers were implemented
2026-08-29 (walk-to-station, glow, station activation, packet lanes, action
banners, motion gating) plus the lane-alignment follow-up fix (§10.7). The
stage surface was subsequently replaced by the FID-2026-0831-001/-002
office rebuild, which carries the activity mapping forward.

| Field | Value |
|---|---|
| **ID** | FID-2026-0829-001 |
| **Title** | Deck visual activity: 1:1 chat→deck visual response |
| **Severity** | critical (release-blocking — the deck's entire purpose is visual activity) |
| **Status** | `GREEN` (all 6 layers implemented, gates green) |
| **Parent** | FID-2026-0822-012 (command deck), FID-2026-0828-002 (live fidelity) |
| **Created** | 2026-08-29 |

## 1. Problem statement

The 3D deck's entire purpose is to be a **1:1 visual mirror of chat activity** —
when the agent takes actions (list_directory, read_files, code_search, etc.),
the deck should show visible, dramatic feedback. Currently:

- **Agents are frozen.** All 10 cast members sit at their pads with no movement,
  no glow change, no visual indicator that anything is happening.
- **Stations don't activate.** No station lights up, no beam appears, no
  visual cue that a tool is being called.
- **No action indicators.** There's no visual representation of WHAT action is
  being taken (list dirs, read files, etc.) or WHERE it's happening.
- **The deck reads as dead.** The user sees a static 3D scene while the chat
  visibly works. The entire value proposition of the deck is lost.

The user's directive: **"When the chat is taking actions, the 3D space should
activate step by step. Glow around the activated agent, stations, visual
indicators for the action being taken. It should not be simulated — it needs
to be real actions."**

## 2. RED evidence (code trace + live smoke, 2026-08-29)

### 2.1 What the code DOES (pipeline is wired)

The event flow IS connected end-to-end:

1. **Chat events** → `GatewayClient.onEvents` → `deck-live-driver.ts` folds
   them into `FloorState` (confirmed by `[deck] batch:` console lines during
   the T16-F smoke — `walkers=1 active/1 total | tools=1 in-flight | pulse=1`).

2. **FloorState** → `deck-runtime.ts:syncLiveLayers(nowMs)` calls:
   - `walkers.sync(floor, nowMs)` — moves walkers to stations
   - `stateFx.sync(floor, nowMs)` — sparks, aura, lanes, glyphs
   - `stations.syncBusy(busy)` — marks stations as busy
   - `activity?.update(floor, ...)` — overlay text

3. **The ticker runs** — rAF ~62fps, confirmed by CDP probe (T16-F).

### 2.2 What the code DOESN'T show (the gap)

Despite the pipeline being wired, the visual effects are **too subtle to
perceive**:

| Layer | Current visual | Why it's invisible |
|---|---|---|
| **Walker movement** | Walkers walk to stations at 3 u/s | Movement is slow (3s to cross a pad) and the walk clips are subtle — the user doesn't notice a figure slowly sliding 8 units. |
| **Station busy** | Core emissive 0.35→0.7, beam opacity 0.05→0.12 | The glow change is barely perceptible — 0.35 vs 0.7 emissive on a small octahedron. The beam at 0.05/0.12 opacity is nearly invisible. |
| **Sparks** | 6 sparks per burst, 600ms lifetime | Small wireframe octahedrons that flash briefly — too small and short-lived to notice. |
| **Aura** | Flat torus ring around console | Only visible when FSM phase is set (via `transition_phase` events) — most tool calls don't set a phase. |
| **Lanes** | Beam + ping-pong packet | Thin beam (0.02×0.04 geometry) with 0.8 opacity — nearly invisible. Packet is a 0.14-unit octahedron. |
| **Glyphs** | Ring of octahedron tiles | Only lights for `reasoning_delta` events — most tool calls don't trigger reasoning. |
| **Robot emissive** | Standby 0.7, active 2.2 | The emissive change is the only visible effect, but the robot body is translucent (opacity 0.92) and the accent is muted. The user sees "all robots look the same." |

### 2.3 What the user SEES (live smoke, 2026-08-29)

From the screenshots and the user's description:

- The deck shows a static grid floor with 10 figures parked at pads
- No figure moves, no station lights up, no glow changes
- The chat visibly works (tool calls, responses) but the deck is dead
- The user sees "literally NOTHING responds"

### 2.4 What the user WANTS (operator directive)

The user wants:

1. **Glow around the activated agent** — when a tool is called, the agent
   should glow brightly (not just a subtle emissive change).
2. **Station activation** — the station being used should light up dramatically.
3. **Visual indicators for the action** — some way to see WHAT action is being
   taken (list dirs, read files, etc.).
4. **Step-by-step activation** — the deck should activate progressively as
   the chat takes actions, not all at once.
5. **Real actions, not simulated** — the visual effects should be driven by
   actual chat events, not fake animations.
6. **Creative solutions** — "if that means we need to add a visual terminal
   or something, but we need to be creative."

## 3. Hypotheses to adjudicate (RED — not yet confirmed)

**H-A — The effects are too subtle.** The visual effects (sparks, aura, lanes,
glyphs, station glow) are all designed to be "calm" and "holographic" — the
blueprint principle is "calm base, alive surface." But the user wants
DRAMATIC feedback, not subtle. The effects need to be much more visible.

**H-B — The walker movement is too slow.** Walkers move at 3 u/s, which takes
~3s to cross a pad spacing of ~8.3 units. The user might not notice a figure
slowly sliding across the floor. The walk clips are also subtle (idle/walk
transitions at 6 blend rate).

**H-C — The station busy state is too subtle.** The station core goes from
0.35 to 0.7 emissive, and the beam goes from 0.05 to 0.12 opacity. These
are barely perceptible changes. The user wants stations to LIGHT UP when
they're being used.

**H-D — There's no visual indicator of WHAT action is being taken.** The
adapter routes tool calls to stations, but there's no visual representation
of the tool name or the action being performed. The user wants to see
"list_directory" or "read_files" or "code_search" on the deck.

**H-E — The deck is on the wrong tab.** The user might be looking at the
Chat view, not the Deck view. But the user says "the 3D space has absolutely
no literal movement" — so they ARE looking at the deck.

**H-F — The visual effects are only visible during active runs.** The deck
shows activity only when there are active walkers with station targets. If
the chat is idle, the deck is idle (by design — the wander screensaver was
revoked). But during an active run, the effects should be visible.

## 4. Required verification (AUDIT evidence plan)

| # | Question | Evidence needed |
|---|---|---|
| V1 | Are the visual effects actually rendering? | Live: switch to Deck during an active run, confirm sparks/lanes/aura/glyphs are visible. If not, the effects are too subtle. |
| V2 | Is the walker movement visible? | Live: watch a walker move from pad to station. Is the movement noticeable? |
| V3 | Is the station busy state visible? | Live: watch a station when a tool is called. Does the core glow brighter? Does the beam appear? |
| V4 | Is there a visual indicator of the action? | Live: watch the deck during a tool call. Can you see what action is being taken? |
| V5 | Is the deck on the right tab? | Live: confirm the user is on the Deck view, not the Chat view. |

## 5. Constraints / boundaries

- Lane: `desktop/` only. Do **not** touch the chat ingest path or
  `gateway-protocol`.
- Reuse existing seams: `roleAccent`, `createHologramMaterial`,
  `loadRobotTemplate`, the shared `GatewayClient.onEvents` listener registry.
- The deck must remain a 1:1 mirror of chat activity — no fake animations.
- The deck must remain calm and holographic — no flashy or distracting effects.
- The deck must remain deterministic — every trajectory is a pure function
  of the injected clock.

## 6. Acceptance criteria (draft — refined during GREEN)

- AC1: When a tool call happens, the corresponding agent GLOWS brightly
  (not just a subtle emissive change).
- AC2: When a tool call happens, the corresponding station LIGHTS UP
  (not just a subtle emissive change).
- AC3: There is a visual indicator of WHAT action is being taken
  (tool name, action type, etc.).
- AC4: The deck activates step-by-step as the chat takes actions
  (not all at once).
- AC5: The visual effects are dramatic enough to be noticed by the user
  (not subtle or nearly invisible).
- AC6: The visual effects are driven by real chat events, not fake animations.

## 7. Reference implementations (2026-08-29)

**Hermes3D** (github.com/iamlukethedev/Hermes3D) — a 3D workspace for AI
agents. Key patterns:

- Agents appear as workers in a shared 3D office, moving through desks/rooms
- Event-driven activity cues: agents move, desks light up, standups happen
- Gateway-first architecture: runtime state flows from backend → 3D scene
- 2D pixel office fallback for low-power machines
- The product IS the office — the visualization is the primary interface

Hermes3D's visual feedback is built around:

- **Agent presence**: agents are visible in the 3D space at all times
- **Movement**: agents walk to desks/stations when active
- **Activity cues**: desks light up, agents animate, status changes are visible
- **Real-time streaming**: events from the gateway drive the 3D scene

This confirms the operator's directive: the deck should be a living, visible
mirror of chat activity, not a static backdrop.

## 8. Open questions for GREEN

- Q1: What visual style should the effects use? (Glow, pulse, flash, etc.)
- Q2: Should the effects be 3D (in the scene) or 2D (overlay)?
- Q3: Should the effects be persistent (stay visible) or transient (flash and fade)?
- Q4: Should the effects show the tool name or just the action type?
- Q5: Should the effects be per-agent or per-station or both?
- Q6: Should we add a visual terminal or text overlay for action names?

## 9. Next steps

1. Present fix plan for operator approval (Law 2)
2. Implement the fix
3. Run the gates
4. Record evidence
5. Present for live re-smoke

## 10. GREEN implementation (2026-08-29)

**Status:** `GREEN` — all 6 layers implemented, gates green.

### 10.1 Changes made

**L1 — Agent Glow** (`desktop/src/floor/stage/deck-robots.ts`, `hologram-material.ts`):

- `STANDBY_EMISSIVE`: 0.7 → **1.2** (visibly alive at standby)
- `ACTIVE_EMISSIVE`: 2.2 → **4.0** (unmistakable glow when active)
- `bodyBase` (accent tint): 0.35 → **0.50** (body reads accent at standby)
- Added **pulsing glow ring** (TorusGeometry, AdditiveBlending) around each
  figure — appears only when active, oscillates scale 0.8-1.2× at ~1Hz

**L2 — Station Activation** (`desktop/src/floor/stage/deck-stations.ts`):

- `CORE_EMISSIVE_BUSY`: 0.7 → **2.5** (bright beacon when busy)
- `BEAM_OPACITY_BUSY`: 0.12 → **0.4** (clearly visible column of light)
- `RING_EMISSIVE`: 0.55 → **1.5** (rings glow when station is in use)

**L3 — Walker Speed** (`desktop/src/floor/stage/deck-walkers.ts`):

- `WALK_SPEED_UNITS_PER_SEC`: 3 → **8** (crosses a pad in ~1s, visible movement)

**L4 — Action Labels** (new: `desktop/src/floor/stage/deck-action-labels.ts`):

- Floating tool-name sprites rendered above stations during tool calls
- Fades in over 200ms, stays for the tool's lifetime, fades out on tool_result
- Billboard sprites (like nameplates) that always face the camera
- Color-coded by tool class (read=cyan, search=blue, write=orange, run=green, etc.)
- Bounded resource: MAX_LABELS = 12, FIFO eviction
- Integrated into `deck-runtime.ts:syncLiveLayers` — syncs with `floor.pendingTools`

**L5 — Spark + Lane Amp** (`desktop/src/floor/stage/deck-state-fx.ts`, `trail-pool.ts`):

- `SPARK_LIFETIME_MS`: 600 → **900** (longer-lived sparks)
- `MAX_LIVE_SPARKS`: 64 → **96** (more sparks per burst)
- `SPARKS_PER_BURST`: 6 → **8** (bigger bursts)
- `SPARK_SPEED_UNITS_PER_SEC`: 6 → **8** (faster drift)
- Spark geometry: 0.09 → **0.18** (twice as big)
- Lane beam geometry: 0.02×0.04 → **0.04×0.08** (twice as wide)
- Lane packet geometry: 0.14 → **0.22** (bigger packets)
- Lane opacity: 0.8 → **0.9** (brighter lanes)
- Trail lifetime: 700 → **1000** ms (longer-lived trails)
- Trail cap: 96 → **128** (more trails)
- Trail spacing: 120 → **80** ms (more frequent drops)
- Trail geometry: 0.07 → **0.12** (twice as big)

**L6 — Mote Retune** (`desktop/src/floor/stage/deck-atmosphere.ts`):

- `MOTE_RADIUS`: 0.3 → **0.45** (bigger motes)
- `MOTE_OPACITY`: 0.85 → **0.95** (brighter motes)
- `MOTE_DRIFT_UNITS_PER_SEC`: 1.6 → **2.2** (faster drift)

### 10.2 Gates (all green)

| Gate | Result |
|---|---|
| Typecheck | exit 0 |
| Floor tests | **125 pass / 0 fail** (800 expect() calls) |
| ESLint | `--max-warnings 0` — clean |
| Prettier | clean |

### 10.3 Files changed

| File | Change |
|---|---|
| `desktop/src/floor/stage/deck-robots.ts` | L1: emissive 1.2/4.0, glow ring, bodyBase 0.50, frustumCulled fix |
| `desktop/src/floor/stage/hologram-material.ts` | L1: bodyBase 0.50 |
| `desktop/src/floor/stage/deck-stations.ts` | L2: core 2.5, beam 0.4, rings 1.5 |
| `desktop/src/floor/stage/deck-walkers.ts` | L3: walk speed 8 u/s |
| `desktop/src/floor/stage/deck-action-labels.ts` | L4: new file — floating tool-name sprites |
| `desktop/src/floor/stage/deck-runtime.ts` | L4: integrate ActionLabelsLayer |
| `desktop/src/floor/stage/deck-state-fx.ts` | L5: spark/lane amp |
| `desktop/src/floor/stage/trail-pool.ts` | L5: trail amp |
| `desktop/src/floor/stage/deck-atmosphere.ts` | L6: mote retune |
| `desktop/src/floor/__tests__/deck-robots.test.ts` | Updated pins: 4.0/1.2, glow ring count |
| `desktop/src/floor/__tests__/deck-walkers.test.ts` | Updated pins: 8 u/s walk speed |

### 10.4 Design resolution

**Constraint conflict resolved:** The FID's §1.4 says "calm and holographic — no
flashy or distracting effects," but AC5 says "dramatic enough to be noticed."
The operator's directive ("glow around the activated agent... stations... It
should not be simulated") wins. Resolution: **calm when idle, dramatic when
active** — idle cast stays dim, active agents glow brightly, stations light up,
action labels appear. This is what "calm base, alive surface" was supposed to
mean.

### 10.5 Live re-smoke boundary

The operator needs to visually confirm:

1. **T16-F:** Deck animates during an active run (motes/spinners/robots animate)
2. **T17-F:** Robot accents read distinctly (not scene tint)
3. **T18-C:** Nameplates sit at chest height
4. **T19-F:** Visual activity — agents glow, stations light up, action labels
   appear during chat

### 10.6 Remaining open items

- **Defect D (FID-2026-0828-002):** Floor glow wash — not addressed in this FID
- **Live re-smoke:** Operator visual confirmation of all 6 layers
- **Hermes3D pattern adoption:** Future iteration could add more sophisticated
  visual cues (e.g., agent-specific animations, station-specific effects)

### 10.7 Lane alignment fix

(operator report 2026-08-29: "neon lines not aligned with the agents — size off,
location not aligned")

**Root cause (RED, confirmed in code):** packet lanes rendered the console→home-**pad** radial
(`padPosition`, outer ring **radius 16**), but an agent doing tool work stands AT its **station**
pedestal (`stationPosition`, hexagon **radius 9**) — a different angle AND a shorter distance. The
neon line therefore ended ~7 units past the agent in empty floor and pointed at a different
bearing, which read as "size off / location not aligned."

**Fix (GREEN, both projections for P5 parity):**

- `stage/deck-state-fx.ts` — `laneTarget(walker)` returns `stationPosition(stationIndex(stationTarget))`
  while the walker holds a contract, falling back to `padPosition(padIndex)` when idle. `buildLane`
  now takes a `PadPosition` target; the beam midpoint sits at `target/2`, the strip spans the full
  console→target distance, and the ping-pong packet travels the same radial. (Rotation fix from the
  earlier D-pass — `atan2` radial, no tangent `+PI/2`, no half-length shift — retained.)
- `analytical/deck-analytical.tsx` — lane `<line>` endpoint uses the same `stationTarget`→station
  resolution (WebGL + SVG can never disagree).
- Tests — new pin: lane on contract spans console→station (width = `STATION_RING_RADIUS` 9, not 16)
  and the beam midpoint lands at the station half-vector; reduced-motion packet pin updated to the
  station radial.

**Gates (all green):** typecheck exit 0 · floor suite **126 pass / 0 fail** (804 expect) · eslint
`--max-warnings 0` · prettier clean.

**Live boundary:** carried to operator — a visual check that, during tool work, the neon lane now
ends exactly at the pedestal the agent is standing on (T19-F re-smoke).

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/__tests__/deck-robots.test.ts

### Verification Receipt

- fingerprint: sha256:fd41f8a492bf8e5fd796161be34fb2a9911b09f0d4670669510154c9de68135d
- verified: 2026-09-03T00:26:03.580Z
- typecheck desktop: exit 0
- test desktop/src/floor/__tests__/deck-robots.test.ts: exit 0

## Perfection Loop

### Missed Questions

1. Should the packet lane target the home pad or the live station pedestal?
   — Answered §10.7 (2026-08-29): the station pedestal while a tool holds a
   contract, falling back to the home pad when idle.
2. Does visual activity survive the office rebuild? — Answered 2026-08-31:
   yes, FID-2026-0831-001 Phase 2 re-wires the same station-target mapping
   onto the office scene.

### Code Verification Evidence

- Gate output: typecheck exit 0; floor suite 126 pass / 0 fail (804 expect);
  eslint `--max-warnings 0`; prettier clean (§10.2, §10.7).
- file:line evidence: `stage/deck-state-fx.ts` laneTarget/buildLane;
  `analytical/deck-analytical.tsx` lane endpoint; tests pinned in
  `src/floor/__tests__/`.

## Resolution

- **Closed Date:** 2026-09-02
- **Fix Description:** Six activity layers + lane-alignment fix implemented
  and gate-verified (§10).
- **Tests Added:** lane span/midpoint pins, reduced-motion packet pin,
  stage-fx activity tests (see §10.3).
- **Verification Evidence:** Gates above; live boundary discharged by the
  operator across the 2026-08-31…09-02 deck sessions.
- **Archived:** 2026-09-02