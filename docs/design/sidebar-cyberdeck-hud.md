# Sidebar Cyberdeck HUD — design record

Status: approved direction. Source of truth for the sidebar redesign tracked in
`dev/fids/FID-2026-1009-008-sidebar-cyberdeck-hud-modernization.md`.

## Approved design

Design 8, "Holo Frame", from `dev/fixtures/sidebar-style-samples.html`:

- Centered header: the company logo (`art/savant-logo.png`), then `Savant`,
  then the version beneath it. The logo is never redrawn or replaced.
- Sections are raised inner panels with a magenta accent.
- Section headers use a fold chevron, a semantic icon, a bold title and a
  right-aligned count.
- A History timeline and a context meter sit at the bottom.

## Decisions

- The ASCII `S` fallback is kept. Where inline images are not supported, the
  header renders the text fallback. Design 8 is first class in both paths.
- The first production section is Session, with its existing rows
  (Compaction, Compactions, Cache) unchanged.
- Fold behavior, data sources and keyboard handling are preserved. Only the
  presentation changes.

## Open items (not part of the first change)

- Generator diff in `cli/scripts/generate-savant-icons.ts` is unattributed and
  belongs to FID-2026-1009-004.
- Preview fixtures in `dev/fixtures/` are not formatting-exempt.
- Colors and spacing in design 8 are not yet mapped to `savant-cyberpunk`
  tokens.
- Cursor rendering of the image logo is unverified.