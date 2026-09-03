# FID: Deck Ambient Life, Interaction & Headroom (FID-2026-0901-003)

**Filename:** `FID-2026-0901-003-deck-ambient-life-interaction.md`
**ID:** FID-2026-0901-003
**Severity:** medium
**Status:** fixed
**Created:** 2026-09-01
**YAGNI-Compliance:** Verified

---

## Summary

The operator approved the six deck-headroom features I named after the
Hermes3D reference. The deck currently mirrors real chat activity well, but the
space is **static and passive** when idle — agents park, the lighting never
changes, nothing is clickable, and there is no ambient "living" motion. This FID
adds: (1) a day/night lighting cycle with animated ceiling spotlights, (2)
click-to-focus camera + hover tooltips on agents and desks, (3) ambient idle
fidgets (agents drift to breaks on a timer), (4) activity effects (tool-run
screen flicker, result spark bursts, streaming indicator), (5) a richer
furniture set (coffee machine, fridge, water cooler, couch, whiteboard), and
(6) a follow-cam preset on the active agent.

## Environment

- **OS:** Windows
- **Runtime:** Bun ≥ 1.3.14, React 19, React Three Fiber, @react-three/drei, @react-three/postprocessing
- **Workspace:** `desktop/` (floor renderer + chat surface)

## Detailed Description

### Problem

The office floor is correct but lifeless and non-interactive:

- Lighting is a **static** rig — no time-of-day variation, ceiling strips are
  fixed bars (no moving spotlights).
- Agents are **not clickable** and desks/agents show no hover affordance; you
  can't focus the camera on a specific agent from the deck.
- When idle, agents do nothing but stand at their desk (ambient motion was
  deliberately removed in P8 when the operator flagged "aimless wandering").
- Tool activity is shown (beacon + desk light), but there is no richer feedback:
  no streaming indicator over the thinking agent, no result spark burst.
- Furniture is thin: desks, bookshelves, plants, server racks, holo columns,
  cargo. Missing the lived-in office staples (coffee, water, fridge, couch,
  whiteboard).
- No follow-cam: you can't track the currently-acting agent.

### Expected Behavior

1. Lighting slowly cycles day→night; ceiling spotlights gently sweep.
2. Clicking an agent or desk eases the camera onto it; hovering shows a tooltip.
3. Idle agents periodically fidget — drift to a break point, then return.
4. Active tool work shows a streaming indicator; a completed tool fires a spark
   burst at the agent.
5. The office has a coffee machine, water cooler, fridge, a couch, and a
   whiteboard.
6. A follow-cam preset tracks the active (station-target) agent.

### Root Cause

The office scene (`office-scene.tsx`) was built to mirror activity but not to
**be inhabited**. Motion was removed wholesale in P8 to kill aimless drift;
interaction furniture never existed; and the camera rig is a static OrbitControls
with no focus target or follow mode.

### Evidence

- `desktop/src/floor/office/office-scene.tsx` — `OfficeEnvironment` (static
  lights), `AgentCharacter` (no pointer handlers), `CameraRig` (static orbit).
- `desktop/src/floor/office/office-motion.ts` — roam helpers exist (`roamPoint`,
  `idleDwellMs`, `roamEpoch`) but are no longer wired into the frame loop.
- `desktop/src/floor/office/office-props.tsx` — furniture primitives present, no
  break-furniture set.

## Impact Assessment

### Affected Components

- `desktop/src/floor/office/office-scene.tsx`
- `desktop/src/floor/office/office-props.tsx`
- `desktop/src/floor/office/office-motion.ts`
- `desktop/src/floor/office/__tests__/office-motion.test.ts`

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium — additive visuals; no data-path change
- [ ] Low

## Proposed Solution

### Approach

Add six additive features without touching the activity mirror logic:

1. **Day/night cycle + ceiling spotlights** — a time-of-day light rig (ambient,
   hemisphere, background color lerp) driven by a slow clock, plus 2–3 animated
   spotlights that sweep the floor at ceiling height.
2. **Click-to-focus + hover tooltips** — `AgentCharacter` wraps its body in a
   pointer-visible group; clicking dispatches a `focusAgent` event; hovering shows
   a floating tooltip. A `FocusRig` eases the camera toward the focused target.
3. **Ambient fidgets** — re-enable roam-but-purposed: idle agents pick a break
   point (coffee/water/console) deterministically, walk, dwell, return. Never
   active while a tool is running (station target wins).
4. **Activity effects** — a streaming indicator (pulsing dots) over the thinking
   agent; a `ResultBurst` spark field that fires on `floor.lastPulse` seq change.
5. **Break furniture** — coffee machine, water cooler, fridge, couch, whiteboard
   as procedural meshes in `office-props.tsx`.
