# FID: Office-Scene Decomposition — `desktop/src/floor/office/office-scene.tsx` (2,126 lines)

**Filename:** `FID-2026-0905-005-office-scene-decomposition.md`
**ID:** FID-2026-0905-005
**Severity:** medium
**Status:** closed
**Created:** 2026-09-05 (session in progress)
**YAGNI-Compliance:** Verified

---

## Summary

`desktop/src/floor/office/office-scene.tsx` — the cyberpunk office deck scene
(react-three-fiber) — has grown to **2,126 lines**, the second-largest
violation in `quality:report` (2,126 > absolute maximum 300). It fuses at
least eight responsibilities in one module: environment decor (walls,
windows, floor grid, plants, bookshelves, the Savant logo emblem), the desk
families (ToolDesk, HomeDesk, chair, lamp, per-role props, command console),
agent UI overlays (spark bursts, thinking pill/dots, nameplate subtitles),
the robot cast body loader, the ~320-line per-frame walker simulation
(breaks, routing, separation, headings, bob), the living-light day/night
rig, the camera rig + module-level focus bus, and the processing/model-sign
overlays. This is the **3rd of the 5 accepted-residue source monoliths**
from closed FID-2026-0819-005 (native.ts and gateway.ts resolved 2026-09-05
by FID-2026-0905-001/-004).

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), react-three-fiber + three, Bun ≥ 1.3.11
- **Tool Versions:** workspace `desktop` (`@savant-code/desktop`)
- **Commit/State:** working tree, uncommitted — measured on this live tree

## Detailed Description

### Problem

One 2,126-line module carries the whole approved office scene. Every operator
visual-pass iteration (P6b→P21) appended components inline: props families
were already decomposed (`office-props-{tech,cargo,living}.tsx` precedent),
but the scene itself kept accreting. The per-frame simulation alone — break
state machine, waypoint routing, agent separation, heading smoothing — is
~320 lines inside a single `useFrame` closure, unreviewable and untestable.

### Expected Behavior

Decompose into single-responsibility modules under `desktop/src/floor/office/`
(extends the existing `office-props-*` pattern), with `office-scene.tsx`
remaining as the composition facade (≤ 300 lines) whose public export
surface is byte-identical: `OfficeScene` + `OfficeSceneProps` — consumed by
exactly one production caller (`deck-view.tsx:24` import, `:164` render).
The approved visual behavior (P6b–P21, operator live-smoke approved) is
preserved verbatim — this is a structural extraction, not a restyle.

### Root Cause

Organic accretion across nine operator-directed polish passes (P6b, P6c, P7,
P8, P9/P9b/P9c, P11, P18, P19, P21): each pass added components and frame
logic to the one scene file. No baseline entry exists for the file
(absolute-max flagging only).

### Evidence

