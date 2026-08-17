# Savant-Code UI Overhaul Plan

> **Status:** Approved scope (2026-08-16, single-agent session; `SCOPE.md`).
> **EXECUTED 2026-08-16** — all phases implemented, operator live-test
> confirmed, and the FID queue closed + archived (`dev/fids/archive/`,
> FID-2026-0816-003..012). This document is the historical plan; the shipped
> state is described in `docs/features.md` → Terminal UI.
> **Sequencing decision:** OpenTUI 0.2.2 → 0.5.x upgrade **first** (Phase 0),
> then visual and animation work on the new foundation.
> **Grounding:** All OpenTUI capability claims are corrected per
> `docs/design/OpenTUI Terminal UI Capabilities.md` §14 (Verification &
> Corrections, 2026-08-16). Where this plan differs from the report body, the
> appendix wins.
> **Implementation routing:** Each phase becomes its own FID (complex task →
> FID-Bound Execution). No UI code is written before a phase's FID converges.

---

## 1. Goals and principles

1. **Foundation first.** The 0.5.x upgrade is not cosmetic — it unlocks native
   Yoga layout (drop the JS `yoga-layout` dep), native image rendering,
   WriteConsoleW on Windows, embedded runtime, and the FFI struct-reuse perf
   fixes. Every later phase is designed against 0.5.x APIs.
2. **Animate on the engine, not on `setInterval`.** Replace manual timers with
   `useTimeline` / `requestLive` discipline; suspend loops when off-screen or
   unfocused (battery). Never animate structural layout props (width/height/
   padding) — animate `translateX`/`translateY`/colors (post-layout, no
   reflow).
3. **One token source.** Formalize the visual vocabulary (colors, borders,
   spacing) into the existing theme system + `@savant-code/design-systems`
   adapters; surfaces consume tokens, never raw hex.
4. **Preserve what works.** The controller/presentational split, zustand state,
   theme detection chain, and savant-ui component library are keepers — the
   overhaul reskins and upgrades them, it does not rewrite them.
5. **Ship every phase green.** Each phase lands with typecheck ×4 + `bun test`
   + `lint` + `lint:md` + a tmux live pass, per the repo's hard gates.

## 2. Current state (baseline, 2026-08-16)

| Surface | Today | Gap |
|---|---|---|
| Engine | @opentui/core 0.2.2 + @opentui/react 0.2.2, JS `yoga-layout` ^3.2.1 | Pre-native-Yoga; no native images; no WriteConsoleW path |
| Header | `ChatHeader` renders `null` | Dead area where identity/model state belongs |
| Transcript | Custom markdown renderables in scrollbox | No native `<code>`/tree-sitter highlighting |
| Animation | Raw `setInterval` in spinner/pulse/shimmer/sheen/cursor-blink; `useTimeline` only in ProgressBar + phase-indicator | No live-loop discipline; battery/CPU waste; no suspension |
| Sidebar | Fixed 40-col, ~10 stacked sections | Crowds narrow terminals; no hierarchy/breakpoints |
| Theme | Env → IDE → OSC → platform detection; dark/light; plugins | Strong — keep; needs token unification |
| Design system | savant-ui library + design-systems package (74 presets, EHEL scanning) | Strong — keep; adapt to 0.5.x |

## 3. Phase 0 — Foundation upgrade (0.2.2 → 0.5.3)

**Goal:** Move to the current engine with zero visual regression.

**Steps:**

1. Bump `@opentui/core` and `@opentui/react` to 0.5.3 (verified latest on npm,
   2026-08-16).
2. Remove the `yoga-layout` JS dependency (native in core since 0.4.1).
3. Audit every `@opentui/core` import surface for 0.5.x breaking changes
   (renderer options, styles, scrollbox props, `createCliRenderer` options).
4. Terminal compatibility: set `OPENTUI_FORCE_EXPLICIT_WIDTH=false` behind
   environment detection (Windows Console / legacy terminals; OSC 66 artifact
   guard — verified env var per report §14.2).
5. Teardown audit: verify SIGINT/SIGTERM/uncaughtException paths route to
   `renderer.destroy()` (0.5.x strictness — verified per report §14.2); keep
   `use-exit-handler` behavior.
6. Verify: `useRenderer`/`useTimeline`/`useKeyboard` behavior against 0.5.3
   (note: `useKeyboard` has no scope-tree model — verified; no refactoring
   needed).

**Exit criteria:** typecheck ×4, full `bun test`, lint + lint:md, prettier
check, tmux smoke (launch, resize, stream, interrupt, exit — terminal left in
cooked mode).

