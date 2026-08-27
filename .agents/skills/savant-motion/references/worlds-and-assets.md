# Worlds and assets (local-first)

Savant-motion is local-first and BYOK: no paid generation APIs, no required
ffmpeg, no platform-specific binaries. Real user assets beat generated ones
every time, and a fully procedural build is first-class, not a fallback.

## The asset ladder

1. **User-provided footage and photos** — anchor the world, cost nothing.
2. **Canvas image sequences** — stills the engine steps through
   (`data-sm-seq`); cheap to produce from existing photography.
3. **Procedural CSS/canvas worlds** — gradients, grain, geometry, code-rendered
   surfaces. Zero assets required; `scrollcraft-showcase` and `vesper-v2`
   upstream both proved zero-imagery builds can clear the gate.

Text baked into images is banned: real markup stays selectable, translatable,
sharp.

## World budget

- Hero worlds get the video scrub or sequence; support worlds get stills.
- Every media element carries a poster frame that matches the first frame.
- Load order: current world first, neighbours deferred; the engine's blob
  fetch and sequence loader degrade gracefully when assets are absent.

## Codecs and encoding (operator-facing notes)

- **webm/vp9 scrubs everywhere**; bundled Chromium lacks h264, so the verify
  harness reports video metrics as `skipped` (not failed) when it falls back
  from the Chrome channel. Prefer vp9 to keep verification complete.
- Scrubbing walks from the previous keyframe: dense GOP beats small files.
  If the operator has ffmpeg, suggest `-g 8` (desktop) / `-g 4` (mobile) with
  audio stripped — as documentation, never as an agent dependency.
- Serve over localhost for verification; `file://` blocks the engine's blob
  fetches (the harness embeds its own server).

## Brand kits are inputs, not decoration

Point the build at the brand's folder before generating anything. Its hard
rules win, including rules that forbid things the skill would otherwise reach
for: a brand that bans invented numbers means no stat counters.