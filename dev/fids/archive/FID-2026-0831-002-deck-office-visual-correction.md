# FID-2026-0831-002 — Deck office visual correction: readable neon-noir world

| Field | Value |
|---|---|
| **Filename** | `FID-2026-0831-002-deck-office-visual-correction.md` |
| **ID** | FID-2026-0831-002 |
| **Severity** | critical (native smoke fails the flagship visual acceptance bar) |
| **Status** | `fixed` (P1–P6b/P6c/P7/P8 implemented; visual corrections discharged by operator live smoke) |
| **Created** | 2026-08-31 |
| **Parent** | FID-2026-0831-001 (deck rebuild scaffold), FID-2026-0829-001 (visual activity) |
| **Scope register** | SCOPE.md Task 15 follow-up; operator-requested correction FID |

**Filename:** `FID-2026-0831-002-deck-office-visual-correction.md`
**ID:** FID-2026-0831-002
**Severity:** critical
**Status:** fixed
**Created:** 2026-08-31
**Parent:** FID-2026-0831-001, FID-2026-0829-001

---

## Summary

The first native smoke of FID-2026-0831-001 demonstrated that the R3F scaffold
is not visually acceptable: the operator sees mostly black, Savant is framed at
the bottom, no office details are visible, no recognizable robots/models are
present, and no Hermes3D-like movement can be perceived. This correction rebuilds
the presentation layer into an unmistakably readable cyberpunk/neon-noir office:
visible floor architecture, room zones, personal workstations, articulated
agent characters, deliberate camera composition, and observable real-event motion.
The existing FloorState/live gateway plumbing remains the source of truth.

## Environment

- **OS:** Tauri v2 desktop WebView2/WebKit; native smoke is authoritative
- **Language/Runtime:** TypeScript strict, React 19, Bun 1.3.14, Three.js 0.185.1,
  React Three Fiber 9.7.0, drei 10.7.8, postprocessing 3.1.1
- **Tool Versions:** Existing desktop dependencies; no additional service
- **Commit/State:** Working tree after FID-2026-0831-001 P0–P3; native smoke failed

## Detailed Description

### Problem

Operator smoke reported: mostly black output; Savant moved toward the bottom after
sending a message; no office details; no robots or models; no visible movement like
Hermes3D. Ground-truth review of the current scene confirms:

- `desktop/src/floor/office/office-scene.tsx` renders only six tool desks and simple
  capsule/sphere characters; it has no room shell, floor markings, personal desks,
  console architecture, wall details, or visible character limbs/faces.
- The character group is rendered at its default origin and its `useFrame` loop moves
  direct children by `userData.agentId`; the camera is `[0,14,26]` looking toward the
  origin, so the composition lacks an intentional office framing and depth cue.
- `office-plan.ts` contains only tool-desk positions and home coordinates; “home” is
  an empty pad coordinate, not a rendered workstation.
- `neon-atmosphere.tsx` supplies post-processing but not the missing emissive geometry.
  Bloom cannot make absent geometry visible.
- Speech-bubble reducer exists and is tested, but no scene component subscribes to
  `text` events and renders its output.

### Expected Behavior

On native startup, the Deck tab must immediately read as a place before any live
activity occurs:

1. A visible dark-blue/black floor plane with perspective grid, lane markings,
   neon perimeter rails, room divisions, and a central command console.
2. Six named tool rooms/desks and nine visible personal workstations, with cyan,
   magenta, green, amber, and red role/station accents. Idle detail remains dim but
   readable; active detail becomes bright.
3. Ten recognizable low-poly agent characters (Savant plus nine ECHO roles) with
   torso, head, arms, legs, eyes/visor, accent rim, and nameplate. They are visibly
   separate from the floor and never hidden by the camera.
4. A composed camera showing the full office initially (no bottom-edge Savant crop),
   with orbit/pan/zoom controls bounded to the office.
5. On a real `tool_call`, the owning character visibly walks from its home desk to
   the matching tool room/desk; on its paired result it visibly returns. Motion must
   be driven by FloorState, not timers or invented demo events.
6. On real `text` events with an attributable active `agentId`, a bounded neon speech
   bubble appears over that character; unattributable text is dropped honestly.
7. WebGL fallback remains the existing analytical SVG projection; reduced-motion
   mode disables walking animation while preserving state changes and readability.

### Root Cause

