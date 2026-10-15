# Sidebar command console

The Savant terminal sidebar gives current work, model identity and context
pressure a persistent summary, with operational details underneath. It uses
the existing theme surfaces and semantic colors. FID: `FID-2026-1008-006`.

## Layout

The full sidebar occupies 40 terminal columns, including its left divider.
Below 100 columns, it becomes a 14-column rail. Ctrl+B can also fold it at
wider sizes; that manual choice persists across resizing.
An expanded narrow rail can yield sidebar columns to leave 20 columns for chat
at the supported 50-column floor; it uses the tiny brand mark when narrowed.

Layout follows the sidebar's allocated height:

| Rows | Presentation |
| --- | --- |
| 20+ | Spaced wordmark/activity/model above details; context pinned below |
| 12–19 | Three-row brand/activity strip; session summary scrolls |
| 2–11 | One status row; remaining information scrolls |
| 0–1 | Only the status space that fits |

The spacious top is capped at 9 rows with a blank row between groups. Context
and window provenance are centered beneath the detail viewport, separated by a divider.
The centered version sits directly above the meter. Short layouts put context
last in the scrollable content. At least six detail
rows remain in spacious mode. The folded rail retains its centered S mark,
centered navigation and raised rounded fold button; activity appears once,
under its Activity control, with a blank row below the S mark when height allows.
Detail sections retain their folds
when the terminal resizes or the theme changes. Long model identities and
activity targets are available in expanded Activity detail; bounded summaries
show an explicit ellipsis.

## Controls

- **F6:** cycle sidebar controls in visual order and scroll to reveal them.
- **Enter / Space:** activate the focused section, FID row or fold handle.
- **Ctrl+B:** fold/unfold the sidebar.
- **Escape / Ctrl+C:** close an expanded responsive rail preview.
- **Mouse:** click complete heading rows; hover reveals the responsive rail.
  A manually folded rail stays folded until activated.

F6 preserves an input draft when moving focus. Ctrl+G passes through untouched.
Ctrl+B defers to editing while the input has focus and contains text.
Focused rows use an underline, accent text and a surface change. Hover changes
the entire actionable row. Rail activation focuses the corresponding section.

## Signals

Current activity and ECHO phase are separate observations. The canonical
paused, connecting or retrying lifecycle takes priority over stale work labels.
Clipboard feedback does not become a work phase. Unknown phases and activity
kinds receive explicit unknown labels.

Context displays used/limit and the actual percentage, including values above
100%. Only the bar geometry is clamped. A valid zero usage remains zero;
invalid usage or an unknown window does not produce a percentage. Warning
starts at 70%; error starts at 100%. Window provenance remains catalog, table
or default.

Session diagnostics preserve cache sample denominators, reported zero,
unreported data and rejected samples. Compaction displays blocked reasons and
ineffective outcomes. File counts show created and modified separately; tool
counts mean distinct used names, and history counts mean retained events.

FID cards show the document title, date/sequence, actual status and severity.
Expanded cards preserve the full ID and summary paragraphs. Missing titles
fall back to the full ID. Loading and empty are distinct; the current loader
API does not distinguish read failure from empty inventory.

Teacher, Trust Matrix, scheduled Loop and Auto Drive keep their existing
conditions and data authority. FID review status is displayed per document.
It does not imply the runtime has reached the most advanced document's phase.

## Motion and terminal compatibility

Set `SAVANT_CODE_REDUCED_MOTION=1` or `true` to disable sidebar motion. Values
are case-insensitive and resolved once when the sidebar mounts. Disabled
motion renders the final state immediately.

Folds use a finite 160 ms transition. A changed activity can emphasize the
surface once for 200 ms. Repeated activity, streaming tokens and idle do not
restart decoration. Blur settles folds; completion/unmount releases timeline
live references. Static sections have no animation blur listener.

`SAVANT_GLYPH_TIER=ascii` selects ASCII chevrons, status markers and meter cells;
Unicode and Nerd Font tiers retain their established resolver. Host font
availability still determines how wide characters and the wordmark appear.

Ordinary sidebar text resolves to an existing theme token with at least 4.5:1
contrast against both surface and hover backgrounds when the palette provides
one. Otherwise it chooses the strongest existing candidate. A custom palette
with no readable token cannot meet that target. The existing large wordmark
retains its brand color and click behavior.

## Verification and preview

The nine FID suites cover data semantics, title loading, native keyboard and
mouse interaction, resizing, folds, scroll reveal, glyph tiers and finite motion.
Additional Teacher/Trust regression suites preserve those display contracts.

Local artifacts are under
`dev/scratchpad/active/sidebar-command-console-2026-10-08/`:

- Native OpenTUI character frames, ANSI, cell metadata and raster previews.
- Nine size pairs in dark/light, plus lifecycle and conditional-panel states.
- Fresh isolated tmux captures at the same nine pairs.
- A measured ordinary-text contrast report, excluding decorative wordmark art,
  separators and meter graphics.

Raster previews draw captured native cells using local fonts; they are not
screenshots of the operator's terminal font. Review the actual terminal before
closing visual acceptance. Fixtures are synthetic and make no provider calls.

To inspect the native fixture from the repository root:

```powershell
bun --no-env-file run dev/scratchpad/active/sidebar-command-console-2026-10-08/preview.tsx
```

Use T to switch theme and Q to exit. The fixture reads only its synthetic FIDs.
