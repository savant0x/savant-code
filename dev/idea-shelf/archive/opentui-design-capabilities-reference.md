<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# OpenTUI Design Capabilities — Comprehensive Reference

**Source:** OpenTUI docs (opentui.com), awesome-opentui (github.com/msmps/awesome-opentui), npm
**Compiled:** 2026-08-15
**Status:** Reference for Savant-Code UI redesign. Flag: Savant-Code currently pins `@opentui/core` **0.2.2** — verify feature availability against this version before implementing.

> **Reconciled 2026-08-16 (master FID-2026-0816-002 step 7).** This shelf copy was
> compiled before the primary-source audit and is **not load-bearing**. Where this
> document conflicts with `docs/design/OpenTUI Terminal UI Capabilities.md` §14
> (Verification & Corrections, 2026-08-16), **§14 wins** — it classifies every
> claim as VERIFIED / INCORRECT / UNVERIFIED against GitHub releases, the npm
> registry, and opentui.com. The load-bearing deltas:
>
> - **Version:** Savant-Code now pins `@opentui/core` + `@opentui/react` **0.5.3**
>   (Phase 0 shipped); the JS `yoga-layout` dependency is **dropped** (native
>   yoga since 0.4.1). §9's "0.2.2 may not expose requestLive/onUpdate" concern is
>   resolved — Phase 2 adopted the timeline/live-loop engine.
> - **Keyboard:** there is no scope-tree keyboard model to migrate to — §6/§10's
>   keyboard isolation claims are INCORRECT (§14.1; issue #638 is an open
>   proposal). No `useKeyboard` refactoring.
> - **Streaming:** the §13 typewriter pattern via ScrollbackSurface is
>   INCORRECT — that API does not exist (§14.1). Savant uses chunked React
>   commits (Phase 2 typewriter) instead.
> - **Built-in components:** verified set is text, box, scrollbox, ascii-font,
>   input, textarea, select, tab-select, code, line-number, diff. No built-in
>   `Spinner`, no `Markdown`, no `Slider`, no `TextTable` (§14.1/14.3). Spinner
>   visuals come from the timeline engine (Phase 2) / `opentui-spinner`
>   (unverified scheduler claims — evaluated and NOT adopted).
> - **`useFocus`/`useBlur`:** terminal-window focus events (§14.1) — this is the
>   Phase 2 blur→15fps throttle signal.
> - **Animating `opacity`:** unverified style property; use RGBA colors +
>   translate offsets (§14.3).

---

## 1. Core Architecture

