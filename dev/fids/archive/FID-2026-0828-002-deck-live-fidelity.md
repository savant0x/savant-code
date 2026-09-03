# FID-2026-0828-002 — Desktop deck live activity + visual fidelity

> **State:** managed by the operator under `dev/scratchpad` → this FID documents
> the four live-webview deck findings from the 2026-08-28 operator smoke after
> the stale-sidecar boot fix (FID-2026-0828-001 closed the splash stall).
>
> **Kind:** defect + visual-fidelity bundle (RED-phase evidence below). This FID
> exists to run the full Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL)
> before any deck code changes land, then present for install/build.

**Filename:** `FID-2026-0828-002-deck-live-fidelity.md`
**ID:** FID-2026-0828-002
**Severity:** high
**Status:** fixed
**Created:** 2026-08-28
**Parent:** FID-2026-0822-012 (command deck), FID-2026-0824-011 (live driver)

## Summary

The four live-webview deck findings from the 2026-08-28 operator smoke after
the stale-sidecar boot fix (FID-2026-0828-001 closed the splash stall):
defect A (walker/agent render divergence), defect B (robot role-accent
readability), defect C (nameplate height), defect D (glow wash). Defect B
was fixed in GREEN (2026-08-29, see §8); defects C and D were superseded by
the full deck rebuild (FID-2026-0831-001/-002), which replaced the stage
renderer this FID was auditing.

| Field | Value |
|---|---|
| **ID** | FID-2026-0828-002 |
| **Title** | Desktop deck live activity + visual fidelity |
| **Severity** | high (release-blocking visual + functional fidelity) |
| **Status** | `analyzed` (RED awaiting loop) |
| **Parent** | FID-2026-0822-012 (command deck), FID-2026-0824-011 (live driver) |
| **Created** | 2026-08-28 |

## 1. Problem statement

After the desktop boot was repaired (the sidecar was a stale Aug-24 binary, so
the hello reply omitted `projectId` and the renderer never connected), the
operator ran a live smoke and confirmed the app boots and chat works. Four
deck-specific complaints surfaced in the running WebGL floor:

1. **Deck is entirely static while the chat processes.** The floor shows no
   activity motion — nothing progresses while the agent runs.
2. **No robot ever moved** — the walker/robot cast stays fixed.
3. **The floor gradient/glow is too bright** — a green→orange glow washes the
   floor.
4. **Robots take the floor's color, not their own per-role design scheme.**

## 2. RED evidence (live-webview smoke, 2026-08-28)

Operator observed, with a live chat processing `explore the project`, in the
Deck view:

- The WebGL canvas showed the static grid floor + the 10-role cast parked at
  pads. Atmosphere motes and station-core spinners — which the runtime ticker
  animates every frame regardless of live state — appeared frozen.
- No role figure departed its pad or played its walk clip.
- A bright green→orange glow saturated the floor plane near center.
- Robots read as the same greenish body tint rather than their role accent.

### What the code *should* do (invariants from the relevant layers)

- `stage/deck-runtime.ts:mountDeckRuntime` starts a continuous
  `requestAnimationFrame` ticker (`createTicker`) that calls
  `stage.render()` and, each tick, `atmosphere.sync(nowMs)` +
  `stations.sync(nowMs)` + `syncLiveLayers(nowMs)`. Atmosphere motes
  (`deck-atmosphere.ts`, pure function of the clock) and station cores
  (`deck-stations.ts`) should therefore be visibly moving even with zero live
  traffic.
- `stage/deck-walkers.ts` stands the full persistent 10-role cast with
  **Savant always at console** and specialists on pads, per the operator
  directive (all roles visible at all times); `sync()` reconciles the pure
  `FloorState` and steps any active walker toward its station at bounded speed.
- `driver/deck-live-driver.ts` subscribes the shared `GatewayClient.onEvents`
  stream and folds each batch through `adapter/floor-adapter.ts` into
  `FloorState` consumed by walkers + state-FX on every tick.
- Visual: role accents come from `roles.ts:roleAccent(path)`;
  `hologram-material.ts:createHologramMaterial(accent, emissive, …)` builds the
  dark-chassis + accent-emissive shader; `deck-atmosphere.ts` motes use
  `DECK_TOKENS.primary` (`#18faf9`, cyan) with `AdditiveBlending` at
  opacity 0.5.

## 3. Hypotheses to adjudicate (RED — not yet confirmed)

