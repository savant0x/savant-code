# FID: Phase 2 — Animation Engine Adoption

**Filename:** `FID-2026-0816-005-animation-engine-adoption.md`
**ID:** FID-2026-0816-005
**Severity:** medium
**Status:** closed
**Created:** 2026-08-16 14:30
**Closed:** 2026-08-16 (operator confirmed blur → 15fps in live test)
**YAGNI-Compliance:** Complete

---

## Summary

Child FID (Phase 2) of FID-2026-0816-002: replace manual `setInterval`
animations with the OpenTUI timeline/live-loop engine (`useTimeline`,
`requestLive`/`dropLive` discipline), add a central animation-budget hook
(blur → 15fps, scissor-hidden suspension), and implement smooth scroll,
fold/collapse, and streaming typewriter with the engine. Explicitly does NOT
use the unshipped ScrollbackSurface API.

## Environment

- **OS:** Windows (win32); Git Bash shell
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** @opentui/core + @opentui/react 0.5.3 (post-Phase-0),
  react 19
- **Commit/State:** main branch; Phase 2 implemented (regression fixed)

## Detailed Description

### Problem

Six UI component files drive animation with raw `setInterval` + React state
(spinner, pulse, shimmer, cursor blink, elapsed timer, status-bar timer):
`cli/src/components/elapsed-timer.tsx:41`,
`cli/src/components/input-cursor.tsx:46`,
`cli/src/components/savant-ui/animation/pulse.tsx:17`,
`cli/src/components/savant-ui/feedback/spinner.tsx:24`,
`cli/src/components/shimmer-text.tsx:151`, `cli/src/components/status-bar.tsx:98`.
Only `ProgressBar` (`savant-ui/feedback/progress-bar.tsx:1`) and
`phase-indicator` (`savant-ui/echo/phase-indicator.tsx:2`) use `useTimeline`.
There is no live-loop budget: no blur-based FPS drop, no off-screen
suspension, no `dropLive` cleanup discipline.

### Expected Behavior

Engine-driven animation with a central budget hook; zero `setInterval` in UI
components (grep gate); battery-conscious behavior (blur → 15fps, suspend
when clipped); smooth scroll and folds.

### Root Cause

Components predate the timeline engine's stabilization; animation was
implemented with the simplest pattern available (JS timers) and never
retrofitted.

### Evidence

```text
$ grep -rln "setInterval" cli/src/components
cli/src/components/elapsed-timer.tsx
cli/src/components/input-cursor.tsx
cli/src/components/savant-ui/animation/pulse.tsx
cli/src/components/savant-ui/feedback/spinner.tsx
cli/src/components/shimmer-text.tsx
cli/src/components/status-bar.tsx
$ grep -rln "useTimeline" cli/src/components
cli/src/components/savant-ui/feedback/progress-bar.tsx
cli/src/components/savant-ui/echo/phase-indicator.tsx
```

## Impact Assessment

### Affected Components

- `cli/src/components/savant-ui/feedback/spinner.tsx`
- `cli/src/components/savant-ui/animation/pulse.tsx`
- `cli/src/components/shimmer-text.tsx`
- `cli/src/components/input-cursor.tsx`
- `cli/src/components/elapsed-timer.tsx`, `cli/src/components/status-bar.tsx`
- `cli/src/chat/panels.tsx` (scrollbox smooth scroll)
- New: `cli/src/hooks/use-animation-budget.ts` (proposed)

### Risk Level

- [x] Medium: visual behavior churn; performance regression risk if the
  live loop is left running

## Proposed Solution

### Approach

Mechanical migration (setInterval → useTimeline/onUpdate) plus a shared
budget hook. Verify opentui-spinner's scheduler/suspension claims against its
source before adopting the package — never adopt on the report alone.

### Steps

1. Migrate spinner, pulse, shimmer, sheen, cursor blink to
   `useTimeline`/`onUpdate`; remove per-component timers.
