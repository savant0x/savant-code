# FID: Output-result renderer adopts the TrafficLights panel chrome

**Filename:** `FID-2026-0822-005-output-result-traffic-lights-chrome.md`
**ID:** FID-2026-0822-005
**Severity:** low
**Status:** closed
**Created:** 2026-08-22 14:58
**YAGNI-Compliance:** Verified

---

## Summary

Operator directive: the output rendering introduced by FID-2026-0821-007 (`OutputResultComponent`,
shared by 15 registrations — representative `deep_research` + 14 aliases — via
`cli/src/components/tools/registry.ts`) should render inside the same TrafficLights panel chrome as
`TerminalCommandDisplay` and `CompactionSignal` — a rounded-border box on the surface color with a
right-aligned glowing traffic-lights title bar (FID-2026-0817-001) — instead of a bare YAML code block.

## Environment

- **OS:** Windows 11 (Git Bash / MSYS)
- **Language/Runtime:** TypeScript, Bun 1.3.14, React (@opentui/core renderer)
- **Tool Versions:** cli workspace
- **Commit/State:** working tree post-v0.0.27 (release-only-commits convention)

## Detailed Description

### Problem

`OutputResultComponent` rendered the formatted tool `output` as a bare ```yaml fenced block through the
markdown pipeline, with no panel chrome. Result-bearing tools visually differ from terminal output and
compaction lifecycle events, which use the bordered surface panel + glowing TrafficLights title bar.

### Expected Behavior

Tool output renders inside the standard bordered surface panel with the right-aligned TrafficLights title bar,
matching the established visual language of `TerminalCommandDisplay` and `CompactionSignal`.

### Root Cause

FID-2026-0821-007 scoped the component minimally (make the output visible); chrome parity was out of its spec.

## Impact Assessment

### Affected Components

- `cli/src/components/tools/output-result.tsx` (renderer body)
- NEW `cli/src/components/traffic-light-panel.tsx` (shared chrome primitive)
- `cli/src/components/tools/__tests__/output-result.test.tsx` + NEW
  `cli/src/components/tools/__tests__/traffic-light-panel.test.tsx` + NEW
  `cli/src/components/tools/__tests__/helpers/mock-opentui-react-static.ts`

### Risk Level

- [ ] Critical / High / Medium
- [x] Low: cosmetic parity change

## Proposed Solution

### Approach (converged after RED)

Extract ONE shared primitive `TrafficLightPanel` adopting the canonical chrome recipe with the compaction-signal
`'100%'` width model; adopt in `OutputResultComponent` only (no refactor of the two existing consumers this pass —
recorded as optional follow-up debt). Inner `codeBlockWidth = Math.max(1, options.availableWidth - 2)`
(border allowance). Null guards + `collapsedPreview` unchanged. Test-risk mitigation for `useAnimationBudget`'s opentui
context hooks: scoped `mock.module('@opentui/react')` stubs in test files ONLY.

### Steps

1. [implemented] Create `TrafficLightPanel` (`cli/src/components/traffic-light-panel.tsx:18-49`).
2. [implemented] Wire into `OutputResultComponent` (`cli/src/components/tools/output-result.tsx:5,:51-67`)
   with border-allowance width (:57-59).
3. [implemented] Tests: primitive suite (2 tests) + chrome integration assertion (suite now 5 tests).
4. [implemented] Gates: typecheck/eslint/focused suites/full cli suite.

### Verification

All gates green (see Implementation Evidence).

## Perfection Loop

### Loop 1 — RED

- **RED:** Detective catalog (2026-08-22): ISSUE-1 no shared title-bar primitive existed (TrafficLights consumers =
  exactly 2 components; flex-end at 3 sites); ISSUE-2 `useAnimationBudget` pulls `@opentui/react` context hooks
  with zero static-markup coverage (reproduced: 5/7 tests failed with 'Renderer not found' before the mock); ISSUE-3 no
  existing chrome-JSX test coverage; ISSUE-4 width-model divergence + ~24-col agent-grid clamp
  (`agent-branch-wrapper.tsx:53`; `blocks-renderer.tsx:30` availableWidth = terminalWidth−2); ISSUE-5 blast radius 15
  registrations; ISSUE-6 null-content guards pinned by tests. Render-path theme-context proof:
  `tool-branch.tsx` mounts config.content inside the themed tree; production precedent `run-terminal-command.tsx` embeds
  `useTheme()`-consuming JSX.
- **GREEN:** Hybrid-mode implementation completed 2026-08-22: `TrafficLightPanel` primitive (style-object pattern
  conforming to both references per Law 11); `OutputResultComponent` wired with border-allowance width fix; 3 test
  artifacts added; scoped opentui mock helper (test-only). Gates: cli typecheck exit 0; eslint --max-warnings 0 across
  all 5 files; focused suites 7 pass / 0 fail / 14 expect() calls.
- **AUDIT:** Verifier PASS on all items (pattern conformance, null guards, Law-4 call-graph incl. registry
  untouched-by-construction, mock scope, width model soundness) with REQUIRED gate: full cli suite — SATISFIED:
  `bun test` in cli → 3265 pass / 18 skip / 0 fail / 9046 expect() calls across 235 files, exit 0 (settles cross-file
  mock-leakage concern empirically; bun module mocks process-global but per-file graphs isolated). NEEDS-REVIEW retained:
  human runtime-chrome visual check (static markup proves structure, not layout).
- **ADVERSARIAL:** Verdict STANDS (2026-08-22). All PASSes disk-resolved: `traffic-light-panel.tsx:18-49` recipe exact;
  `output-result.tsx:5,:51-67` wiring + `:40-42` guards byte-equivalent; TrafficLightPanel production consumer =
  output-result.tsx ONLY (grep 16 hits: definition + consumer + tests + FID prose); `registry.ts:82-95` 15 registrations
  intact, zero edits this session; sole `mock.module('@opentui/react')` at `mock-opentui-react-static.ts:13`; omission
  sweep clean (set-output/sequential-thinking migration = recorded follow-up debt, operator scope was 'the output'
  renderer). One citation typo in the Verifier report ('firstMeaningingLine') immaterial.
- **CHANGE DELTA:** N/A — single-loop convergence; FID changes additive only.

### Missed Questions

1. Theme context available in tool-content path? → Yes — production precedent (RunTerminalCommandComponent embeds TerminalCommandDisplay).
2. Collapsed state shows chrome? → No — expanded content only.
3. Extract or copy the chrome? → Extract `TrafficLightPanel`; adopt in OutputResultComponent only; migrating the two
   inline copies = optional follow-up debt (recorded in Resolution).
4. Will opentui hooks survive react-dom/server? → NO — reproduced ('Renderer not found'); resolved via test-only
   mock.module stubs per FID decision 5. Production untouched.
5. Width model? → '100%' boxes + availableWidth−2 inner code wrap.
6. Empty output renders empty panel? → No — guards preserved.
7. Single-consumer YAGNI concern? → Spec-sanctioned: replaces an already-twice-duplicated pattern; not speculative
   scaffolding (Verifier NOTE, Adversary CONFIRMED).

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working-tree closure per release-only-commits convention (no commit between releases; swept by
  next automation release)
- [x] **File:line ranges:** `cli/src/components/traffic-light-panel.tsx:18-49` (primitive);
  `cli/src/components/tools/output-result.tsx:5` (import), `:51-67` (JSX wrap), `:57-59` (codeBlockWidth −2),
  `:40-42` (null guards); `cli/src/components/tools/__tests__/traffic-light-panel.test.tsx` (2 tests);
  `cli/src/components/tools/__tests__/output-result.test.tsx:88-96` (chrome assertion);
  `cli/src/components/tools/__tests__/helpers/mock-opentui-react-static.ts:13` (sole opentui mock)
- [x] **Gate output:** cli typecheck exit 0 (`tsc --noEmit -p .`); eslint --max-warnings 0 exit 0 over all 5 touched
  files; focused `bun test` 7 pass / 0 fail / 14 expect(); full cli suite 3265 pass / 18 skip / 0 fail / 9046 expect()
  across 235 files, exit 0
- [x] **Reproducibility:** grep `TrafficLightPanel` cli/src → definition + output-result.tsx consumer + tests; grep
  `mock.module\('@opentui/react'\)` cli/src → helper file only; `registry.ts:82-95` unchanged
- [x] **Step statuses:** all four Proposed-Solution steps `implemented` (none blocked/deferred)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (Adversary disk-resolved each)
- [x] Implementation matches the Proposed Solution (recipe + wiring + width model verified)
- [x] Typecheck/tests/lint pass with pasted tool output (above)
- [x] Production call-graph evidence present (TrafficLightPanel ← output-result.tsx; registry aliases intact)
- [x] FID status reflects actual state: closed with implementation live in working tree

> Carried NEEDS-REVIEW: runtime visual layout inside narrow agent grids requires one human TUI spot-check
> (trigger a get_goal/deep_research block).

## Resolution

- **Closed Date:** 2026-08-22 16:05
- **Fix Description:** Shared `TrafficLightPanel` chrome primitive extracted (canonical recipe, '100%' width model) and
  adopted by `OutputResultComponent` for all 15 registered result-bearing tools; border-allowance width fix;
  test-only opentui static-render mock.
- **Tests Added:** Yes — 2 primitive tests + 1 chrome integration assertion (+ preserved 4 originals); shared mock helper.
- **Verification Evidence:** See Implementation Evidence (gates + Adversary disk-resolution).
- **Archived:** 2026-08-22 16:25 (physical move completed later the same session, after bash-relay
  failures forced an apply_patch-mediated move; timestamp originally authored at closure)

Optional follow-up debt (explicitly recorded, operator may schedule): migrate `terminal-command-display.tsx` +
`compaction-signal.tsx` onto `TrafficLightPanel` (Law 13 completion); extend the same chrome to `set-output.tsx` /
`sequential-thinking.tsx` if desired.

## Lessons Learned

Static-markup TUI tests cannot exercise provider-bound context hooks — `useRenderer()` throws outside a live opentui
renderer. The cheap, honest seam is a test-only `mock.module` with inert stubs (documented in the FID BEFORE
implementation, per decision 5), never production changes for testability. Also: when extracting a duplicated
visual pattern, adopt the percentage-width variant when the new consumer renders inside variable-width grid cells —
the numeric-width variant silently assumes a fixed frame budget.