**H-A — static deck + no robot movement is a live-flow gap, not a renderer
freeze.** The floor's animated-but-live-independent surfaces (motes, station
cores) are driven by the same ticker that renders walkers. If those were also
frozen, the ticker/frame loop is the suspect (reduced-motion? rAF not
scheduled? canvas not visually advancing?). If the motes/stations WERE moving
but walkers were not, the gap is walker authorization: the adapter only spawns
activity from `subagent_start`/attributed `tool_call`/`reasoning_delta`. During
an orchestrator-only run (`explore` walks `list_directory`/`read_files` with no
`agentId`), the adapter drops those calls (`floor-adapter.ts`:
`if (!isAuraCall && !attributed) return state`). So "no robot moved while chat
works" is consistent with **no subagent walkers being active** — the cast stays
parked by design — but it does NOT explain motes/stations being frozen.

**H-B — atmosphere/stage visual wash.** `AdditiveBlending` motes stack toward
center (golden-angle spiral density ∝ √i), and robot glow halos + station
emissive accumulate additively. With `DECK_TOKENS.background #050508` void and
a `MeshBasicMaterial` void plane (no tone map on basic materials), the
additive motes near center plus the cyan/ambient lights can read as a bright
green→orange gradient rather than the "calm base" blueprint promise. The
"orange" term may come from `DECK_TOKENS.warning #ff9500` / role accents
(`success #39ff14` green + an orange accent) bleeding into the additive wash.

**H-C — robots take the void/floor color.** The robot body is a translucent
holo material (`opacity 0.92`) whose accent emissive may be overpowered by the
lighting rig (`HemisphereLight '#1b2a38',0.9` + key `#bfe9ff,1.4` + fill
`#18faf9,0.35`). If `emissiveIntensity` (standby 0.7 / active 1.2) is too low
relative to the diffuse response, the figure reads as the scene's cyan/green
light, not its role accent. Also unverified live: did `robot.glb` actually load
(→ GLB cast) or fall back to silhouette (→ all figures share chassis color)?
`lastTemplateOutcome()` telemetry (FID-2026-0824-030) is not surfaced in the UI;
the console `[deck] robot template …` line and `[deck] cast figure … fell back`
lines are the evidence source.

## 3.5 Confirmed evidence (RED adjudication, 2026-08-28 console capture)

- Handshake now reaches `ready`; gateway replies `projectId:"src-tauri"` and the
  full 8-capability list — boot/sidecar fix confirmed (`use-gateway`/client log).
- `deck-robots.ts:84 [deck] robot template loaded (14 clips)` — **the vendored
  `robot.glb` loaded successfully**, so all 10 cast roles mount the real rigged
  GLB figure (not a fallback silhouette). Consequence: the robot-color complaint
  is **H-C**: the translucent holo body (`opacity 0.92`, accent emissive
  `STANDBY_EMISSIVE 0.7`) is reading the stage lighting rig rather than the
  role accent. It is NOT a silhouette fallback.

## 3.5 Confirmed evidence (RED adjudication, 2026-08-28 console + live smoke)

- Boot/sidecar fix confirmed: handshake reaches `ready`, gateway replies
  `projectId:"src-tauri"` + full 8-capability list.
- `[deck] robot template loaded (14 clips)` — **the vendored `robot.glb` loaded**
  successfully, so all 10 cast roles mount the real rigged GLB figure (not a
  fallback silhouette).
- Live observation (operator, Deck foreground during an active run):
  - **Zero movement** — the atmosphere motes, station-core spinners, AND the
    robot figure clips all parked; the canvas reads frozen.
  - Robots render as a **solid slab of the reigning scene tint** (e.g. all
    "blue", all "orange"), not their per-role accent.
  - Each robot's **nameplate floats well above its figure**, not at chest.

## 3.6 Adjudicated root causes (RED → tentative)