FID-2026-0831-001 implemented the architectural scaffold but not the visual product:
R3F Canvas, primitive entities, and post-processing were mistaken for an office. The
Hermes3D reference's effect comes from the combination of environment geometry,
character anatomy, authored camera framing, and visible event-driven motion — not from
Bloom or emissive material values alone.

### Evidence

- Native smoke report from operator 2026-08-31: mostly black; Savant bottom; no office,
  robots/models, or Hermes3D-like movement.
- `desktop/src/floor/office/office-scene.tsx:1-219`: current R3F scene contains only
  capsule/sphere characters, six desk groups, lights, and a Canvas; no office shell.
- `desktop/src/floor/office/office-plan.ts:1-67`: current plan exposes tool desks and
  coordinate functions only; no rendered home-desk objects.
- `desktop/src/floor/office/neon-atmosphere.tsx:1-53`: post-processing has Bloom and
  Vignette, but no scene geometry.
- `resources/Hermes3D-main/src/features/retro-office/objects/agents.tsx:1-120`:
  Hermes3D's character component contains separate limb, face, bubble, and interaction
  refs; the current scene has one capsule plus one sphere.
- `resources/Hermes3D-main/src/features/retro-office/RetroOffice3D.tsx:5750-5909`:
  Hermes3D composes a full Canvas scene with atmosphere, floor/walls, furniture,
  models, controls, and runtime systems; the current scene has none of those office
  layers.

## Impact Assessment

### Affected Components

- `desktop/src/floor/office/office-scene.tsx` — replace the incomplete scene composition
- `desktop/src/floor/office/office-plan.ts` — add shared room/home-desk geometry
- `desktop/src/floor/office/office-motion.ts` — retain pure movement contract; extend
  only if needed for arrival/facing
- `desktop/src/floor/office/speech-bubbles.ts` — retain reducer; wire to real text events
- `desktop/src/floor/office/neon-atmosphere.tsx` — retain postfx; add only required light
  contract changes
- `desktop/src/floor/deck-view.tsx` — preserve fallback; improve fixed canvas sizing and
  error handling if native smoke identifies a shell-specific issue
- `desktop/src/floor/office/__tests__/` — geometry, motion, speech, and scene contract tests
- `desktop/package.json` / `bun.lock` — no new dependencies expected

### Risk Level

- [x] Critical: flagship visual feature currently fails its primary acceptance bar
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Treat this as a visual-product rebuild, not a shader tuning pass. Establish a fixed
orthographic/isometric office composition first, then build visible geometry from the
outside in: floor/rooms → furniture/signage → characters → live motion → speech
bubbles → atmosphere. Keep each seam small and testable under the existing 300-line
quality ceiling. Do not retire the old stage until native smoke confirms the replacement.

### Steps and statuses

1. **P0 — Native render baseline (`implemented`):** reproduce in the Tauri shell, capture
   the failure, and keep the browser/Tauri distinction explicit. No browser-only smoke
   counts as acceptance.
2. **P1 — Readable office shell (`blocked` pending approval):** add a visible floor plane,
   neon grid/rails, central console, six tool-room bays, nine home-desk props, room
   labels/signage, and authored camera target/position. All coordinates derive from the
   existing `padPosition`/`stationPosition` functions.
3. **P2 — Recognizable characters (`blocked` pending approval):** replace capsule/sphere
   silhouettes with a ≤300-line articulated low-poly character component: torso, head,
   two arms, two legs, visor/eyes, role accent rim, nameplate. Parent group must carry
   `userData.agentId`; the frame loop must mutate that group only. Add a static roster
   mode so all canonical roles are visible at idle when the live state has not spawned
   them, without inventing activity or events.
4. **P3 — Observable live motion (`blocked` pending approval):** fix the render-state
   seam so React-created groups receive current pose props while the ref loop updates
   only positions/rotation/bob. Tool calls target the matching room; result returns
   home. Add visible arrival pulse and facing direction, all derived from FloorState.
5. **P4 — Real speech bubbles (`blocked` pending approval):** add a small injected
   event-to-bubble seam. Preferred design: extend the shared driver with a bounded,
   attributable text snapshot alongside FloorState, avoiding a second gateway
   subscription. Render `SpeechBubble` billboards from that snapshot with the tested
   flatten/clamp/TTL/FIFO reducer. If the driver API cannot safely expose text, stop and
   re-present option B (direct gateway subscription); do not silently choose.
6. **P5 — Neon-noir readability/perf (`blocked` pending approval):** make the floor readable
   at idle (not black), preserve `DECK_TOKENS`/role accents, use bloom only as an accent,
   clamp DPR, keep postfx optional, and verify native startup plus reduced-motion behavior.
