# The taste floor

Non-negotiable craft minimums. The engine's token block
(`savant-motion.css`) is the single definition site for raw values; markup and
page CSS consume `var(--sm-*)` tokens only. A build rebrands by overriding six
colour roles and two fonts — nothing else.

## Typography

- Measure 45–75ch (`--sm-measure: 62ch` default).
- Fluid type ramp `--sm-t-xs` … `--sm-t-4xl`; never hardcode font sizes.
- Tracking tightens as size grows (positive at caption sizes, slightly
  negative at display); leading runs inverse to measure.
- Two families maximum: one display, one text.

## Spacing

- 4px base scale (`--sm-1` … `--sm-11`) with intentional odd steps.
- More space above a heading than below it.
- Fluid section rhythm (`--sm-section`, `--sm-gutter`) so a phone does not
  inherit desktop air.

## Colour

- Six roles: `--sm-canvas`, `--sm-surface`, `--sm-ink`, `--sm-ink-soft`,
  `--sm-accent`, `--sm-accent-ink`. Secondary text is tinted toward the
  canvas, never flat grey.
- No pure white on pure black; light-on-dark is compensated.
- Raw hex lives only in the build's theme block (the definition site). Usage
  sites consume tokens. Pages that hard-cut between light and dark grounds
  need the accent at two lightness stops to hold contrast on both.

## Depth

Five tools, not one: offset shadows tinted toward the canvas hue
(`--sm-e1..e3`), edge light (`--sm-edge-light`), scale-and-blur as distance,
overlap, and grain. Zero-offset coloured halos are structurally impossible —
the elevation tokens all carry offset.

## Motion

- One easing family (`--sm-ease`); durations scale to distance.
- Transform and opacity only; `clip-path` for wipes.
- One pixel of wheel equals one pixel of document travel — scroll is never
  hijacked. Parallax and pans are layered motion, not scroll replacement.
- `prefers-reduced-motion` flattens every device to a readable static page;
  this is verified, not assumed.