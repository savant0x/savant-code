# FID: Savant Logo Easter Egg — Escalating Click Prank

**Filename:** `FID-2026-0816-008-savant-logo-easter-egg.md`
**ID:** FID-2026-0816-008
**Severity:** low
**Status:** closed
**Created:** 2026-08-16
**Closed:** 2026-08-16 (operator visual pass PASS — "absolutely perfect, feature is complete")
**YAGNI-Compliance:** Complete

---

## Summary

A click-per-message Easter egg on the Savant ASCII wordmark ("Savant") in
the right sidebar: three clicks each show a nagging bubble that
auto-dismisses back to normal; the **4th click** plays the glitch
distortion, a fake terminal "file deletion" takeover, and a moral bubble,
then resets to baseline. Purely visual — no filesystem access, no shell
invocation. Builds on the existing `Branding` component,
`useAnimationTimeline`, and `Clickable` wrapper.

## Environment

- **OS:** Windows 11 (primary), WSL, Linux, macOS
- **Language/Runtime:** TypeScript 5.x, Bun 1.3.14, React 19.2, OpenTUI 0.5.3
- **Tool Versions:** `@opentui/core@0.5.3`, `@opentui/react@0.5.3`, `react-reconciler@0.33.0`
- **Commit/State:** Working tree dirty (UI overhaul Phases 0–4 in progress); FID authored against `main@HEAD`.

## Detailed Description

### Feature

The Savant logo in the right sidebar (full `<Branding text="Savant">` wordmark)
gains a hidden click-state machine. **One click per message:**

| Click | Phase | Behavior |
|-------|-------|----------|
| 1 | nag-1 | Centered bubble: "Ouch!" — auto-dismisses after 1.5 s, back to normal |
| 2 | nag-2 | Centered bubble: "Hey! That hurts, please stop." — auto-dismisses, back to normal |
| 3 | nag-3 | Centered bubble: "Seriously, stop poking me." — auto-dismisses, back to normal |
| 4 | glitch | Logo jitter + color flash (~600 ms via timeline engine), auto-advances |
| 4 (cont.) | takeover | Full-screen fake terminal overlay — **cyan on near-black** (Savant colorway): a fast ~5 s flood of "DELETED" lines (480 lines through a viewport-height scrolling window, filling top to bottom), auto-advances |
| 4 (cont.) | frozen | Centered moral bubble: "See... being poked isn't fun? Be nice, I can be mean too." — auto-resets after 5 s (long enough to fully read) |
| — | idle | Return to baseline, level 0; the cycle can repeat |

A nag bubble **auto-dismisses itself back to `idle`** — the user clicks
again for the next message (the logo is never permanently covered, and the
bubble never chains into the next phase on its own). The glitch → takeover
→ frozen chain plays on its own after the 4th click. Nothing traps the
user, no click is ever required to dismiss a popup, and the sequence
always terminates at `idle`. Clicks during a running phase are ignored.
The nag/frozen messages are small cards **centered on the terminal**
(full-viewport flex layer), never full-screen dialogs.

### Existing Components Reused

- `cli/src/components/savant-ui/branding.tsx` — `<ascii-font>` wordmark
- `cli/src/components/clickable.tsx` — `Clickable` mouse-event wrapper
- `cli/src/hooks/use-animation-timeline.ts` — stable `Timeline` for glitch + scroll
- `cli/src/hooks/use-theme.tsx` — theme tokens for popup/overlay styling
- `cli/src/components/dialog-overlay.tsx` — shared overlay chrome
  (FID-2026-0816-007 step 2): absolute + RGBA backdrop + translateY entry/exit.
  The full-screen takeover reuses its absolute/z-index pattern. (The nag and
  frozen messages render as small logo-anchored `NagBubble`/`FrozenBubble`
  components instead of centered dialogs — operator-corrected.)

### New Components

- `cli/src/hooks/use-easter-egg.ts` — click-state machine hook (~45 lines)
- `cli/src/components/savant-ui/easter-egg-logo.tsx` — provider + overlay
  layer + trigger component (~230 lines)

### Safety

- Fake command list is a `readonly string[]` literal — no filesystem access,
  no shell/tool-executor import, no real paths.
- "DELETED" lines are purely visual text rendered in a `<pre>` element.
- State is component-local (hook `useState`/`useRef`), no store pollution.
- Reset is automatic (5 s frozen bubble auto-reset); no click is ever
  required to dismiss anything.

