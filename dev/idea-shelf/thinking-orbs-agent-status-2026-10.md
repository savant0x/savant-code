# Thinking Orbs — AI Agent Status Indicators (2026-10-07)

Found by Spencer (YouTube ref: manuagi video, watch?v=9F_bL40YwbI). He remembered it as
"speech bubbles" — it's actually **orb-based agent status indicators**. Site: thinkingorbs.com.

## What it is
- npm: `@yogesharc/thinking-orbs` — React component library of animated AI status orbs
- Repo: https://github.com/yogesharc/thinking-orbs
- **Zero dependencies, 3.8 KB gzipped.** Also plain-JS (needs nothing at all), and
  shadcn copy-paste: `npx shadcn@latest add https://thinkingorbs.com/r/orb.json`
- 8 states: working, reasoning, searching, background tasks, retrying, compacting, waiting, base
- 15 variants (e.g. Searching · Lighthouse, Retrying · Surge, Compacting · Squeeze/Fuse),
  5 shapes (incl. cube), 8 render styles (incl. halftone)
- Props: state, variant, size, speed, shape, render, density, dotSize, tilt, paused, label (a11y), className (text-* tinting)
- Tree-shakeable: core ships 1 shape + 1 render; extras are opt-in imports

## Why it matters for Savant
1. **It names the states we live in.** "Compacting", "Retrying", "Background Tasks" — this
   is agent-reality vocabulary as UI states. Savant Desktop's chat UI (bubbles, streaming,
   approval buttons) needs exactly this: a status indicator that says what the agent is
   DOING, not a spinner that says "loading".
2. **The design bar is Spencer-grade.** "Attention to detail on every state and variant" —
   15 named variants implies hand-tuned motion per state, not one animation re-tinted.
   Worth studying HOW they differentiate 15 variants of the same orb (speed? density?
   phase? trail?) — that taxonomy is directly portable to Savant Desktop's status system.
3. **Zero-dep + plain-JS path** = can be ported to non-React contexts (the desktop app is
   native, not Electron-React). The plain-JS orb could be reimplemented or adapted.

## Portable patterns
- The **state taxonomy itself** (8 states incl. compacting/retrying) — free requirements
  research for Savant Desktop's agent-status UI
- Variant naming as a design system practice (state × variant matrix)
- tilt/density/dotSize as parametric knobs for procedural dot-orbit animation

## Status
SHELVED — reference for Savant Desktop agent-status UI design. Reactivation trigger:
when Savant Desktop's status-indicator work starts, port the state taxonomy + study
the variant differentiation technique; plain-JS render for the native app.