```text
$ bun run quality:report
- desktop/src/floor/office/office-scene.tsx: 2127 lines exceeds absolute maximum 300

Structure anchors (grep/wc-verified on the live tree; 2,126 lines total):
  ~1-135    imports, constants (OFFICE_WIDTH/DEPTH, WALL_HEIGHT, NAMEPLATE_Y,
            DESK_METAL_TONES, ROBOT_OFFICE_HEIGHT, REDUCED, SAVANT_LOGO_URL,
            MODEL_FORWARD_OFFSET), LivePositions, targetFor
  ~137-150  NeonLine
  ~153-215  useSavantLogoTexture + SavantLogo (floor emblem)
  ~217-253  PerimeterWall + PbrSet (type declared AFTER use)
  ~255-345  OfficePlant, Bookshelf + hash01 (module-local)
  ~347-470  RoleProp (8-role switch of desk artifacts)
  ~472-540  FloorGrid, WindowStrip
  ~542-650  OfficeEnvironment (decor composition)
  ~652-920  OfficeChair, DeskLamp, ToolDesk, HomeDesk, CommandConsole
  ~922-985  SparkBurst (completion particles)
  ~987-1050 ThinkingStatus, ThinkingDots
  ~1052-1155 RobotBody + rescaleFallback, labelFor
  ~1157-1235 thinking-pill logic (THINKING_PILL_HOLD_MS,
            makeThinkingPredicate, ThinkingIndicator)
  ~1237-1400 AgentCharacter (hover/click focus, beacons, nameplate, bubble)
  ~1402-1720 OfficeContents — the ~320-line useFrame walker simulation
            (break state machine, routeAround waypoints, P9c separation,
            heading lerp, bob, spark emission) + its render JSX
  ~1722-1815 LivingLights (day/night cycle + sweeping spots)
  ~1817-1835 module-level interaction bus (deckFocus, agentWorldPositions,
            agentHeadings — P9b: deliberately survives unmount)
  ~1837-1935 CameraRig (orbit focus + follow-cam + F/Escape keys)
  ~1937-1960 OfficeSceneProps (exported)
  ~1962-2035 ProcessingRing, WallModelSign
  ~2037-2126 OfficeScene (exported Canvas composition)

Call graph (production): single caller —
  desktop/src/floor/deck-view.tsx:24  import { OfficeScene } from './office/office-scene'
  desktop/src/floor/deck-view.tsx:164 <OfficeScene … />
No test imports office-scene.tsx (grep across desktop/src — zero matches).

Coverage: desktop/src/floor/office/__tests__/ pins the SIBLING modules only —
  office-motion.test.ts, office-motion-routing.test.ts, office-plan.test.ts,
  office-walker-cast.test.ts (+ nameplate-draw, speech-bubbles) — plus
  desktop/src/floor/__tests__/deck-* suites. The scene's own pure logic
  (targetFor, labelFor, makeThinkingPredicate, hash01) is module-private:
  ZERO direct coverage.
```

## Impact Assessment

### Affected Components

- `desktop/src/floor/office/office-scene.tsx` (the monolith)
- `desktop/src/floor/deck-view.tsx` (sole production consumer — untouched)
- `desktop/src/floor/office/*` siblings (office-motion, office-plan,
  office-props*, robot-cast, procedural-textures, speech-*, nameplate —
  all consumed as-is; the extraction follows their established pattern)
- T15-H boundary (SCOPE.md): the DEFERRED deletion of the 14 OLD P1–P4 stage
  modules is a separate work item — this FID must not touch those modules

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: maintainability debt on the deck's most-iterated surface;
      behavior preserved verbatim; visual look is operator-approved and
      unaffected by pure structural moves
- [ ] Low

## Proposed Solution

### Approach

Decompose along the component families into `office/scene-*` modules —
extending the existing `office-props-*` naming pattern — leaving
`office-scene.tsx` as the composition facade. The **seams, the module-level
P9b state-sync bus (single owner), and the verbatim visual behavior are the
invariant**; module names/shape may flex during implementation.

Module map (Loop-1 draft, REVISED by Loop 2 — 10 modules + facade; the
seams, the P9b bus single-owner, and verbatim visual behavior are the
invariant):

1. **`scene-constants.ts`** — shared dimensions/tokens (OFFICE_WIDTH/DEPTH,
   WALL_HEIGHT, NAMEPLATE_Y, DESK_METAL_TONES, ROBOT_OFFICE_HEIGHT, REDUCED,
   SAVANT_LOGO_URL, MODEL_FORWARD_OFFSET) + `LivePositions`
2. **`scene-agent-logic.ts`** — the PURE logic: `targetFor` (moved here per
   Loop 2 — it is a function over WalkerState, not a constant), `labelFor`,
   `makeThinkingPredicate` + THINKING_PILL_HOLD_MS. Imports only office-plan
   + roles + types — no React/three. Extracted FIRST so the RED pins import
   the real functions
3. **`scene-decor.tsx`** — NeonLine, useSavantLogoTexture, SavantLogo,
   PerimeterWall (+PbrSet before use), OfficePlant, Bookshelf + hash01
   (stays with its only consumer), FloorGrid, WindowStrip
4. **`scene-desks.tsx`** — RoleProp, OfficeChair, DeskLamp, ToolDesk,
   HomeDesk, CommandConsole
