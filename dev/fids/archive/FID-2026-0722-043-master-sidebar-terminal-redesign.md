# FID-2026-0722-043 — Master: Sidebar & Terminal UI Redesign

**Filename:** `dev/fids/FID-2026-0722-043-master-sidebar-terminal-redesign.md`
**ID:** FID-2026-0722-043
**Severity:** high
**Status:** closed
**Created:** 2026-07-22 18:15
**Updated:** 2026-07-22 18:45
**Author:** ECHO Orchestrator

---

## Summary

Orchestrate a comprehensive visual redesign of the Savant-Code terminal interface. The Master FID coordinates three child FIDs that respectively address the right sidebar core layout, the FID card/list presentation, and the remaining terminal-facing components. All existing functionality is preserved; only the visual presentation and layout primitives are modernized.

---

## Environment

- **OS:** Windows 11 / cross-platform TypeScript CLI
- **Language/Runtime:** TypeScript 5.5, Bun 1.3.14
- **Tool Versions:** `@opentui/core` 0.2.2, React 19
- **Commit/State:** main branch, v0.0.4 prep

---

## Detailed Description

### Problem

The Savant-Code terminal interface has a fragmented visual system:

1. **Right sidebar** uses hand-drawn ASCII borders and manual padding.
2. **FID card/list** uses hardcoded indentation and square-bracket badges.
3. **Other terminal components** (`chat-input-bar`, `model-picker`, `command-palette`, `status-bar`) were missed by earlier redesign work and still use ad-hoc spacing/ASCII hints.

The result is a product that looks inconsistent and unfinished, especially the sidebar which the operator described as "horrible" and "first-year-dev" quality.

### Expected Behavior

A unified terminal design system where:
- Layout is driven by OpenTUI flexbox, not string math.
- Borders are native OpenTUI borders, not ASCII art.
- Components share a small set of reusable primitives (`SidebarSection`, `KeyValueRow`, `KeyHint`, `Badge`).
- The sidebar, input bar, overlays, and status bar all feel like one coherent product.

### Root Cause

The TUI was built in phases. Phase 033a–033e rebuilt many components, but the right sidebar and several overlays were either patched in isolation (FID-036, 037, 038) or never redesigned. Without a Master orchestration FID, individual fixes addressed symptoms instead of establishing a shared visual system.

### Evidence

- `cli/src/components/right-sidebar.tsx` — ASCII borders and manual padding.
- `cli/src/components/savant-ui/echo/fid-card.tsx` — hardcoded indentation.
- `cli/src/components/chat-input-bar.tsx`, `model-picker.tsx`, `command-palette.tsx`, `status-bar.tsx` — ad-hoc spacing and ASCII hints.

---

## Impact Assessment

### Affected Components

- `cli/src/components/right-sidebar.tsx`
- `cli/src/components/savant-ui/echo/fid-card.tsx`
- `cli/src/components/savant-ui/echo/fid-list.tsx`
- `cli/src/components/chat-input-bar.tsx`
- `cli/src/components/model-picker.tsx`
- `cli/src/components/command-palette.tsx`
- `cli/src/components/status-bar.tsx`
- New primitives: `SidebarSection`, `KeyValueRow`, `KeyHint`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

*High severity because the sidebar is the primary ECHO Protocol status surface and the user's first impression of the product. Inconsistent terminal UI undermines trust.*

---

## Proposed Solution

### Approach

Implement the three child FIDs in order, validating after each phase. The Master FID defines the shared design system and dependencies; child FIDs contain the detailed implementation plans.

### Steps

1. **Implement FID-2026-0722-040** — Right Sidebar Core Layout & Visual System
   - Create `SidebarSection` and `KeyValueRow` primitives.
   - Rewrite `right-sidebar.tsx` with native flexbox and left border.

2. **Implement FID-2026-0722-042** — FidCard and FidList Visual Redesign
   - Rewrite `FidCard` as a flex-based card with chevron and pill badges.
   - Update `FidList` empty state.

3. **Implement FID-2026-0722-041** — Terminal-Facing Components Visual Redesign
   - Update `chat-input-bar.tsx`, `model-picker.tsx`, `command-palette.tsx`, `status-bar.tsx`.
   - Create `KeyHint` primitive for status bar hints.

4. **Integration & Final Verification**
   - Run x4 typecheck gate.
   - Run ESLint on all changed files.
   - Run CLI in tmux for visual inspection.
   - Update CHANGELOG and archive child FIDs.

### Verification

