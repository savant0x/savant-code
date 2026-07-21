# FID: Phase A — Theme System Port from opencode-dev

**Filename:** `FID-2026-0720-033a-theme-system-port.md`
**ID:** FID-2026-0720-033a
**Severity:** high
**Status:** analyzed
**Created:** 2026-07-21 00:30
**Updated:** 2026-07-21 16:30
**Author:** ECHO Agent (Perfection Loop)
**Last Audit:** 2026-07-21 16:30 (GLM 5.2 independent re-audit — Loop 3)
**Master FID:** [FID-2026-0720-033-master](./FID-2026-0720-033-master-tui-rebuild.md)

---

## Summary

Port the theme system from opencode-dev (MIT licensed) to establish a robust, token-based theme engine for the Savant TUI. The current theme system is a 41-line stub with 7 hardcoded colors. The opencode-dev system has 1025 lines (verified via `Measure-Object -Line`), 33 JSON themes, reference chain resolution, terminal auto-detection, and 80+ semantic tokens. This phase creates the foundational theme engine that all subsequent phases depend on.

**OpenTUI Integration:** This phase leverages OpenTUI's `SyntaxStyle` for syntax highlighting themes, `RGBA` for color manipulation, and `parseColor` for color parsing. The theme engine outputs `SyntaxStyle` objects that can be used directly by `CodeRenderable`, `DiffRenderable`, and `MarkdownRenderable` in Phase C.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **UI Framework:** OpenTUI v0.2.2 (`@opentui/core` + `@opentui/react`, React 19)
- **Source:** `resources/opencode-dev/packages/tui/src/theme/` (MIT License)
- **License:** MIT confirmed at `resources/opencode-dev/LICENSE`

---

## Detailed Description

### Problem

1. **Theme system is minimal** — 41 lines, 7 hardcoded colors (`#22c55e`, `#ef4444`, `#f59e0b`, `#3b82f6`, `#6b7280`, `#18faf9`, `#0f172a`). No dark/light switching, no terminal auto-detection, no reference resolution.

2. **ChatTheme type is incomplete** — 144-line `types/theme-system.ts` with ~40 semantic tokens. Missing: diff colors, markdown colors, syntax colors, surfaceHover, aiLine, userLine, agent backgrounds, mode toggle colors.

3. **No theme variety** — Single dark theme. No light theme. No user-selectable themes. No JSON theme files.

4. **No terminal integration** — No OSC color detection, no IDE theme detection, no OS dark mode detection.

### Expected Behavior

A theme engine that:
- Resolves themes from JSON files with reference chains
- Auto-detects terminal colors and dark/light mode
- Provides 80+ semantic tokens for all UI elements
- Supports 5-10 built-in themes (dark + light)
- Bridges to existing ChatTheme type for backward compatibility
- Has zero hardcoded colors in components (all from tokens)

### Root Cause

The theme system was a quick 7-color stub created during initial CLI setup. No design system was established. The opencode-dev project has a mature, MIT-licensed theme system that can be ported.

### Evidence

**Current State:**
```typescript
// cli/src/components/savant-ui/theme.ts (41 lines)
export const tokens = {
  colors: {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    muted: '#6b7280',
    primary: '#18faf9',
    surface: '#0f172a',
  },
  // ... 7 hardcoded colors total
}
```

**Source State:**
```typescript
// resources/opencode-dev/packages/tui/src/theme/index.ts (1025 lines, verified)
export function resolveTheme(theme: ThemeJson, mode: "dark" | "light") {
  // Reference chain resolution
  // 80+ token mapping
  // RGBA conversion
}

export function generateSystem(colors: TerminalColors, mode: "dark" | "light"): ThemeJson {
  // Terminal color detection
  // Gray scale generation
  // ANSI color mapping
}
```

**Token Gap:**

| Category | opencode | Savant | Delta |
|----------|----------|--------|-------|
| Core colors | 7 | 7 | 0 |
| Text colors | 3 | 2 | +1 |
| Background colors | 4 | 2 | +2 |
| Border colors | 3 | 1 | +2 |
| Diff colors | 12 | 0 | +12 |
| Markdown colors | 14 | 0 | +14 |
| Syntax colors | 10 | 0 | +10 |
| Agent colors | 0 | 4 | -4 |
| Mode colors | 0 | 6 | -6 |
| **Total** | **53** | **22** | **+31** |

---

## Impact Assessment

### Affected Components