7. **P6 — Parity retirement (`blocked` pending P5 native smoke):** only after operator
   confirms the office visually meets the target, remove obsolete stage modules/tests;
   until then they remain rollback safety. No dead-code deletion before parity.

### Verification

- Static: `bun run --cwd=desktop typecheck` exit 0; eslint `--max-warnings 0` on all
  touched files; prettier clean.
- Unit: `bun test desktop/src/floor/office/__tests__/` plus full
  `bun test desktop/src/floor/`; existing adapter/driver tests remain green.
- Native runtime: launch with `bun tauri dev`; verify sidecar readiness and inspect the
  actual Tauri window. Browser Vite output is not acceptance evidence.
- Visual acceptance checklist: office floor, walls/rooms, personal desks, full cast,
  readable camera, walk-to-tool then return on a real event, visible active desk glow,
  real attributable speech bubble, fallback and reduced-motion behavior.
- Call graph: grep confirms `OfficeScene` → `OfficeContents` → `AgentCharacter` and
  `getSharedDeckDriver` → `FloorState`; grep confirms no fake event/timer source.
- No new dependencies unless P0 evidence proves the existing stack insufficient;
  any dependency change requires a new P0 gate and operator review.

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/office/__tests__/office-motion.test.ts
- gate: test desktop/src/floor/__tests__/floor-adapter.test.ts

### Verification Receipt

- fingerprint: sha256:2fa359cdef029864d72da0071f644a17319ffc63bd6fe0efb0de77b13f99ae9f
- verified: 2026-09-03T00:28:56.939Z
- typecheck desktop: exit 0
- test desktop/src/floor/office/__tests__/office-motion.test.ts: exit 0
- test desktop/src/floor/__tests__/floor-adapter.test.ts: exit 0

## Perfection Loop

### Missed Questions

1. Can the office metaphor survive low-poly primitives? — Mitigated by
articulated character anatomy and authored readable spaces; the operator's
native smoke remained the final authority across P6a→P8.
2. Does the rebuild lose rollback safety? — No: the old stage renderer was
retained until P4 retirement, so every pass was revertible.

### Code Verification Evidence

- Gate output: `typecheck desktop` exit 0; `test
  desktop/src/floor/office/__tests__/office-motion.test.ts` exit 0; `test
  desktop/src/floor/__tests__/floor-adapter.test.ts` exit 0 (Verification
  Receipt, stamped 2026-09-03).
- file:line evidence: `office/office-plan.ts` (desk geometry,
  standSpot/deskFaceTarget), `office/office-scene.tsx` (frame loop, beacon
  + activity ring), `office/office-props.tsx` (sci-fi prop layer),
  `office/robot-cast.ts` (GLB cast + rim + role tint), `driver/` text
  snapshot tests (3 added).

### Loop 1 — RED

- **RED:** Native smoke falsified the prior FID's visual acceptance. The scene has
  post-processing and primitive meshes but no authored office environment, no full cast,
  no personal desks, and no visible text-bubble path. Savant's bottom placement and
  invisible cast show composition/render-state defects, not insufficient glow.
- **GREEN:** Scope corrected from “R3F scaffold” to “readable office product”: authored
  environment, home desks, full character anatomy, fixed camera, state-driven motion,
  real bubble seam, and native acceptance. Old stage retention prevents rollback loss.
- **AUDIT:** Evidence cites actual current scene and reference ranges above. Every proposed
  phase has an explicit status; no implementation is claimed. No dependency expansion is
  proposed. Critical native-only acceptance is explicit.
- **ADVERSARIAL:** A visual reviewer could still reject low-poly primitives as unlike
  Hermes3D. Mitigation: anatomy must be visibly articulated and the environment must have
  readable authored spaces; operator smoke remains the final authority. A browser screenshot
  could hide Tauri IPC failure; mitigation: native Tauri launch is mandatory.
- **CHANGE DELTA:** ~20% from the initial correction draft.

### Loop 2 — Independent audit and self-correction

- **RED:** The first plan implied the live `FloorState` contained text events, which it
  does not. It also implied a static roster without defining whether those agents were
  “active,” risking fake activity.
- **GREEN:** P4 now requires an injected bounded text snapshot; P2 explicitly says static
  roster characters are present but do not produce activity. P3 requires parent-group
  identity and separates React props from per-frame mutations.