| Aspect | Detail |
|---|---|
| **Core** | Zig native renderer with TypeScript bindings via Bun FFI |
| **Paradigm** | Component-based (React + Solid bindings available) |
| **Layout** | Flexbox via Yoga (same engine as React Native) |
| **Performance** | ~32MB for a complex app (vs Ink's ~32MB for a counter) |
| **Render loop** | Frame-based (like a game loop), NOT CSS transitions |
| **Bun support** | First-class (no flags needed); Node 26.4+ with `--experimental-optional` |

---

## 2. Animation System (THE key Discovery)

OpenTUI does NOT do CSS-like transitions. It uses a **frame-based game-loop model:**

| API | What It Does |
|---|---|
| `renderer.requestLive()` | Starts continuous rendering (activates frame loop for your component) |
| `renderer.dropLive()` | Stops continuous rendering (back to static) |
| `onUpdate(deltaTime)` | Fired every frame with deltaTime in ms — write custom animation logic here |
| `targetFps` | Configurable, default 30 FPS |
| `maxFps` | Configurable, default 60 FPS cap |
| `translateX` / `translateY` | Visual offset without layout recalculation (move elements smoothly) |

**This is how the video did falling neon blocks:** `onUpdate()` updates Y position each frame, `translateY` applies the offset. No layout thrashing, 60 FPS smooth motion.

**Implication for redesign:** Any animation (spinners, falling blocks, scanlines, breathing glows, typewriter text) is done by updating a value inside `onUpdate()` and applying it via transform or style props.

---

## 3. Renderer Configuration (Visual Controls)

| Option | Type | Default | Design Relevance |
|---|---|---|---|
| `screenMode` | `"alternate-screen"` / `"main-screen"` / `"split-footer"` | alternate-screen | split-footer pins UI to bottom, leaves top for output |
| `backgroundColor` | ColorInput | transparent | Full control over bg color |
| `targetFps` / `maxFps` | number | 30 / 60 | Smoothness vs battery tradeoff |
| `useMouse` / `enableMouseMovement` | boolean | true | Click + hover interactions |
| `autoFocus` | boolean | true | Auto-focus nearest element on click |

---

## 4. Cursor Control (Fine Visual Polish)

```ts
renderer.setCursorPosition(x, y, visible)
renderer.setCursorStyle({
  style: "block" | "underline" | "line" | "default",
  blinking: true | false,
  color: RGBA.fromHex("#FF0000"),
  cursor: "pointer" | "text" | "crosshair" | "move" | "not-allowed"
})
```

Use for: custom text cursors, blinking carets, pointer changes on hover, spatial text editing.

---

## 5. Built-in Components (React + Solid)

| Component | Purpose |
|---|---|
| `Text` | Colored text, wraps `fg`, `bold`, `italic`, `underline` |
| `Box` | Flexbox container: `borderStyle` (rounded/double/single), `padding`, `gap`, `flexDirection` |
| `Input` | Text input field |
| `Select` | Dropdown selection |
| `Spinner` | Animated spinner (third-party: opentui-spinner) |

---

## 6. Ecosystem Libraries (npm/GitHub)

| Library | Author | What It Gives You |
|---|---|---|
| **[opentui-spinner](https://github.com/msmps/opentui-spinner)** | msmps | **80+ built-in spinner animations**, `createPulse(colors)` + `createWave(colors)` color generators, adaptive heap scheduler (all spinners share one interval), 60 FPS cap, auto-suspend invisible spinners, React binding via `opentui-spinner/react` |
| **[opentui-ui](https://github.com/msmps/opentui-ui)** | msmps | Pre-built UI component library for terminal apps |
| **[opentui-skill](https://github.com/msmps/opentui-skill)** | msmps | Reference docs installed as an AI coding agent skill (`npx skills add anomalyco/opentui --skill opentui`) |
| **[anscribe](https://github.com/msmps/anscribe)** | msmps | Capture live UI regions to clipboard or MCP — hand a screenshot to an agent |
| **[termdraw](https://github.com/benvinegar/termdraw)** | benvinegar | **Drawing editor for terminal** — editable diagrams, UI mocks, text graphics |
| **[opentui-doom](https://github.com/muhammedaksam/opentui-doom)** | msmps | DOOM running in terminal via OpenTUI framebuffer rendering (proof of high-FPS capability) |
| **[present-drop](https://github.com/msmps/present-drop)** | msmps | Game — Santa dropping presents, proof of real-time game-loop animation |
| **[tuiboard](https://github.com/NazzarenoGiannelli/tuiboard)** | NazzarenoGiannelli | Terminal kanban with planner, calendar, live Claude Code session view |
| **[hunk](https://github.com/modem-dev/hunk)** | modem-dev | Review-first diff viewer for agentic coders |
| **[tokscale](https://github.com/junhoyeo/tokscale)** | junhoyeo | Token usage tracking TUI |

---

## 7. Real-World OpenTUI Apps (Visual Inspiration)

| App | What It Shows OpenTUI Can Do |
|---|---|
| **OpenCode** (opencode.ai) | Full IDE in terminal — production-grade, syntax highlighting, diff viewer, multi-panel layout |
| **cftop** | Real-time Cloudflare Workers dashboard — live data, tables, monitoring |
| **critique** | Git code review in terminal — split panes, inline comments, navigation |
| **ghui** | GitHub PR management — lists, filters, status indicators |
| **opendocker** | Docker container management — dense data, status colors, actions |
| **waha-tui** | WhatsApp client in terminal — chat bubbles, message status, media |

---

## 8. What This Unlocks for Savant-Code

Given the above, the visual ceiling you thought existed **does not.** Here is what Savant-Code's terminal can do *today* with the right OpenTUI version:

| Category | Capability | How |
|---|---|---|
| **Animation** | Falling blocks, scanlines, breathing glows, typewriter text, wave sweeps | `onUpdate(deltaTime)` + `translateX`/`translateY` + style updates |
| **Spinners** | 80+ animated spinners (dots, bars, braille, bouncing, pulsing, wave) | `opentui-spinner` with `createPulse`/`createWave` color generators |
| **Layout** | Full flexbox — foldable panels, resizable splits, layered overlays | Yoga-based `Box` with `flexDirection`, `gap`, `padding` |
| **Interaction** | Mouse click, hover, scroll, drag, custom cursors | `useMouse`, `enableMouseMovement`, `setCursorStyle` |
| **Styling** | Full RGB color, bold/italic/underline, borders (rounded/double/single), background colors | `fg`, `bg`, `borderStyle`, props on `Text`/`Box` |
| **Input** | Text input, dropdown select, custom keyboard handlers | `Input`, `Select`, `addInputHandler` |
| **Debug** | FPS counter, memory usage overlay, render stats | `renderer.toggleDebugOverlay()` |
| **Notifications** | Native terminal notifications | `renderer.triggerNotification(title, body)` |
| **Games** | DOOM-level frame rates achievable | Frame buffer rendering (opentui-doom proof) |
| **Drawing** | Editable diagrams, UI mocks, text graphics | `termdraw` library |

---

## 9. Version Flag (CRITICAL — reconciled 2026-08-16)

| Item | Version |
|---|---|
| Savant-Code now pins (post-Phase-0) | `@opentui/core` + `@opentui/react` **0.5.3** (exact pins, `cli/package.json`) |
| `yoga-layout` JS dependency | **dropped** (native yoga in the core binary since 0.4.1) |
| `opentui-spinner` peer dep | `@opentui/core` **^0.3.4** (evaluated and NOT adopted — FID-2026-0816-005 step 6) |
| Animation system (`requestLive`/`onUpdate`, timeline engine) | **available on 0.5.3** — adopted as the Phase 2 animation engine |

**Before implementing any animation:** verify the API surface against
`@opentui/core`/`@opentui/react` **0.5.3** (installed) and the corrected fact
base in report §14 — not against this shelf sheet's 0.2.2-era assumptions.

---

## 10. Next Steps for the Redesign

1. **Verify OpenTUI version** — does 0.2.2 expose `requestLive`/`onUpdate`? If not, target the version that does.
2. **Map visual goals to APIs** — for each "wow" feature, identify whether it's built-in, needs `opentui-spinner`, or needs custom `onUpdate` logic.
3. **Prototype one animation** — a single `onUpdate` component (sweep, spinner, or fade) to validate the pipeline before building the whole redesign.
4. **Consider `termdraw`** — if you're mocking up UI layouts in the terminal, this tool lets you draw/edit them visually.

---

**Bottom line:** The "visual ceiling" was a version gap, not a platform limit. OpenTUI is a full game-capable rendering engine that Savant-Code already owns. The redesign target isn't "make it work" — it's "use what's already there."
