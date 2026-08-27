# Devices and the data-sm-* contract

Nine device families. A page uses at least four and never the same family
twice in a row — five sections that behave identically are one section shown
five times. The engine reads these attributes off real semantic markup; it
never generates DOM. Page CSS must not restyle engine-owned layer classes.

## The contract

| Attribute                       | Device                                            |
| ------------------------------- | ------------------------------------------------- |
| `data-sm-act="flow\|pin\|scrub\|pan\|dwell"` | act stage; span via `data-sm-span` (vh) |
| `data-sm-scrub` + `data-sm-src` | video timeline scrubs under the wheel (blob fetch)|
| `data-sm-seq` + `-src`/`-count` | canvas image sequence (`{i}` placeholder)         |
| `data-sm-cue`                   | opacity reaches exactly 1 at viewport center      |
| `data-sm-reveal="up\|down\|left\|right\|iris"`| one-shot entrance                  |
| `data-sm-parallax="0.2"`        | depth factor over viewport delta                  |
| `data-sm-pan-track`             | horizontal track inside a pan act                 |
| `data-sm-count="12000"`         | count-up with locale formatting on entry          |
| `data-sm-kinetic`               | display type split into words for choreography    |

Supporting attributes: `data-sm-drift-from/-to` (ground tint interpolation),
`data-sm-dwell="0.4"` (linger ease), `data-sm-magnet="0.3"`,
`data-sm-spotlight` (pointer devices — never fire on touch),
`data-sm-worldflight` + `data-sm-world` + `data-sm-spacer` (fixed-stage
worlds), `data-sm-root`, `data-sm-lerp`.

## What the engine publishes

Per act: `--sm-p` (local progress 0..1). Globally: `--sm-vy` (smoothed scroll
velocity px/ms). Events: `sm:waypoint` at world boundaries.
`window.ScrollMotion.instances` exposes mounted instances. Bespoke signature
moves read this state as page-local JS — the engine stays untouched.

## Rules

- At most two scrub acts. Video is the heaviest thing on the page.
- Every cue must reach full opacity at its center moment; the verify harness
  fails any cue a reader can only ever see faded.
- Authored silence is an act with zero motion devices — mark it in BRIEF.md so
  verification can tell it from dead scroll.
- `transition: all` and animating width/height/top/left are banned; use
  transform, opacity, clip-path.