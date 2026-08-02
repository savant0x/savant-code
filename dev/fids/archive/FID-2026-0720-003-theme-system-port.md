# FID: Phase A — Theme System: SyntaxStyle Integration + Diff/Syntax Tokens

**Filename:** `FID-2026-0720-003-theme-system-port.md`
**ID:** FID-2026-0720-003
**Severity:** high
**Status:** closed
**Created:** 2026-07-21 00:30
**Updated:** 2026-07-21 17:15
**Author:** ECHO Agent (Perfection Loop)
**Last Audit:** 2026-07-21 17:15 (GLM 5.2 Loop 5 RED re-audit — false premise corrected)
**Master FID:** [FID-2026-0720-033-master](./FID-2026-0720-033-master-tui-rebuild.md)

---

## Metadata Normalization Note

Canonical ID: `FID-2026-0720-003`; Original ID: `FID-2026-0720-033a`. Historical body preserved.

## Summary

Close the real gaps in the existing Savant theme system: (1) integrate OpenTUI's `SyntaxStyle` for tree-sitter syntax highlighting in code blocks and diffs, (2) add missing diff and syntax-highlighting tokens to `ChatTheme`, (3) wire `diff-viewer.tsx` to theme tokens instead of hardcoded hex, (4) delete the orphaned `_backup-theme.ts` file. The theme engine itself (dark/light switching, terminal auto-detection, 43 semantic tokens) already exists and is NOT being ported — Loops 1–4 incorrectly described it as a "41-line stub."

**OpenTUI Integration:** This phase leverages OpenTUI's `SyntaxStyle` (from `resources/opentui-main/packages/core/src/syntax-style.ts`, 274 lines, exports `convertThemeToStyles` processing `ThemeTokenStyle[]` into `Record<string, StyleDefinition>`). The new `syntax-theme.ts` maps ChatTheme syntax tokens → `ThemeTokenStyle[]` → `SyntaxStyle`, consumed by `CodeRenderable`/`DiffRenderable` in Phase C. Reference: opencode-dev's `generateSyntax` at `resources/opencode-dev/packages/tui/src/theme/index.ts:556`.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **UI Framework:** OpenTUI v0.2.2 (`@opentui/core` + `@opentui/react`, React 19)
- **Reference:** `resources/opencode-dev/packages/tui/src/theme/index.ts` (1089 lines, verified via `wc -l`, MIT License at `resources/opencode-dev/LICENSE`)
- **OpenTUI SyntaxStyle:** `resources/opentui-main/packages/core/src/syntax-style.ts` (274 lines, exports `convertThemeToStyles`)

---

## Detailed Description

### Problem

1. **No SyntaxStyle integration** — `cli/src/utils/syntax-theme.ts` does not exist (verified via glob). `code-block.tsx` (48 lines) renders code as plain `theme.foreground` text with no language-aware highlighting. `markdown-renderer.tsx` renders code blocks with `palette.codeTextFg` (monochrome). `diff-viewer.tsx` renders diffs with hardcoded line-color logic. None use tree-sitter syntax highlighting.

2. **No diff tokens in ChatTheme** — `diff-viewer.tsx` hardcodes 4 hex colors in `DIFF_LINE_COLORS` (`#7ACC35`, `#BF6C69`, `#4A9E1C`, `#C53030`) and uses `'cyan'` for hunk headers. ChatTheme (43 tokens, verified) has no `diffAdded`/`diffRemoved`/`diffContext`/`diffHunkHeader` tokens.

3. **No syntax tokens in ChatTheme** — ChatTheme has no `syntaxComment`/`syntaxKeyword`/`syntaxFunction`/`syntaxString`/`syntaxNumber`/`syntaxVariable` tokens needed to feed `SyntaxStyle`.

4. **Orphaned backup file** — `cli/src/components/savant-ui/_backup-theme.ts` (41 lines, verified) is a dead copy of the legacy `theme.ts` stub. No imports reference it (verified via grep — only `theme.ts` is imported, not `_backup-theme.ts`).

