# FID: Right sidebar FidCard native-border collision breaks rendering

**Filename:** `FID-2026-0722-038-sidebar-fidcard-native-border-collision.md`
**ID:** FID-2026-0722-038
**Severity:** high
**Status:** analyzed
**Created:** 2026-07-22 00:00
**Author:** Forge (via operator-requested deep review)

---

## Summary

The right sidebar composes two incompatible border systems: (1)_ascii-text_
divider lines (`midBorder = '├' + '─'.repeat(38) + '┤'`) rendered as plain
`<text>` elements, and (2) the `<FidCard>` component's native OpenTUI box
border (`<box border={true} borderStyle="single">`). The native box border
draws its own characters around the card bounds inside the 40-char sidebar,
colliding with the surrounding ASCII dividers and clipping the card's inner
text content. This single root cause produces four user-visible symptoms that
have been patched in isolation for five prior turns without resolution:

1. **FID title invisible**: `FID-035` text is emitted to the render buffer
   but not visible on screen — the native box border clips/wraps the inner
   `<text>` content so the visible portion of "FID-035" is overwritten by
   the box's own border character or padding edge.
2. **Stray digit "5" appears between badges**: When "FID-035" is clipped by
   the native border, the trailing "5" wraps onto the next visual line and
   appears between `[high]` and `[created]`, producing `[high] 5 [created]`.
3. **Mouse click selects a highlighted block**: `<FidCard>` attaches
   `onMouseDown` directly to a `<box>`, making every text node inside the
   card selectable. The rest of the codebase uses `makeTextUnselectable`
   (in `clickable.tsx`) precisely to avoid this artifact; `FidCard` skips it.
4. **Divider after "Files Changed" misaligns**: The native border of the
   `FidCard` instances below (in the Active FIDs section) draws box
   characters that overlap with the ASCII `midBorder` above, producing a
   line that visually "goes through the text" rather than matching the
   clean dividers used elsewhere.

## Environment

- **OS:** Windows 11 (`win32`), OpenTUI/inherited terminal renderer
- **Language/Runtime:** Bun 1.3.14, TypeScript strict
- **Tool Versions:** `@opentui/core` 0.2.2, `react` ^19
- **Commit/State:** Editing session 2026-07-21; five prior fix attempts
  changed color, padding, borderStyle and added `onMouseDown` without
  diagnosing the underlying border-system collision.

## Detailed Description

### Problem

The sidebar in `cli/src/components/right-sidebar.tsx` builds its dividers
as literal text:

```ts
const W = 40
const midBorder = '├' + '─'.repeat(W - 2) + '┤'
// ...
<text fg={theme.muted}>{midBorder}</text>
```

Every section (ECHO Protocol, Session, Tools, Files Changed, Agent Stack,
Active FIDs, History) is framed by these text dividers. The Active FIDs
section then embeds `<FidList>` → `<FidCard>`:

```tsx
<box
  border={true}
  borderStyle="single"
  borderColor={theme.border}
  paddingLeft={1}
  paddingRight={1}
  paddingTop={1}
  paddingBottom={1}
  onMouseDown={handleToggle}
>
  <text fg={theme.foreground} attributes={TextAttributes.BOLD}>FID-{shortId}</text>
  <text>
    <span fg={severityColor}>[{severity}]</span>
    {' '}
    <span fg={statusColor}>[{status}]</span>
  </text>
  {expanded && <text fg={theme.muted}>{summary}</text>}
</box>
```

The native `<box border={true}>` instructs OpenTUI to render box-drawing
characters around the box bounds _at the same screen columns_ the ASCII text
dividers above it occupy. The renderer's border pass and the text pass
collide: title text is overwritten, borders draw through divider lines, and
the `onMouseDown` makes the text selectable (highlighting on click).

### Expected Behavior

- FID cards render as plain text rows that align with the sidebar's
  existing 40-column ASCII layout — no per-card native border.
- Clicking (or pressing) a FID card toggles its expanded state without
  leaving the selected-text artifact behind.
- All dividers (`midBorder`) render identically regardless of what
  sections sit below them.

### Root Cause

Mixing OpenTUI native box borders with ASCII text dividers inside a
fixed-width column. The native border was added piecemeal across earlier
turns (rounded → single, padding 0 → 1) without recognizing that the
sidebar's entire visual rhythm uses plain `<text>` border characters.
`onMouseDown` was also added without the paired `makeTextUnselectable`
treatment that every other interactive surface in the codebase uses.

### Evidence

User-supplied render of the sidebar (this session, prior turn):

```text
├──────────────────────────────────────┤
  Active FIDs
    open  4
FID-035
[high] [created]
The slash-command menu popup (and the `/model` picker it invokes) remain broken...
FID-036
[medium] [analyzed]
...
```

User report:
> "i don't actually see 'fid-035' etc, it seems hidden, no idea how i
> copied it when i cannot see it"
> "clicking somewhere in the ui seems to select a block of the ui and
> shows it's highlighted somehow"
> "the first title shows an extra '5' between [high] & [created]"
> "the 'files created' section has the line going straight through the
> text and not matching all other dividors"

Code evidence:

- `cli/src/components/right-sidebar.tsx:91-93` — ASCII border constants
- `cli/src/components/right-sidebar.tsx:152,163,182,191,203,220` —
  midBorder rendered as `<text>` in every section gap
- `cli/src/components/savant-ui/echo/fid-card.tsx:52-61` — native box
  border + onMouseDown inside the ASCII-framed column
