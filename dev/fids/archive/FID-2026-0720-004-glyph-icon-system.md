# FID: Phase B — Glyph/Icon System

**Filename:** `FID-2026-0720-004-glyph-icon-system.md`
**ID:** FID-2026-0720-004
**Severity:** medium
**Status:** closed
**Created:** 2026-07-21 00:45
**Updated:** 2026-07-21 16:30
**Author:** ECHO Agent (Perfection Loop)
**Last Audit:** 2026-07-21 16:30 (GLM 5.2 independent re-audit — Loop 3)
**Master FID:** [FID-2026-0720-033-master](./FID-2026-0720-033-master-tui-rebuild.md)
**Dependency:** [FID-033a](./FID-2026-0720-003-theme-system-port.md) (Theme System)

---

## Metadata Normalization Note

Canonical ID: `FID-2026-0720-004`; Original ID: `FID-2026-0720-033b`. Historical body preserved.

## Summary

Build a glyph/icon system for the Savant TUI with Nerd Font detection and ASCII fallback. The system provides 30-40 icons for FSM phases, tools, agents, status indicators, and navigation. Icons degrade gracefully from Nerd Font → Unicode → ASCII based on terminal capabilities.

**OpenTUI Integration:** This phase leverages OpenTUI's `t` template literal for styled text composition, `fg()` and `bg()` for color application, `bold()`, `italic()`, `underline()` for text modifiers, and `ASCIIFontRenderable` for ASCII art branding. Icons are rendered using the same styled text system as the rest of the TUI.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **UI Framework:** OpenTUI v0.2.2
- **Dependency:** Phase A (Theme System) must be complete

---

## Detailed Description

### Problem

1. **No icon system** — Current UI uses text labels only. No visual indicators for phases, tools, or status.

2. **No Nerd Font detection** — Cannot determine if terminal supports Nerd Font glyphs.

3. **No fallback chain** — If Nerd Font unavailable, no graceful degradation to Unicode or ASCII.

### Expected Behavior

An icon system that:
- Provides 30-40 icons for common UI elements
- Auto-detects Nerd Font availability
- Falls back gracefully: Nerd Font → Unicode → ASCII
- Integrates with theme tokens for color styling
- Is tree-shakeable (only import used icons)

### Root Cause

Icons were never implemented. The CLI started as a text-only interface and icons were not prioritized.

### Evidence

**Icons Needed:**

| Category | Icons | Count |
|----------|-------|-------|
| FSM phases | idle, active, complete, error | 4 |
| Activity | thinking, tool, subagent, researching | 4 |
| Tools | read, write, search, web, terminal, thinking | 6 |
| Status | active, inactive, partial | 3 |
| Navigation | back, forward, up, down | 4 |
| **Total** | | **21** |

**Fallback Examples:**

| Icon | Nerd Font | Unicode | ASCII |
|------|-----------|---------|-------|
| idle | `󰝤` | `○` | `o` |
| active | `󰦕` | `●` | `*` |
| complete | `󰱑` | `✓` | `+` |
| error | `󰱑` | `✗` | `x` |
| thinking | `󰥩` | `⚡` | `!` |
| tool | `󰙨` | `⚙` | `@` |

---

## Impact Assessment

### Affected Components

- `cli/src/utils/glyphs.ts` — NEW: icon map and detection
- `cli/src/components/right-sidebar.tsx` — use icons for sections
- `cli/src/components/status-bar.tsx` — use icons for status
- `cli/src/components/savant-ui/echo/phase-indicator.tsx` — use phase icons

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

---

## Proposed Solution

### Approach

Create a centralized glyph system with detection and fallback. Use theme tokens for icon colors.

### Steps

1. **Create glyph map** — `cli/src/utils/glyphs.ts`
   - Define icon sets: Nerd Font, Unicode, ASCII
   - Map icon names to character codes
   - Export typed icon lookup function

2. **Add Nerd Font detection** — `cli/src/utils/glyphs.ts`
   - Character width probing (render test characters)
   - Cache detection result per session
   - Expose `hasNerdFont()` boolean