---

## Impact Assessment

### Affected Components

- `cli/src/components/right-sidebar.tsx` — `<Branding>` swap to `<EasterEggLogo>`
- `cli/src/components/savant-ui/branding.tsx` — **read-only**, no changes
- `cli/src/components/savant-ui/easter-egg-logo.tsx` — **new**
- `cli/src/hooks/use-easter-egg.ts` — **new**

### Risk Level

- [x] **Low:** New feature, additive, component-local, no existing logic modified
      beyond a 3-line swap. Fake terminal is pure visual. Zero security surface.

---

## Proposed Solution

### Approach

One hook + one component. The hook owns the state machine; the component
owns rendering. The easter egg wraps the existing `<Branding>` via
`<Clickable onMouseDown>` so the wordmark itself becomes the trigger.

### Steps

1. Create `cli/src/hooks/use-easter-egg.ts` — expose `phase`, `advance`,
   `reset`. State machine: `idle → nag-1 → nag-2 → nag-3 → glitch →
   takeover → frozen → idle`. Every transition auto-advances via timer or
   timeline `onComplete` (1.5 s nag dismiss, 5 s frozen reset — UI timers,
   allowlisted).
2. Create `cli/src/components/savant-ui/easter-egg-logo.tsx` — wrap
   `<Branding>` in `<Clickable>`, render phase-conditional overlays:
   - `nag-1/2/3` → `NagBubble` — small logo-anchored auto-dismiss bubble
     (top-right, 1.5 s timer)
   - `glitch` → apply jitter tween to a wrapper `<box>` via `useAnimationTimeline`
   - `takeover` → full-surface z-indexed absolute `<box>` (same positioning
     pattern as `dialog-overlay.tsx`) with green-on-black rapid-scrolling
     `DELETED_LINES` (6 passes over the list, ~2 s timeline)
   - `frozen` → `FrozenBubble` — centered moral bubble, 5 s auto-reset
3. Modify `cli/src/components/right-sidebar.tsx` — replace `<Branding ... />`
   with `<EasterEggLogo ... />` on the full wordmark instance.
4. Mount `EasterEggProvider` + `<EasterEggOverlays />` at the app root in
   `cli/src/app.tsx` so the takeover covers the full viewport, not the
   sidebar.
5. Verify: typecheck ×4, `bun test cli/`, eslint, prettier. Unit tests for
   the state machine + overlay render.

### Verification

- [ ] typecheck ×4 (sdk/common/agent-runtime/cli) exit 0
- [ ] `bun test cli/` exit 0
- [ ] `eslint --max-warnings 0` exit 0
- [ ] `prettier --check` clean
- [ ] Visual pass: click-per-message flow in terminal (3 auto-dismissing
      nags, then the takeover on the 4th click)

---

## Perfection Loop

### Loop 1 — RED

- **RED:** Document authored. No code yet — RED is a planning pass on the
  document itself, not a code audit. Findings: (1) missing required "Author"
  metadata field, (2) status "created" undersells the document's maturity
  (full Missed Questions, Impact Assessment, and Proposed Solution already
  present), (3) citation `use-theme.ts` is inaccurate — the actual file is
  `use-theme.tsx`.
- **GREEN:** Applied all three fixes: added `Author: Recorder`, set status to
  `analyzed`, corrected the theme-hook citation to `use-theme.tsx`.
- **AUDIT:** Verifier confirmed safety and Missed Questions sections PASS;
  flagged the three RED findings above (now resolved).
- **ADVERSARIAL:** (deferred — document-only FID with no implementation yet;
  adversarial pass will accompany the implementation audit).
- **CHANGE DELTA:** ~3% (metadata + one citation).

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default
> derivable from inspection, and fold the answer back into the relevant sections.

1. **Should the easter egg survive across sidebar collapse/expand?** → No.
   State is component-local to `EasterEggLogo`. Collapse/expand unmounts
   the rail; state resets. Acceptable — the easter egg targets the full
   wordmark which only renders in the expanded sidebar.
2. **What if the user clicks faster than animations complete?** → Clicks
   during a running sequence are ignored (`advance` is only wired when
   `phase === 'idle'`); the overlays cover the trigger and play on their
   own. No race condition — React batches state updates.