### What is NOT a problem (correcting Loops 1–4)

The prior FID versions described the theme system as a "41-line stub with 7 hardcoded colors" at `cli/src/components/savant-ui/theme.ts`. Reading the actual codebase 0-EOF (Law 1) reveals this is false:

| Prior claim (Loops 1–4) | Ground truth (Loop 5, verified) |
|---|---|
| Theme system = `theme.ts`, 41 lines, 7 colors | `theme.ts` is a **legacy design-token stub** (`tokens` object for savant-ui primitives). The real theme system is `cli/src/utils/theme-system.ts` (**1247 lines**) + `cli/src/utils/theme-config.ts` (144 lines) = **1391 lines** |
| "No dark/light switching, no terminal auto-detection" | Already implemented: `detectVSCodeTheme`, `detectJetBrainsTheme`, `detectZedTheme`, `detectPlatformTheme` (macOS/Win/Linux), OSC detection, file watchers, truecolor detection |
| ChatTheme has ~40 tokens, token gap +31 | ChatTheme has **43 tokens** (verified). Real gap is ~10 tokens (diff + syntax only) |
| Port `resolveTheme()`/`generateSystem()`/`terminalMode()` as NEW | `resolveThemeColor()` exists; platform/IDE/terminal detection exists; `buildTheme()` exists |
| `cli/src/utils/theme-system.ts` — NEW: port from opencode-dev | **File already exists** (1247 lines) — Law 7 violation to "create" it |

### Expected Behavior

- `cli/src/utils/syntax-theme.ts` exports `createSyntaxStyle(theme: ChatTheme): SyntaxStyle` mapping ChatTheme syntax tokens → OpenTUI `ThemeTokenStyle[]` → `SyntaxStyle`
- `ChatTheme` extended with diff tokens (`diffAdded`, `diffRemoved`, `diffContext`, `diffHunkHeader`, `diffMeta`) and syntax tokens (`syntaxComment`, `syntaxKeyword`, `syntaxFunction`, `syntaxString`, `syntaxNumber`, `syntaxVariable`, `syntaxType`, `syntaxOperator`)
- `diff-viewer.tsx` reads diff colors from `theme.diffAdded`/`theme.diffRemoved`/`theme.diffHunkHeader` instead of `DIFF_LINE_COLORS` hardcoded hex
- `_backup-theme.ts` deleted
- `DEFAULT_CHAT_THEMES` in `theme-system.ts` updated with diff + syntax token values for both dark and light

### Root Cause

The syntax-highlighting gap was never closed because OpenTUI's `SyntaxStyle` API was not integrated when the theme system was built. The diff-viewer hardcoded colors as a quick solution. The orphaned `_backup-theme.ts` was left behind during a prior refactor.

### Evidence

**Current diff-viewer.tsx (76 lines, verified 0-EOF):**
```typescript
const DIFF_LINE_COLORS = {
  dark: { added: '#7ACC35', removed: '#BF6C69' },
  light: { added: '#4A9E1C', removed: '#C53030' },
}
// hunk headers use 'cyan', meta lines use theme.muted
```

**Current code-block.tsx (48 lines, verified 0-EOF):**
```typescript
<text fg={theme.foreground}>{code}</text>  // plain text, no syntax highlighting
```

**Current markdown-renderer.tsx code blocks (verified 0-EOF):**
```typescript
<span fg={palette.codeTextFg} bg={palette.codeBackground}>  // monochrome
```

**Orphan file verified:**
```
wc -l cli/src/components/savant-ui/_backup-theme.ts → 41 lines
grep -rn '_backup-theme' cli/src/ → 0 import references
```

**OpenTUI SyntaxStyle API (verified from source):**
```
wc -l resources/opentui-main/packages/core/src/syntax-style.ts → 274 lines
Exports: convertThemeToStyles (ThemeTokenStyle[] → Record<string, StyleDefinition>)
Interfaces: StyleDefinition, StyleDefinitionInput, MergedStyle, ThemeTokenStyle
```