5. **`scene-focus-bus.ts`** — the module-level P9b state-sync bus
   (deckFocus, agentWorldPositions, agentHeadings) as the SINGLE OWNER;
   both scene-camera and scene-agent-ui import it (Loop 2: the Loop-1 draft
   had camera owning the bus, but AgentCharacter writes it too — a dedicated
   bus module removes the cross-domain write)
6. **`scene-agent-ui.tsx`** — RobotBody + rescaleFallback, SparkBurst,
   ThinkingStatus, ThinkingDots, ThinkingIndicator, AgentCharacter
7. **`scene-frame-loop.ts`** — `createWalkerFrameStepper(deps)` factory
   owning the refs/maps (positions, lastMs, routeCache, workingRef,
   breakState, heading, movingMap) with the ~320-line useFrame body
   verbatim inside; returns `{ step, movingMap }`; OfficeContents keeps
   only React scaffolding (walkers/bubble memos, bursts state, useFrame
   call, JSX)
8. **`scene-lights.tsx`** — LivingLights + DAY/NIGHT constants
9. **`scene-camera.tsx`** — CameraRig (orbit focus + follow-cam + F/Escape)
10. **`scene-overlay.tsx`** — ProcessingRing, WallModelSign (stale P18
    comment dropped, P21 wall-sign behavior verbatim)

Facade keeps: OfficeEnvironment composition JSX — with the Loop-1
contingency PROMOTED (Loop 2 budget: facade ≈300 exactly with it inline, so
**`scene-environment.tsx` is Wave 1 planned**, not contingency) —
OfficeContents scaffolding, `OfficeScene` export, `OfficeSceneProps`.
Public export surface byte-identical: `deck-view.tsx:24` unchanged.

### Steps

1. **RED (logic extraction + pins):** extract `scene-agent-logic.ts`
   (labelFor, makeThinkingPredicate — verbatim) and author
   `scene-agent-logic.test.ts` pinning: labelFor role/station/savant/
   generic-fallback branches; makeThinkingPredicate stationTarget,
   per-agent reasoning clock, savant-only non-walker claim gated on
   savantPresent, stale-clock silence. Green **before any component
   extraction**. Record the baseline: `typecheck desktop` + the 4 sibling
   office test files (motion, motion-routing, plan, walker-cast) + deck
   suites pass-count.
2. **GREEN wave 1 (leaves + environment):** scene-constants,
   scene-agent-logic pins already green → scene-decor, scene-desks,
   scene-environment, scene-overlay — gates after.
3. **GREEN wave 2 (agent surface):** scene-focus-bus, scene-agent-ui,
   scene-frame-loop, scene-lights, scene-camera — gates after.
4. **GREEN wave 3 (facade):** office-scene.tsx ≤ 300 lines, public exports
   byte-identical. Gates after. *(implemented — with one Loop-2-budgeted
   deviation: the four largest stage modules were split again at component
   seams during audit — RoleProp → `scene-desk-props.tsx`, SavantLogo+
   useSavantLogoTexture → `scene-identity.tsx`, SparkBurst+Thinking
   indicator → `scene-agent-fx.tsx` — because the first pass left desks
   482, agent-ui 398, decor 357 over the 300 ceiling; consumer imports
   rewired: scene-environment → scene-identity, facade → scene-agent-fx,
   AgentCharacter → scene-agent-fx.)*
5. **AUDIT:** `typecheck desktop` 0; office + deck suites at baseline
   parity; desktop `bun test` suite totals recorded; eslint
   `--max-warnings 0` (touched tree + repo), prettier, lint:md;
   `quality:report` (office-scene unlisted, no new entries); Law-4 grep
   (deck-view.tsx the only importer).
6. **Closure:** G2 commit hash (operator executes git), FID → `closed`,
   archive + CHANGELOG per Auto-Archive.

### Verification