6. **Follow-cam preset** — when the active agent (station target) exists, the
   `FocusRig` follows it; one key toggles follow on/off, else orbit.

### Steps

1. Extend `office-motion.ts` with `breakPoint(seed, epoch)` + `FIDGET_DWELL_MS`.
2. Add break furniture to `office-props.tsx` (coffee/water/fridge/couch/whiteboard).
3. Add a `DayNightCycle` light rig + `CeilingSpotlights` to the scene.
4. Wire ambient fidget target selection into the `OfficeContents` frame loop.
5. Add `focusAgent` click + hover tooltip + `FocusRig` follow-cam to `AgentCharacter`.
6. Add activity effects: streaming indicator over the busy agent + result spark
   burst keyed off `floor.lastPulse.seq`.
7. Run gates + tests.

### Verification

- `bun x tsc --noEmit` in `desktop/`
- `bun test src/floor/`
- `bun x eslint src/floor/office/ --max-warnings 0`
- `bun x prettier --check src/floor/office/`

## Verification Gates

- gate: test desktop/src/floor/office/__tests__/office-motion.test.ts

### Verification Receipt

- fingerprint: sha256:748c61e1ef2b4adef81a53a2b8bacc566cb585e7a1fcb8f45a39ebec333d93f8
- verified: 2026-09-03T00:26:06.271Z
- test desktop/src/floor/office/__tests__/office-motion.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The six features are absent; the floor is static/passive.
- **GREEN:** Implement the additive features described above.
- **AUDIT:** See Implementation Evidence + gates below.
- **ADVERSARIAL:** Confirm the activity mirror (station-target wins over fidget)
  is preserved and that fidgets never fire while a tool is running.
- **CHANGE DELTA:** 0% (new FID).

### Loop 2 — Independent audit and self-correction

- **RED:** Cross-check that click-to-focus does not fight the walk/heading frame
  update and that follow-cam eases rather than snaps.
- **GREEN:** Isolate camera motion in a `FocusRig` that runs its own lerp.
- **AUDIT:** Typecheck + tests green; no regression in heading/roam wiring.
- **ADVERSARIAL:** Verify reduced-motion still freezes fidget/spotlight motion.
- **CHANGE DELTA:** Folded into Implementation Evidence.

### Loop 3 — Final convergence

- **RED:** Residual: native smoke is the operator's boundary (WebGL visual).
- **GREEN:** Declare gates; note the interactive visual pass is operator-owned.
- **AUDIT:** Compile-time + unit evidence complete.
- **ADVERSARIAL:** No unevidenced PASS.
- **CHANGE DELTA:** Folded into Implementation Evidence.

## Perfection Loop

### Missed Questions

1. Do ambient breaks fight the live activity mirror? — No: station targets
cancel a break the same frame, and reduced motion disables breaks entirely
(ADVERSARIAL re-audit, Implementation Evidence).
2. Do agents walk through furniture? — Fixed in P9: obstacle-aware routing
(`routeAround`) with deterministic tangent detours + layout clearance sweep
tests.

### Code Verification Evidence

- Gate output: desktop typecheck exit 0; floor suite **178 pass / 0 fail**
(5154 expect); eslint `--max-warnings 0`; prettier clean (Gates, post-P9).
- file:line evidence: `office/office-motion.ts` (break/roam/route helpers),
`office/office-plan.ts` (BREAK_SPOTS, WALK_OBSTACLES),
`office/office-scene.tsx` (LivingLights, ThinkingDots, SparkBurst, CameraRig
focus/follow), `office/office-props.tsx` (break furniture).

## Resolution

- **Closed Date:** 2026-09-02
- **Fix Description:** Six ambient-life features implemented (day/night,
click-to-focus + follow-cam, purposeful breaks, activity fx, break
furniture, camera rig) plus the P9 follow-ups (obstacle routing, position
persistence across remounts).
- **Tests Added:** break-helper determinism/bounds/kind-variety,
office-plan geometry, router tests incl. full-layout desk-to-desk clearance
sweep (+16 total across the two gate passes).
- **Verification Evidence:** Gates above (both passes pasted in this FID).
- **Archived:** 2026-09-02

## Implementation Evidence (2026-09-01, loop executed)

All six features implemented as additive changes; the activity mirror
(station-target wins) is untouched and now explicitly overrides breaks.

1. **Day/night + sweeping spotlights** — `LivingLights` in `office-scene.tsx`:
   3-minute cycle lerping background/fog/ambient/hemisphere/directional between
   noir-night and warm-day; two ceiling spotlights (cyan + magenta) orbit the
   floor with convergent oscillation. Reduced motion freezes at night.