- **AUDIT:** `common/src/types/print-mode.ts:55-58` confirms `text` has optional
  `agentId`; `desktop/src/state/transcript-store.ts:202-204` confirms transcript text
  is consumed separately; `desktop/src/floor/adapter/floor-adapter.ts:87-111` confirms
  FloorState has no text field. The FID no longer claims otherwise.
- **ADVERSARIAL:** Direct gateway subscription is simpler than driver extension but risks
  two event consumers and mismatched clocks. Preferred driver snapshot keeps one event
  path; fallback is explicitly a blocking re-presentation, not an internal decision.
- **CHANGE DELTA:** ~8%.

### Loop 3 — Final convergence

- **RED:** Existing scope says “no code until FID approved,” and this correction is itself
  the requested planning artifact. The P4 dependency choice remains an implementation
  decision, but acceptance cannot depend on either option before its seam is verified.
  Existing `deck-view.tsx` WebGL probe listens on `window`, not the canvas; a native
  context-loss test may require correction.
- **GREEN:** P4 preserves both design options with a preferred order and stop/re-present
  rule. P5 explicitly tests context-loss behavior in the Tauri window and retains the SVG
  fallback. P6 remains blocked on operator smoke.
- **AUDIT:** FID gates are syntactically valid allowlisted declarations; `desktop` is
  allowed by `scripts/validation-manifest.ts:22-35`. The FID status is `converged` and
  no implementation evidence is claimed. The previous smoke defect is recorded in
  `SCOPE.md` as `[OPEN-OUT-OF-SCOPE]`.
- **ADVERSARIAL:** “Why not just copy Hermes3D?” Rejected: its Next.js/Studio runtime,
  7856-line monolith, retro palette, and backend boundary do not fit the Tauri desktop;
  its spatial/product patterns are adopted, not its whole application. “Why keep old
  stage code?” Because deleting rollback safety before native parity would make a failed
  visual experiment harder to recover; P6 deletes it after acceptance.
- **CHANGE DELTA:** ~3% → **converged** (below the 2% trend after final wording
  correction; no unresolved design contradiction).

## Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending operator commit
- [x] **File:line ranges:**
  - P1–P3 (pre-existing from prior session): `office/office-scene.tsx` (full scene:
    environment, cast, desks, camera, frame loop), `office/office-plan.ts` (geometry),
    `office/office-motion.ts` (pure walk math + reduced-motion teleport),
    `office/neon-atmosphere.tsx` (Bloom/Vignette), `deck-view.tsx` (WebGL probe +
    fallback), `office/speech-bubbles.ts` (reducer + honesty filter)
  - P4 (this session): `driver/deck-live-driver.ts` (getTextSnapshot + text fold +
    honesty filter + TTL prune), `office/speech-bubble-3d.tsx` (in-scene billboard
    renderer), `office/office-scene.tsx` (OfficeContents bubbleByAgent →
    AgentCharacter → AgentSpeechBubble), `deck-view.tsx` (useLiveBubbles →
    OfficeScene bubbles prop), `office/speech-bubbles.ts` (reducer)
  - P5 (this session): `office/office-scene.tsx` (reduced-motion gates bob —
    walkPose teleports, no idle/walk bob when reduced)
  - Tests: `__tests__/deck-live-driver.test.ts` (3 new P4 snapshot tests: fold,
    honesty-drop, TTL-prune)
- [x] **Gate output:**
  - desktop typecheck: exit 0
  - floor suite: 156 pass / 0 fail (921 expect) across 20 files
  - eslint `--max-warnings 0`: clean
  - prettier: clean
- [x] **Reproducibility:** `grep -r getTextSnapshot desktop/src/floor` → driver,
  deck-view, tests; `grep -r AgentSpeechBubble desktop/src/floor` → speech-bubble-3d,
  office-scene; `grep -r "bubbles=" desktop/src/floor/deck-view.tsx` → OfficeScene
  bubbles prop wired
- [x] **Step statuses:** P0 `implemented`; P1 `implemented`; P2 `implemented`;
  P3 `implemented`; P4 `implemented`; P5 `implemented`; P6 `blocked` pending
  operator native smoke (T15-F)

## Code Verification Evidence

- [x] Failure files and reference files verified to exist and contain cited evidence
- [x] Implementation matches this FID — P1–P5 implemented, P6 blocked on operator
- [x] Typecheck/tests/lint pass with pasted output — typecheck exit 0; 156/0;
      eslint clean; prettier clean