3. **Could the fake "DELETED" text trigger an EHEL or security scanner?** →
   The strings are `readonly string[]` literals rendered in a `<pre>`. No
   tool executor, no shell import, no `eval`. A static scan matching the
   word "DELETED" in a JSX string is a false positive — EHEL flags
   execution paths, not display strings.
4. **Does the glitch animation conflict with the Phase 2 animation-budget
   hook?** → No. `useAnimationTimeline` registers a dedicated `Timeline`
   instance that the engine tracks. The budget hook's blur→15fps throttle
   and scissor-hidden suspension apply normally — the glitch degrades
   gracefully when blurred/hidden.
5. **Should the takeover overlay be dismissible mid-scroll?** → No. The
   sequence is a story — interrupting it undermines the joke. It
   auto-advances after ~2 s (the timeline completes) into the frozen moral
   bubble, which auto-resets after 5 s. Nothing waits for input.

---

### Implementation Evidence (REQUIRED for `closed`)

> A FID **cannot** be set to `closed` without this section filled. No silent
> deferrals — every step must be `implemented`, `blocked`, or `deferred`
> (operator-approved only).

- [ ] **Commit SHA:** (working tree — no commit yet; implementation
  verified locally)
- [x] **File:line ranges:** `cli/src/hooks/use-easter-egg.ts` (state machine,
  full file, new); `cli/src/components/savant-ui/easter-egg-logo.tsx`
  (provider + full-screen `EasterEggOverlays` layer + `EasterEggLogo`
  trigger, full file, new); `cli/src/components/right-sidebar.tsx`
  (import swap at top + `<EasterEggLogo />` at the header wordmark);
  `cli/src/app.tsx` (authed return now wraps the surface in
  `EasterEggProvider` and mounts `<EasterEggOverlays />` as a sibling of
  `AppShell` — the same root-level mount pattern as `ToastContainer`, so
  every overlay is absolutely positioned against the full viewport).
- [x] **Gate output:** typecheck ×4 exit 0; cli suite 3109 pass / 18 skip /
  0 fail; `eslint --max-warnings 0` exit 0; `lint:md` exit 0; prettier
  clean; tmux (WSL) smoke — TUI launches and renders the wordmark with the
  swap live.
- [x] **Reproducibility:** unit tests cover the full state-machine cycle +
  bubble render; `animation-timeline-loop.test.ts` proves the takeover's
  pinned 2000 ms timeline completes (the freeze regression). The one-click
  story needs a terminal mouse pass (operator visual pass).
- [x] **Step statuses:** all four Proposed Solution steps `implemented`
  (see accounting below).

### Step-Level Accounting (anti-deferral)

| Step | Status |
| --- | --- |
| 1. `use-easter-egg.ts` state machine | `implemented` |
| 2. `easter-egg-logo.tsx` overlays (nag/glitch/takeover/frozen) | `implemented` |
| 3. `right-sidebar.tsx` `<Branding>` → `<EasterEggLogo>` swap | `implemented` |
| 4. App-root provider + overlay mount in `app.tsx` | `implemented` |
| 5. Verify: typecheck ×4, cli tests, eslint, prettier | `implemented` |

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution — `CenteredPopup`
  corrected to `DialogOverlay` (Loop 3); overlays reuse Phase-4 chrome
- [x] Typecheck/tests/lint pass with pasted tool output (above)
- [x] Production call-graph evidence is present — `right-sidebar.tsx` mounts
  `EasterEggLogo` (replacement for `Branding`), which is the only wordmark
  instance
- [x] FID status reflects the actual implementation state — `fixed` =
  implemented + gates pass; visual pass pending

---

### Loop 2 — Re-convergence (2026-08-16)

- **RED:** (1) The metadata carried an `Author: Recorder` field, which the
  single-agent protocol forbids (no Author/signature fields in FIDs); (2) the
  theme-hook citation needed re-verification against the actual file.
- **GREEN:** Removed the `Author` field. Confirmed the `use-theme.tsx`
  citation matches the real file (`ls cli/src/hooks/ | grep use-theme` →
  `use-theme.tsx`); all four referenced components/hooks exist
  (`branding.tsx`, `clickable.tsx`, `use-animation-timeline.ts`,
  `right-sidebar.tsx`).
- **AUDIT:** File-existence checks pasted (all four EXISTS); theme-hook
  filename confirmed.