2. **Click-to-focus + hover + follow-cam** — `AgentCharacter` gained pointer
   handlers: hover shows a role-colored focus ring + pointer cursor; click eases
   the orbit target onto the agent via the `CameraRig` focus path; **F** toggles
   follow-cam (camera trails the agent at ≤14 units); **Escape** releases. Live
   positions are published by the frame loop into `agentWorldPositions` (single
   writer) — camera never fights walk/heading (isolated in CameraRig).
3. **Purposeful break fidgets** — pure helpers in `office-motion.ts`
   (`breakDwellMs` 12–26s, `breakLingerMs` 4–10s, `breakKindFor`) + a per-agent
   state machine (`work → outbound → linger → return`) in the frame loop. Break
   destinations are NAMED spots (`BREAK_SPOTS` in `office-plan.ts`: coffee,
   water, couch, whiteboard). Any station target cancels the break immediately;
   reduced motion disables breaks entirely. Savant never leaves the center.
4. **Activity fx** — `ThinkingDots` (three pulsing dots) over every working
   agent; `SparkBurst` (10-particle role-colored ring, 700ms fade) fires on the
   working→idle transition (tool completion). Busy desks already glow via the
   P8 monitor/lamp wiring — unchanged.
5. **Break furniture** — `office-props.tsx`: `CoffeeMachine` (glowing brew
   panel, carafe, cup), `WaterCooler` (bottle + status strip + cup dispenser),
   `Fridge` (door-seal glow, handle), `Couch` (cushions, armrests, neon piping),
   `Whiteboard` (seeded marker scrawls in cyan/pink/amber). Placed in the
   +X/+Z corner, clear of the pad ring and emblem.
6. **Camera rig** — min distance lowered 18→8 so focusing an agent actually
   gets close; follow pull-in eases with delta-time; damping unchanged.

### Gates (all green)

- `bun x tsc --noEmit -p tsconfig.json` (desktop) — exit 0
- `bun test src/floor/` — **172 pass / 0 fail** (2262 expect calls; +10 new:
  break-helper determinism/bounds/kind-variety + office-plan geometry)
- `bun x eslint src/floor/office/ --max-warnings 0` — clean (auto-fixed)
- `bun x prettier --write src/floor/office/` — applied

### ADVERSARIAL re-audit

- Station target mid-break → break state dropped same frame (code path
  `else if (breakEntry !== undefined)` in office-scene.tsx). Confirmed.
- Reduced motion → breaks never start (`!reduced` guard) and the light cycle
  freezes at phase=1 (night). Confirmed.
- No unevidenced PASS: every claim above maps to a gate run in this session.

## P9 follow-up (same session, operator reports)

Two operator findings after the first live pass, both fixed:

1. **"Agents walking through desks, not around them"** — every walk was a
   straight line. Added obstacle-aware routing:
   - `office-motion.ts`: `WalkObstacle`, `AGENT_RADIUS`, `ROUTE_PAD`,
     `segmentPointDistance`, and `routeAround(from, to, obstacles)` — a
     deterministic worklist router that inserts tangent detour waypoints for
     every furniture footprint the path would cross, re-checking the remaining
     path after each detour (a single greedy pass was proven to cut corners by
     the layout test and rewritten). Endpoints inside their own zone (a seated
     agent, a break spot hugging its furniture) skip that obstacle.
   - `office-plan.ts`: `WALK_OBSTACLES` — circular footprints for the pedestal,
     all 6 tool desks, all 9 home desks, the 5 break furniture pieces, and the
     server racks / holo columns / cargo stacks. Single truth; the scene never
     re-derives them.
   - Scene: the frame loop now follows routed waypoints (cached per agent,
     recomputed only when the target changes) instead of beelining.
2. **"Clicking chat/deck resets the deck — agents spawn from center"** — live
   positions lived in a `useRef`, discarded on unmount. Now the frame loop
   resumes each agent from the module-level `agentWorldPositions` map (which
   survives remounts); spawn-from-center only happens for genuinely new
   agents. Headings persist the same way via `agentHeadings`.

### Gates (all green, post-P9)

- `bun x tsc --noEmit` (desktop) — exit 0
- `bun test src/floor/` — **178 pass / 0 fail** (5154 expect calls; +6 router
  tests incl. the full-layout desk-to-desk clearance sweep)
- `bun x eslint src/floor/office/ --max-warnings 0` — clean
- `bun x prettier --write src/floor/office/` — applied

## Lessons Learned

- Motion that is *purposed* (to a break point) reads as "alive"; random drift
  reads as "aimless" — always give idle travel a destination the eye can follow.
- Camera control belongs in its own rig (FocusRig), not blended into the frame
  loop that already owns walk positions and heading.
- Reduced-motion must gate every new animated element (cycle, spotlights, fidgets).