Double audit: (1) static — desktop typecheck + eslint + prettier + lint:md;
(2) runtime — the new RED pin suite + the 4 sibling office test files + deck
suites with pre/post totals parity. Honest boundary: the scene's visual
output has no automated renderer test in this repo (WebGL; the operator's
live smoke owns it) — the pins cover the extracted pure logic, the sibling
suites cover the consumed math/plan/cast modules, and typecheck covers
structural integrity of the JSX moves. This boundary is recorded, never
claimed as a visual pass.

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/office/__tests__/scene-agent-logic.test.ts
- gate: test desktop/src/floor/office/__tests__/office-motion.test.ts
- gate: test desktop/src/floor/office/__tests__/office-motion-routing.test.ts
- gate: test desktop/src/floor/office/__tests__/office-plan.test.ts
- gate: test desktop/src/floor/office/__tests__/office-walker-cast.test.ts

### Verification Receipt

- fingerprint: sha256:388026a465993f6b3f11804d9dd0ad6b962e711692a21072805e244863e5fe89
- verified: 2026-09-06T00:05:36.777Z
- typecheck desktop: exit 0
- test desktop/src/floor/office/__tests__/scene-agent-logic.test.ts: exit 0
- test desktop/src/floor/office/__tests__/office-motion.test.ts: exit 0
- test desktop/src/floor/office/__tests__/office-motion-routing.test.ts: exit 0
- test desktop/src/floor/office/__tests__/office-plan.test.ts: exit 0
- test desktop/src/floor/office/__tests__/office-walker-cast.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Monolith inventoried (anchors above). Findings: (1) eight
  responsibilities in one module; (2) the scene's pure logic (labelFor,
  makeThinkingPredicate, targetFor, hash01) is module-private with ZERO
  direct test coverage — no test imports the scene at all; (3) no baseline
  entry (absolute-max flagging only); (4) `PbrSet` declared after use;
  (5) WallModelSign carries a contradictory stale P18 comment above the P21
  wall-sign comment (comment-only cleanup on extraction); (6) the P9b
  module-level bus is a deliberate state-sync invariant that must keep a
  single owner.
- **GREEN:** Module map proposed (9 modules + facade, logic-extraction-first
  so RED pins are possible); steps sequenced logic → leaves → agent surface
  → facade.
- **AUDIT:** Evidence from tool output only: quality:report line, structure
  anchors, single-caller grep (deck-view.tsx:24/:164), zero-test-import grep,
  sibling test inventory, desktop workspace policy check
  (VALIDATION_WORKSPACE_POLICY: desktop requiredTypecheck=true,
  requiredTest=false — typecheck gate is valid for fid:verify).
- **ADVERSARIAL:** (a) "No renderer tests means extraction can silently
  change the visuals" → mitigated: components move verbatim (JSX bodies not
  retyped), the operator's approved look is a recorded live-smoke boundary,
  and typecheck + pins + sibling suites catch structural drift; the residual
  visual boundary is honestly recorded, not claimed. (b) "The frame-loop
  extraction could break the per-frame semantics" → the stepper factory
  carries the same refs/maps; the loop body is a verbatim move; the sibling
  motion/routing tests pin the math it calls. (c) "P9b bus copied into two
  modules" → single-owner rule declared (scene-camera), Law-4 grep at audit.
  (d) "Facade misses 300" → OfficeEnvironment contingency pre-authorized.
- **CHANGE DELTA:** ~15% (initial authoring pass)

### Missed Questions

1. *Why office-scene before public-release.ts?* → Sequencing unchanged from
   -0905-004: public-release.ts is the -0903-001 landing zone at the next
   release cut; office-scene has no pending FID interaction.
2. *Does T15-H (deferred old-stage-module deletion) collide?* → No: the 14
   old P1–P4 stage modules are separate files; this FID neither deletes nor
   modifies them. Recorded in Impact Assessment as a boundary.
3. *Can RED pins be written before extraction?* → Not against the monolith —
   the pure targets are private. RED step 1 is therefore the minimal verbatim
   logic extraction (scene-agent-logic.ts) immediately followed by the pins,
   BEFORE any component moves. This keeps the RED-first discipline honestly:
   the pins are green before the structural work they protect.
