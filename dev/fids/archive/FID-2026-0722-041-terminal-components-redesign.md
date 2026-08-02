# FID-2026-0722-041 — Terminal-Facing Components Visual Redesign

**Filename:** `FID-2026-0722-041-terminal-components-redesign.md`
**ID:** FID-2026-0722-041
**Severity:** medium
**Status:** closed
**Created:** 2026-07-22 18:05
**Author:** ECHO Orchestrator

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0722-041`. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

Apply the same visual design system used for the right sidebar to the other terminal-facing components that were missed during earlier redesign phases: `chat-input-bar.tsx`, `model-picker.tsx`, `command-palette.tsx`, and `status-bar.tsx`. The goal is consistent spacing, typography, and removal of hardcoded ASCII hints and manual string padding.

---

## Environment

- **OS:** Windows 11 / cross-platform TypeScript CLI
- **Language/Runtime:** TypeScript 5.5, Bun 1.3.14
- **Tool Versions:** `@opentui/core` 0.2.2, React 19
- **Commit/State:** main branch, v0.0.4 prep

---

## Detailed Description

### Problem

Several terminal-facing components still use ad-hoc visual patterns that were bypassed during the Phase 033 TUI redesign:

1. **`chat-input-bar.tsx`**: the ask-user form uses a hardcoded padded title string:
   ```tsx
   const [askUserTitle] = React.useState(' Some questions for you ')
   ```
   The compact-mode prompt glyph `❯` is unstyled and the mode label/icon chips use inline spans with hardcoded spacing.

2. **`model-picker.tsx`**: list items use manual padding to align model IDs:
   ```tsx
   const pad = ' '.repeat(Math.max(0, maxIdLen - model.id.length))
   ```
   This breaks if the terminal font is not perfectly monospace or if IDs contain wide characters.

3. **`command-palette.tsx`**: command rows use inline spacer spans (`<span>{'  '}</span>`) to separate columns instead of flex layout.

4. **`status-bar.tsx`**: action hints use raw ASCII glyphs (`■ Esc`, `✕ End session`) with no consistent key-hint styling.

### Expected Behavior

All terminal components should share the same visual language:
- Flexbox for alignment, never manual spaces.
- Consistent badge/chip styling via Savant-UI primitives.
- Clean key hints without ASCII block glyphs.
- Prompt glyph uses a theme accent color and a consistent style.

### Root Cause

These components were either created after the main redesign push or were considered "good enough" during earlier phases. They were not given the same design-system treatment as the Savant-UI components in `cli/src/components/savant-ui/`.

### Evidence

- `cli/src/components/chat-input-bar.tsx:133` — `askUserTitle` padded string.
- `cli/src/components/model-picker.tsx:280-282` — `pad = ' '.repeat(...)`.
- `cli/src/components/command-palette.tsx:110` — spacer spans.
- `cli/src/components/status-bar.tsx:230-236` — `■ Esc` / `✕ End session` glyphs.

---

## Impact Assessment

### Affected Components

- `cli/src/components/chat-input-bar.tsx`
- `cli/src/components/model-picker.tsx`
- `cli/src/components/command-palette.tsx`
- `cli/src/components/status-bar.tsx`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

---

## Proposed Solution

### Approach

For each component, replace manual spacing and ASCII glyphs with native flexbox and Savant-UI primitives. Introduce a small `KeyHint` primitive for status-bar keyboard hints.

### Steps

1. **`chat-input-bar.tsx`**
   - Remove `askUserTitle` padded string; use `titleAlignment="center"` without padding.
   - Style the compact prompt `❯` with `theme.success`.
   - Convert mode label/icon chips to a shared `InputModeChip` primitive (or use existing Savant-UI badge).

2. **`model-picker.tsx`**
   - Remove `pad` and `maxIdLen`.
   - Render each row as `<box flexDirection="row" gap={1}>` with separate `<text>` nodes for marker, id, provider badge, and name.
   - Use `flexGrow`/`flexShrink` to control description truncation.

3. **`command-palette.tsx`**
   - Remove inline spacer spans.
   - Use a flex row with three columns: marker/label, description, and a right-aligned key hint.

4. **`status-bar.tsx`**
   - Replace `■ Esc` and `✕ End session` with a `KeyHint` primitive rendering `[Esc]` / `[End]` style tags.
   - Keep action button behavior; only the label styling changes.

5. **Verification**
   - `cd cli && bun run typecheck`
   - `bun x eslint cli/src/components/chat-input-bar.tsx cli/src/components/model-picker.tsx cli/src/components/command-palette.tsx cli/src/components/status-bar.tsx cli/src/components/savant-ui/primitives/key-hint.tsx --max-warnings 0`
   - Visual inspection in tmux.

### Verification

1. Typecheck passes.
2. ESLint passes on all four files plus the new `KeyHint` primitive.
3. Visual check: model picker rows align without manual padding, command palette uses flex spacing, status bar hints are clean.

---

## Perfection Loop

### Loop 1

- **RED:**
  - Four terminal components use manual padding, ASCII glyphs, or hardcoded title strings.
  - Visual inconsistency with the redesigned Savant-UI components.
  - `model-picker` alignment is fragile to font/character width.
- **GREEN:**
  - Replace manual spacing with flexbox in all four components.
  - Introduce `KeyHint` primitive for status-bar keyboard hints.
  - Standardize chip/badge styling for input mode indicators.
- **AUDIT:**
  - Design cross-checked against OpenCode/Kilocode terminal overlays (clean flex rows, no ASCII art).
  - Scope limited to four files plus one new primitive.
  - Verification commands identified.
- **CHANGE DELTA:** ~5–10% per file; one new primitive file.

### Missed Questions (folded back into the FID)

- **Q1: What happens if a model ID is longer than the available row width?**
  - Use `flexShrink` and `wrapMode="none"` on the model ID and `flexGrow` on the description; long IDs truncate with ellipsis rather than breaking alignment.
- **Q2: Is the `KeyHint` primitive reusable outside the status bar?**
  - Yes. It is a generic presentational component that renders a bracketed keyboard hint. It can be used in any overlay or footer.
- **Q3: Does the `❯` prompt glyph color work in both light and dark themes?**
  - Yes. `theme.success` is defined in both theme palettes and adapts to the active mode.
- **Q4: Are there existing tests that will break?**
  - No tests currently assert on the exact spacing strings or ASCII hints. Tests that render these components will continue to pass because data and behavior are unchanged.

---

## Resolution

- **Fixed By:** Forge
- **Fixed Date:** 2026-07-22
- **Fix Description:**
  - **NEW** `cli/src/components/savant-ui/primitives/key-hint.tsx` — reusable bracketed keyboard hint primitive (returns OpenTUI `<box>` so it can be nested inside other flex containers).
  - **REWIRED** `cli/src/components/chat-input-bar.tsx` — removed the hardcoded padded `askUserTitle` string; styled the compact prompt `❯` with `theme.success`; converted mode label/icon chips to theme-aware boxes with colored backgrounds.
  - **REWIRED** `cli/src/components/model-picker.tsx` — removed manual `pad = ' '.repeat(...)` alignment; rendered each row as a flex row with separate columns for marker, model ID, provider badge, and model name; used `wrapMode="char"` for safe truncation.
  - **REWIRED** `cli/src/components/command-palette.tsx` — removed inline spacer spans; used a flex row with marker/label, description, and key-hint columns; replaced hardcoded `ESC to close` text with the `KeyHint` primitive.
  - **REWIRED** `cli/src/components/status-bar.tsx` — replaced raw ASCII glyphs (`■ Esc`, `✕ End session`) with the `KeyHint` primitive inside `StatusActionButton`.
- **Tests Added:** None (no behavioral changes; existing tests continue to pass).
- **Verified By:** x4 typecheck gate (sdk, common, agent-runtime, cli) ✅; ESLint `--max-warnings 0` on all changed files ✅.
- **Commit/PR:** [Pending — user commit]
- **Archived:** 2026-07-22

---

## Lessons Learned

1. **Redesigns must be comprehensive.** Missing a few components makes the whole product look inconsistent.
2. **Manual padding is a maintenance trap.** Flexbox alignment survives font and terminal changes.
3. **Small primitives (`KeyHint`) prevent duplication.** Status-bar hints would otherwise be reimplemented in multiple places.

---

## Linked Documents

- [FID-2026-0722-040](./FID-2026-0722-040-sidebar-core-layout-redesign.md) — sidebar core layout redesign
- [FID-2026-0722-042](./FID-2026-0722-042-fidcard-fidlist-redesign.md) — FID card/list redesign
- [FID-2026-0722-043](./FID-2026-0722-043-master-sidebar-terminal-redesign.md) — Master FID