1. `cd cli && bun run typecheck`
2. `bun x eslint cli/src/components/right-sidebar.tsx cli/src/components/savant-ui/echo/fid-card.tsx cli/src/components/savant-ui/echo/fid-list.tsx cli/src/components/chat-input-bar.tsx cli/src/components/model-picker.tsx cli/src/components/command-palette.tsx cli/src/components/status-bar.tsx cli/src/components/savant-ui/primitives/sidebar-section.tsx cli/src/components/savant-ui/primitives/key-value-row.tsx cli/src/components/savant-ui/primitives/key-hint.tsx --max-warnings 0`
3. `tmux-cli` visual inspection: no double-bar artifacts, collapsible sections work, badges render as pills, no selectable-text artifacts.

---

## Perfection Loop

### Loop 1

- **RED:**
  - Sidebar and terminal UI use inconsistent layout systems (ASCII art, manual padding, native borders mixed).
  - Existing FIDs 036–038 attempted partial fixes but never established a shared visual system.
  - The user is near a breaking point with the sidebar's appearance.
- **GREEN:**
  - Decompose the work into three focused child FIDs (040, 041, 042) plus this Master FID (043).
  - Define shared primitives and visual language in the Master FID.
  - Preserve all functionality; only change presentation.
- **AUDIT:**
  - Each child FID reviewed for completeness and non-overlapping scope.
  - Reference implementations from OpenCode/Kilocode reviewed (collapsible sections, flex rows, clean key hints).
  - Verification commands cover typecheck, lint, and visual inspection.
- **CHANGE DELTA:** ~6 source files, ~3 new primitive files.

### Loop 2

- **RED:**
  - Need to ensure child FID scopes do not conflict (e.g., 040 and 042 both touch `right-sidebar.tsx` padding).
- **GREEN:**
  - Clarify ownership: 040 owns the sidebar layout and spacing; 042 owns the `FidCard` internal layout only.
  - Add cross-references in each child FID.
- **AUDIT:**
  - Scopes verified as non-overlapping.
- **CHANGE DELTA:** Documentation only.

### Missed Questions (folded back into the FID)

- **Q1: What is the implementation order and why?**
  - 040 → 042 → 041. The sidebar layout must exist before the FID card can be placed correctly inside it; terminal components are independent and can be updated last.
- **Q2: How do we handle dependencies between child FIDs?**
  - FID-042 depends on FID-040's parent spacing but does not block it. FID-041 is independent. The Master FID lists this order and dependency graph.
- **Q3: What is the rollback plan if a child FID fails verification?**
  - Each child FID is implemented in its own commit. If verification fails, revert that commit and re-run the Perfection Loop on that FID only.
- **Q4: When do we archive the superseded FIDs (036–038)?**
  - After the implementation of FID-040, FID-041, and FID-042 is verified, FIDs 036–038 will be closed as superseded and archived per ECHO Auto-Archive rule.
- **Q5: How do we ensure visual consistency across all changed components?**
  - Shared primitives (`SidebarSection`, `KeyValueRow`, `KeyHint`) and strict use of theme tokens enforce consistency. The final verification includes a full tmux visual pass.

---

## Resolution

- **Fixed By:** [Pending — Forge]
- **Fixed Date:** [Pending]
- **Fix Description:** [Pending]
- **Tests Added:** [Pending]
- **Verified By:** [Pending]
- **Commit/PR:** [Pending]
- **Archived:** [Pending]

---

## Lessons Learned

1. **Master FIDs prevent scope drift.** Without a Master, individual fixes chase symptoms.
2. **Shared primitives first.** `SidebarSection`, `KeyValueRow`, and `KeyHint` will prevent future inconsistency.
3. **Visual work needs visual verification.** Typecheck and lint are not enough; every visual FID must end with a tmux visual check.

---

## Linked Documents

- [FID-2026-0721-036](./FID-2026-0721-036-right-sidebar-fid-enhance.md) — prior FID display enhancement
- [FID-2026-0721-037](./FID-2026-0721-037-right-sidebar-stroke-artifact.md) — prior stroke artifact fix
- [FID-2026-0722-038](./FID-2026-0722-038-sidebar-fidcard-native-border-collision.md) — prior FidCard border collision fix
- [FID-2026-0722-040](./FID-2026-0722-040-sidebar-core-layout-redesign.md) — sidebar core layout redesign
- [FID-2026-0722-041](./FID-2026-0722-041-terminal-components-redesign.md) — terminal components redesign
- [FID-2026-0722-042](./FID-2026-0722-042-fidcard-fidlist-redesign.md) — FID card/list redesign