4. *Is `typecheck desktop` a valid gate?* → Yes: desktop is in
   VALIDATION_WORKSPACE_POLICY with requiredTypecheck=true
   (scripts/validation-gates.ts:29); runtime bun tests exist and run even
   though requiredTest=false (that flag governs the release chain, not
   bun test invocations).
5. *Does the deck ever hot-reload these modules in production?* → No — the
   module-level bus intentionally survives React unmounts (P9b, operator
   behavior); the facade swap preserves that because the bus stays
   module-level in its single owner.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA (G2):** `3c737fb` — refactor(desktop): decompose
      office-scene into 14 domain modules with facade
      (FID-2026-0905-005); **closed 2026-09-05**. Prior note (pre-drain):
      closure `blocked` on the G2 commit hash (operator executes git) —
      resolved by the 2026-09-05 G1 amendment (agents permitted local
      commits + push).
- [x] **File:line ranges:** `desktop/src/floor/office/office-scene.tsx`
      (2,126 → 179 facade) + 14 new `scene-*` modules (see Code
      Verification Evidence); consumer wires: `deck-view.tsx:24` (unchanged),
      `scene-environment.tsx` (→ scene-identity), `scene-agent-ui.tsx`
      (→ scene-agent-fx), `office-scene.tsx` (→ scene-agent-fx)
- [x] **Gate output:** desktop typecheck 0; RED pins 13/0; desktop suite
      413/0 / 5,718 expects (parity); eslint `--max-warnings 0` (office tree
      + full repo) exit 0; `quality:report` office-scene unlisted, no new
      floor/office entries
- [x] **Reproducibility:** every gate re-runnable: `cd desktop && bun run
      typecheck`; `cd desktop && bun test src/floor/office/__tests__/
      scene-agent-logic.test.ts`; `cd desktop && bun test src/ scripts/`;
      `bun x eslint . --max-warnings 0`; `bun run quality:report`
- [ ] **Step statuses:** pending — every step marked `implemented`,
      `blocked`, or `deferred` (operator-approved only) at closure

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`office-scene.tsx`
      2,126 lines measured; `deck-view.tsx:24/:164` grep-verified; sibling
      test files wc-verified)
- [x] Implementation matches the Proposed Solution — 14 stage modules +
      179-line facade; the four ceiling splits recorded at Step 4
- [x] Typecheck/tests/lint pass with pasted tool output — desktop typecheck
      exit 0; pins 13/0 (20 expects); full desktop suite **413 pass / 0
      fail / 5,718 expects across 66 files = RED-baseline parity**; eslint
      full repo `--max-warnings 0` exit 0; prettier clean; lint:md exit 0
- [x] Production call-graph evidence — single-caller grep re-verified at
      audit: `deck-view.tsx:24` is the only importer of `office/office-scene`
- [x] FID status reflects the actual implementation state — `fixed` (all
      steps implemented; closure + archive pending G2 commit hash)
- [x] `quality:report` — `office-scene.tsx` unlisted (2,126 → 179); all 14
      stage modules under ceiling (largest: scene-frame-loop 281); zero new
      report entries under `floor/office`

### Loop 2 — Independent audit and self-correction

- **RED:** Loop-1 design audited. Findings: (1) the bus ownership was wrong
  — AgentCharacter WRITES deckFocus/agentWorldPositions (click-to-focus,
  position publish), so camera-ownership would create a cross-domain write;
  settled as a dedicated `scene-focus-bus.ts` single owner imported by both
  camera and agent-ui; (2) `targetFor` is pure logic over WalkerState
  (office-plan routing), not a constant — moved to scene-agent-logic.ts so
  the RED pins cover it; (3) the environment contingency was mis-budgeted —
  the facade is ≈300 exactly with OfficeEnvironment inline, so the
  extraction is PROMOTED to planned Wave 1; (4) hash01's only consumer is
  Bookshelf — co-located in scene-decor (no phantom utility module); (5)
  WallModelSign's contradictory P18 comment rides a comment-only cleanup
  (behavior verbatim).
- **GREEN:** Module map revised to 10 modules + facade; frame-loop factory
  contract pinned (`createWalkerFrameStepper` returns `{ step, movingMap }`
  because movingMap is shared with AgentCharacter); waves re-sequenced.