- [x] Production call-graph evidence — getTextSnapshot: driver→deck-view;
      AgentSpeechBubble: speech-bubble-3d→office-scene; bubbles prop:
      deck-view→OfficeScene→OfficeContents→AgentCharacter
- [x] FID status reflects actual state: P1–P5 implemented, P6 blocked on operator

## P6a — Real-office scene rebuild (2026-09-01, operator: "it needs to be an office")

Operator rejected the neon-void read (screenshot: dark grid floor with glowing
slabs and box figures). Reference: Hermes3D retro-office (MIT, vendored under
`resources/Hermes3D-main/`). Rebuilt in place, same seams:

- `office/procedural-textures.ts` (new) — runtime canvas PBR textures adapted
  from the MIT reference: wood planks, plaster, carpet, brushed metal; seeded
  hash noise (deterministic across sessions); module-level texture cache.
- `office/office-scene.tsx` (rebuilt) — wood plank floor, rug under the command
  area, four plaster perimeter walls with dark cap trim, three warm window
  panels + one thin neon baseboard line (neon demoted to accent), corner plants
  (pot + layered foliage), wooden tool desks with legs/monitor (screen glows
  only while busy)/keyboard/office chair, wooden home desks with desk lamp
  (accent shade), mug, per-desk wood-tone rotation, round wood command console
  with activity-tied holo ring + three status screens, characters in fabric
  tones with arms/legs and accent visor only, warm ambient + hemisphere + two
  directional lights, lighter fog/background (`#0b1018`).
- **Overlap fix (operator: Savant standing on the detective):** the idle-cast
  filler in `OfficeContents` now skips pad indexes already held by real walkers
  (`heldPads` set), so Savant (materialized at pad 0 by the adapter) no longer
  shares a spot with `idle-0`.
- Gates: desktop typecheck exit 0; floor suite 156 pass / 0 fail (921 expect);
  eslint `--max-warnings 0` clean; prettier clean.

## P6b — Cyberpunk restyle + robot cast