- `cli/src/types/theme-system.ts` — extend ChatTheme with missing tokens
- `cli/src/hooks/use-theme.tsx` — integrate resolveTheme, generateSystem
- `cli/src/utils/theme-system.ts` — NEW: port from opencode-dev
- `cli/src/themes/` — NEW: directory with JSON theme files
- `cli/src/components/savant-ui/theme.ts` — replace stub with token bridge

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (theme changes affect all consumers)
- [ ] Low: Minor issue, cosmetic, or edge case

---

## Proposed Solution

### Approach

Port opencode-dev's theme system with adaptations for Savant's ChatTheme type. Keep existing ChatTheme as the external API, but power it with the new theme engine internally.

### Steps

1. **Create theme engine** — `cli/src/utils/theme-system.ts`
   - Port `resolveTheme()` with RGBA → hex conversion
   - Port `generateSystem()` for terminal detection
   - Port `terminalMode()` for dark/light detection
   - Port `tint()` utility for color blending
   - Adapt to output hex strings (not RGBA) for ChatTheme compatibility

2. **Create JSON theme directory** — `cli/src/themes/assets/`
   - Port 5 default themes: opencode (dark), github (light), catppuccin, nord, dracula
   - Convert RGBA values to hex in JSON files
   - Add `$schema` for validation

3. **Extend ChatTheme** — `cli/src/types/theme-system.ts`
   - Add diff colors: `diffAdded`, `diffRemoved`, `diffContext`, `diffHunkHeader`, etc.
   - Add markdown colors: `markdownHeading`, `markdownLink`, `markdownCode`, etc.
   - Add syntax colors: `syntaxComment`, `syntaxKeyword`, `syntaxFunction`, etc.
   - Add surface/agent colors: `surfaceHover`, `aiLine`, `userLine`, agent backgrounds
   - Add mode toggle colors: `modeFastBg`, `modeMaxBg`, `modePlanBg`, etc.

4. **Create SyntaxStyle integration** — `cli/src/utils/syntax-theme.ts`
   - Port `generateSyntax()` from opencode-dev to generate SyntaxStyle objects
   - Map tree-sitter scopes to theme tokens
   - Export `createSyntaxStyle(theme: ChatTheme): SyntaxStyle` function
   - Use `SyntaxStyle.fromStyles()` from `@opentui/core`

5. **Update theme hook** — `cli/src/hooks/use-theme.tsx`
   - Integrate `resolveTheme()` for theme resolution
   - Integrate `generateSystem()` for terminal detection
   - Add theme switching (dark/light/auto)
   - Add user theme selection persistence
   - Add `useSyntaxStyle()` hook that returns SyntaxStyle for current theme

6. **Replace theme stub** — `cli/src/components/savant-ui/theme.ts`
   - Bridge `tokens` object to new theme engine
   - Maintain backward compatibility for existing consumers
   - Add `useTokens()` hook that returns resolved theme
   - Export `useSyntaxStyle()` for Phase C consumers

7. **Verify** — grep for hardcoded colors
   - `grep -rn '#[0-9a-fA-F]\{6\}' cli/src/components/` should show zero after migration
   - `grep -rn 'SyntaxStyle' cli/src/` should show usage in theme system

### Verification

1. `bun run typecheck` in cli/ — zero errors
2. `grep -rn '#[0-9a-fA-F]\{6\}' cli/src/components/savant-ui/` — zero hardcoded colors
3. `grep -rn 'SyntaxStyle' cli/src/` — SyntaxStyle integration present
4. `grep -rn 'RGBA\|parseColor' cli/src/utils/theme-system.ts` — OpenTUI color utilities used
5. Manual verification: dark theme renders correctly
6. Manual verification: light theme renders correctly
7. Manual verification: terminal auto-detection works
8. Manual verification: SyntaxStyle generates correct colors for syntax highlighting

---

## Scope Constraints

| DO | DO NOT |
|---|---|
| Port theme engine from opencode-dev (MIT) | Touch agent-runtime logic |
| Extend ChatTheme type | Touch sdk/src/impl/ |
| Create JSON theme files | Touch common/src/ |
| Update theme hook | Touch agents/ |
| Bridge existing token consumers | Modify ECHO.md |

---

## Error Handling (Law 14)