2. Add `use-animation-budget.ts`: `useBlur` → drop `targetFps` to 15; query
   layout bounds → suspend when scissor-hidden; `dropLive` in effect cleanup.
3. Smooth scroll: spring-interpolated `scrollTop` on the transcript
   scrollbox.
4. Fold/collapse: height tween to 0, then unmount on `onComplete`.
5. Streaming typewriter: chunked React commits (~16 chars/flush) or
   imperative native-Text-ref updates — NOT ScrollbackSurface (unshipped).
6. Evaluate opentui-spinner (SpinnerRenderable, createWave/createPulse)
   against its source; adopt only if scheduler/suspension claims hold;
   bump to ^0.0.7 for type parity if adopted.
7. Grep gate: zero `setInterval` in `cli/src/components`.

### Verification

- `grep -rln "setInterval" cli/src/components` → zero hits (allowlist
  non-visual timers: heartbeats, polling, elapsed).
- `OPENTUI_DEBUG=true` + `bun --cpu-prof` before/after CPU comparison.
- Blur behavior: FPS drops to 15 when unfocused. **Windows verification**
  (operator-corrected 2026-08-16): Alt+Tab is NOT a valid test on Windows —
  it is the OS window switcher and never delivers the intended focus-loss
  signal. Use a real focus move instead: **click another window or the
  desktop** (or press Shift+D, then click back). Confirm `useBlur`
  fires on Windows Terminal focus-loss; terminal focus events are unreliable
  across Windows Terminal vs ConHost vs WSL tmux — if `useBlur` does not fire
  on the primary dev platform, document the limitation and defer the
  blur-throttle feature rather than shipping a no-op.
- Existing component tests updated (spinner/pulse/shimmer have tests).

## Perfection Loop

### Loop 1 — RED

- **RED:** Six components on raw `setInterval` (grep evidence above); no
  budget hook; report §13's typewriter pattern references the unshipped
  ScrollbackSurface API.
- **GREEN:** Migration steps + budget hook + corrected streaming pattern
  (chunked commits); opentui-spinner gated on source verification.
- **AUDIT:** grep evidence pasted; `useTimeline` API verified in
  @opentui/react 0.5.3 docs (autoplay default true, `add()` targets,
  `onUpdate`); ScrollbackSurface absence: not present in the @opentui/react
  component list nor the roadmap post (which explicitly says the render tree
  remains TypeScript-owned).
- **ADVERSARIAL:** Claim "chunked commits avoid layout thrash" — consistent
  with the roadmap post's own warning that setStyledText rebuilds text
  buffers wholesale; chunked commits bound that cost. Claim "spinner package
  claims unverified" — correct, hence step 6 gates adoption on source
  inspection.
- **CHANGE DELTA:** New document (initial authoring).

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default
> derivable from inspection, and fold the answer back into the relevant sections.

1. "Are all six setInterval usages visual?" → elapsed-timer and status-bar
   timers are 1 Hz text updates, not visual animation; they can stay on
   timers if migrated ones prove noisy — the grep gate allowlists them with
   a comment. Folded into step 7.
2. "Does `useBlur` fire for terminal-window focus loss?" → Yes — verified
   semantics: useFocus/useBlur are terminal-window focus events (report §14.1
   correction). That is exactly the blur signal the budget hook needs.
3. "Can `translateX/Y` be used for slide-ins?" → Yes — post-layout offsets
   without reflow (verified pattern); used for picker/modals in Phase 4.
4. "Should motion respect a reduce-motion preference?" → Yes; verify the env
   var name before wiring (plan §8 accessibility row) — do not invent one.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is
> ground truth.

- [x] Files referenced exist (six component files + progress-bar +
  phase-indicator; grep evidence above)
- [x] Implementation matches the Proposed Solution — all seven steps
  implemented + the timeline-loop regression fixed (see Resolution)