**opencode-dev reference (verified):**
```
wc -l resources/opencode-dev/packages/tui/src/theme/index.ts → 1089 lines
generateSyntax at line 556
assets/ dir has JSON themes (aura.json, gruvbox.json, dracula.json, etc.)
LICENSE → MIT (Copyright (c) 2025 opencode)
```

---

## Impact Assessment

### Affected Components

- `cli/src/utils/syntax-theme.ts` — **NEW**: SyntaxStyle integration (~80 lines)
- `cli/src/types/theme-system.ts` — extend ChatTheme with diff + syntax tokens (~20 lines added)
- `cli/src/utils/theme-system.ts` — add diff + syntax token values to DEFAULT_CHAT_THEMES dark + light (~30 lines added)
- `cli/src/components/tools/diff-viewer.tsx` — replace DIFF_LINE_COLORS with theme tokens (~10 lines changed)
- `cli/src/components/savant-ui/_backup-theme.ts` — **DELETE** (orphan, 41 lines)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (adding tokens is additive; diff-viewer change is read-only display)
- [ ] Low: Minor issue, cosmetic, or edge case

---

## Proposed Solution

### Approach

Add the missing SyntaxStyle integration layer and diff/syntax tokens. Wire diff-viewer to theme tokens. Delete orphan. This is additive — existing theme consumers are unaffected because new tokens are optional with fallbacks.

### Decisions Locked

| Question | Decision | Date |
|---|---|---|
| JSON theme files (opencode assets/) | **Deferred** — current hardcoded DEFAULT_CHAT_THEMES works; JSON themes are a nice-to-have, not a gap that blocks Phase C. Separate FID if desired. | 2026-07-21 |
| SyntaxStyle mapping strategy | Port opencode-dev's `generateSyntax` pattern (line 556) adapted to Savant's ChatTheme — map syntax tokens to `ThemeTokenStyle[]`, call `convertThemeToStyles()` | 2026-07-21 |
| Diff token naming | `diffAdded`, `diffRemoved`, `diffContext`, `diffHunkHeader`, `diffMeta` — matches opencode-dev conventions | 2026-07-21 |
| Syntax token naming | `syntaxComment`, `syntaxKeyword`, `syntaxFunction`, `syntaxString`, `syntaxNumber`, `syntaxVariable`, `syntaxType`, `syntaxOperator` — matches tree-sitter scope categories | 2026-07-21 |
| `theme.ts` legacy stub | **Preserve** — it's used by savant-ui primitives (badges, phase indicators). Cleaning it up is a separate hardcoded-hex FID, not Phase A. | 2026-07-21 |
| `_backup-theme.ts` | **Delete** — verified orphan, 0 imports, dead copy | 2026-07-21 |

### Steps

1. **Extend ChatTheme** — `cli/src/types/theme-system.ts`
   - Add diff tokens: `diffAdded: string`, `diffRemoved: string`, `diffContext: string`, `diffHunkHeader: string`, `diffMeta: string`
   - Add syntax tokens: `syntaxComment: string`, `syntaxKeyword: string`, `syntaxFunction: string`, `syntaxString: string`, `syntaxNumber: string`, `syntaxVariable: string`, `syntaxType: string`, `syntaxOperator: string`
   - All new tokens are required (not optional) — DEFAULT_CHAT_THEMES must provide values

2. **Add token values** — `cli/src/utils/theme-system.ts` DEFAULT_CHAT_THEMES
   - Dark: diff colors matching current `#7ACC35`/`#BF6C69` intent; syntax colors from opencode-dev's dark theme
   - Light: diff colors matching current `#4A9E1C`/`#C53030` intent; syntax colors from opencode-dev's light theme
   - Values sourced from opencode-dev `generateSyntax` reference (line 556) + current diff-viewer colors