- **ADVERSARIAL:** No residual challenge — document remains planning-only.
- **CHANGE DELTA:** < 2%.

### Loop 3 — Final convergence

- **RED:** One Ground-Truth fabrication in the document: step 2 referenced
  `<CenteredPopup message={...} />`, but no `CenteredPopup` exists anywhere in
  `cli/src` — grep resolves to zero matches. The centered popup archive is
  already solved in-repo by `dialog-overlay.tsx` (FID-2026-0816-007 step 2),
  authored after this FID.
- **GREEN:** Corrected step 2 + the reused-components list to use
  `DialogOverlay` (absolute + RGBA backdrop + translateY entry/exit) for the
  nag popups and the frozen moral message; the takeover overlay reuses the
  same absolute/z-index pattern.
- **AUDIT:** `grep -rn "CenteredPopup" cli/src` → zero matches (fabrication
  confirmed); `cli/src/components/dialog-overlay.tsx` exists — `onClose` +
  render-prop `requestClose` API verified (lines 19–36).
- **ADVERSARIAL:** Previously deferred (Loop 1) — now completed on the whole
  document. Safety claims re-checked: fake command list is a `readonly
  string[]` literal, no shell/tool-executor import, no real paths; state is
  component-local; the 6→idle 3 s `setTimeout` is an allowlisted UI timer
  (matches the Phase 2 grep-gate exception class). Clickability: `Clickable`
  wrapper exists (`clickable.tsx`). No residual challenge.
- **CHANGE DELTA:** ~4% (fabricated component corrected + loop completed).

  All five loop phases (RED/GREEN/AUDIT/ADVERSARIAL/CHANGE DELTA) are now
  complete on this document. Status is `fixed` as of the implementation pass
  (see Resolution + Implementation Evidence); closure requires the operator's
  click-per-message visual pass.

### Loop 4 — Operator-correction pass (2026-08-16)

- **RED:** The operator's live test exposed two real defects, not cosmetic
  nits: (1) the interaction required **7 clicks** with centered,
  next-click-only popups — the operator wanted a single click that plays
  the whole story; (2) the takeover **froze the UI** — after a few
  "DELETED" lines the overlay stuck with no escape, forcing a CLI restart.
  Root cause of the freeze: `useAnimationTimeline()` defaults to
  `duration: 1000`, so the 2000 ms takeover item was cut off at 1 s — the
  timeline stopped ticking and the item-level `onComplete` never fired,
  leaving the overlay mounted with no handler (same class as the
  FID-2026-0816-005 loop regression).
- **GREEN:** Rewrote `easter-egg-logo.tsx` — nag/frozen are small
  logo-anchored auto-dismiss bubbles (1.5 s / 3 s timers); glitch and
  takeover are timeline-driven with explicit `duration` pinned to the item
  (600 ms / 2000 ms); the takeover reveals 6 passes over the `DELETED` list
  so the screen fills with movement; every phase auto-advances;
  `onComplete` always fires so the sequence always returns to baseline.
  Clicks during a running sequence are ignored.
- **AUDIT:** `animation-timeline-loop.test.ts` extended to prove the
  regression mechanically — the default 1000 ms timeline halts a longer
  item (old behavior), and a pinned `duration` completes (new behavior).
  Full gate battery re-run: typecheck ×4, cli suite, eslint, lint:md,
  prettier all green; tmux launch smoke clean.
- **ADVERSARIAL:** No residual challenge — the freeze has a mechanical
  regression test, the interaction has no trapping states, safety claims
  unchanged (readonly literals, no shell, allowlisted timers).
- **CHANGE DELTA:** ~15% (interaction redesign + freeze fix + docs).

