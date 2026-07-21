# FID: Master TUI Rebuild — Orchestration FID for 5-Phase Rebuild

**Filename:** `FID-2026-0720-033-master-tui-rebuild.md`
**ID:** FID-2026-0720-033-master
**Severity:** high
**Status:** analyzed
**Created:** 2026-07-21 00:15
**Updated:** 2026-07-21 16:30
**Author:** ECHO Agent (Perfection Loop)
**Last Audit:** 2026-07-21 16:30 (GLM 5.2 independent re-audit — see Loop 4)

---

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
| 033a | Theme System Port | Theme engine, JSON themes, token system | 8-12 | LOW | SyntaxStyle, RGBA, parseColor |
| 033b | Glyph/Icon System | Icon map, Nerd Font detection, fallback | 2-3 | LOW | ASCIIFontRenderable, t, fg, bg, bold |
| 033c | Tool & Message Rendering | Upgrade 20 renderers, add reasoning blocks | 15-20 | MEDIUM | DiffRenderable, MarkdownRenderable, CodeRenderable, ScrollBoxRenderable, TextTableRenderable |
| 033d | Layout & Navigation | Command palette, dialogs, toasts, sidebar | 8-10 | MEDIUM | SelectRenderable, TabSelectRenderable, InputRenderable, TextareaRenderable, BoxRenderable |
| 033e | Polish | Animations, syntax highlighting, markdown | 5-8 | LOW | Timeline, useTimeline, post-processing (scanlines, vignette, brightness, saturation) |

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
1. `grep -rn '#[0-9a-fA-F]\{6\}' cli/src/components/` — zero hardcoded colors
2. `grep -rn '<new-component>' cli/src/` — all components wired
3. `grep -rn 'DiffRenderable\|MarkdownRenderable\|CodeRenderable' cli/src/` — native OpenTUI components used
4. `grep -rn 'SelectRenderable\|TabSelectRenderable\|InputRenderable' cli/src/` — native OpenTUI components used
5. `grep -rn 'Timeline\|useTimeline' cli/src/` — native OpenTUI animations used
6. `bun run typecheck` in cli/ — zero errors
7. Manual verification: all screens render correctly

### Steps

1. Create FID-033a (Theme System Port)
2. Run Perfection Loop on 033a
3. Create FID-033b (Glyph/Icon System)
4. Run Perfection Loop on 033b
5. Create FID-033c (Tool & Message Rendering)
6. Run Perfection Loop on 033c
7. Create FID-033d (Layout & Navigation)
8. Run Perfection Loop on 033d
9. Create FID-033e (Polish)
10. Run Perfection Loop on 033e
11. Final verification across all phases

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

---

## Resolution

- **Fixed By:** ECHO Agent (Perfection Loop)
- **Fixed Date:** 2026-07-21 00:15
- **Fix Description:** Decomposed FID-033 into 5 phase FIDs with Master orchestration FID
- **Tests Added:** N/A (documentation only)
- **Verified By:** Perfection Loop audit
- **Commit/PR:** Pending
- **Archived:** Pending (when all phase FIDs closed)

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
- [FID-033a](./FID-2026-0720-033a-theme-system-port.md) — Theme System Port
- [FID-033b](./FID-2026-0720-033b-glyph-icon-system.md) — Glyph/Icon System
- [FID-033c](./FID-2026-0720-033c-tool-message-rendering.md) — Tool & Message Rendering
- [FID-033d](./FID-2026-0720-033d-layout-navigation.md) — Layout & Navigation
- [FID-033e](./FID-2026-0720-033e-polish.md) — Polish
