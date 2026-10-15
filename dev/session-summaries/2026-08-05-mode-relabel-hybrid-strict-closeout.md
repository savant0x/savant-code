# Session Summary: Mode Execution-Scope Relabel + STRICT Mode + Hover Descriptions (FID-2026-0805-001)

**Date:** 2026-08-05
**Author:** Savant
**FID:** `dev/fids/archive/FID-2026-0805-001-mode-execution-scope-relabel-hybrid-strict.md`

## What happened

The operator surfaced two compounding problems: (1) the `EDIT` mode label was false
advertising — it claimed the strict ECHO loop while the `savant` agent it selected ran
**Hybrid Mode by default** (the exact documented-intent vs. implemented-behavior gap
FID-2026-0804-009 cataloged at the enforcement layer); and (2) after FID-009/010, hybrid
was bounded (harness `warn` receipts, 20-line ceremony threshold) but still
self-escalating — no first-class mode *guaranteed* the full ceremony. A third item
folded in: hovering the mode toggle showed no explanation of what each mode does
(OpenTUI 0.2.2 ships no tooltip/hovertip component, but every absolute-positioning /
mouse-coordinate primitive to build one is present).

The design was converged with the operator through the Perfection Loop (Loop 1
converged on the four-mode axis **HYBRID / SCAFFOLD / STRICT / ANALYZE**; Loop 2
re-audit produced zero actionable improvements and the operator authorized automation
lvl 3 = Autonomous). The floating hovertip became the primary design after the operator
surfaced the standard OpenTUI absolute-positioning pattern; primitives were verified
against the pinned 0.2.2 bundle before the FID was marked COMPLETE.

## Changes

- **`cli/src/utils/constants.ts`** — `AGENT_MODE_TO_ID` keys renamed `EDIT` → `HYBRID`,
  `STRICT: 'savant-strict'` added; axis comment rewritten honestly; new single-source
  `MODE_DESCRIPTIONS: Record<AgentMode, string>` map (one-line contract per mode).
- **`agents/savant/savant.ts`** — `'strict'` added to `SystemPromptMode`; strict
  preamble + step prompts; the ECHO-Phase-Gating section made mode-aware so STRICT
  replaces the Hybrid-Mode boilerplate (the strict contract is explicit: Recorder FID
  per change → RED → GREEN (Forge writes) → AUDIT (Verifier + Law-4 greps), no
  self-verification, no phase-skipping for code changes, pure Q&A read-only).
- **`agents/savant/savant-strict.ts`** (new) — `{ ...createSavant('strict'), id:
  'savant-strict' }`; auto-discovered by `prebuild:agents` (zero script changes).
- **`cli/src/utils/settings.ts`** — `DEFAULT_SETTINGS.mode = 'HYBRID'`;
  `LEGACY_MODE_MIGRATION += { EDIT: 'HYBRID' }`; `loadModePreference` fallback
  `'HYBRID'`.
- **Handoff strings → HYBRID** — `agents/recorder/recorder.ts:94`,
  `agents/savant/savant-scaffold.ts`, `common/src/tools/params/tool/set-scaffold-complete.ts`,
  `cli/src/hooks/use-scaffold-revert-subscriber.ts`, `cli/src/hooks/use-chat-input.ts`,
  `cli/src/cli-args.ts` (the `--edit` CLI flag is kept), `cli/src/index.tsx`,
  `cli/src/utils/savant-free-agent-selection.ts`.
- **Aliases** — `/mode:edit` and `model:edit` kept as aliases for `mode:hybrid`
  (slash-commands + registry + router-input test).
- **`cli/src/components/segmented-control.tsx`** — optional `Segment.description`;
  `onHoverChange` callback; 150 ms hover-intent grace on mouse-out (prevents tip
  flicker while the cursor travels toward the tip).
- **`cli/src/components/mode-hovertip.tsx`** (new) — bordered, `position: 'absolute'`,
  bottom-anchored above the control, `zIndex`, non-interactive (no mouse handlers).
- **`cli/src/components/agent-mode-toggle.tsx`** — `MODE_DESCRIPTIONS` wired into
  `buildExpandedSegments`; hovertip state; collapsed-button tip when input is not
  focused; stale-hover reset on mode change.
- **Bundle + tests + docs** — `bundled-agents.generated.ts` regenerated
  (`prebuild:agents`); new/updated test suites (settings migration, 4-mode axis, toggle
  labels + descriptions, slash aliases, free mapping, strict prompt contract, hovertip
  SSR markup, frame-buffer render test); README.md + README.zh-CN.md +
  cli/release/README.md mode tables and feature bullets.

## Verification

- Independent code review (code-reviewer-deepseek-flash) — fixes applied: collapsed-tip
  hover-intent grace, stale-hover reset, coupling/enforcement-gap comments, and a
  headless terminal-smoke render test.
- **Frame-buffer render test** (`mode-hovertip.render.test.tsx`) — the FID's
  terminal-smoke gate, done headlessly via `@opentui/core/testing`
  `createTestRenderer` + `MockMouse`: proves the tip renders ABOVE the control in the
  real rendered cells, appears on hover, and stays hidden pre-hover. Two harness quirks
  resolved empirically: `footerHeight: 0` is required (default 12 with height 12 gives
  the content area zero rows), and the async paint needs real delays between
  `renderOnce()` loops (a single loop does not land the frame).
- Gates: typecheck ×9 all exit 0; ESLint `--max-warnings 0` clean (4 import-order
  warnings in the new render test auto-fixed); `lint:md` 0 issues; CLI full suite
  2825 pass / 0 fail / 18 skip; common 523/0; agents 5/5; affected suites 106/0;
  Law-4 reachability greps green (HYBRID in toggle/settings/cli-args/index; STRICT in
  toggle/cli-args/savant-strict; `savant-strict` bundled; `MODE_DESCRIPTIONS` consumed
  outside constants).

## Status

FID-2026-0805-001 closed and archived after this closeout. Lesson recorded in
`dev/LEARNINGS.md` (2026-08-05 entry). Changes remain an uncommitted 0.0.19 release
candidate in the working tree.