> **Loop 4 addendum (second operator correction, same day):** the first
> Loop-4 fix over-corrected to "one click plays the whole story". The
> operator's intended flow is **click-per-message**: each nag bubble
> auto-dismisses back to `idle`, and only the 4th click starts the prank.
> The state machine was rewritten with a `level` counter
> (`use-easter-egg.ts`: `clickTransition` / `nagDismissTransition` /
> `autoAdvanceTransition` / `resetTransition` — pure functions, fully unit
> tested), so a dismissed nag returns to `idle` instead of chaining into
> the next phase. Suite re-run: 3132 pass / 0 fail; eslint, lint:md,
> prettier green.
>
> ### Loop 5 — Colorway/position/flood correction + navy purge (2026-08-16)
>
> - **RED:** The operator's visual pass found three defects: (1) the takeover
>   rendered **green-on-black** instead of the Savant **cyan-on-near-black**
>   colorway; (2) the nag/frozen bubbles were pinned top-right instead of
>   **centered** on the terminal; (3) the takeover scroll lasted ~2 s and
>   stopped before it registered — it needed to **flood fast for ~5 s**.
>   Additionally the operator flagged that the **navy/slate neutral family
>   is wrong project-wide** — it is pre-fork Freebuff branding, and Savant
>   is near-black + cyan only.
> - **GREEN:** (1) takeover now uses `theme.primary` (`#18faf9` cyan) text
>   on `theme.background` (`#050508` near-black); (2) bubbles render on a
>   full-viewport flex layer (`BUBBLE_CENTER`) — centered, no top-right
>   anchoring; (3) takeover is now a 5 s linear timeline revealing 480
>   lines through a viewport-height scrolling window (`offset = revealed −
>   window`, window = `useTerminalBreakpoints().height` so the flood always
>   covers the full terminal height — operator follow-up 2026-08-16),
>   so the screen fills fast and keeps flooding. Project-wide navy purge:
>   `palette.ts` dark+light neutrals (surface `#0f172a` → `#0b0b11`, border
>   `#1e293b` → `#20202a`, muted `#94a3b8` → `#8f8f99`, foreground
>   `#e2e8f0` → `#e4e4e8`, aiLine/syntaxComment/imageCardBorder `#64748b` →
>   `#5c5c66`, etc.), the `savant-cyberpunk` contract (`default.ts`,
>   `theme-adapter.ts` FALLBACKS, `parser.ts`), the HTML-export CSS
>   (`template-css-part1.ts`), and the logo block colors
>   (`use-logo.tsx`, `login/utils.ts` `#020617` → `#050508`).
> - **AUDIT:** grep confirms zero `#0f172a` / `#1e293b` / `#94a3b8` /
>   `#64748b` / `#e2e8f0` / `#020617` remaining in `cli/src` +
>   `packages/design-systems/src` product code; `default.test.ts` gained a
>   no-navy assertion on the neutral family; theme-config / export-conversation
>   tests updated to the new values. Gates: typecheck ×5 (incl.
>   design-systems), cli suite 3132 pass / 0 fail, eslint 0, lint:md 0,
>   prettier clean.
> - **ADVERSARIAL:** No residual challenge — the contrast pairs in
>   `default.test.ts` were re-verified ≥ 4.5 for the new neutrals; safety
>   claims unchanged (readonly literals, no shell, allowlisted timers).
> - **CHANGE DELTA:** ~8% (easter-egg color/position/flood + palette purge).
>
> **Loop 5 addendum (operator tweak, same day):** the frozen moral bubble's
> auto-reset went 3 s → **5 s** (`FROZEN_DURATION_MS`) — it disappeared
> roughly as the reader finished the sentence. 5 s lets the message be fully
> read. Sequence table / safety / steps updated.

---

## Resolution