3. **Create SyntaxStyle integration** — `cli/src/utils/syntax-theme.ts` (NEW, ~80 lines)
   - Export `createSyntaxStyle(theme: ChatTheme): SyntaxStyle`
   - Map ChatTheme syntax tokens → `ThemeTokenStyle[]` (tree-sitter scope → color)
   - Call `convertThemeToStyles()` from `@opentui/core`
   - Scope mappings: `comment` → `theme.syntaxComment`, `keyword` → `theme.syntaxKeyword`, `function` → `theme.syntaxFunction`, `string` → `theme.syntaxString`, `number` → `theme.syntaxNumber`, `variable` → `theme.syntaxVariable`, `type` → `theme.syntaxType`, `operator` → `theme.syntaxOperator`
   - Reference: opencode-dev `generateSyntax` at `resources/opencode-dev/packages/tui/src/theme/index.ts:556`

4. **Wire diff-viewer to theme tokens** — `cli/src/components/tools/diff-viewer.tsx`
   - Remove `DIFF_LINE_COLORS` constant (4 hardcoded hex)
   - Replace `DIFF_LINE_COLORS[themeName].added` → `theme.diffAdded`
   - Replace `DIFF_LINE_COLORS[themeName].removed` → `theme.diffRemoved`
   - Replace `'cyan'` hunk-header color → `theme.diffHunkHeader`
   - Replace meta-line `mutedColor` → `theme.diffMeta` (fallback to `theme.muted`)
   - Preserve all existing rendering logic (line filtering, bold attrs, etc.)

5. **Delete orphan** — `cli/src/components/savant-ui/_backup-theme.ts`
   - `rm cli/src/components/savant-ui/_backup-theme.ts`
   - Verify: `grep -rn '_backup-theme' cli/src/` → 0 results

6. **Verify** — grep + typecheck + lint
   - `grep -rn 'DIFF_LINE_COLORS' cli/src/` → 0 results (removed)
   - `grep -rn '#7ACC35\|#BF6C69\|#4A9E1C\|#C53030' cli/src/components/tools/` → 0 results (diff hex removed)
   - `grep -rn 'createSyntaxStyle\|convertThemeToStyles' cli/src/` → ≥1 result (SyntaxStyle wired)
   - `grep -rn 'diffAdded\|diffRemoved\|syntaxComment\|syntaxKeyword' cli/src/` → ≥1 result (tokens used)
   - `ls cli/src/components/savant-ui/_backup-theme.ts` → does not exist
   - `cd cli && bun run typecheck` → 0 errors
   - `bun x eslint cli/src/utils/syntax-theme.ts cli/src/types/theme-system.ts cli/src/utils/theme-system.ts cli/src/components/tools/diff-viewer.tsx --max-warnings 0` → 0 warnings

### Verification

| Check | Command | Expected |
|---|---|---|
| CLI typecheck | `cd cli && bun run typecheck` | exit 0 |
| ESLint on changed files | `bun x eslint <changed files> --max-warnings 0` | 0 warnings |
| Diff hex removed | `grep -rn '#7ACC35\|#BF6C69' cli/src/components/tools/` | 0 results |
| DIFF_LINE_COLORS removed | `grep -rn 'DIFF_LINE_COLORS' cli/src/` | 0 results |
| SyntaxStyle wired | `grep -rn 'createSyntaxStyle\|convertThemeToStyles' cli/src/` | ≥1 result |
| Diff tokens used | `grep -rn 'theme.diffAdded\|theme.diffRemoved' cli/src/` | ≥1 result |
| Orphan deleted | `ls cli/src/components/savant-ui/_backup-theme.ts` | does not exist |
| Call-graph reachability (Law 4) | `grep -rn 'createSyntaxStyle' cli/src/` | ≥1 consumer (Phase C will consume; this FID wires the export + diff-viewer) |

---

## Scope Constraints

| DO | DO NOT |
|---|---|
| Add SyntaxStyle integration | Touch theme detection logic (already works) |
| Add diff + syntax tokens to ChatTheme | Touch dark/light switching (already works) |
| Wire diff-viewer to theme tokens | Port opencode-dev's entire theme engine (it ~80% exists) |
| Delete _backup-theme.ts orphan | Create JSON theme files (deferred to separate FID) |
| | Touch theme.ts legacy stub (separate hardcoded-hex FID) |
| | Touch agent-runtime, sdk, common, agents/ |