**A — frozen floor = reduced-motion static frame (`stage/motion.ts` + runtime).**
`createReducedMotionWatcher` honors `(prefers-reduced-motion: reduce)`; when it
matches, `deck-runtime.ts:applyMotionPreference` renders ONE static frame at
t=0 and never starts the rAF ticker — so motes, station rings, atmosphere, and
robot clips ALL freeze (consistent with “entirely static”, including the
live-independent ambient layers). Contingent on the OS/webview reduced-motion
flag being set (~very likely on the operator's Windows build). Under that
mode the comment says state-truth positions still STEP, so the remaining
“no activity during chat” gap is the adapter below.

> **CONFIRMED 2026-08-29 (operator + code):** operator verified the deck was
> frozen **while chat actively worked** and that motes + spinners froze too —
> matching the single-ticker park. Operator directive: **the live deck always
> animates**; reduced motion governs only the non-live fallback frame.
> **FIXED in `stage/deck-runtime.ts`:** new pure `shouldRunTicker(hasLive,
> reduced)` (live ⇒ always run); `applyMotionPreference` uses it;
> `walkers.sync({ reduced })` narrowed to the non-live fallback only; the
> rAF tick now wraps advance+render in try/catch/finally so one throwing
> layer can no longer silently kill the loop (log-once, loop continues).
> Gates: desktop typecheck exit 0 · floor suite 123 pass / 0 fail · eslint
> `--max-warnings 0` · prettier clean. Live re-smoke boundary carried.

**B — robots solid scene tint = emissive underpowered vs. lighting rig.**
`hologram-material.ts` body is `opacity 0.92` translucent with accent emissive
(STANDBY 0.7 / ACTIVE 1.2); the stage rig (`HemisphereLight #1b2a38,0.9` + key
`#bfe9ff,1.4` + fill `#18faf9,0.35`) dominates the diffuse response, so the
accent reads as the reigning light/void tint, not the role schema. GLB cast is
real (V0), so this is an emissive/lighting balance fix, not silhouettes.

> **FIXED 2026-08-29 (defect B, GREEN):** three changes so the role accent wins
> over the light rig:
>
> 1. `stage/deck-robots.ts` — STANDBY_EMISSIVE 0.22 → **0.7** (restores the
>    FID-2026-0824-028 recovery level; the coherent-dim pass had dropped it to
>    0.22, at which the accent emissive lost to the rig's diffuse response).
>    ACTIVE stays 2.2. The dim standby look comes from the translucent base
>    (opacity 0.92) + dark tinted chassis, not a near-zero emissive.
> 2. `stage/hologram-material.ts` — dark-accent body base 0.22 → **0.35** of
>    the accent so the lit diffuse agrees with the emissive hue instead of the
>    cyan key/fill rig; metalness stays 0.2 so lights cannot re-tint the body.
> 3. `deck-accents.ts` — split the shared palette collisions so all 10 roles
>    are visually separable (scout/researcher no longer ≡ savant on primary;
>    scribe no longer ≡ thinker on muted).
> Gates: desktop typecheck exit 0 · floor suite 123 pass / 0 fail (incl. the
> updated emissive pins 2.2/0.7) · eslint `--max-warnings 0` · prettier clean.
> Live re-smoke (V6) carried to operator.
>
> **T16-F LIVE RE-SMOKE PASS (2026-08-29 ~20:50 EDT, agent-run via CDP):**
> launched the real app (debug exe + fresh dist/ renderer with all A/B/C
> fixes) with `--remote-debugging-port=9223` against the vite dev server,
> drove it over CDP: reducedMotion:false, rAF ~62fps (37-38 frames/600ms),
> all 10 roles mount `glb`, screenshot pairs 1.5-4s apart differ in 0.42%
> idle / 11.11% and 45.92% during an active run (frozen = 0%), and a real
> chat run sent via CDP produced `[deck] batch:` lines with walkers=1 active,
> tools in-flight, pulse=2→3→4. Evidence:
> `dev/session-summaries/2026-08-29-t16f-live-resmoke-pass.md`.
>
> **T16-F LIVE RE-SMOKE PASS (2026-08-29 ~20:40 EDT, agent-run via CDP):**
> launched the real app (debug exe + fresh dist/ renderer) with
> `--remote-debugging-port=9223`, drove it over CDP: reducedMotion:false,
> rAF ~62fps (37-38 frames/600ms), all 10 roles mount `glb`, screenshot pairs
> 1.5-3s apart differ in 2.41-5.29% of pixels (frozen = 0%), and a real chat
> run sent via CDP produced `[deck] batch:` lines with walkers=1 active,
> tools in-flight, pulse=1→2. Evidence:
> `dev/session-summaries/2026-08-29-t16f-live-resmoke-pass.md`.

**D — floor glow wash = additive compounding.** The atmosphere layer uses
> `AdditiveBlending` on motes with radius 0.45 and opacity 0.95. In the
> golden-angle spiral, motes near center stack brightness exponentially —
> the operator saw a bright green→orange glow saturating the floor plane.
> Fix: reduced `MOTE_RADIUS` 0.45 → **0.28** and `MOTE_OPACITY` 0.95 → **0.55**
> so additive compounding is damped while drift speed stays at 2.2 u/s
> (FID-2026-0829-001 L6 motion preserved). Gates: typecheck exit 0 ·
> 125 pass / 0 fail · eslint `--max-warnings 0` · prettier clean.
>
> **T20-D LIVE RE-SMOKE PASS (2026-08-29 ~21:15 EDT, agent-run via CDP):**
> launched the real app with `--remote-debugging-port=9223`, drove it over CDP:
> reducedMotion:false, rAF ~62fps (37-38 frames/600ms), all 10 roles mount
> `glb`, screenshot pairs 1s apart differ in 7081/8566 samples (~82.7% pixel
> change — a frozen deck would be 0%). Live activity confirmed: `[deck] batch:`
> lines with walkers=1 active, tools in-flight, pulse=4→5. Evidence:
> screenshots in `C:/tmp/deck-frame-{1,2}.png`, probe in
> `dev/scratchpad/deck-smoke.cjs` + `deck-shot-diff.cjs`.

**C — nameplates float = positioning mismatch vs. rendered scale.**
`deck-walkers.ts:mountFigure` puts the nameplate at
`ROBOT_TARGET_HEIGHT * 0.4` (25*0.4 = 10 world units) local to a figure root
whose body may not visually occupy that anchor (GLB normalize/eyes-`scale`
discrepancy; the EYE-SCALING session overshoot comment). Needs a height-anchor
that tracks the real figure, tuneable live.

**D — no deck activity during an orchestrator-only run = adapter drop.**
Independent of A: `floor-adapter.ts` drops any `tool_call` without an `agentId`
unless it is `transition_phase`, and robots only spawn/step on
`subagent_start`/attributed calls. A lone `explore` run surfaces only `start`
(Savant presence) — no walker motion. Contributes to “no robot moved even
while chat works” once A is lifted.

## 4. Required verification (AUDIT evidence plan)

| # | Question | Evidence needed |
|---|---|---|
| V1 | Is the rAF ticker actually advancing motes/stations while Deck is foreground? | Live check: toggle to Deck during a run, confirm motes drift + cores spin (screenshot/video) OR read `[deck]` console + reduced-motion pref state |
| V2 | Does the live driver deliver events to the floor? | Confirm `GatewayClient.onEvents` fans out to both the chat ingest AND `deck-live-driver` (single shared client, two listeners) — live + unit trace |
| V3 | Which walker path is unused during orchestrator-only runs? | Live: run `explore`, watch if any `subagent_start`/attributed `tool_call` arrives; capture event types on the shared stream |
| V4 | Is the floor "glow" motes (additive stacking), robot halos, or station emissive? | Component isolation: toggle layer groups, screenshot per layer |
| V5 | Did `robot.glb` load (GLB cast) or fall back (chassis silhouettes)? | `[deck] robot template …` + `[deck] cast figure … fell back` console lines; `castTelemetry()` count vs 10 |
| V6 | Is robot body accent emissive underpowered vs lights? | Render a single role figure against the void; confirm body reads accent, not cyan/green |

## 5. Constraints / boundaries

- Lane: `desktop/` only. Do **not** touch the chat ingest path or
  `gateway-protocol` (the frozen v1 handshake is out of scope post-fix).
- Reuse existing seams: `roleAccent`, `createHologramMaterial`,
  `loadRobotTemplate`, the shared `GatewayClient.onEvents` listener registry.
- Reduced-motion must keep working (park ticker → one static frame).
- Deterministic replay discipline: every animated trajectory stays a pure
  function of the injected clock.

## 6. Acceptance criteria (draft — refined during GREEN)

- AC1: With the Deck foreground during an active run, at least the
  live-independent ambient motion (atmosphere motes, station cores) advances;
  nothing appears frozen.
- AC2: An orchestrator-only run produces visible floor state (Savant console
  burn / FSM aura / reasoning glyphs) even when no subagent walker spawns.
- AC3: Robots read as their distinct per-role accent (not the void/floor tint);
  GLB cast loads (or a documented fallback decision).
- AC4: The green→orange floor glow is damped to a "calm base, alive surface"
  so the grid/hologram reads cleanly.

## 7. Open questions for GREEN

- Q1: What floor state is *minimally* expected during an orchestrator-only run?
  (Savant burn-in + FSM aura only, or also map unattributed tool calls to
  controller activity?)
- Q2: Is the "floor glow" primarily motes, station emissive, or robot halos —
  and should we damp motes (fewer / lower opacity / smaller radius) vs. retune
  lights?
- Q3: Should robots that fall back to silhouettes carry the role accent more
  boldly so they don't read as the floor color?

> **FIXED 2026-08-29 (defect C, GREEN):** operator revised the shared-plane
> directive — cast nameplates back to per-figure CHEST height. In
> `stage/deck-walkers.ts:mountFigure`: anchor restored to
> `nameplate.sprite.position.y = ROBOT_TARGET_HEIGHT * 0.4` (chest fraction
> of the 6-unit body, landing proportionally since the plate is a child of
> the scaled root — Savant taller, specialists standard); the
> `NAMEPLATE_PLANE_Y` import and shared-plane compensation were removed.
> Station plates keep their own plane in `deck-stations.ts`.
> Gates: desktop typecheck exit 0 · floor suite 125 pass / 0 fail ·
> eslint `--max-warnings 0` · prettier clean.
> Live re-smoke (chest height on each figure) carried to operator.

## 8. GREEN log — defect B (2026-08-29)

Operator directive: robots must read their role accent, not the scene tint.
Changes (all in `desktop/src/floor/`):

1. `stage/deck-robots.ts` — `STANDBY_EMISSIVE` 0.22 → **0.7** (restores the
   FID-2026-0824-028 recovery level; at 0.22 the accent emissive lost to the
   stage rig's diffuse response). `ACTIVE_EMISSIVE` stays 2.2. The dim-standby
   look comes from the translucent base (opacity 0.92) + dark tinted chassis,
   not a near-zero emissive.
2. `stage/hologram-material.ts` — dark-accent body base 0.22 → **0.35** of the
   accent, so the lit diffuse agrees with the emissive hue; metalness stays 0.2
   so the key/fill lights cannot re-tint the body.
3. `deck-accents.ts` — split the shared palette collisions so all 10 roles are
   visually separable: scout → `#7fd4b8` (seafoam), researcher → `#b8a6e8`
   (lavender), scribe → `#8f9aa8` (slate — distinct from thinker's warm muted).
   `ROLE_FLOOR_ACCENTS` updated; chrome tokens untouched.
4. `__tests__/deck-robots.test.ts` — reduced-motion pin updated 0.22 → 0.7
   (constructor-level emissive under the coherent dim/bright contract).

**Gates (all green):** desktop typecheck exit 0 · floor suite 123 pass / 0 fail
· eslint `--max-warnings 0` · prettier clean.
**Carried:** live re-smoke (V6: single role figure vs void — body reads accent,
not cyan/green) is operator-run; defects C (nameplate height) and D (glow
wash) were superseded by the deck rebuild FID-2026-0831-001/-002 (their
surfaces no longer exist on the rebuilt deck).

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/__tests__/deck-robots.test.ts

### Verification Receipt

- fingerprint: sha256:bef484c3614f34d40adabdb1b87c61ea4a8640dbb06964441e319a37783ff2ab
- verified: 2026-09-03T00:25:55.931Z
- typecheck desktop: exit 0
- test desktop/src/floor/__tests__/deck-robots.test.ts: exit 0

## Perfection Loop

### Missed Questions

1. Should defects C/D be fixed in place or absorbed by the FID-2026-0831-001
   deck rebuild? — Answered 2026-08-31: absorbed; the rebuild replaced the
   stage surface this FID's defects lived on.

### Code Verification Evidence

- Gate output: desktop typecheck exit 0; floor suite 123 pass / 0 fail;
  eslint `--max-warnings 0`; prettier clean (GREEN log §8, 2026-08-29).
- file:line evidence: `stage/deck-robots.ts` STANDBY_EMISSIVE 0.22 → 0.7;
  `stage/hologram-material.ts` body base 0.22 → 0.35; `deck-accents.ts`
  scout/researcher/scribe palette splits (§8).

## Resolution

- **Closed Date:** 2026-09-02
- **Fix Description:** Defect B fixed (emissive/body-base/palette trio, §8).
  Defects C and D superseded by the FID-2026-0831-001/-002 deck rebuild.
- **Tests Added:** reduced-motion emissive pin update in
  `__tests__/deck-robots.test.ts`.
- **Verification Evidence:** Gates above (GREEN log §8).
- **Archived:** 2026-09-02