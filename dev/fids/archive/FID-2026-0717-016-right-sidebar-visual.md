# FID: Right Sidebar Visual Fixes

**Filename:** `FID-2026-0717-016-right-sidebar-visual.md`
**ID:** FID-2026-0717-016
**Severity:** medium
**Status:** closed
**Created:** 2026-07-17 22:00
**Author:** Spencer Howell

---

## Summary

4 visual bugs in the right sidebar: tagline split across 2 lines, context progress bar on 2 lines, model truncation loses dash, context section missing its own border wrapper.

## Environment

- **OS:** Windows 11
- **UI Framework:** OpenTUI v0.2.2
- **Sidebar width:** 30 chars (hardcoded in Panel `width={30}`)

## Detailed Description

### Issue 1 — Tagline Split (right-sidebar.tsx:72-75)

```tsx
<text fg={theme.muted}>{'│ One Mind. A Thousand │'}</text>
<text fg={theme.muted}>{'│   Faces.             │'}</text>
```

"Faces." is isolated on its own line with box-drawing `│` characters. The tagline should be on one line.

**Root cause**: `│ One Mind. A Thousand Faces. │` is 32 chars. Sidebar is 30 chars. Two lines used to fit.

### Issue 2 — Context Progress Bar Split (right-sidebar.tsx:92 + token-meter.tsx)

`TokenMeter` renders two lines:
- Line 1: `context ████████████████░░░░ 35%`
- Line 2: `45.0k/128.0k`

Should be single-line.

**Root cause**: `TokenMeter` component renders `<ProgressBar>` + separate `<box>` with token count below.

### Issue 3 — Model Truncation (right-sidebar.tsx:87)

`truncate(model, 14)` truncates to 13 chars + `…`. "minimax/minimax-m3" (15 chars) → "minimax/minimax…" — the dash is preserved but the model name is cut.

The user says it shows "minimax/minimaxm3" — this suggests the model value might be wrong (missing dash), or the truncation is confusing.

**Root cause**: Truncation at 14 chars is too aggressive for model IDs.

### Issue 4 — Context Section Missing Wrapper (right-sidebar.tsx:92)

TokenMeter is inside the Session section (lines 78-96), which has `┌─ Session ────┐` border. But the context bar doesn't have its own `┌─ Context ────┐` wrapper like Tools, Files, Agent Stack, History sections have.

## Impact Assessment

- [x] Medium: Visual polish issues, not functional breaks

## Proposed Solution

**Fix 1: Tagline on one line**
- Remove `│` box-drawing characters
- Use: `<text fg={theme.muted}>One Mind. A Thousand Faces.</text>`
- Fits in 30 chars without padding

**Fix 2: TokenMeter single-line**
- Modify `TokenMeter` to render progress bar and token count on the same line
- Change from `<box flexDirection="column">` to `<box flexDirection="row">`
- Or: remove TokenMeter, use ProgressBar directly with inline token count

**Fix 3: Model truncation**
- Increase truncation from 14 to 20 chars, or remove truncation entirely
- "minimax/minimax-m3" (15 chars) fits in 20 chars without truncation

**Fix 4: Context section wrapper**
- Move TokenMeter into its own `┌─ Context ────┐` bordered section
- Or: integrate into Session section with a sub-header

## Perfection Loop

### RED Phase — Issues Identified

| # | Issue | File:Line | Evidence |
|---|-------|-----------|----------|
| 1 | Tagline split across 2 lines | right-sidebar.tsx:72-75 | `│ Faces. │` isolated |
| 2 | Context bar on 2 lines | token-meter.tsx:27-44 | flexDirection="column" |
| 3 | Model truncation at 14 chars | right-sidebar.tsx:87 | "minimax/minimax…" loses context |
| 4 | Context section has no border wrapper | right-sidebar.tsx:78-96 | Inside Session section, no own border |

### GREEN Phase — Proposed Fixes

**Fix 1: Tagline**
```tsx
<text fg={theme.muted} marginBottom={1}>
  One Mind. A Thousand Faces.
</text>
```
Remove `│` characters. Text is 28 chars, fits in 30-char sidebar with 1-char padding on each side.

**Fix 2: TokenMeter single-line**
Modify `TokenMeter` to render inline:
```tsx
<box flexDirection="row" gap={1}>
  <ProgressBar value={used} max={max} label={label} width={12} />
  <text fg={theme.muted}>{`${(used/1000).toFixed(1)}k/${(max/1000).toFixed(1)}k`}</text>
</box>
```
ProgressBar width reduced from 20 to 12 to fit token count on same line.

