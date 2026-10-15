<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Idea-Farm — Terminal Visual Layer & Rust Stack Unification

**Logged:** 2026-08-15
**Status:** SHELVED — brainstorming capture. Spencer is NOT committed to doing this. Endgame Rust rewrite is "in crosshairs, not on plate." Revisit when ready.
**Theme:** Savant-Code presentation layer + full-stack language unification under one entity.

## Backstory (why this thought exists)
- Spencer originally started Savant-Code in **Rust** — but had never built a terminal before, was doing it wrong, hit a wall.
- Looked at other completed terminal coding agents, randomly checked FreeBuff's license (Apache-2.0), and the idea clicked: *why reinvent the wheel when you can retrofit?*
- Forked FreeBuff (TS), built ECHO governance + 10-agent roster + packages on top. Shelved the Rust idea.
- FreeBuff was TS; other Rust CLI tools at the time were "trash"; the workflow Spencer wanted was in FreeBuff → stuck with TS by necessity, not preference.
- Now that Savant-Code works as intended, the Rust/visual idea is back — for a concrete reason (below), not just aesthetics.

## The real driver: stack unification
- **Savant Core** (Rust agent runtime, savant0x org) is being built separately.
- Savant is architected so the Core agent can *drive* Savant-Code.
- Spencer wants **the same entity across the entire stack** — one Rust-native being, not a TS harness + a Rust Core on different substrates.
- Thesis: **"one mind, a thousand faces."** Insane scope, but he believes he can pull it off. When done, the entire stack is connected.

## The visual thesis (why the terminal matters)
- Current limit: OpenTUI (TS) caps what's possible — animations, sliders, foldable panels with real motion are "somewhat possible but limited."
- Language is the ceiling: Charm (Go) looks better because they hand-roll escape sequences *under* the framework; OpenTUI abstracts them away. The terminal escape layer can do far more (truecolor, cursor animation, alternate screen, sixel/kitty graphics) than the framework exposes.
- Goal: **first impression of wonder** — "how the fuck did they do THAT?" — not "oh, a regular terminal with cool colors."
- Retention hook: a terminal stared at for 10 hours needs kinetic life or it becomes wallpaper.
- Code Universe (sci-fi code explorer w/ sound effects, comets, sidebar) is proof he can do this — his proudest visual feature.

## Current stance (grounded, uncertain)
- NOT doing it now. Not a single-day task. Not even 100% sure he'll pull the trigger later.
- Endgame Rust rewrite already planned (OpenTUI has a Rust version available) — but that's a future FID track, not imminent.
- Near-term probe IF pursued: a **TS spike** — build one wild component (animated foldable panel / motion slider) directly on terminal escapes to see if OpenTUI fights or coexists. Determines whether TS stack can carry the vision before committing to a rewrite.
- The "fork FreeBuff" lesson applies in reverse: don't rewrite from scratch if the TS stack can be retrofitted.

## Re-activation trigger
- When Spencer decides to unify Savant-Code + Savant Core into one Rust substrate → this becomes a major FID track.
- When the visual ceiling becomes a real blocker (not just a feeling) → run the TS spike first.
- "One mind, a thousand faces" = north-star thesis for any stack-unification work.

## Reference links
- FreeBuff (fork source): https://github.com/CodebuffAI/freebuff
- Savant-Code (current, TS): https://github.com/savant0x/savant-code (public)
- Savant Core (Rust runtime): savant0x org — exact repo name TBD
- OpenTUI (current TS foundation): https://github.com/opentui-dev/opentui
- Charm (Go, visual reference — hand-rolled escape layer): https://github.com/charmbracelet
- Cross-ref: yt-roundup-283-triage.md (terminal redesign bullet)