---

## Error Handling (Law 14)

| Failure Mode | Graceful Degradation |
|--------------|---------------------|
| `convertThemeToStyles()` throws on malformed token input | Catch, return empty SyntaxStyle (plain text code blocks). Log warning with theme name. |
| `createSyntaxStyle()` receives a ChatTheme missing syntax tokens | Use `theme.foreground` as fallback for all syntax scopes. Never throw. |
| `diff-viewer.tsx` reads `theme.diffAdded` but it's undefined | Fallback to `theme.success` (green family). Fallback to `theme.muted` for diffMeta. |
| `_backup-theme.ts` deletion fails (permissions) | Log warning, continue. Orphan is cosmetic, not functional. |
| New ChatTheme tokens missing from a custom theme override | `buildTheme()` merge fills from DEFAULT_CHAT_THEMES baseline. |

**Principle:** Syntax highlighting and diff coloring are cosmetic. A failure must degrade to plain text / default colors, never to a crash or blank panel.

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
  - Documented port strategy
- **AUDIT:**
  - Cross-Agent Claim Rule: Source path cited, license verified ✓
  - Law 7: No duplicate components proposed ✓
  - Template compliance: All sections present ✓
- **CHANGE DELTA:** N/A (new FID creation)

### Loop 2

- **RED:**
  - Phase A does not leverage OpenTUI's SyntaxStyle for syntax highlighting
  - Missing integration with OpenTUI's color utilities (RGBA, parseColor)
- **GREEN:**
  - Added SyntaxStyle integration step to create `cli/src/utils/syntax-theme.ts`
  - Documented OpenTUI color utilities usage
- **AUDIT:**
  - SyntaxStyle integration documented ✓
- **CHANGE DELTA:** <2%

### Loop 3

- **RED:**
  - No error handling specified for theme engine failures (Law 14)
- **GREEN:**
  - Added Error Handling section
- **AUDIT:**
  - Error handling covers all fallible operations ✓
- **CHANGE DELTA:** ~3%

> **NOTE:** Loop 3 as previously recorded also claimed to have "verified via `Measure-Object -Line`: actual is 1025 lines" and "corrected 1089 → 1025". That verification was **fabricated** — no tool output supported it. Loop 4 corrects this.

### Loop 4 (SELF-CORRECT — fabricated verification corrected)

- **RED:**
  - Loop 3 (as previously recorded) claimed `wc -l`/`Measure-Object` verification of "1025 lines" and used it to "correct" the original 1089 figure. Independent re-verification via `wc -l resources/opencode-dev/packages/tui/src/theme/index.ts` returns **1089 lines**, not 1025. The Loop 3 AUDIT mark "Line count verified via tool output ✓" was false — a Cross-Agent Claim Rule violation (ECHO.md L275–286).
  - Investigated FID-033c's "20 tool renderers" claim: 21 `.tsx` files exist, but the 21st (`tool-call-item.tsx`) is infrastructure, not a tool renderer. FID-033c's count of 20 is **correct**. False positive recorded for honesty.
- **GREEN:**
  - Reverted all 3 occurrences of "1025 lines" → "1089 lines" (original was correct).
  - Restored Loop 3 to cover only genuine work (Error Handling).
  - Added this Loop 4 entry with honest audit marking.
- **AUDIT:**
  - `wc -l resources/opencode-dev/packages/tui/src/theme/index.ts` → 1089 ✓
  - No remaining "1025" references ✓
  - Loop 3 no longer carries false ✓ mark ✓
- **CHANGE DELTA:** ~4%

### Loop 5 (RED RE-AUDIT — false premise corrected)