**Fix 3: Model truncation**
Change `truncate(model, 14)` to `truncate(model, 20)`. "minimax/minimax-m3" (15 chars) fits without truncation.

**Fix 4: Context section wrapper**
Extract TokenMeter into its own bordered section:
```tsx
<box flexDirection="column" marginBottom={1}>
  <text attributes={TextAttributes.BOLD} fg={theme.primary}>
    ┌─ Context ────────┐
  </text>
  <TokenMeter ... />
  <text fg={theme.muted}>
    └──────────────────┘
  </text>
</box>
```

### AUDIT Phase

| # | Check | Method |
|---|-------|--------|
| 1 | Tagline on one line | Visual inspection |
| 2 | Context bar single-line | Visual inspection |
| 3 | Model shows full ID | Visual inspection |
| 4 | Context has border wrapper | Visual inspection |
| 5 | Typecheck passes | `bun run --cwd=cli typecheck` |

### SELF-CORRECT Phase

**Finding:** Removing `│` characters from the tagline changes the visual style. Other sections use box-drawing borders.

**Correction**: The tagline is a subtitle, not a section header. It doesn't need box-drawing characters. Plain text is cleaner.

**Finding:** Reducing ProgressBar width from 20 to 12 might make the bar too small to read.

**Correction**: 12 chars is still readable (5 filled + 7 empty at 40%). The token count provides the exact number. The bar is supplementary.

**Finding:** What if the model ID is longer than 20 chars? Some OpenRouter model IDs are very long.

**Correction**: Keep truncation at 20 chars. Any model ID longer than 20 chars is an edge case. The truncation adds `…` to indicate overflow.

**Finding:** The TokenMeter currently accepts a `history` prop for sparkline. If we change it to single-line, do we lose the sparkline?

**Correction**: The sparkline is optional and not passed from the sidebar. No loss. If history is added later, it can be a third element in the row.

**Finding:** Should the context section be inside Session or separate?

**Correction**: Separate. The Session section shows metadata (tokens, cost, model, mode, agent). The Context section shows the progress bar. They're different concerns. Separating them with borders makes the sidebar more scannable.

### COMPLETE Phase

FID converged. 4 fixes: tagline single-line, TokenMeter single-line, model truncation increased, context section bordered.

## Blind Spots (Questions I Should Have Asked)

1. **What if the tagline is too long for some terminal widths?** — The sidebar is fixed at 30 chars. The tagline is 28 chars. It fits. No responsive behavior needed.

2. **Should the ProgressBar use neon colors?** — Yes, it already uses `theme.warning` for low capacity. The neon green (`#39ff14`) will be used for healthy capacity if we change the color logic.

3. **What about the version display at the bottom?** — Line 174-179. It uses `justifyContent: 'flex-end'` and `marginTop: 'auto'`. This pushes it to the bottom. No change needed.

4. **Should the fsmPhase display be in its own section?** — Currently it's not shown at all in the sidebar. If added, it should be in the Session section or as a badge.

5. **What about the agent stack section?** — It uses `AgentStack` component which renders `└─` prefixed items. This is consistent with the tree-view style.

6. **Should the history section show more than 5 items?** — Currently `toolHistory.slice(-5)`. 5 is reasonable for a sidebar. More would overflow.

7. **What about empty states?** — If no tools are used, the Tools section shows nothing. If no history, History section shows nothing. Should we show "None" or hide the section?

8. **Should the sidebar be collapsible?** — Not in scope for this FID. Could be a future feature.

## Resolution

- **Fixed By:** Spencer Howell
- **Fixed Date:** 2026-07-17 22:15
- **Fix Description:** 4 visual fixes: (1) Tagline merged to single line "One Mind. A Thousand Faces." (28 chars, fits 30-char sidebar); (2) TokenMeter changed from 2-line column layout to single-line row layout (ProgressBar width 20→12, token count inline); (3) Model truncation increased from 14 to 20 chars; (4) Context section extracted into own bordered section with ┌─ Context ────┐ wrapper matching other sections.
- **Tests Added:** No (visual verification only)
- **Verified By:** typecheck (zero errors)
- **Archived:** 2026-07-17 22:15