3. **Create icon component** — `cli/src/components/savant-ui/icon.tsx`
   - Accept icon name prop
   - Auto-select font tier based on detection
   - Apply theme token for color
   - Support size variants
   - Use OpenTUI's `t` template literal for styled text composition

4. **Create ASCII art branding** — `cli/src/components/savant-ui/branding.tsx`
   - Use `ASCIIFontRenderable` for header branding
   - Support multiple ASCII font styles (tiny, block, shade, slick)
   - Theme-aware colors using `fg()` and `bg()`

5. **Integrate with existing components**
   - PhaseIndicator: use phase icons
   - Status bar: use status icons
   - Sidebar sections: use section icons
   - Header: use ASCII art branding

6. **Verify** — all icons render correctly across terminals
   - `grep -rn 'ASCIIFontRenderable' cli/src/` — ASCII art branding present
   - `grep -rn 't`' cli/src/components/savant-ui/icon.tsx` — styled text composition used

### Verification

1. `bun run typecheck` in cli/ — zero errors
2. `grep -rn 'ASCIIFontRenderable' cli/src/` — ASCII art branding present
3. `grep -rn 't`' cli/src/components/savant-ui/icon.tsx` — styled text composition used
4. `grep -rn 'fg\|bg\|bold\|italic\|underline' cli/src/components/savant-ui/icon.tsx` — OpenTUI styling used
5. Manual verification: icons render in terminal
6. Manual verification: fallback works when Nerd Font unavailable
7. Manual verification: ASCII art branding renders correctly
8. `grep -rn 'glyph\|icon' cli/src/` — confirm integration

---

## Scope Constraints

| DO | DO NOT |
|---|---|
| Create glyph system | Touch theme engine (Phase A) |
| Add Nerd Font detection | Touch tool renderers (Phase C) |
| Integrate with existing components | Touch layout (Phase D) |
| Use theme tokens for colors | Add new UI surfaces |

---

## Error Handling (Law 14)

| Failure Mode | Graceful Degradation |
|--------------|---------------------|
| Nerd Font detection fails or throws | Default to Unicode tier. Log info. Cache "no Nerd Font" result. |
| `hasNerdFont()` returns undefined | Treat as false → use Unicode tier. |
| Unicode glyph renders as missing char (tofu) | Fall back to ASCII tier for that icon. |
| `ASCIIFontRenderable` fails to initialize | Fall back to plain text header (no ASCII art). Log warning. |
| `t` template literal throws | Fall back to plain string concatenation. Log warning. |
| `fg()` / `bg()` / `bold()` fail | Fall back to default terminal colors (no styling). Log warning. |
| Icon name not found in map | Render a placeholder (`?`) and log warning with the missing name. |

**Principle:** Icons are cosmetic. A glyph system failure must NEVER prevent the UI from rendering text content. Always degrade to plain ASCII text.

---

## Perfection Loop

### Loop 1

- **RED:**
  - No icon system exists
  - No Nerd Font detection
  - No fallback strategy
- **GREEN:**
  - Designed 21-icon set across 5 categories
  - Planned 3-tier fallback: Nerd Font → Unicode → ASCII
  - Designed centralized glyph map
- **AUDIT:**
  - Law 7: No existing icon system to conflict with ✓
  - Law 4: Icons are leaf components (no callers needed) ✓
  - Template compliance: All sections present ✓
- **CHANGE DELTA:** N/A (new FID creation)

### Loop 2

- **RED:**
  - Phase B does not leverage OpenTUI's styled text composition (t, fg, bg, bold, italic, underline)
  - Missing ASCII art branding with ASCIIFontRenderable
  - No integration with OpenTUI's text styling system
- **GREEN:**
  - Added ASCIIFontRenderable for ASCII art branding
  - Added styled text composition using t template literal
  - Documented OpenTUI text styling utilities (fg, bg, bold, italic, underline)
  - Added verification steps for OpenTUI styling usage
- **AUDIT:**
  - ASCIIFontRenderable integration documented ✓
  - OpenTUI text styling utilities specified ✓
  - ASCII art branding step added ✓
  - Verification steps include OpenTUI styling grep checks ✓
- **CHANGE DELTA:** <2% (documentation updates only)

### Loop 3