(2026-09-01, operator: "textures need to be cyberpunk, the agents need to be
robots")

Operator approved the office STRUCTURE but rejected the warm-wood read. Restyled:

- `office/robot-cast.ts` (new) — per-URL cached GLB loader over the two vendored
  CC0 robots (`public/floor-assets/robots/robot.glb` Quaternius +
  `RobotExpressive.glb` Khronos, per ASSET-MANIFEST.md); design rotates by
  padIndex — two distinct robot designs across the cast. Loader never throws;
  null → solid silhouette fallback.
- `office/office-scene.tsx` — cast swapped from box figures to the shared
  hologram figure factory (`stage/deck-robots.ts` createRobotFigure, height
  1.85): rigged Idle/Walking animations, per-role hologram emissive (standby
  1.2 / active 4.0), active ground-halo pulse. Wrapper groups keep the
  userData.agentId seam so the P1-P5 frame loop, nameplates, and speech
  bubbles ride unchanged.
- Environment restyled cyberpunk: `getTechFloorTextures` (dark metal panels +
  cyan seams) floor, `getDarkPanelTextures` walls, cyan back-wall + magenta
  side-wall glowing window panels, neon baseboard lines, accent edge strips on
  every desk (tool + home), dark-metal desk tops and console, cool noir rig
  (ambient #c2d6ea, hemisphere, cool key/fill) plus cyan/magenta corner point
  pools. NeonAtmosphere bloom retained — emissives now carry the glow.
- **P6b follow-up (operator: "agents have no details, just glowing" + "floor
  all black"):** `createOfficeRobotFigure` (office/robot-cast.ts) replaces the
  stage hologram override — robots KEEP their original GLB materials (their own
  colors/parts are the detail), plus only an activity ground ring. Floor
  brightened (panel albedo #232b36, seams at 0.5 alpha) and a thin neon floor
  grid (FloorGrid: 5×5 cyan lines) added; ambient/hemisphere/key raised.
- **P6c (operator session 3):** role-accent tint per robot figure (cloned
  materials, lerped 45% toward the role accent — the cast no longer reads as
  one same-colored model); clip lookup tolerates both rigs' naming;
  SPAWN_POINT walk-in (new walkers materialize at the console edge and WALK
  to their post, so sending a message visibly animates the floor);
  Savant materialized whenever `savantPresent` and homed on the command tile
  (`CONSOLE_SPOT`); center tile replaced with the glowing SAVANT emblem
  (dark glossy disc + two cyan rings + flat glowing "S"); bookshelves with
  seeded book rows along two walls; per-role desk artifacts (`RoleProp`:
  forge crucible, thinker orb, detective case files, verifier stamp,
  recorder/scribe ledger, scout binoculars, researcher flask, adversary
  blades). Robots still play no per-role ANIMATION variety (two models only)
  and idle fidgets remain future work.
- **P7 (operator session 4):** four concrete fixes from native smoke.
  (1) Every agent now carries a **glowing inverted-hull rim in its own role
  color** — a second bone-deep SkeletonUtils clone scaled 1.06×, rendered
  BackSide + additive accent, advanced on its own synced mixer so the neon
  outline hugs the posed silhouette through Idle/Walk frames (robot-cast.ts).
  (2) **Idle roaming** so the floor feels alive (office-motion.ts now exports
  `idleDwellMs`/`roamPoint`/`roamEpoch`): idle agents walk to a deterministic
  wander point every 2.5–6.5s, dwell, then drift again — 'floor' points at
  11–17 radius, 'console' points loiter near the tile (3.5–7 radius), all
  in-bounds and never stacked on the tile.
  (3) **Heading rotation** — agents now turn to face their ACTUAL travel
  direction (velocity vector angle, shortest-path smoothed at dt*10) instead
  of gliding sideways with a forward-static model; arrived agents settle to
  face their desk.
  (4) **Real Savant brand emblem** — the central tile now textures
  `assets/logo.png` (copied to desktop/public/floor-assets/emblem/
  savant-logo.png, loaded via TextureLoader, additive-tinted so the cyan
  reads as neon glow) instead of the procedural "S"; Savant is **always
  present** (roster no longer gated on `savantPresent`, which is false when
  idle and caused Savant to vanish), placed dead-center on the pedestal, and
  scaled 1.9× so it reads as the lead character without dwarfing the desks.
  Plus a sci-fi prop layer (office-props.tsx: server racks with blinking
  lights, holo columns, cargo crates + canisters, charging pads, ceiling
  light strips) and a `standSpot` fix so agents stand 1.5 units OUTSIDE
  their desk front instead of clipping through the desktop.
- **P8 (operator session 5, native smoke):** the deck now MIRRORS real chat
  activity instead of aimless wandering. Aimless roam REMOVED — agents only
  leave their desk when the adapter sets `stationTarget` (a live tool call
  routed to that agent); otherwise they stand at their post. Facing fixed:
  `standSpot` now seats the agent on the CONSOLE side of the desk (radially
  inward, where the chair is) with `deskFaceTarget` aiming the idle heading
  at the monitor's outward edge — so agents look AT their screen, not away
  (operator: "agents are on the opposite of the computer screens, their
  backs are to the screens"). Desks enlarged to full-workstation scale
  (home 4.2×2.4, tool 4.8×2.6, deck height 1.0) with chairs on the seat side;
  Savant scaled 1.55× and ceiling strips raised to 3.32 + center beam dropped
  so nothing clips Savant's head (operator: "the middle beam clips through
  Savant's head"; Savant logo dimmed to opacity 0.45 + ring 0.35 — "too
  bright"). A working agent (live `stationTarget`) now gets a vertical accent
  beacon + pulsing activity ring, so the deck visibly shows WHICH agent is
  acting when chat runs a tool (operator: "when chat is doing an action, the
  deck should represent something is happening with the correct agent").
- Gates: desktop typecheck exit 0; floor suite 162 pass / 0 fail (1805
  expect); eslint `--max-warnings 0` clean; prettier clean.

## Resolution

- **Closed Date:** 2026-09-02
- **Fix Description:** Office visual correction implemented through P8
(office rebuild, cyberpunk restyle, robot cast with role accents, heading
rotation, desk-scale + stand-spot fixes, activity beacons); visual
corrections discharged by operator live smoke across the 2026-08-31…09-02
deck sessions.
- **Tests Added:** 3 driver snapshot tests (fold attributable text,
honesty-drop unknown agentIds, TTL-prune against batch arrival clock).
- **Verification Evidence:** see Implementation Evidence above and the P6a
section (gates pasted inline).
- **Archived:** 2026-09-02

## Lessons Learned

- A working WebGL canvas is not a working visual product; native smoke must test
  composition, scene readability, character presence, and observable motion.
- Bloom cannot compensate for missing geometry. Establish environment and camera before
  tuning atmosphere.
- Hermes3D's key transferable idea is spatial presence: places, people, and movement
  driven by runtime state — not a decorative 3D background.
