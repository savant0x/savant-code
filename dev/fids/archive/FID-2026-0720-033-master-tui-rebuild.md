# FID: Master TUI Rebuild — Orchestration FID for 5-Phase Rebuild

**Filename:** `FID-2026-0720-033-master-tui-rebuild.md`
**ID:** FID-2026-0720-002
**Severity:** high
**Status:** closed
**Created:** 2026-07-21 00:15
**Updated:** 2026-07-21 (closed — all 5 phase FIDs archived)
**Author:** ECHO Agent (Perfection Loop)
**Last Audit:** 2026-07-21 (Master closure audit — all phases verified closed/archived, final verification greps pass)

---

## Metadata Normalization Note

Canonical ID: `FID-2026-0720-002`; Original ID: `FID-2026-0720-033-master`. Historical body preserved.

## Summary

This Master FID orchestrates the comprehensive TUI rebuild split into 5 incremental phases. The original FID-2026-0720-033 was decomposed because it violated ECHO Principle "One problem at a time" by bundling 5 distinct phases into a single FID. This Master FID tracks dependencies, verification strategy, and cross-phase coordination. Each phase has its own FID with independent Perfection Loop convergence.

**OpenTUI Integration:** This rebuild fully leverages OpenTUI v0.2.2's native capabilities including DiffRenderable, MarkdownRenderable, CodeRenderable, ScrollBoxRenderable, SelectRenderable, TabSelectRenderable, InputRenderable, TextareaRenderable, TextTableRenderable, ASCIIFontRenderable, Timeline animations, and post-processing effects. Custom implementations are avoided wherever native OpenTUI components exist.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **UI Framework:** OpenTUI v0.2.2 (`@opentui/core` + `@opentui/react`, React 19)
- **Decomposed FIDs:** 5 phase FIDs (033a-033e)

---

## Detailed Description

### Problem

The original FID-2026-0720-033 attempted to cover 5 distinct phases in a single FID:
1. Theme System Port
2. Glyph/Icon System
3. Tool & Message Rendering
4. Layout & Navigation
5. Polish

This violated ECHO Protocol principles and created unmanageable scope.

### Expected Behavior

5 independent, focused FIDs that:
- Each complete the Perfection Loop independently
- Have clear dependency chains
- Can be implemented incrementally
- Each pass verification before proceeding

### Root Cause

FID-033 was created without ECHO Protocol compliance checks. It lacked:
- Perfection Loop audit trail
- Loop State field
- Call-graph reachability verification
- Cross-Agent Claim Rule compliance

### Evidence

**Original FID Issues (from Perfection Loop RED phase):**

| Issue | Law Violated | Severity |
|-------|--------------|----------|
| diff-viewer proposed as NEW but already exists | Law 7 | High |
| opencode-dev source path doesn't exist | Cross-Agent Claim Rule | High |
| No grep verification for new components | Law 4 | High |
| Perfection Loop section empty | ECHO Template | Critical |
| Status `created` not `analyzed` | Law 10 | Critical |

---

## Impact Assessment

### Affected Components

- **FID-2026-0720-033a** — Theme System Port
- **FID-2026-0720-033b** — Glyph/Icon System
- **FID-2026-0720-033c** — Tool & Message Rendering
- **FID-2026-0720-033d** — Layout & Navigation
- **FID-2026-0720-033e** — Polish

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (decomposition adds coordination overhead)
- [ ] Low: Minor issue, cosmetic, or edge case

---

## Proposed Solution

### Approach

Create 5 independent phase FIDs with clear dependencies. Each phase FID must complete Perfection Loop before implementation begins. Master FID tracks cross-phase coordination.

### Dependency Graph

```text
FID-033a (Theme System) ─────────────────────────────────────────────┐
    │                                                                │
    ▼                                                                │
FID-033b (Glyph/Icon) ──────────────────────────────────────────────┤
    │                                                                │
    ▼                                                                │
FID-033c (Tool Rendering) ──────────────────────────────────────────┤
    │                                                                │
    ▼                                                                │
FID-033d (Layout & Navigation) ─────────────────────────────────────┤
    │                                                                │
    ▼                                                                │
FID-033e (Polish) ──────────────────────────────────────────────────┘
```

**Critical Path:** 033a → 033b → 033c → 033d → 033e (sequential)

### Phase FIDs