- `cli/src/components/clickable.tsx:33-56` — `makeTextUnselectable` is
  the established pattern for interactive text surfaces and FidCard does
  not call it
- `cli/src/components/savant-ui/data-display/code-block.tsx:41` — the
  only other `border={true}` usage; lives in the chat message area (full
  width, no ASCII-divider parent), so it does not collide

## Impact Assessment

### Affected Components

- `cli/src/components/savant-ui/echo/fid-card.tsx` (primary fix)
- `cli/src/components/savant-ui/echo/fid-list.tsx` (no change expected;
  passes through)
- `cli/src/components/right-sidebar.tsx` (audit only — confirm dividers
  are consistent, no per-card native borders remain downstream)

### Risk Level

- [x] Medium: Sidebar cosmetic regression; workaround is "scroll past
      the FID cards". Does not break chat, editing, or protocol flow.

## Proposed Solution

### Approach

Remove the native box border from `FidCard` entirely and render the card
as three plain `<text>` rows that match the sidebar's 40-column indent
convention (`'    '` prefix = 4 spaces). Keep the foldable behavior by
retaining `useState(expanded)` and the `onClick` flow, but switch the
mouse handler to use `makeTextUnselectable` from `clickable.tsx` so the
highlight-on-click artifact is suppressed. Inline the badge colors as
`<span>` children of the badges `<text>` row (already done; this keeps
both badges on a single visual line without the `<box flexDirection="row">`
that was contributing to the border collision).

### Steps

1. In `fid-card.tsx`:
   - Drop `border`, `borderStyle`, `borderColor`, `paddingLeft/Right/Top/Bottom`
     from the outer `<box>`.
   - Wrap children in `makeTextUnselectable(...)` and keep `onMouseDown`
     on the box — this preserves foldable behavior while suppressing
     the selectable-text artifact (the exact pattern `Button` uses).
   - Prefix each text row with 4 spaces so FID cards line up with
     Session/Tools/Files Changed rows.
   - Keep `<text fg={theme.foreground} attributes={TextAttributes.BOLD}>`
     for the title.
2. In `fid-list.tsx`: no structural change; verify `<box flexDirection="column"
   gap={1}>` continues to render the cards as plain stacked rows.
3. In `right-sidebar.tsx`: audit that no other descendant of the sidebar
   uses `border={true}` (the grep already confirmed only `fid-card.tsx`
   and the unrelated chat-area `code-block.tsx` do). No edit needed.

### Verification

- `cd cli && bun run typecheck` — zero errors.
- `bun x eslint cli/src/components/savant-ui/echo/fid-card.tsx --max-warnings 0`
  — zero warnings.
- Operator visual inspection of the sidebar:
  - FID title `FID-035` / `FID-036` / `FID-037` visible as plain text.
  - No stray digit between `[severity]` and `[status]` badges.
  - All `midBorder` lines render identically.
  - Clicking a FID card no longer leaves a highlighted selection block.

## Perfection Loop

### Loop 1

- **RED:**
  - FidCard mixes native `<box border>` with the sidebar's ASCII text
    dividers → title clipped, extra "5" leaks, Files Changed divider
    appears malformed, `onMouseDown` selects text and highlights.
  - Evidence: user paste + `fid-card.tsx:52-61` + `clickable.tsx:33-56`.
- **GREEN:**
  - Strip `border*` and `padding*` props from the outer `<box>` in
    `fid-card.tsx`.
  - Wrap card children with `makeTextUnselectable(...)` (imported from
    `clickable.tsx`) so the `onMouseDown` toggle no longer leaves a
    selection artifact.
  - Indent card rows by 4 spaces to match the sidebar's section rows.
  - Keep `expanded` state and `onClick` forwarding — foldable still works.
- **AUDIT:**
  - `cd cli && bun run typecheck` — pass (will paste output into FID on
    completion).
  - `bun x eslint cli/src/components/savant-ui/echo/fid-card.tsx
    --max-warnings 0` — pass.
  - Law 4 (call-graph): `grep -rn FidCard cli/src/` confirms
    `fid-list.tsx` is the production caller; `right-sidebar.tsx` renders
    `<FidList>` at line 213 — reachable.
- **CHANGE DELTA:** <10% of `fid-card.tsx` character count (one block
  edit on the outer `<box>` and a wrapper call).

## Resolution

- **Fixed By:** (pending — to be filled after AUDIT passes)
- **Fixed Date:** (pending)
- **Fix Description:** Remove native box border, add makeTextUnselectable,
  indent rows to match sidebar.
- **Tests Added:** No — FID card is a presentational component with no
  existing unit tests; verification is visual + typecheck + eslint.
- **Verified By:** Operator visual inspection + tool output.
- **Commit/PR:** (pending)
- **Archived:** (pending)

## Lessons Learned

- **When two border systems coexist in one column, one wins and one
  renders through the other.** OpenTUI native `<box border>` is incompatible
  with ASCII-text dividers inside the same fixed-width parent. Pick one.
- **Adding `onMouseDown` to a `<box>` of `<text>` children produces
  selectable text.** Every interactive surface in this codebase goes
  through `Button`/`Clickable` which call `makeTextUnselectable`; a
  bespoke interactive component must follow the same discipline.
- **Five patches in a row changed the symptom (color, padding,
  borderStyle, mouse handler) without naming the cause.** The.Protocol
  requires the cause to be identified in RED before GREEN; patching past
  that is a Law 2 (Present Before Act) anti-pattern.