| Failure Mode | Graceful Degradation |
|--------------|---------------------|
| Terminal color detection (OSC query) fails | Fall back to hardcoded dark theme defaults. Log a single info message. |
| `generateSystem()` throws | Catch, return the default dark theme JSON. |
| `resolveTheme()` fails on a malformed JSON theme | Catch, fall back to the previous valid theme. Never leave the UI without a theme. |
| JSON theme file is missing or unreadable | Fall back to bundled default theme. Log warning with file path. |
| `parseColor()` / `RGBA` conversion fails on bad input | Use a safe default color (e.g. `#6b7280` muted). Log the bad value. |
| `SyntaxStyle.fromTheme()` / `fromStyles()` throws | Fall back to plain text code blocks (no syntax highlighting). UI remains functional. |

**Principle:** The theme engine must NEVER leave the UI in an unstyled state. Every fallible operation must degrade to a known-good default.

---

## Perfection Loop

### Loop 1

- **RED:**
  - Original FID-033 had diff-viewer Law 7 violation (already exists)
  - Original FID-033 had opencode-dev Cross-Agent Claim Rule violation (source path didn't exist)
  - Original FID-033 had no grep verification for new components
  - Original FID-033 had empty Perfection Loop section
- **GREEN:**
  - Verified opencode-dev source exists at `resources/opencode-dev/`
  - Verified MIT license at `resources/opencode-dev/LICENSE`
  - Read complete theme engine (1025 lines, verified)
  - Identified token gap (53 vs 22 tokens)
  - Documented port strategy
- **AUDIT:**
  - Cross-Agent Claim Rule: Source path cited, license verified ✓
  - Law 7: No duplicate components proposed ✓
  - Law 4: Theme engine is foundational (no callers needed) ✓
  - Law 1: Full file reads completed ✓
  - Template compliance: All sections present ✓
- **CHANGE DELTA:** N/A (new FID creation)

### Loop 2

- **RED:**
  - Phase A does not leverage OpenTUI's SyntaxStyle for syntax highlighting
  - Missing integration with OpenTUI's color utilities (RGBA, parseColor)
  - No strategy for generating SyntaxStyle from theme tokens
- **GREEN:**
  - Added SyntaxStyle integration step to create `cli/src/utils/syntax-theme.ts`
  - Added `useSyntaxStyle()` hook for Phase C consumers
  - Documented OpenTUI color utilities usage (RGBA, parseColor)
  - Added SyntaxStyle verification steps
- **AUDIT:**
  - SyntaxStyle integration documented ✓
  - OpenTUI color utilities specified ✓
  - Phase C consumers can use SyntaxStyle ✓
  - Verification steps include SyntaxStyle grep checks ✓
- **CHANGE DELTA:** <2% (documentation updates only)

### Loop 3

- **RED:**
  - FID-033a claimed theme/index.ts is 1089 lines. Verified via `Measure-Object -Line`: actual is **1025 lines** (Cross-Agent Claim Rule violation — prior model self-reported without measuring)
  - No error handling specified for theme engine failures (Law 14)
- **GREEN:**
  - Corrected all 3 occurrences of "1089 lines" → "1025 lines" with verification note
  - Added Error Handling section covering: terminal detection failure, generateSystem failure, resolveTheme failure, missing JSON file, parseColor failure, SyntaxStyle failure
- **AUDIT:**
  - Line count verified via tool output (Measure-Object) ✓
  - All occurrences corrected ✓
  - Error handling covers all fallible operations in theme engine ✓
- **CHANGE DELTA:** ~5% (3 line count corrections + new Error Handling section + Loop 3 entry)

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

1. **Source verification is mandatory.** The original FID-033 referenced opencode-dev but the path was wrong. Always verify source paths before citing them.

2. **MIT license is portable.** opencode-dev's MIT license allows free reuse. Always verify license compatibility before porting code.

3. **Token gap analysis reveals scope.** Comparing opencode's 53 tokens vs Savant's 22 tokens shows exactly what needs to be added.

4. **Backward compatibility matters.** Keeping ChatTheme as the external API while powering it with the new engine prevents breaking existing consumers.

5. **Theme-first is high-leverage.** Establishing the theme engine first (Phase A) enables all subsequent phases to use proper tokens.

---

## Linked Documents

- [Master FID](./FID-2026-0720-033-master-tui-rebuild.md) — orchestration
- [Original FID-033](./FID-2026-0720-033-tui-rebuild-comprehensive.md) — superseded
- [opencode-dev theme](../../../resources/opencode-dev/packages/tui/src/theme/index.ts) — source (1025 lines, verified via Measure-Object -Line)
- [opencode-dev license](../../../resources/opencode-dev/LICENSE) — MIT