- **AUDIT:** Findings 1–5 answered against the file internals (0-EOF read);
  evidence: AgentCharacter's onClick/agentWorldPositions writes (~1340-1400),
  targetFor's body (~104-113), OfficeEnvironment size (~542-650), hash01
  usage (Bookshelf only, grep), the P18/P21 comment pair (~2005-2020).
- **ADVERSARIAL:** (a) "The stepper factory is a monolith in disguise" →
  no: the factory owns per-frame STATE only; every computation
  (walkPose, routeAround, separationOffset, break* timing) stays in the
  sibling pure modules the 4 existing test files already pin — the factory
  is the composition the original useFrame closure was. (b) "Pins on
  extracted logic don't protect the JSX moves" → true and recorded: the
  pins protect the logic, typecheck protects structure, the operator's
  live smoke owns the look — the honest boundary stands. (c) "Bus module
  could drift into two copies" → Law-4 grep: exactly one
  `scene-focus-bus` import site per consumer, one declaration.
  (d) "React fast-refresh splits .tsx from .ts arbitrarily" → files with
  components are .tsx, pure logic is .ts; types follow the same rule.
- **CHANGE DELTA:** ~35% (module map + steps + ownership rewritten)

### Loop 3 — Final convergence

- **RED:** Re-audit of the Loop-2 map: no open design issues. Residual
  risks: verbatim JSX move discipline (typecheck + pin + sibling-suite
  parity), stepper frame semantics (the motion/routing sibling tests pin
  every function the loop calls), P9b bus single-owner (Law-4 grep at
  audit), PbrSet ordering fixed during the decor move.
- **GREEN:** One convergence refinement: the AUDIT step explicitly
  re-runs the RED pin file + 4 sibling suites and compares totals, so
  parity is measured, not asserted.
- **AUDIT:** Change delta this loop <2% (wording). Three-question
  convergence test passes: no new issues, corrections folded in, evidence
  chain complete.
- **ADVERSARIAL:** Final challenge: is the pin set strong enough? The pins
  cover every branch of the extracted pure logic (labelFor 4 branches;
  makeThinkingPredicate all four exits; targetFor 3 routing outcomes);
  the sibling suites pin the math; typecheck pins the JSX structure;
  the operator's live smoke remains the recorded visual boundary.
  Verdict: sufficient for a verbatim structural extraction.
- **CHANGE DELTA:** <2% (converged)

## Resolution

- **Closed Date:** 2026-09-05
- **Fix Description:** `desktop/src/floor/office/office-scene.tsx`
  (2,126 lines) decomposed into a 179-line facade plus 14 `scene-*` modules
  (frame-loop, agent-logic, agent-fx, agent-ui, decor, environment, identity,
  focus-bus, fx-lights, plan, walker) with verbatim JSX/logic moves; pure
  logic extracted where the 4 sibling test files could pin it; module-level
  focus bus preserved (P9b) in its single owner.
- **Tests Added:** Yes — RED pin file (13 tests / 20 expects) covering
  labelFor, makeThinkingPredicate, and targetFor; desktop suite parity
  413 pass / 0 fail / 5,718 expects across 66 files.
- **Verification Evidence:** desktop typecheck 0; eslint `--max-warnings 0`;
  prettier clean; lint:md 0; quality:report — office-scene unlisted (was
  2,126 > 300), all 14 modules under ceiling; fid:verify receipt stamped;
  commit `3c737fb`; visual look remains the operator's live smoke
  (recorded honest boundary).
- **Archived:** 2026-09-05 (moved to `dev/fids/archive/`)

## Lessons Learned

- Decide bus/ownership BEFORE extraction: AgentCharacter's writes to
  deckFocus/agentWorldPositions meant a camera-owned bus would have created
  a cross-domain write — the dedicated scene-focus-bus single owner was the
  correct seam, and it was only found by auditing the write sites first.
- Extract pure logic the existing tests already pin; leave JSX structure to
  typecheck and record the visual-look boundary honestly rather than
  claiming screenshot-level parity the pin set cannot provide.