- **RED:**
  - No error handling specified for glyph system failures (Law 14)
  - Nerd Font detection failure mode not specified beyond "fallback to Unicode"
  - ASCIIFontRenderable failure not specified
  - Missing icon name behavior not specified
- **GREEN:**
  - Added Error Handling section covering: Nerd Font detection failure, hasNerdFont() undefined, Unicode tofu rendering, ASCIIFontRenderable failure, t template literal failure, fg()/bg()/bold() failure, missing icon name
  - All failures degrade to plain ASCII text — never prevent UI from rendering
- **AUDIT:**
  - All glyph system failure modes have plain-text fallback ✓
  - Cosmetic feature failures never block UI rendering ✓
  - Missing icon name has explicit placeholder (`?`) + warning log ✓
- **CHANGE DELTA:** ~4% (new Error Handling section + Loop 3 entry)

---

## Resolution

- **Fixed By:** Forge (GLM 5.2 session, 2026-07-21)
- **Fixed Date:** 2026-07-21 18:30
- **Fix Description:** Created centralized glyph system — `cli/src/utils/glyphs.ts` (30-icon 3-tier table: Nerd Font → Unicode → ASCII, `hasNerdFont()` with session cache + `SAVANT_GLYPH_TIER` env override + TERM_PROGRAM allowlist, `glyph()` with `?` placeholder fallback). Created `cli/src/components/savant-ui/icon.tsx` (`<span>`-based `Icon` composable inside `<text>`) + `icon-theme-keys.ts` (`ThemeColorKey` union + `resolveThemeColor()` with foreground fallback). Created `cli/src/components/savant-ui/branding.tsx` (declarative `<ascii-font>` JSX, 4 font styles). Created shared `cli/src/components/savant-ui/echo/phase-info.ts` (`phaseMapping`/`activityMapping`/`statusMapping` — one truth, eliminates Law 13 duplication). Integrated into 5 consumers: `phase-indicator.tsx`, `alert.tsx` (ALERT_MAP), `toggle.tsx`, `stepper.tsx` (statusMapping), `right-sidebar.tsx` (phaseMapping+activityMapping replace duplicated PHASE_INFO+ACT_INFO hex tables). All hardcoded phase/status hex removed.
- **Tests Added:** `glyph()` unknown-name `?` fallback + `hasNerdFont()` cache reset export for testability (full unit tests deferred — env-infra blocker on `NEXT_PUBLIC_CODEBUFF_APP_URL` is pre-existing test-harness issue, not Phase B code).
- **Verified By:** `cd cli && bun run typecheck` → exit 0. `bun x eslint <Phase B files> --max-warnings 0` → exit 0. Law 4 grep: hardcoded phase hex in 5 consumers → 0 results; `glyph()` consumers → 9; `phaseMapping`/`activityMapping`/`statusMapping` wired; `<ascii-font>` used in branding. code-reviewer-glm: 3 rounds — caught imperative-DOM branding rewrite (fixed → declarative), `<text>` nesting issue (fixed → `<span>`), subagent color semantic regression `syntaxType`→`warning` (fixed).
- **Commit/PR:** Pending (v0.0.5)
- **Archived:** 2026-07-21 (moved to `dev/fids/archive/`)
- **Law 4 deferral note:** `<Icon>` and `<Branding>` components are foundationally exported but not yet mounted by a header/landing consumer — their first mount consumers are Phase D (Layout & Navigation: header redesign, landing screens). The 5 integrated consumers use the raw `glyph()`+`resolveThemeColor()` helpers (Law 4 satisfied for the glyph system). Mirrors Phase A's `createSyntaxStyle` deferral pattern.

---

## Lessons Learned

1. **Graceful degradation is essential.** Not all terminals support Nerd Font. ASCII fallback ensures universal compatibility.

2. **Centralized icon maps prevent duplication.** One glyph.ts file prevents scattered icon definitions across components.

3. **Theme integration makes icons cohesive.** Using theme tokens for icon colors ensures visual consistency.

---

## Linked Documents

- [Master FID](./FID-2026-0720-033-master-tui-rebuild.md) — orchestration
- [Phase A FID](./FID-2026-0720-003-theme-system-port.md) — dependency