- **Closed Date:** 2026-08-16 — operator visual re-test PASS
  (click-per-message flow, centered bubbles, cyan-on-near-black takeover,
  viewport-height 5 s flood, 5 s moral bubble — "absolutely perfect,
  feature is complete").
- **Fix Description:** All five steps implemented with zero deferrals.
  `use-easter-egg.ts` owns the click-state machine (idle → nag-1..3 →
  glitch → takeover → frozen → idle) with a `level` counter (nags shown).
  State lives at the **app root**: the `EasterEggProvider` wraps the authed
  surface in `app.tsx` and `<EasterEggOverlays />` mounts as a sibling of
  `AppShell` (the same root-level mount pattern as `ToastContainer`), so
  every phase overlay is `position: absolute` against the **full viewport**.
  Shipped interaction (operator-corrected): **click-per-message** — clicks
  1–3 show small **centered** auto-dismiss nag bubbles (1.5 s), and the
  **4th click** plays `GlitchOverlay` (600 ms timeline jitter + color
  flash), `TakeoverOverlay` — a **full-screen** fake DELETED terminal in
  the **cyan-on-near-black** Savant colorway (`theme.primary` /
  `theme.background`), 480 lines through a viewport-height scrolling window
  over ~5 s — then a centered moral bubble that auto-resets after 5 s.
  `EasterEggLogo` in the sidebar is only the wordmark + click trigger.
  Purely cosmetic: `readonly` string literals, no shell/tool-executor
  imports, no store.
- **Interaction correction (operator, 2026-08-16, two rounds):** the first
  shipped version required 7 clicks, used centered next-click-only popups,
  and its takeover **froze** — the timeline defaulted to 1000 ms, cutting
  the 2000 ms takeover item off so `onComplete` never fired and the overlay
  trapped the user. Round 1 corrected the freeze (takeover pins
  `duration: 2000`) but over-corrected the interaction to "one click plays
  the whole story" — the operator's intended design is **click-per-message**:
  clicks 1–3 each show a nag bubble that auto-dismisses back to `idle`
  (1.5 s), and the 4th click starts the glitch → takeover → frozen chain.
  Round 2 rewrote the state machine with a `level` counter (nags shown) so
  dismissal never chains into the next phase on its own.
- **Color/position/flood correction (operator, 2026-08-16, round 3):** (1)
  the takeover was green-on-black; the Savant colorway is **cyan on
  near-black** — the takeover now uses `theme.primary` / `theme.background`;
  (2) the bubbles were top-right anchored; they are now **centered** on the
  terminal; (3) the takeover flood was ~2 s (it filled and stopped before it
  registered); it is now a **~5 s fast flood** (480 lines through a
  viewport-height scrolling window) so the movement reads clearly. Follow-up:
  the flood window is sized from `useTerminalBreakpoints().height` (was a
  fixed 30 rows, which left short terminals' lower half empty). Round 3 also purged the
  **navy/slate neutral family project-wide** (operator directive: the navy
  scale was pre-fork Freebuff branding, never Savant) — `palette.ts` dark
  + light neutrals, the `savant-cyberpunk` design contract
  (`default.ts`/`theme-adapter.ts`), the HTML-export CSS, and the logo
  block colors now use neutral near-black grays with cyan accents only.
- **Tests Added:** `use-easter-egg.test.ts` (click-per-message cycle:
  click → nag → auto-dismiss → idle at the next level; 4th click → glitch
  → takeover → frozen → reset; clicks during running phases ignored;
  transitions only apply to their own phases); `easter-egg-logo.test.tsx`
  (bubble renders message); `animation-timeline-loop.test.ts` (proves the
  1000 ms default halts a longer item and the pinned duration completes —
  the freeze regression).
- **Verification Evidence:** pasted in Implementation Evidence above
  (gates + tmux launch smoke). Operator visual pass PASS 2026-08-16 in
  Windows Terminal — click-per-message flow, centered bubbles,
  cyan-on-near-black takeover, viewport-height 5 s flood, and the 5 s moral
  bubble all confirmed ("absolutely perfect").
- **Archived:** 2026-08-16 — moved to `dev/fids/archive/` after operator
  closure; CHANGELOG closure entry appended.

---

## Lessons Learned

- A fake-terminal prank stays safe when its "commands" are `readonly`
  string literals and its only timers are UI-side — no executor, no shell.
- For an easter egg keyed on clicks, every phase must have a defined
  successor (the NEXT_PHASE table) so a running sequence always lands in a
  valid state instead of an undefined render.
- "Full-screen" in a terminal layout is a mount-point decision, not a style
  decision: an overlay should be `position: absolute` but it only covers the
  viewport when it is mounted as a sibling of the app shell (the
  `ToastContainer` pattern) — mounting it inside the sidebar pins it to the
  sidebar.
- **Timeline duration must match its longest item** (the freeze bug):
  `useAnimationTimeline` defaults to 1000 ms, so a longer overlay item gets
  cut off — the timeline stops ticking and the item's `onComplete` never
  fires, leaving the overlay up with no escape. Always pass an explicit
  `duration` matching the item (same class as the FID-2026-0816-005 loop
  regression).
- **A gag's interaction is operator intent, not agent preference.**
  Round 1 of the correction "simplified" the flow to one-click-auto-play;
  the operator's intended design was click-per-message (each nag
  auto-dismisses back to normal; the 4th click starts the prank). The real
  invariant is: every phase auto-advances on its own timer, a dismissed
  phase returns to a usable `idle`, and nothing traps the user — never
  assume the interaction shape; ask or follow the stated spec exactly.
