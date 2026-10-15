# Easter Eggs

Canonical documentation for hidden/optional visual gags in the Savant-Code
TUI. Keep this page updated whenever an easter egg ships or changes —
`FID-2026-0816-008` is the tracking FID for the current one.

---

## Savant Logo Easter Egg (FID-2026-0816-008)

A hidden click-state machine on the **Savant** ASCII wordmark in the right
sidebar. **One click per message**: each of the three nag bubbles appears
centered on the terminal, auto-dismisses back to normal, and the **4th
click** plays the glitch + full-screen fake-terminal takeover + moral bubble
— then the UI returns to baseline. Purely visual — **no filesystem access,
no shell, no store writes**.

### The sequence (one click per message)

| Click | Phase | What you see |
|-------|-------|--------------|
| 1 | `nag-1` | Centered bubble: "Ouch!" — auto-dismisses after 1.5 s, back to normal |
| 2 | `nag-2` | Centered bubble: "Hey! That hurts, please stop." — auto-dismisses, back to normal |
| 3 | `nag-3` | Centered bubble: "Seriously, stop poking me." — auto-dismisses, back to normal |
| 4 | `glitch` | ~600 ms logo jitter + color flash, then auto-advances |
| 4 (cont.) | `takeover` | **Full-screen** fake terminal in the Savant colorway — cyan on near-black: a fast ~5 s flood of "DELETED …" lines (480 lines through a viewport-height scrolling window, so it fills the terminal top to bottom), then auto-advances |
| 4 (cont.) | `frozen` | Centered moral bubble: "See... being poked isn't fun? Be nice, I can be mean too." — auto-resets after 5 s (long enough to fully read) |
| — | `idle` | Back to normal, level 0; the cycle can repeat |

Every phase **auto-advances** — a nag bubble dismisses itself back to
`idle` (you click again for the next message), and the glitch → takeover →
frozen chain plays on its own after the 4th click. Nothing traps the user,
no click is ever required to dismiss a popup, and the sequence always
terminates at `idle` with the counter reset. Clicks during a running phase
are ignored. The nag/frozen bubbles are small cards **centered on the
terminal** (full-viewport flex layer), never full-screen dialogs.

### Architecture

```text
app.tsx                          (root)
  ├─ <EasterEggProvider>         state machine (one instance, app-scoped)
  │    └─ <AppShell>             normal UI — sidebar contains EasterEggLogo
  ├─ <EasterEggOverlays />       full-screen overlay layer (phase-driven)
  └─ <ToastContainer />
right-sidebar.tsx                <EasterEggLogo /> = wordmark + click trigger
```

- `cli/src/hooks/use-easter-egg.ts` — the state machine
  (`idle → nag-1..3 → glitch → takeover → frozen → idle`), `NEXT_PHASE`
  table, nag/moral message constants.
- `cli/src/components/savant-ui/easter-egg-logo.tsx` —
  - `EasterEggProvider` — app-root context provider.
  - `EasterEggOverlays` — renders the phase overlays; mounted as a sibling of
    `AppShell` (same pattern as `ToastContainer`) so every overlay is
    `position: absolute` against the **full viewport**.
  - `EasterEggLogo` — the wordmark wrapped in `Clickable`; a click from
    `idle` shows the next message (nag-1 → nag-2 → nag-3) or starts the
    prank on the 4th click; clicks during a running phase are ignored.
  - Overlays: nag/frozen are small, centered auto-dismiss bubbles (1.5 s /
    5 s timers); the glitch jitter and the takeover reveal are driven by the
    Phase 2 timeline engine (`useAnimationTimeline` — zero `setInterval`).
    The takeover is cyan-on-near-black (`theme.primary` / `theme.background`)
    — the Savant colorway, never navy or green.
- `cli/src/app.tsx` — mounts the provider + overlay layer on the authed
  surface.

### Safety

- The "DELETED" lines are a `readonly string[]` of string literals — no
  filesystem access, no shell/tool-executor imports, no real paths.
- No store pollution: state is component/provider-local.
- Only UI timers are used (1.5 s nag dismiss, 5 s frozen reset) — both
  allowlisted UI timers under the Phase 2 grep gate.
- Every phase auto-advances; the sequence always terminates at `idle`.
  There is deliberately no full-screen phase that waits for input.
- State resets if the sidebar collapses (provider unmounts) — acceptable;
  the prank targets the expanded wordmark.

### Timeline discipline (regression note)

Every `useAnimationTimeline()` call must pass an explicit `duration` matching
its item. The hook's default timeline duration is **1000 ms**: a longer item
(e.g. the 5000 ms takeover flood) gets cut off at 1 s — the timeline stops
ticking and the item-level `onComplete` never fires, leaving the overlay
frozen with no escape (the exact bug the operator hit on 2026-08-16, and the
same class as the FID-2026-0816-005 loop regression). The takeover pins its
timeline `duration: 5000` to match the item. Covered by
`cli/src/hooks/__tests__/animation-timeline-loop.test.ts` (which proves the
old default halts at 1 s and the pinned duration completes).

### Extending

To add another easter egg or a new step:

1. Add the phase to `EasterEggPhase` + `NEXT_PHASE` in
   `cli/src/hooks/use-easter-egg.ts` (every phase needs a defined successor).
2. Add a phase branch in `EasterEggOverlays` (or a new overlay component).
3. If it needs timers/animations, use `useAnimationTimeline` — `setInterval`
   is banned in components except the documented allowlist.
4. Keep it purely cosmetic. If the gag touches real OS surfaces (paths,
   commands, fake permission prompts), it is **not** a gag anymore — stop.

### Status

- **Implementation:** complete. FID-2026-0816-008 **closed** and archived
  2026-08-16 after the operator's visual pass PASS (click-per-message
  flow, centered bubbles, cyan-on-near-black viewport-height flood, 5 s
  moral bubble — "absolutely perfect, feature is complete").
- **Origin:** brainstorm captured in `dev/idea-shelf/savant-logo-easter-egg.md`
  (mark as implemented; superseded by this page).

## Future / shelved ideas

- None currently active. New gag ideas live in `dev/idea-shelf/` until a FID
  (or this page) picks them up.