**Do NOT do (corrected from report):** no `useKeyboard` scope refactor; no
`trapFocus` wiring (unshipped); no ScrollbackSurface patterns (unshipped).

## 4. Phase 1 — Design tokens and visual identity

**Goal:** A coherent, distinctive look for chat, sidebar, header, and input.

**Steps:**

1. Define the canonical token set (background/surface/foreground/muted, primary
   + semantic colors, border styles, spacing scale) in one module, consumed by
   `savant-ui/theme.ts` tokens and the theme-config pipeline.
2. **Header (currently `null`):** project identity strip — cwd breadcrumb,
   model name, agent mode, permission mode, connection state. Compact;
   collapses on narrow widths.
3. **Sidebar hierarchy:** section ordering by importance (Active Agents →
   Session → Perfection Loop → FIDs → Tools → Files → History); collapsed-by-
   default for low-frequency sections; remove dead counters (report §13 style:
   fold, don't delete).
4. **Input bar & status bar:** restyle against tokens; split status-bar duties
   (status text left, timer/actions right — already partially done; keep).
5. **Transcript polish:** message spacing, hover states for actions
   (copy/re-run), clearer user/assistant differentiation.

**Exit criteria:** visual pass in tmux at 3 widths (120/80/60 cols); existing
component tests updated; no regressions in the A–Z live prompt.

## 5. Phase 2 — Animation engine adoption

**Goal:** Fluid motion with engine-level efficiency; kill `setInterval` in UI.

**Steps:**

1. Migrate `Spinner`, `Pulse`, `shimmer-text`, `sheen`, `input-cursor` blink
   to `useTimeline`/`onUpdate`; verify against opentui-spinner's scheduler
   claims **before** adopting the package (claims unverified — report §14.3);
   adopt only if the shared-scheduler/suspension claims hold.
2. **Live-loop discipline:** central `useAnimationBudget` hook — drop
   `targetFps` to 15 on window blur (`useBlur` — window-focus semantics,
   verified), suspend when scissor-hidden (query layout bounds), `dropLive` in
   effect cleanup.
3. **Smooth scroll:** spring-interpolated `scrollTop` on the transcript
   scrollbox for jump-free log streaming (verified pattern from report §13).
4. **Fold/collapse animations:** height-tween to 0 then unmount (report §13
   pattern is sound — it does not depend on the unshipped APIs).
5. **Streaming typewriter:** chunked commits (batch ~16 chars per flush) or
   imperative native-Text-ref updates — NOT ScrollbackSurface (corrected per
   report §14.1).
6. **Sheen/progress:** keep the existing `useTimeline` ProgressBar; add
   createWave-based shimmer only if `createWave` behavior verifies against the
   package source.

**Exit criteria:** zero `setInterval` in UI components (grep gate — allowlist
non-visual timers: elapsed-time, heartbeats, polling); CPU/FrameDrop check via
`OPENTUI_DEBUG=true` + `bun --cpu-prof`; battery sanity (blur → 15fps).

## 6. Phase 3 — Native code/data components

**Goal:** Tree-sitter highlighting and structured data in the transcript.

**Steps:**

1. Evaluate `<code>` + `<line-number>` + `<diff>` (verified components) for
   tool-call diffs and code blocks; replace the custom highlight path where it
   measurably wins (perf + visual parity).
2. `<ascii-font>` branding for the sidebar logo (replace/upgrade `Branding`
   `font="tiny"`).
3. Verify `Image`/native image rendering usefulness on the target terminals
   (Sixel/kitty; fallback is half-block — verified per report §14.2); adopt
   only for image cards if the fallback is acceptable on Windows Console.
4. Re-verify `Markdown` (report §5 listed it — **not in the component set**,
   corrected) — do not plan around it.

**Exit criteria:** diff view renders in transcript with highlighting; typecheck
×4; tmux visual pass; A–Z regression.

## 7. Phase 4 — Layout and responsiveness

**Goal:** First-class narrow-terminal behavior.

**Steps:**

1. Breakpoint-aware layout (the existing `use-terminal-breakpoints` /
   `use-terminal-layout` hooks): sidebar collapses to overlay/icon at narrow
   widths; header collapses to one line.
2. Modals/pickers (model/provider/rewind/ask-user): consistent dialog chrome —
   centered, dimmed backdrop via RGBA alpha (`#00000080`), focus stays in the
   picker (verify actual 0.5.x focus routing; no trapFocus assumption).
3. Toast stack polish via absolute positioning + entry/exit timelines.
4. `cwd:` line folded into the header or input-bar chrome.

**Exit criteria:** usable at 60 cols; all pickers reachable and keyboard-
navigable in tmux at narrow width.

## 8. Cross-cutting requirements

| Concern | Requirement |
|---|---|
| Performance budget | No UI-driven CPU above baseline after Phase 2 (measure with `OPENTUI_DEBUG=true` + `bun --cpu-prof` before/after) |
| Error boundaries | Keep ErrorBoundary + fallback box; crash paths must `renderer.destroy()` (report §7 discipline — sound) |
| Accessibility | Contrast from tokens; focus visibility in all pickers; no motion when `OPENTUI_REDUCE_MOTION`-style override (verify env var existence before wiring) |
| Testing | Per-phase: component tests updated in place; tmux live pass (project convention); A–Z live prompt for regressions; typecheck ×4 + lint + lint:md hard gates |
| Docs | Each phase updates the CHANGELOG + session summary; no attribution/signatures in artifacts (single-agent protocol) |
| Windows | Primary dev platform is win32 — verify WriteConsoleW path + OSC 66 guard in Phase 0; GBK/UTF-8 subprocess behavior in tmux tests |

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| 0.5.x breaking changes beyond the verified list | Phase 0 is isolated: upgrade-only FID, full regression (typecheck ×4 + test + A–Z) before any visual work |
| React reconciler behavior drift (0.2.2 → 0.5.3) | Pin exact versions (core 0.5.3 + react 0.5.3); run tmux interactive pass; keep React 19 |
| opentui-spinner / termdraw / anscribe claims unverified | Gate adoption on source-level verification (FID AUDIT must grep package source) — never adopt on the report alone |
| Animation migration churn | Phase 2 is mechanical (setInterval → useTimeline); grep gate proves completion |
| Narrow-terminal sidebar collapse complexity | Phase 4 is last and isolated; existing breakpoint hooks are keepers |
| Scope creep | Every phase is a separate FID with its own exit criteria; SCOPE.md tracks drops |

## 10. FID routing

| Phase | FID trigger | Routing |
|---|---|---|
| 0 — Upgrade | > 75 lines + new APIs (engine swap) | FID-Bound Execution (RED → GREEN → AUDIT → COMPLETE → IMPLEMENT) |
| 1 — Tokens/identity | large multi-file visual change | FID-Bound Execution |
| 2 — Animation | new animation utilities + cross-cutting refactor | FID-Bound Execution |
| 3 — Native components | new integrations, possible new deps | FID-Bound Execution (dependency verification in RED) |
| 4 — Layout | multi-file layout change | FID-Bound Execution |

Each FID: `dev/fids/FID-YYYY-MMDD-NNN-{title}.md` per template; closed FIDs
auto-archive with CHANGELOG entry (recorder role).

## 11. Open questions — RESOLVED (2026-08-16)

1. **Pin policy: exact pins.** `@opentui/core` + `@opentui/react` at exactly
   `0.5.3` (no carets) — matches the existing exact-pin convention
   (cli/package.json pins 0.2.2 today) and the repo's frozen-lockfile
   invariant + the eslint-10 lockfile-regeneration lesson (LEARNINGS
   2026-08-09). Regenerate `bun.lock` deliberately once, then re-run all
   gates; verify the platform native subpackages resolve
   (`@opentui/core-win32-x64` etc.).
2. **Live-test target: two-part.** This machine has **no native tmux** (Git
   Bash) but **WSL Ubuntu is installed** — so the automation harness is
   **tmux inside WSL** (install bun in WSL; the tmux scripts' default
   `cd cli && bun run dev` works from the repo mount). Visual acceptance
   target is **Windows Terminal** (truecolor, kitty keyboard); legacy
   ConHost is the compatibility floor that exercises the
   `OPENTUI_FORCE_EXPLICIT_WIDTH=false` guard and truecolor fallbacks.
3. **savant-free: no separate seam.** `IS_SAVANT_FREE` is a compile-time
   define (`SAVANT_FREE_MODE=true` via `--define` in build-binary.ts,
   dead-code eliminated — SPEC.md §1/§9). savant-free reuses **100% of
   cli/ source**; its surfaces (landing screen, session summary, banners)
   are conditional components *inside* cli/src. The overhaul therefore
   applies to both builds automatically — no parallel UI path. Phase 0 must
   additionally run the savant-free e2e suite (`bun run e2e`, builds the
   variant binary) to prove the flag still compiles and the conditional
   components still render. Status note: savant-free is **private,
   unreleased, on hold** until partnerships are live — no release
   sequencing concerns, only the build/e2e path must stay green.