- [x] Typecheck/tests/lint pass with pasted tool output — typecheck ×4 exit 0;
  cli suite 3087 pass / 0 fail; eslint/lint:md/prettier exit 0
- [x] Production call-graph evidence present — components import
  `useAnimationTimeline`/`useAnimationBudget`; grep gate confirms zero
  non-allowlisted `setInterval`
- [x] FID status reflects the actual implementation state — `fixed` =
  implemented + gates pass; OPEN pending operator blur-throttle verification

### Loop 2 — Independent audit and self-correction

- **RED:** The plan cited the report's smooth-scroll pattern (§13) without
  noting it depends only on scrollTop interpolation — re-verified: no
  unshipped API in that pattern.
- **GREEN:** Explicit note in step 3: smooth scroll uses documented
  `scrollTop`/spring interpolation only.
- **AUDIT:** Report §14.2 lists scrollTop-adjacent claims as verified
  patterns; no ScrollbackSurface dependency in the step.
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

### Loop 3 — Final convergence

- **RED:** Residual risk: the `useTimeline` hook API shape on 0.5.3 differs
  from 0.2.2 usage in progress-bar.tsx.
- **GREEN:** Step 1 includes a compatibility pass: re-verify ProgressBar's
  existing `useTimeline` usage against 0.5.3 during migration (it is the
  in-repo reference pattern).
- **AUDIT:** progress-bar.tsx already uses `useTimeline` + `onUpdate` +
  `once()` — the in-repo reference for the migration.
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

### Loop 4 — Second-pass review (2026-08-16)

- **RED:** The animation-budget hook relies on `useBlur` firing for terminal-window
  focus loss (the 15fps battery throttle), but terminal focus events are
  unreliable across Windows Terminal vs. ConHost vs. WSL tmux. No verification
  item existed to confirm `useBlur` actually fires on the primary dev platform.
- **GREEN:** Added a verification item to exit criteria: confirm `useBlur` fires on
  Windows Terminal focus-loss during the tmux smoke test; if it does not, document
  the limitation and defer the blur-throttle feature rather than shipping a no-op.
- **AUDIT:** `bun run typecheck` (all workspaces) exit 0; `bun run lint:md` exit 0;
  `bun x eslint . --max-warnings 0` exit 0.
- **ADVERSARIAL:** PASS — `useBlur`-on-Windows constraint properly hedged with
  verify-or-defer; no fabricated claim.
- **CHANGE DELTA:** ~3% (added verification item).

### Loop 5 — Re-convergence (2026-08-16)