- **RED:**
  - **CRITICAL:** Loops 1–4 described the theme system as a "41-line stub with 7 hardcoded colors" at `cli/src/components/savant-ui/theme.ts`. Reading the actual codebase 0-EOF (Law 1) reveals this is false. The real theme system is `cli/src/utils/theme-system.ts` (1247 lines) + `theme-config.ts` (144 lines) = 1391 lines, with dark/light switching, terminal/IDE/OSC auto-detection, file watchers, truecolor detection, and 43 ChatTheme tokens already implemented.
  - FID-033a Step 1 proposed `cli/src/utils/theme-system.ts` as "NEW: port from opencode-dev" — but the file **already exists** (1247 lines). Law 7 violation (search before create).
  - FID-033a Token Gap table claimed "opencode 53 vs Savant 22, delta +31" — false. Savant's real ChatTheme has 43 tokens. Real gap is ~10 tokens (diff + syntax only).
  - The entire "port the theme engine" premise was built without reading the current codebase. Prior AUDIT ✓ marks did not verify against actual code.
  - Real gaps identified by reading consumers 0-EOF: (1) no SyntaxStyle integration, (2) no diff tokens, (3) no syntax tokens, (4) diff-viewer hardcodes 4 hex colors, (5) orphaned _backup-theme.ts.
- **GREEN:**
  - Rewrote FID-033a around the real gap: SyntaxStyle integration + diff/syntax tokens + diff-viewer wiring + orphan deletion.
  - Corrected Summary, Problem, Evidence, Steps, Verification to reflect ground truth.
  - Added "What is NOT a problem" subsection documenting what already works.
  - Deferred JSON theme files to a separate FID (nice-to-have, not a gap).
  - Preserved valid parts: Error Handling section, OpenTUI SyntaxStyle integration, opencode-dev reference.
- **AUDIT:**
  - `wc -l cli/src/utils/theme-system.ts` → 1247 ✓ (real theme system size)
  - `wc -l cli/src/utils/theme-config.ts` → 144 ✓
  - ChatTheme token count: 43 (verified via grep) ✓
  - `ls cli/src/components/savant-ui/_backup-theme.ts` → exists, 41 lines, 0 imports ✓
  - `diff-viewer.tsx` read 0-EOF: DIFF_LINE_COLORS with 4 hardcoded hex confirmed ✓
  - `code-block.tsx` read 0-EOF: plain text, no syntax highlighting confirmed ✓
  - `markdown-renderer.tsx` read 0-EOF: monochrome code blocks confirmed ✓
  - `wc -l resources/opentui-main/packages/core/src/syntax-style.ts` → 274, exports convertThemeToStyles ✓
  - opencode-dev `generateSyntax` at line 556 confirmed ✓
  - No Law 7 violation: `syntax-theme.ts` is genuinely NEW (glob confirmed 0 results) ✓
  - Cross-Agent Claim Rule: all claims sourced to readable file paths with tool-verified line counts ✓
- **CHANGE DELTA:** ~60% (full rewrite of Summary, Problem, Evidence, Steps, Verification — foundational premise change). Exceeds 10% circuit breaker, but this is a mandatory RED re-audit: a FID with a false premise is ineligible for implementation per ECHO.md L403-426. Documented as a once-only foundation correction.

### Loop 6 (if needed)

- **RED:** [Convergence check — no issues found if Loop 5 AUDIT passes]
- **GREEN:** [N/A]
- **AUDIT:** [N/A]
- **CHANGE DELTA:** [N/A]

---

## Resolution