| FID | Title | Scope | Est. Files | Risk | OpenTUI Components Used |
|-----|-------|-------|------------|------|-------------------------|
| 033a | Theme System Port | Theme engine, JSON themes, token system | 8-12 | LOW | SyntaxStyle, RGBA, parseColor | **CLOSED 2026-07-21** — scope reduced to real gap (SyntaxStyle + diff/syntax tokens + cleanup); 4 changed + 1 new + 1 deleted; archived |
| 033b | Glyph/Icon System | Icon map, Nerd Font detection, fallback | 2-3 | LOW | ASCIIFontRenderable, t, fg, bg, bold | **CLOSED 2026-07-21** — 30-icon 3-tier glyph system + shared phase-info (Law 13 dedup) + 5 consumers rewired; archived |
| 033c | Tool & Message Rendering | render-ui hex→tokens (Law 13 dedup), code-block→SyntaxStyle (closes Phase A Law 4), FID loader + useFids hook wired to right-sidebar | 5 | MEDIUM | DiffRenderable, MarkdownRenderable, CodeRenderable, ScrollBoxRenderable, TextTableRenderable | **CLOSED 2026-07-21** — render-ui dedup, code-block wired to native `<code>`, FidList wired to live dev/fids/ data; archived |
| 033d | Layout & Navigation | CommandPalette (native <select>), Dialog (reusable modal), Toast system (Zustand store + ToastContainer), wired into chat-input-bar + app.tsx | 6 | MEDIUM | SelectRenderable, TabSelectRenderable, InputRenderable, TextareaRenderable, BoxRenderable | **CLOSED 2026-07-21** — 4 new components + 2 wiring points shipped; Dialog primitive reserved for incremental modal migration; archived |
| 033e | Polish | Timeline animations, syntax highlighting, markdown, post-processing | 5-8 | LOW | Timeline, useTimeline, post-processing (scanlines, vignette, brightness, saturation) | **CLOSED 2026-07-21** — useTimeline on progress-bar + phase-indicator, SyntaxStyle in diff-viewer + markdown, opt-in post-processing wired in index.tsx; archived |

### Verification

**Cross-Phase Verification:**
1. Each phase FID must pass Perfection Loop before next phase begins
2. Each phase FID must include grep verification for new components
3. Each phase FID must include typecheck verification
4. Master FID tracks overall progress

**OpenTUI Component Verification:**
- Phase C: Verify DiffRenderable, MarkdownRenderable, CodeRenderable, ScrollBoxRenderable, TextTableRenderable are used instead of custom implementations
- Phase D: Verify SelectRenderable, TabSelectRenderable, InputRenderable, TextareaRenderable are used instead of custom components
- Phase E: Verify Timeline, useTimeline, post-processing effects are used for animations and visual polish

**Final Verification (after all phases):**
1. **Phase-scoped hardcoded hex:** `grep -rn '#[0-9a-fA-F]\{6\}' cli/src/components/{savant-ui/echo/phase-indicator,savant-ui/feedback/alert,savant-ui/input/toggle,savant-ui/navigation/stepper,right-sidebar,render-ui}.tsx` — zero hardcoded colors in **phase-scoped consumer files** (phase-indicator, alert, toggle, stepper, right-sidebar phase/activity tables, render-ui). Remaining hardcoded hex elsewhere in `cli/src/components/` (badge, ad-banner, ask-user, login-modal, project-picker-screen, pulse, implementor-row) is **out of scope** for the 033 phase FIDs and tracked as follow-up cleanup.
2. **Full-tree hardcoded hex audit:** `grep -rn '#[0-9a-fA-F]\{6\}' cli/src/components/` — returned **20+ instances across ~10 files** during the Master closure AUDIT (2026-07-21). Sample findings: `cli/src/components/savant-ui/feedback/badge.tsx` (severity/status color constants), `cli/src/components/savant-ui/animation/pulse.tsx` (`#6b7280`), `cli/src/components/ad-banner.tsx`, `cli/src/components/ask-user/components/*.tsx`, `cli/src/components/login-modal.tsx`, `cli/src/components/project-picker-screen.tsx`, `cli/src/components/blocks/implementor-row.tsx`. `right-sidebar.tsx` originally appeared in this list with a non-phase `#ff4444` DEV-MODE indicator; it was fixed during the Master closure audit by replacing the hardcoded hex with `theme.error` and re-verified clean. These remaining components were **not in the scope** of any phase FID (033a–033e) and are deferred to a future cleanup FID.
3. `grep -rn '<new-component>' cli/src/` — all components wired
4. `grep -rn 'DiffRenderable\|MarkdownRenderable\|CodeRenderable' cli/src/` — native OpenTUI components used
5. `grep -rn 'SelectRenderable\|TabSelectRenderable\|InputRenderable' cli/src/` — native OpenTUI components used
6. `grep -rn 'Timeline\|useTimeline' cli/src/` — native OpenTUI animations used
7. `bun run typecheck` in cli/ — zero errors
8. Manual verification: all screens render correctly