- **RED:** The Code Verification Evidence section still carried planning-phase
  text (`analyzed` = document converged; "implementation scheduled
  post-Phase-0") after the phase was implemented and marked `fixed`.
- **GREEN:** Rewrote the section to reflect the implemented state (seven
  steps done + regression fixed) and the `fixed` status.
- **AUDIT:** `grep -n useBlur cli/src/hooks/use-animation-budget.ts` →
  `useBlur`/`useFocus` imported (lines 3–4) and wired (lines 99–100);
  `targetFps` computed at line 157. Resolution already records the
  timeline-loop regression fix + `animation-timeline-loop.test.ts`.
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

## Resolution

- **Closed Date:** 2026-08-16 — operator visual pass PASS (blur → 15fps
  confirmed in live test; verification method corrected 2026-08-16: click
  another window/desktop — Alt+Tab is the OS window switcher on Windows and
  does not deliver a focus-loss signal)
- **Regression fix (2026-08-16):** `useAnimationTimeline` created its
  `Timeline` as `new Timeline({ autoplay: false })`, inheriting
  `loop: false` + `duration: 1000`, so every looping item (spinner, pulse,
  shimmer, cursor blink, sheen) was halted once the timeline reached 1000 ms —
  all continuous animations froze ~1 s in. Fixed by adding `loop`/`duration`
  options to `useAnimationTimeline` and having the five looping components
  pass `{ loop: true, duration: Infinity }` (the per-item `loop`/`onLoop` now
  drives the cycle); `useTypewriter` got an unbounded duration + explicit
  pause on completion. Regression test:
  `cli/src/hooks/__tests__/animation-timeline-loop.test.ts` (proves the old
  options halt at 1 s and the new options keep playing).
- **Fix Description:** All seven steps implemented (no deferred steps):
  - Added `use-animation-timeline.ts` — a stable, engine-registered `Timeline`
    (the stock `useTimeline` constructs a new instance per render and only
    registers the first, which breaks looping animations that re-add on prop
    changes).
  - Added `use-animation-budget.ts` — `useBlur`/`useFocus` → drop `targetFps`
    to 15 when blurred; query layout bounds → suspend when scissor-hidden
    (ancestor ScrollBox viewport intersection, invisible/transparent
    ancestors, or off-screen); balanced `requestLive`/`dropLive` in effect
    cleanup so a suspended/unmounted animation stops paying frames.
  - Migrated spinner, pulse, shimmer-text, sheen, and input-cursor from
    `setInterval`/`setTimeout` to the timeline engine (looping `add()` +
    `onUpdate`/`onLoop`); pulse's hardcoded `#6b7280` replaced with
    `theme.muted`.
  - Step 3 — smooth scroll: `use-scroll-management.ts` replaced its
    `setTimeout` + `easeOutCubic` loop with a timeline-driven damped spring
    (`springProgress`) on `scrollTop`, `once` + `onComplete`.
  - Step 4 — fold/collapse: new `use-fold-collapse.ts` (height tween to 0,
    then unmount on `onComplete`; unfold tweens 0 → last-measured natural
    height); `SidebarSection` now folds/unfolds with the tween.
  - Step 5 — streaming typewriter: new `use-typewriter.ts` (chunked ~16-char
    React commits driven by the timeline engine, not the unshipped
    ScrollbackSurface API); `Thinking` reveals streamed reasoning
    progressively.
  - Step 6 — `opentui-spinner` evaluated against its 0.0.7 source and **not
    adopted**: it runs its own raw `setInterval` heap scheduler rather than
    the OpenTUI timeline engine, which contradicts the engine-driven thesis
    (YAGNI; no new dependency).
  - Step 7 — grep gate: `setInterval(` in `cli/src/components` → only the two
    allowlisted 1 Hz wall-clock timers (elapsed-timer, status-bar).
- **Missed Question #4 (reduce-motion):** verified OpenTUI 0.5.3 ships no
  `OPENTUI_REDUCE_MOTION`/reduce-motion env var, so no override was invented
  (the plan's 'verify the env var before wiring — do not invent one' hedge).
- **Tests Added:** Existing shimmer SSR test still green (timeline is
  SSR-safe: registration happens in effects, which `renderToStaticMarkup`
  skips). No new unit tests — the migration is a mechanical timer→timeline
  swap covered by typecheck + the grep gate.
- **Verification Evidence:** `grep -rn "setInterval(" cli/src/components` →
  only elapsed-timer + status-bar (allowlisted). typecheck ×4 exit 0; cli
  suite 3087 pass / 0 fail; full `bun run test` exit 0; eslint, lint:md,
  prettier exit 0; tmux (WSL) smoke launches + streams without a runaway live
  loop. Blur-throttle (`useBlur` firing on Windows Terminal focus-loss)
  confirmed by the operator in the live closure test (2026-08-16) — closure
  gate met.
- **Archived:** 2026-08-16 → `dev/fids/archive/`

> When status is set to **closed** (after implementation), move this file to
> `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

- The grep gate (zero `setInterval` in components) is a mechanical completion
  proof — better than a self-report.
- Package-adoption claims from third-party writeups must be verified against
  package source before they enter the plan (opentui-spinner scheduler).
