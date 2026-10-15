# Page grammars

Eight mutually exclusive page architectures. Each one **forbids** what the
others require, so two builds cannot quietly converge on the same skeleton.
Pick exactly one per build, before any act planning, and say in the report why
the other seven lost.

## The grammars

1. **Continuous world** — one evolving scene, no section boundaries. Requires
   drift/tint continuity and a single fixed stage. Bans hard cuts, per-section
   painted backgrounds, and free-scrolling body copy.
2. **Pinned chapters** — sticky panels advancing an argument chapter by
   chapter. Requires at least three pinned acts. Bans continuous drift and
   unbroken camera flights.
3. **Horizontal drift** — the wheel drives a sideways track. Requires a
   `data-sm-act="pan"` spine. Bans vertical parallax and stacked full-bleed
   scrub sections.
4. **Layered depth stack** — fixed layers at z-depths separating as you
   scroll. Requires parallax factors on at least two layers. Bans pan tracks.
5. **Kinetic editorial** — typography is the imagery; images subordinate.
   Requires kinetic display type and zero full-bleed media heroes. Bans
   dominant video scrubs.
6. **Product showcase** — an object hero scrubbed through its argument.
   Requires at most two scrub acts and a macro-scale peak. Bans abstract
   gradient art as a substitute for the product.
7. **Data narrative** — counters and metrics carry the story. Requires real,
   verifiable numbers only. Bans invented statistics and decorative gauges.
8. **World flight** — multi-world fixed-stage journey with crossfaded worlds
   (`data-sm-worldflight`). Requires a spacer-driven global playhead. Bans
   in-flow sections and per-world scroll hijacking.

## Selection discipline

- The grammar decides nav, hero, and close — they follow, they are not chosen
  separately.
- Choosing `pinned-chapters` a second time means saying why the other seven
  did not fit this brief.
- A different world or palette is **not** a different page. Structure is the
  axis the fingerprint gate scores hardest.