### Steps

1. ✅ Create FID-033a (Theme System Port) — archived
2. ✅ Run Perfection Loop on 033a — converged (6 loops, false premise corrected in Loop 6)
3. ✅ Create FID-033b (Glyph/Icon System) — archived
4. ✅ Run Perfection Loop on 033b — converged
5. ✅ Create FID-033c (Tool & Message Rendering) — archived
6. ✅ Run Perfection Loop on 033c — converged
7. ✅ Create FID-033d (Layout & Navigation) — archived
8. ✅ Run Perfection Loop on 033d — converged
9. ✅ Create FID-033e (Polish) — archived
10. ✅ Run Perfection Loop on 033e — converged
11. ✅ Final verification across all phases — hardcoded hex in **phase-scoped consumer files** → 0 results (verified via the scoped grep above; `right-sidebar.tsx` `#ff4444` was fixed to `theme.error` during the Master closure audit); independent AUDIT of all `cli/src/components/` returned **20+ remaining hex instances across ~10 files** (sample: badge.tsx, ad-banner.tsx, ask-user/components/*.tsx, login-modal.tsx, project-picker-screen.tsx, pulse.tsx, implementor-row.tsx) — these are **out of scope** for the 033 phase FIDs and deferred to a follow-up cleanup FID; all OpenTUI native components (SyntaxStyle, useTimeline, applyPostProcessing, SelectRenderable, DiffRenderable, CodeRenderable) verified present in `cli/src/`; all NEW files (syntax-theme.ts, post-processing.ts, glyphs.ts, fid-loader.ts, command-palette.tsx, dialog.tsx, toast.tsx, use-fids.ts, use-toast.ts) confirmed on disk

---

## Perfection Loop

### Loop 1

- **RED:**
  - Original FID-033 had 10 identified issues
  - Scope was too large (5 phases in 1 FID)
  - Missing ECHO template sections
  - Law 7 violation (diff-viewer)
  - Cross-Agent Claim Rule violation (opencode-dev source)
- **GREEN:**
  - Decomposed into 5 independent phase FIDs
  - Created Master FID for orchestration
  - Each phase FID will have complete Perfection Loop
  - Each phase FID will include all required ECHO sections
- **AUDIT:**
  - Master FID follows ECHO template ✓
  - Dependency graph is clear ✓
  - Each phase has defined scope ✓
  - Verification strategy is documented ✓
  - Cross-Agent Claim Rule: No external claims in Master FID ✓
- **CHANGE DELTA:** N/A (new FID creation)

### Loop 2

- **RED:**
  - Phase FIDs do not fully utilize OpenTUI native capabilities
  - Custom implementations proposed where native components exist
  - Missing verification strategy for OpenTUI component usage
- **GREEN:**
  - Updated Master FID to document OpenTUI integration strategy
  - Updated phase FIDs to use native OpenTUI components:
    - Phase C: DiffRenderable, MarkdownRenderable, CodeRenderable, ScrollBoxRenderable, TextTableRenderable
    - Phase D: SelectRenderable, TabSelectRenderable, InputRenderable, TextareaRenderable
    - Phase E: Timeline, useTimeline, post-processing effects
  - Added OpenTUI component verification to Master FID
  - Added OpenTUI components used column to Phase FIDs table
- **AUDIT:**
  - Phase FIDs now specify which OpenTUI components to use ✓
  - Master FID includes OpenTUI component verification steps ✓
  - Custom implementations are only proposed where no native component exists ✓
- **CHANGE DELTA:** <2% (documentation updates only)

### Loop 3

- **RED:**
  - Master FID does not include OpenTUI React hooks integration
  - Missing reference to `@opentui/react` JSX elements
  - No documentation of OpenTUI component composition patterns
- **GREEN:**
  - Added OpenTUI React hooks to Lessons Learned
  - Added JSX elements reference to Lessons Learned
  - Added post-processing effects documentation
  - Added Timeline animations documentation
- **AUDIT:**
  - Master FID now documents all OpenTUI integration points ✓
  - Phase FIDs specify which OpenTUI components to use ✓
  - Verification steps include OpenTUI component grep checks ✓
  - Lessons Learned include OpenTUI integration insights ✓
- **CHANGE DELTA:** <1% (documentation updates only)

### Loop 4

- **RED:**
  - Master FID Lessons Learned #6 listed 11 JSX elements but omitted `<line-number>` which exists in `baseComponents` (verified at `resources/opentui-main/packages/react/src/components/index.ts` line 37)
  - JSX element list was not verified against source in prior loops (Cross-Agent Claim Rule — self-reported)
- **GREEN:**
  - Added `<line-number>` to the JSX elements list
  - Added source path citations for verification
- **AUDIT:**
  - JSX elements verified against `baseComponents` in react/src/components/index.ts ✓
  - All 12 JSX elements now documented ✓
- **CHANGE DELTA:** <1% (one element added to a list)

### Loop 5 (if needed)

- **RED:** [No issues found — FID converged]
- **GREEN:** [N/A]
- **AUDIT:** [N/A]
- **CHANGE DELTA:** [N/A]

### Loop 6 (FID-033a re-audit — false premise corrected)

- **RED:**
  - FID-033a's foundational premise was false. Loops 1–4 described the theme system as a "41-line stub with 7 hardcoded colors" at `cli/src/components/savant-ui/theme.ts`. Reading the actual codebase 0-EOF (Law 1) reveals the real theme system is `cli/src/utils/theme-system.ts` (1247 lines) + `theme-config.ts` (144 lines) = 1391 lines, with dark/light switching, terminal/IDE/OSC auto-detection, file watchers, truecolor detection, and 43 ChatTheme tokens already implemented.
  - FID-033a Step 1 proposed `cli/src/utils/theme-system.ts` as "NEW" — but the file already exists (Law 7 violation).
  - Token gap claim "opencode 53 vs Savant 22, delta +31" was false. Savant's real ChatTheme has 43 tokens; real gap is ~10 tokens (diff + syntax).
  - Compounding issue: Loop 3 of FID-033a carried a fabricated "1025 lines, verified via Measure-Object" audit mark (actual: 1089). Corrected in FID-033a Loop 4.
- **GREEN:**
  - Rewrote FID-033a around the real gap: SyntaxStyle integration (NEW `syntax-theme.ts`), diff + syntax tokens added to ChatTheme, diff-viewer wired to theme tokens (remove 4 hardcoded hex), delete orphaned `_backup-theme.ts`.
  - Deferred JSON theme files to a separate FID (nice-to-have, not a gap).
  - FID-033a scope reduced from 8-12 files to 4 changed + 1 new + 1 deleted.
- **AUDIT:**
  - `wc -l cli/src/utils/theme-system.ts` → 1247 ✓ (real theme system, not the 41-line stub)
  - ChatTheme has 43 tokens (grep-verified) ✓
  - `syntax-theme.ts` genuinely does not exist (glob → 0) ✓ — no Law 7 violation
  - `_backup-theme.ts` orphan confirmed (41 lines, 0 imports) ✓
  - `diff-viewer.tsx` 4 hardcoded hex confirmed via 0-EOF read ✓
  - OpenTUI `syntax-style.ts` (274 lines, exports `convertThemeToStyles`) confirmed ✓
  - Cross-Agent Claim Rule: all FID-033a claims now sourced to tool-verified file paths + line counts ✓
- **CHANGE DELTA:** N/A for Master FID (coordination note only); FID-033a itself ~60% rewritten (once-only foundation correction, mandatory per ECHO.md L403-426)

---

## Resolution

- **Fixed By:** ECHO Agent (Perfection Loop)
- **Fixed Date:** 2026-07-21 (decomposed 2026-07-21 00:15; all phases closed 2026-07-21)
- **Fix Description:** Decomposed FID-033 into 5 phase FIDs (033a–033e) with Master orchestration FID; all 5 phases implemented, verified, and archived.
- **Tests Added:** N/A (documentation only); per-phase test evidence recorded in each archived phase FID.
- **Verified By:** Master closure audit (2026-07-21) — final verification block (re-audited after independent basher run):
  - **Phase-scoped hex:** `grep -rn '#[0-9a-fA-F]{6}' cli/src/components/{savant-ui/echo/phase-indicator,savant-ui/feedback/alert,savant-ui/input/toggle,savant-ui/navigation/stepper,right-sidebar,tools/render-ui}.tsx` → 0 results (grep-verified)
  - **Full-tree hex audit:** `grep -rn '#[0-9a-fA-F]{6}' cli/src/components/` → 20+ instances across ~10 files, including `savant-ui/feedback/badge.tsx`, `savant-ui/animation/pulse.tsx` (`#6b7280`), `ad-banner.tsx`, `ask-user/components/*.tsx`, `login-modal.tsx`, `project-picker-screen.tsx`, `blocks/implementor-row.tsx`. `right-sidebar.tsx` originally appeared in this list with `#ff4444`; it was fixed during the Master closure audit by replacing the hardcoded hex with `theme.error` and re-verified clean.
  - All 9 NEW files across phases A–E present on disk (glob-verified)
  - OpenTUI native components wired: `SyntaxStyle`/`createSyntaxStyle` (syntax-theme.ts, code-block.tsx, diff-viewer.tsx, markdown-renderer.tsx), `useTimeline` (progress-bar.tsx, phase-indicator.tsx), `applyPostProcessing` (index.tsx), `SelectRenderable` (command-palette.tsx)
  - All 5 phase FIDs confirmed archived in `dev/fids/archive/`
- **Commit/PR:** Pending (user to commit uncommitted Phases A–E + this Master closure together)
- **Archived:** 2026-07-21 — Master FID moved to `dev/fids/archive/`

---

## Lessons Learned

1. **ECHO Principle: One problem at a time.** Large FIDs should be decomposed into focused, independent FIDs with clear dependency chains.

2. **Perfection Loop is FID-bound.** The loop runs on FID documents, not code. Code implementation begins only after FID converges to COMPLETE.

3. **Master FIDs for orchestration.** When work decomposes into multiple FIDs, a Master FID tracks dependencies and cross-phase coordination.

4. **Phase FIDs must be self-contained.** Each phase FID must have complete Perfection Loop, not rely on Master FID for convergence.

5. **Native OpenTUI components over custom implementations.** OpenTUI v0.2.2 provides DiffRenderable, MarkdownRenderable, CodeRenderable, ScrollBoxRenderable, SelectRenderable, TabSelectRenderable, InputRenderable, TextareaRenderable, TextTableRenderable, ASCIIFontRenderable, Timeline animations, and post-processing effects. Custom implementations should only be used when no native component exists.

6. **OpenTUI React integration is seamless.** The `@opentui/react` package provides JSX elements (`<box>`, `<text>`, `<code>`, `<diff>`, `<markdown>`, `<input>`, `<select>`, `<textarea>`, `<scrollbox>`, `<ascii-font>`, `<tab-select>`, `<line-number>`) and hooks (`useKeyboard`, `useRenderer`, `useTimeline`, `useResize`, `useSelection`, `useTerminalDimensions`, `useFocus`, `useBlur`, `usePaste`, `useEvent`) that integrate directly with the existing Savant CLI. Verified against `resources/opentui-main/packages/react/src/components/index.ts` and `resources/opentui-main/packages/react/src/hooks/`.

7. **Post-processing effects add professional polish.** OpenTUI's post-processing pipeline (scanlines, vignette, brightness, gain, saturation, gamma, chromatic aberration, noise, colorblind simulation) can be applied to the entire render buffer for visual effects without modifying individual components.

8. **Timeline animations are production-ready.** OpenTUI's Timeline system supports tween, spring, easing, keyframes, sub-timeline synchronization, and is already integrated with React via `useTimeline` hook.

---

## Linked Documents

- [Original FID-033](./FID-2026-0720-033-tui-rebuild-comprehensive.md) — superseded by decomposition
- [FID-033a](./FID-2026-0720-003-theme-system-port.md) — Theme System Port
- [FID-033b](./FID-2026-0720-004-glyph-icon-system.md) — Glyph/Icon System
- [FID-033c](./FID-2026-0720-005-tool-message-rendering.md) — Tool & Message Rendering
- [FID-033d](./FID-2026-0720-006-layout-navigation.md) — Layout & Navigation
- [FID-033e](./FID-2026-0720-007-polish.md) — Polish
