# Savant Visual Workspace — Holographic Command Deck

**Status:** Draft blueprint for FID-2026-0822-012 (child of FID-2026-0820-007, Desktop Master)
**Created:** 2026-08-22
**Operator decisions locked 2026-08-22:** full command deck v1 scope · desktop-native only ·
holographic-office art direction ("office look, heavily leaned into cyberpunk — holograms, orbs,
robots") · zero feature parity with any prior art · the visual workspace IS the feature.

---

## 1. Vision

A living holographic floor where every entity is a real, typed runtime event made visible: agents as
glowing drones, tools as holo-pedestals, turns as colored auras, traffic as light. The operator
glances at the deck and knows — without reading a line of text — what the harness is doing right now,
which agent is thinking, where work is stuck, and what needs a human decision.

### Design principles

1. **Informational first.** Every animation is driven by a deterministic structured event from the
   runtime we own. If a motion does not communicate state faster than a label would, it is cut.
   (Prior-art lesson: an avatar walking must mean "reading a file", or it is a toy.)
2. **Calm base, alive surface.** The void and grid never animate. Only entities move. The eye should
   rest on darkness and notice motion.
3. **Contract colors only.** Every pixel derives from the active design system
   (`savant-cyberpunk`). No foreign palettes, no licensed art, nothing hand-picked.
4. **One store, many projections.** The floor consumes exactly the same gateway event stream and
   renderer session state as the chat view. It is a projection, never a second source of truth.
5. **Degrade honestly.** If WebGL is unavailable (Linux WebKitGTK), the deck swaps to an analytical
   fallback rendered from the same store — never a broken canvas.

## 2. Provenance and prior art

The spatial-fleet metaphor is inspired by the MIT-licensed Munder Difflin project (v0.4.5). No code,
art, tilesets, sprites, fonts, or assets are ported. The borrowed idea is exactly one sentence:
*render live agents as moving figures on a shared floor, animated by real tool events*. Everything
else in this document is native Savant design. An MIT attribution note may be added to NOTICE at
release time if legal review wants one; there is no derivative-work obligation for ideas.

## 3. Home in the desktop program

The deck lives inside the FID-2026-0820-010 renderer as a **center-canvas view mode** ("Deck" vs
"Chat"), sharing:

- The FID-2026-0820-008 WebSocket gateway event stream (`printMode*` schema family —
  `common/src/types/print-mode.ts`: 13 schemas at :12-184, discriminated union :198-217).
- The desktop-local token pipeline (landed): `scripts/generate-design-tokens.ts` generates
  `src/design-tokens.generated.ts` from `@savant-code/design-systems`
  (`resolveActiveDesignSystem`, `contrastRatio`), applied at boot by `src/theme.ts`. Session
  state is owned by the FID-2026-0820-010 renderer; the deck keeps its own local module store.
- The three-pane layout: left sessions, center canvas (deck or chat), right governance telemetry.

Hard prerequisites, in order: FID-008 (gateway) → FID-009 (shell + sidecar) → FID-010 renderer
foundation (Step 1 token materialization has landed: `src/tokens.css`,
`design-tokens.generated.ts`, `theme.ts`; the interim raw-hex stylesheet is retired). Until
FID-008 lands there is no live feed — PrintModeEvent reaches only in-process SDK consumers today
— so ALL deck capabilities are developed and verified against replay fixtures; live wiring is
exclusively post-FID-008 work.

## 4. Event substrate → scene mapping

Scene elements split AMENDMENT-FREE vs AMENDMENT-GATED (enforced by the Amendment Gate in
FID-2026-0822-012). AMENDMENT-FREE signals exist in PrintModeEvent today: subagent identity
(drones), tool_call.toolName (stations), tool_result sparks (via toolCallId→agentId join),
packet pulses, reasoning bursts, FSM auras via the INTERIM transition_phase pairing rule.
AMENDMENT-GATED — no schema exists yet; they render only after the FID-008 PrintModeEvent
amendment adds their events; SessionState polling and transcript parsing are forbidden sources:
Approval Gate docking, compaction collapse ripple, objective pylons, thought-index/revision
glyph semantics.

| Runtime signal | Scene element | Motion |
| --- | --- | --- |
| Run start / Orchestrator step | Savant at the central holo-console | Cyan projection (#18faf9) brightens while stepping; ring halo rotates |
| Subagent spawn (`spawn_agents`) | Drone materializes on a pad near the Core | Vertical light beam, then hover-bob |
| Subagent completion / result | Drone dissolves upward | Particle wisp toward the Core |
| Tool call by class | Drone departs to a Station pedestal | Bezier glide path with light trail |
| Tool result | Drone returns carrying a spark | Spark color = success (#39ff14) / error (#ff2d55) |
| Perfection Loop phase transition | Aura tint on the acting drone + zone glow | See §6 color map |
| Parent⇄subagent messages / tool payloads | Packet streaks along lanes | Additive-blend dash, pooled sprites |
| Compaction phases (`compactionStatus`) | Collapse ripple across the floor | Grid lines bend inward, debris pulls to Core |
| Approval pending (Law 2 cards) | Drone docks at the Gate ring | Red pulse until resolved |
| Goal / Auto Drive milestone | Objective pylons at the horizon | Progress arc fills; beacon on completion |
| Thinker reasoning (`sequentialthinking`) | Glyph ring orbiting that drone | One glyph per thought, revisions recolor |

## 5. The Deck layout

```text
                    ┌─ objective pylons (goals / Auto Drive) ─┐
                    │                                          │
   ┌──────────┐     ┌────────────┐      ┌──────────┐          │
   │ File     │     │  SAVANT   │      │ Signal   │   station ring (holo pedestals)
   │ Forge    │     │  (holo    │      │ Array    │
   └──────────┘     │  robot +  │      └──────────┘
   ┌──────────┐     │  rings)   │      ┌──────────┐
   │ Command  │     │            │      │ External │
   │ Spire    │     └────────────┘      │ Gate     │
   └──────────┘       spawn pads        └──────────┘
   ┌──────────┐      under foreman     ┌──────────┐
   │ Cartog-  │         drones park      │ Approval │
   │ raphy    │         in the hollow    │ Gate     │
   └──────────┘                          └──────────┘
```

- **The Void.** Infinite #050508 plane; static #20202a grid horizon with distance fade. Never animates.
- **Savant (Orchestrator).** A larger walker unit (1.4× scale) at the central console — same
  bipedal anatomy family as the role-walkers; paces while adjudicating. The two counter-rotating
  rings become its projection halo; brightness tracks run activity. No orbs anywhere.
- **Stations.** Six holographic pedestals arranged in a ring, keyed to Savant tool classes:
  File Forge (write/edit/patch), Command Spire (terminal commands), Signal Array (web/research),
  Cartography Table (graph/code-map queries), External Gate (browser), Approval Gate (Law 2).
- **Walkers (callsign: drones).** Literal holographic AI on foot: bipedal procedural androids —
  torso, arms, animated LEGS with a blended walk/idle cycle, single light visor, Fresnel rim glow.
  Visor color = current activity class; aura = FSM phase. Scale by role (Orchestrator > subagent).
  Every walker IS a real spawned subagent — Detective, Forge, Verifier, Recorder, Thinker,
  Scout, Researcher, Scribe, Adversary — identity read from the spawn event's `agentType` /
  `displayName` fields; role-cast silhouettes and accent tints per canonical ECHO role. They WALK
  between stations on the deck grid — no floating, no thrusters, no orbs, no invented characters.
- **Pylons.** Horizon-scale objective markers for goals/milestones so long-horizon work reads as
  part of the space, not a menu.

## 6. State color map (contract tokens only)

| State | Token | Hex |
| --- | --- | --- |
| Idle / dormant | primary dimmed | #18faf9 @ low alpha |
| RED phase / error result | error | #ff2d55 |
| GREEN phase / success result | success | #39ff14 |
| AUDIT phase / waiting-on-check | warning | #ff9500 |
| ADVERSARIAL phase | muted flicker | #8f8f99 |
| COMPLETE / connected | primary burst | #18faf9 |
| Blocked on approval | error pulse | #ff2d55 |
| Compacting | inline-code cyan ripple | #22d3ee |

Contrast pairs are validated with the existing `contrastRatio` utility from
`@savant-code/design-systems` at token-materialization time; labels never rely on color alone
(shape/icon accompanies every state). Tokens absent from the desktop CSS-var set (inlineCodeFg
#22d3ee, compaction ripple) extend the generator whitelist minimally, each addition naming its
floor consumer; the drift test asserts generated output equals resolver output for that declared
subset.

## 7. Art direction — "Holographic Office"

An office floor plan, rebuilt as a hologram: room-like zones implied by light boundaries, not walls;
furniture replaced by projection pedestals; the staff is entirely holographic robots — Savant at
the central console, the spawned ECHO roles at their stations. Going all out means
density of *meaningful* effects, not noise.

- Rendering style: additive glow, soft bloom on emissive elements, subtle scanline texture on
  pedestal surfaces, chromatic fringe reserved for error states.
- Geometry: all procedural (primitives + extrusions). No sprite sheets, no external assets, no
  font-based icons inside the canvas — vector paths only.
- Typography in-canvas: minimal; names/status render as DOM overlay chips positioned via camera
  projection, using the renderer's existing type scale (keeps text crisp and accessible).
- Motion grammar: walkers move ON FOOT with blended walk/idle cycles (ease-out settle on arrival,
  no bounce, no glide-float); beams are instant-on, fade-over-200ms; idle motion limited to
  weight-shift and ring rotation.
- Reduced-motion mode: all positions snap, trails become dotted lines, pulses become static rings;
  honored via the platform reduced-motion preference.

## 8. Technical architecture

```text
gateway WS (FID-008) ─► session state (FID-010 renderer) ─► FloorAdapter (pure: events → commands)
                                                        │
                     <DeckView> toggle ◄─ FloorRenderer (Pixi v8 scene graph, pooled)
                                                        │
                                        FloorOverlay (DOM chips: labels, status, focus card)
```

- **FloorAdapter** is a pure function module: `(store snapshot delta) => SceneCommand[]`. Fully unit
  testable with recorded fixtures; this is where ALL logic lives.
- **FloorRenderer** executes commands on a Three.js (WebGL/WebGPU) stage mounted in the center
  canvas: rigged glTF walker meshes rendered through CSM-injected hologram materials (Fresnel rim,
  scanlines, glitch — per `Cyberpunk Holographic WebGL Research.md`) with Alpha-to-Coverage depth.
  Object pooling for packets/sparks/particles; hard particle caps; rAF paused when the view
  is hidden or unfocused.
- **Token materialization:** the design system resolves once at boot into CSS vars (existing) AND a
  generated `floorTokens.ts` of hex numbers for Pixi (single source, two materializations, drift
  check asserted in tests — mirrors the proven tokens.css/tokens.ts dual-file pattern).
- **Camera:** wheel zoom (clamped), drag pan, click-to-focus (drives the right governance pane to
  that agent). Camera state persists per session, deferred beyond v1 if it threatens scope.
- **Platform strategy:** WebGL on Windows (WebView2) and macOS (WKWebView). Linux WebKitGTK WebGL is
  unreliable — detect context-creation failure and swap to the analytical fallback (same store,
  DOM/SVG grid of drones/stations/state). A full animated SVG floor fallback is explicitly deferred.

## 9. Performance budget

- Frame p95 < 16 ms with 50 concurrent drones + 200 packets (profiled via performance.mark in debug).
- Scene graph nodes bounded: pools recycle; caps drop newest-first and surface a count in debug HUD.
- Store→adapter batching: max one adapter pass per frame; coalesce bursts during streaming.

## 10. Quality gates

- 300-line absolute ceiling and 50-line function ceiling across all new TS/TSX (decompose:
  `floor/adapter`, `floor/renderer`, `floor/overlay`, `floor/tokens`).
- `bun run --cwd=desktop typecheck`; eslint `--max-warnings 0`; prettier clean.
- Adapter unit tests over Tier-1 replay fixtures (existing event types: start/text/tool_call/
  tool_result/subagent/reasoning_delta/activity/provenance) plus Tier-2 SYNTHETIC-PENDING-FID-008
  drafts for gated variants, excluded from coverage claims.
- Renderer smoke tests against the real Tauri shell once FID-009 lands (test-renderer lesson: the
  test harness frame buffer is not a proxy for the production webview; human spot-check recorded as
  NEEDS-REVIEW until then).

## 11. Phased steps (FID-shaped)

1. P1 — Scene shell: mount the Three.js stage in DeckView toggle, Void + grid, camera controls,
   token materialization + drift test.
2. P2 — Savant + role-walkers: the Savant unit at the central console, spawn pads, walker
   lifecycle from subagent events (identity = agentType/displayName), focus wiring to the
   governance pane.
3. P3 — Stations: six pedestals, tool-class routing, walk cycles between pedestals with trails.
4. P4 — State layer: FSM auras via the interim transition_phase pairing rule (expires when
   FID-008 adds a dedicated phase event), result sparks via bounded toolCallId→agentId join,
   packet lanes between Core and drones.
5. P5 — Command deck completeness: thinker glyph rings (deterministic idle-gap bursts),
   analytical fallback for Linux; Approval Gate docking, compaction ripple, and objective pylons
   land behind the FID-008 Amendment Gate.
6. P6 — Polish + proof: particles/bloom pass, reduced-motion mode, perf instrumentation against
   budget, full adapter fixture suite, production smoke on the shell.

## 12. Decisions already made (authoring-time answers)

1. Scope: full command deck v1 — operator directive; the phased steps exist to keep each landing
   independently verifiable, not to trim scope.
2. Build path: desktop-native only — no standalone prototype; replay fixtures give early testing
   without throwaway code.
3. Sound: none in v1 (off-mission; can be added later behind preferences).
4. Multi-session floors: deferred — v1 renders the active session only; switching sessions swaps
   the projection like Chat does.
5. Camera persistence: deferred unless trivially cheap at P6.
6. Accessibility: keyboard camera nudge + focus traversal, DOM-chip labels, shape+color state coding,
   reduced-motion honored.
7. In-canvas text: avoided except debug HUD; DOM overlay carries all user-facing strings.

## 13. Open items routed elsewhere

- Missing `printMode*` fields AND missing event variants (tool-class tag; dedicated fsm_phase;
  approval lifecycle; compaction phases; goal/milestone events) → file against the FID-008
  contract amendment, decided in its loop, never improvised client-side.
- Tier-2 fixture reconciliation (SYNTHETIC-PENDING-FID-008 markers) → owned by the same
  FID-008 amendment loop, which must reconcile-or-delete each marker.
- NOTICE/attribution wording for the MIT prior art → release-time legal sweep.
- Linux full-floor SVG fallback → deferred follow-up candidate, tracked in SCOPE when registered.
- Walker asset pipeline: CC0/MIT rigged sources only (Quaternius Animated Robot/Mech/Cyberpunk
  kits; Khronos RobotExpressive/BrainStem), Draco/meshopt compression mandatory — see
  `Cyberpunk Holographic WebGL Research.md`.
- Walker identity registry mirrors the 10-role ECHO roster (ARCHITECTURE.md); an unknown
  `agentType` renders the generic silhouette — never an invented character.
