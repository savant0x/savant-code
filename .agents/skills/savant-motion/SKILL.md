---
name: savant-motion
description: >
  Build a premium scroll-driven interactive landing page where scroll becomes
  the timeline: video scrubs frame by frame under the wheel, stages pin while
  their argument advances, rails pan sideways, headlines assemble line by line,
  the page ground shifts colour as you travel, and the pointer moves things
  that are not scrolling. Interviews first, picks one of eight mutually
  exclusive page grammars plus a bespoke signature move so no two builds share
  a skeleton, enforces a weighted fingerprint gate against every prior build,
  writes real semantic HTML on a token-driven read-only engine, and verifies by
  screenshotting its own scroll — dead-scroll zones, cues that never reach full
  opacity, WCAG raster contrast, reduced-motion readability — as strict JSON
  evidence. Use for "scrollytelling", "scroll animation site", "Apple-style
  landing page", "interactive landing page", "make my brand a scroll
  experience", "a unique scroll site", or any request for a site that should
  feel like an experience rather than a document.
---

# savant-motion

Scroll is the only input every visitor already knows how to use. Treat it as a
timeline: the wheel is a scrubber, the page is a film with real text on top,
and each act behaves differently enough that the visitor keeps going.

**Provenance:** native transposition of `scroll-craft` (MIT, Nate Herk;
worldflight mechanics trace to oso95/scroll-world). The pristine snapshot
lives at `resources/scroll-craft-main/`; everything here is rewritten to
ECHO governance — no paid APIs, no ffmpeg dependency, deterministic evidence.

## Choreography: map onto the Perfection Loop

This skill adds zero runtime machinery; it routes through the loop that
already exists.

| Loop phase | Owner | This skill's work |
| ---------- | ----- | ----------------- |
| idle       | Orchestrator | Interview (Step 0); confirm FID-bound execution applies |
| red        | Detective   | Read brand assets, resolve workspace, load registry rows |
| green      | Thinker + Orchestrator | Grammar + signature move + feeling curve; run `scripts/gate.ts`; write BRIEF.md |
| green      | Forge/Orchestrator | Build page from `templates/engine/page-starter.html` on the read-only engine |
| audit      | Verifier    | Consume `evidence.json` from `scripts/verify/index.ts` — one violation is an AUDIT failure |
| adversarial| Adversary   | Attack the signature move's novelty against registry history; refute derivative claims |
| complete   | Recorder    | Record the row via `gate.ts --record`; archive |

## Step 0: The interview

Always interview before generating anything. Eight questions, one pass:

1. Vibe in three to five words, plus up to three non-site references.
2. The scroll journey section by section, in their words.
3. The energy curve — where calm, where intense.
4. How they should feel stage by stage, and the ONE moment they must remember.
5. One thing this site should do that no site they have seen does (signature
   move seed).
6. How far from premium-minimal: brutalist to dense editorial.
7. One unbroken world or distinct scenes?
8. What assets do they already have? ("Nothing" is fine — see
   [references/worlds-and-assets.md](references/worlds-and-assets.md).)

Write answers verbatim into `<builds>/<name>/BRIEF.md` with the feeling curve,
the peak sentence, and any authored silence. If unreachable, self-author and
mark it `Self-authored, not interviewed`.

## Bootstrap

```bash
bun run <skill>/scripts/workspace.ts --ensure        # resolve + seed workspace
bun run <skill>/scripts/doctor.ts                    # preflight: what is missing
```

Workspace resolution: `SAVANT_MOTION_HOME` env → nearest `.motion.json`
(`{"workspace": "path"}`) → `<project-root>/motion/`. Builds live in
`motion/builds/<name>/`; the registry is `motion/registry.json` and starts
empty — that is correct.

## Steps 1–3: Brief, grammar, gate, score

1. Journey first: four to seven beats, each a shift in what the visitor knows
   or feels. Sections serve beats; cut anything that serves none.
2. Pick one grammar ([references/grammars.md](references/grammars.md)) and say
   why the other seven lost. Nav, hero, and close follow from it.
3. Invent the signature move
   ([references/uniqueness.md](references/uniqueness.md)).
4. Write the proposal JSON and run the gate **before building**:

```bash
bun run <skill>/scripts/gate.ts --proposal brief/proposal.json
```

A collision is a plan change, never a registry edit. Two failed convergence
attempts → present the collision to the operator (`--allow-collision` only).
The row is recorded at **completion** — after verification passes — via
`gate.ts --proposal ... --record`; never before the build exists.

5. Feeling curve before the score table
   ([references/feel.md](references/feel.md)); assign each beat a device from
   [references/devices.md](references/devices.md) — four device families
   minimum, none twice in a row, at most two scrubs, one peak with authored
   silence before it.

## Step 4: Build

Start from `templates/engine/page-starter.html`. Copy the engine files into
the build and never edit them per project. Rebrand via the six colour roles +
two fonts in the theme block; markup consumes `var(--sm-*)` tokens only
([references/taste-floor.md](references/taste-floor.md)). Real semantic HTML:
real `h1`, real links, real reading order.

## Step 5: Verify

```bash
bun run <skill>/scripts/verify/index.ts --dir motion/builds/<name>
```

The harness serves the build, walks every scroll position in headless Chrome
(bundled Chromium fallback marks video metrics `skipped`), and emits
`motion/verify/<name>/evidence.json` plus screenshots:

- dead scroll (identical raster while the wheel advanced),
- cues that never reach opacity 1 at their center moment,
- WCAG 2.1 AA contrast graded on composited pixels at each line's brightest
  background frame,
- reduced-motion static readability, page console errors.

One violation is an AUDIT failure. Then do what the harness cannot: read the
contact sheet cold, run the feel check, tab through for focus order.

## Hard rules

| Never                                             | Instead                                  |
| ------------------------------------------------- | ---------------------------------------- |
| Generating before the interview                   | Step 0, written BRIEF.md                 |
| Same skeleton twice (fails the gate)              | Change the plan, not the registry        |
| Editing the engine per project                     | Tokens, attributes, page-local JS        |
| A page with no engineered peak, or three           | One peak; silence before it; most span   |
| An ending that fades out                           | The close resolves and holds             |
| Scroll hijacking (wheel ≠ document travel)         | Layered motion over honest scroll        |
| Invented statistics in counters                    | Real numbers or no counter               |
| Shipping without running verification              | evidence.json clean, then feel check     |
| Text baked into images                             | Real markup, always                      |

## Output

Report: grammar chosen and why the other seven lost, the signature move, the
gate result per row, the journey, the feeling curve and peak, what was
verified by evidence.json and what was not, the local URL, and the recorded
registry row. Keep it brief — the page is the deliverable.