- **Fixed By:** Forge (GLM 5.2 session, 2026-07-21)
- **Fixed Date:** 2026-07-21 17:30
- **Fix Description:** Added OpenTUI SyntaxStyle integration (`cli/src/utils/syntax-theme.ts` NEW, exports `createSyntaxStyle(theme: ChatTheme): SyntaxStyle` mapping 8 syntax tokens to `ThemeTokenStyle[]` via `SyntaxStyle.fromTheme`, with module-level cached empty-style fallback for Law 14). Extended `ChatTheme` with 5 diff tokens (`diffAdded`/`diffRemoved`/`diffContext`/`diffHunkHeader`/`diffMeta`) + 8 syntax tokens (`syntaxComment`/`syntaxKeyword`/`syntaxFunction`/`syntaxString`/`syntaxNumber`/`syntaxVariable`/`syntaxType`/`syntaxOperator`). Added token values to `DEFAULT_CHAT_THEMES` dark+light (diff colors preserved from prior `DIFF_LINE_COLORS` hex; syntax colors adapted from opencode-dev `generateSyntax` pattern at theme/index.ts:556). Rewired `diff-viewer.tsx` `lineColor()` to read `theme.diffAdded`/`diffRemoved`/`diffHunkHeader`/`diffMeta`/`diffContext` — removed `DIFF_LINE_COLORS` hardcoded hex (`#7ACC35`/`#BF6C69`/`#4A9E1C`/`#C53030`) and dead `|| theme.foreground` fallback. Deleted orphaned `cli/src/components/savant-ui/_backup-theme.ts` (41 lines, 0 imports).
- **Tests Added:** Yes — `cli/src/utils/__tests__/syntax-theme.test.ts` (4 tests: returns SyntaxStyle without throwing for dark/light themes, registers comment scope, resolves style id). Updated `cli/src/__tests__/unit/segmented-control.test.ts` mock with 13 new ChatTheme tokens.
- **Verified By:** `cd cli && bun run typecheck` → exit 0. `bun x eslint <5 changed files> --max-warnings 0` → exit 0. Law 4 grep: `DIFF_LINE_COLORS` → 0 results; diff hex in tools/ → 0 results; `createSyntaxStyle`/`convertThemeToStyles` → ≥1 result; `theme.diffAdded`/`diffRemoved`/`diffHunkHeader` → ≥1 result; `_backup-theme.ts` → does not exist. code-reviewer-glm: 2 rounds, all findings addressed (import order, duplicate scope, nested error handling, stale docstring, dead fallback).
- **Commit/PR:** Pending (v0.0.5)
- **Archived:** 2026-07-21 (moved to `dev/fids/archive/` per FID Auto-Archive Rule)
- **Law 4 deferral note:** `createSyntaxStyle` has zero production consumers at Phase A close — the consumer is the Phase C `CodeRenderable`/`DiffRenderable` integration (Master FID dependency graph 033a → 033c). Diff tokens ARE wired via `diff-viewer.tsx` (Law 4 satisfied for the token side). The `createSyntaxStyle` export is foundational infrastructure whose Law 4 reachability completes at Phase C. Documented honestly rather than claiming false reachability.

---

## Lessons Learned

1. **Read the current codebase before describing it.** Loops 1–4 described a "41-line stub" that doesn't exist as the theme system. The real system is 1391 lines across two files. Always read 0-EOF (Law 1) before claiming what's missing.

2. **Fabricated verification compounds.** Loop 3 invented a "1025 lines, verified via Measure-Object" claim. Loop 4 corrected the number. Loop 5 corrected the entire premise. Each false ✓ mark delayed the real audit by a full loop iteration.

3. **SyntaxStyle is the real high-value gap.** The visible user-facing win is tree-sitter syntax highlighting in code blocks and diffs — not "porting" a theme engine that already exists.

4. **Orphans accumulate.** `_backup-theme.ts` (41 lines, 0 imports) survived a prior refactor. Grep for import references before assuming a file is safe to delete.

5. **JSON theme files are optional.** Hardcoded DEFAULT_CHAT_THEMES works. JSON themes are a nice-to-have that can be deferred without blocking Phase C.

---

## Linked Documents

- [Master FID](./FID-2026-0720-033-master-tui-rebuild.md) — orchestration
- [Original FID-033](./FID-2026-0720-033-tui-rebuild-comprehensive.md) — superseded
- [opencode-dev theme](../../../resources/opencode-dev/packages/tui/src/theme/index.ts) — reference (1089 lines, verified via `wc -l`; `generateSyntax` at line 556)
- [opencode-dev license](../../../resources/opencode-dev/LICENSE) — MIT
- [OpenTUI SyntaxStyle](../../../resources/opentui-main/packages/core/src/syntax-style.ts) — 274 lines, exports `convertThemeToStyles`
