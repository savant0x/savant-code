<!-- markdownlint-disable MD013 -->

# FID: Mode Execution-Scope Relabel — EDIT → HYBRID + New STRICT Mode

**Filename:** `FID-2026-0805-001-mode-execution-scope-relabel-hybrid-strict.md`
**ID:** FID-2026-0805-001
**Severity:** medium
**Status:** closed
**Created:** 2026-08-05 09:00
**Author:** Savant

---

## Summary

The mode toggle exposes three positions labeled `EDIT` / `SCAFFOLD` / `ANALYZE`, but the labels lie about the behavior. `EDIT` — per the comment in `cli/src/utils/constants.ts:131-135` — is described as "the default strict ECHO loop," yet it maps to the `savant` agent whose prompt runs **Hybrid Mode by default** (write directly, escalate to the full Perfection Loop only past the FID-010 20-line threshold). FID-2026-0804-009 moved Law 1 / Law 3 / Verifier-criteria enforcement into the harness at `warn` level, and FID-2026-0804-010 lowered the ceremony threshold from 75 to 20 lines — but no mode exists that **guarantees** the full ceremony. This FID renames `EDIT` → `HYBRID` (honest label for the existing behavior), adds a new **`STRICT`** mode that mandates the complete Perfection Loop for every change (per-change FID via Recorder, RED → GREEN → AUDIT, Forge writes, Verifier audits, Law-4 reachability greps), keeps `SCAFFOLD` and `ANALYZE` unchanged, and adds a **floating hovertip** to the mode toggle so each mode's contract is visible on hover — built on OpenTUI 0.2.2's verified absolute-positioning primitives (no native tooltip component ships in the pinned version). Resulting axis: **HYBRID / SCAFFOLD / STRICT / ANALYZE**.

## Environment

- **OS:** Windows 11 / win32
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned in `.bun-version` and `cli/package.json` engines)
- **Tool Versions:** TypeScript 5.5.4, zod v4, OpenTUI 0.2.2
- **Commit/State:** `main` (working tree after FID-2026-0804-001..010, all archived; no active FIDs)

## Detailed Description

### Problem

1. **The `EDIT` label is false advertising.** `cli/src/utils/constants.ts:131-135` defines
   `AGENT_MODE_TO_ID = { EDIT: 'savant', SCAFFOLD: 'savant-scaffold', ANALYZE: 'savant-analyze' }`
   with the comment "EDIT is the default strict ECHO loop." The actual `savant` prompt
   (`agents/savant/savant.ts:709` → `createSavant('default')`) declares
   "## Hybrid Mode (Default — use for most tasks)" and only enters the full loop when
   the FID-010 criteria are met (touches > 20 lines AND new imports/APIs, OR novel
   architecture, OR verification fails twice, OR user explicitly requests Forge). A user
   who selects "EDIT" believing they get the strict loop instead gets the frictionless
   hybrid — the exact documented-intent vs. implemented-behavior contradiction
   FID-2026-0804-009 cataloged.

2. **No mode guarantees full ceremony.** After FID-009 (harness `warn` enforcement) and
   FID-010 (threshold 75 → 20), hybrid is *bounded* but still self-escalating: the full
   loop (FID per change, Forge, Verifier, Recorder) only happens when the model chooses
   to escalate. There is no first-class mode that requires the full loop for every
   change. Power users and teams needing audit trails (the FID-009 LEARNINGS L-001 class
   of failures) have no opt-in.

3. **The mode axis is cheap to extend.** `AGENT_MODES` (constants.ts:138) drives the
   toggle labels (`agent-mode-toggle.tsx:106`), the `/mode:N` commands
   (`data/slash-commands.ts:22-27`, `command-registry.ts:653-655`), the keyboard cycle
   (`state/chat-store.ts:401-403`), and settings validation (`utils/settings.ts:147`).
   Adding a fourth position is a single-key change plus a prompt variant.

4. **Modes are unlabeled on hover.** Hovering a mode segment shows no explanation of
   what that mode does. `SegmentedControl` already tracks `hoveredId`
   (`segmented-control.tsx:38`) but discards it — there is no description surface.
   OpenTUI 0.2.2 ships **no tooltip/hovertip component** (full-package grep: 0
   `tooltip`/`hovertip` matches — the only hits are 3 unrelated `hint` tokens;
   `Box.title` at `Box.d.ts:13` is a border label with `titleAlignment`). The floating
   hovertip primitives are all present, however: `position: 'absolute'` + `top`/`left`
   (status-bar.tsx renders its countdown fill this way),   `zIndex` (21 occurrences in the runtime bundle), and `MouseEvent.x/y` (renderer.d.ts:116-117, already
   consumed at multiline-input.tsx:481). With the `STRICT` name coming, modes need a per-mode
   description on hover or the axis stays opaque.

### Expected Behavior

- Mode toggle, `/mode` commands, and status surfaces show **HYBRID / SCAFFOLD / STRICT / ANALYZE**.
- **HYBRID** = exactly today's `EDIT` behavior: agent `savant`, hybrid prompt, harness
  compliance at `warn`, FID-010 20-line ceremony threshold. Default mode.
- **STRICT** = new mode, agent `savant-strict`: **every** code change runs the full
  Perfection Loop — Recorder creates a FID, RED (Detective) analysis, GREEN (Forge)
  implementation, AUDIT (Verifier + Law-4 reachability greps), Recorder archives. No
  self-verification. No phase-skipping table for code changes; pure Q&A may stay
  read-only.
- **SCAFFOLD** unchanged (umbrella-FID project init). **ANALYZE** unchanged (read-only).
- Persisted `settings.json` `mode: "EDIT"` migrates to `"HYBRID"` on load via the
  existing `LEGACY_MODE_MIGRATION` mechanism (`utils/settings.ts:26-31`).
- `mode:edit` remains a working alias for `mode:hybrid` so muscle memory and scripts
  don't break.
- The scaffold-complete handoff string "reverting to EDIT mode" becomes
  "reverting to HYBRID mode".
- **Hover descriptions (floating hovertip):** each mode's one-line contract lives in
  a single-source `MODE_DESCRIPTIONS` map (constants.ts) and renders as a **floating
  hovertip** — a small bordered, non-interactive box absolutely positioned above the
  mode control, showing the hovered segment's description (fallback: active mode).
  OpenTUI 0.2.2 has no hovertip component, so it is a ~15-line component per the
  standard OpenTUI absolute-positioning pattern; anchoring is verified in a live
  terminal at implementation time, with an inline caption as the specced fallback if
  absolute anchoring misbehaves. The toggle expands on hover (`agent-mode-toggle.tsx:15`,
  `OPEN_DELAY_MS = 0`), so the tip is one hover away.

### Root Cause

The `EDIT` key predates the hybrid reality: the toggle was authored while the strict
loop was the *intended* contract, then the hybrid flow became the shipped behavior
without relabeling. FID-009/010 made hybrid's enforcement real at the harness layer, so
the honest fix is (a) rename the label to match the shipped behavior and (b) make the
strict-ceremony contract a first-class, user-selectable mode instead of a self-escalation
rule the model must volunteer to follow.

### Evidence

```text
cli/src/utils/constants.ts:131-138
  /**
   * Mapping from agent mode to agent ID.
   * ...
   * Three-position execution-scope axis. EDIT is the default strict ECHO loop;   <- FALSE
   * ANALYZE is read-only; SCAFFOLD is an opt-in umbrella-FID mode ...
   */
  export const AGENT_MODE_TO_ID = {
    EDIT: 'savant',                  // <- runs the HYBRID prompt, not the strict loop
    SCAFFOLD: 'savant-scaffold',
    ANALYZE: 'savant-analyze',
  } as const

agents/savant/savant.ts:709  const definition = { ...createSavant('default'), id: 'savant' }
agents/savant/savant.ts:493-495  mode-specific preamble map (ANALYZE read-only / SCAFFOLD umbrella)
agents/savant/savant.ts:471,507  createSavant(mode: SystemPromptMode) factory — the seam for 'strict'
agents/savant/savant.ts:416,437  ANALYZE read-only prompts; :445,465 SCAFFOLD prompts

cli/src/utils/settings.ts:16-21  DEFAULT_SETTINGS.mode = 'EDIT'
cli/src/utils/settings.ts:26-31  LEGACY_MODE_MIGRATION { DEFAULT/LITE/MAX/PLAN/FREE → EDIT }  (FID-031 precedent)
cli/src/utils/settings.ts:147    validateSettings: AGENT_MODES.includes(migrated)
cli/src/utils/settings.ts:~215   loadModePreference() ?? 'EDIT'

cli/src/state/chat-store.ts:285   agentMode: loadModePreference()
cli/src/state/chat-store.ts:391-404  setAgentMode + keyboard cycle through AGENT_MODES + saveModePreference

cli/src/data/slash-commands.ts:22-27  MODE_COMMANDS generated from AGENT_MODES (id: `mode:${mode.toLowerCase()}`)
cli/src/commands/command-registry.ts:653-655  mode commands generated from AGENT_MODES (excluded in SavantFree)
cli/src/components/agent-mode-toggle.tsx:106  buildExpandedSegments maps AGENT_MODES → raw-key labels
cli/src/components/agent-mode-toggle.tsx:~120  SCAFFOLD confirmation gate (useScaffoldConfirm)

cli/src/components/agent-mode-toggle.tsx:15  OPEN_DELAY_MS = 0 — toggle expands on hover, so the hovertip is one hover away
cli/src/components/segmented-control.tsx:9-16  Segment interface (id/label/isBold/…) — no description field today
cli/src/components/segmented-control.tsx:38  hoveredId state — the seam for the hovertip (currently discarded)
cli/src/components/status-bar.tsx  position: 'absolute' + top/left rendering precedent (countdown fill)
@opentui/core/renderer.d.ts:116-117  MouseEvent.x/y viewport coordinates
@opentui/core (full package grep)  0 tooltip/hovertip matches (only 3 unrelated 'hint' tokens); Box.title is a border label (titleAlignment)
@opentui/core bundle  zIndex — 21 occurrences (layering support)
agents/recorder/recorder.ts:94  handoff string "Umbrella FID sealed. Scaffold session complete; reverting to EDIT mode."
cli/src/agents/bundled-agents.generated.ts  AUTO-GENERATED — regenerated via `bun run prebuild:agents`
```

## Impact Assessment

### Affected Components

- `cli/src/utils/constants.ts` — `AGENT_MODE_TO_ID` (EDIT → HYBRID + STRICT entry), honest axis comment
- `agents/savant/savant.ts` — add `'strict'` to `SystemPromptMode` + strict-mode prompt sections
- `agents/savant/savant-strict.ts` (new) — `{ ...createSavant('strict'), id: 'savant-strict' }`
- `cli/src/utils/settings.ts` — `DEFAULT_SETTINGS.mode`, `LEGACY_MODE_MIGRATION` += `EDIT → HYBRID`
- `agents/recorder/recorder.ts:94` — handoff string "reverting to EDIT mode" → HYBRID
- `cli/src/data/slash-commands.ts` — auto (generated from `AGENT_MODES`) + `edit` alias
- `cli/src/commands/command-registry.ts` — auto + `mode:edit` alias handling
- `cli/src/state/chat-store.ts` — cycle order (reads `AGENT_MODES`; verify no hardcoded EDIT)
- `cli/src/components/agent-mode-toggle.tsx` — labels auto; verify no hardcoded EDIT
- `cli/src/utils/savant-free-agent-selection.ts` — `AGENT_MODE_TO_ID[agentMode]` mapping
- `cli/src/agents/bundled-agents.generated.ts` — regenerate via `bun run prebuild:agents`
- `cli/src/components/mode-hovertip.tsx` (new) — bordered, absolute-positioned, non-interactive tip fed by the hovered segment
- `cli/src/components/segmented-control.tsx` — optional `Segment.description` + hover callback/state exposure
- `cli/src/components/agent-mode-toggle.tsx` — wire `MODE_DESCRIPTIONS` into `buildExpandedSegments`; hovertip state + viewport clamp
- `cli/src/utils/constants.ts` — new `MODE_DESCRIPTIONS: Record<AgentMode, string>` (single source for hovertip + `/mode` help)
- Tests: `agent-mode-toggle.test.ts`, `settings.test.ts`, slash-command tests, free-agent-selection tests, `segmented-control.test.ts`
- Docs: `README.md`, `README.zh-CN.md`, `cli/release/README.md` (mode table + feature bullets)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] Medium: Major feature broken, no workaround
- [x] Low: Minor issue, cosmetic, or edge case (labels + one new mode; behavior of HYBRID unchanged)

## Proposed Solution

### Approach

Rename the axis honestly and add STRICT as a first-class mode. The mode system is
data-driven from `AGENT_MODES`, so the rename cascades automatically to the toggle,
slash commands, and cycle; the two deliberate touch points are the settings migration
and the new `savant-strict` prompt variant. `mode:edit` stays as an alias so existing
users/scripts keep working. STRICT enforces via the prompt contract + the existing
FID-009 harness warnings at `warn` level; the hard `block` mode remains explicitly
deferred (FID-009 future work).

### Steps

1. **constants.ts:** `AGENT_MODE_TO_ID = { HYBRID: 'savant', SCAFFOLD: 'savant-scaffold', STRICT: 'savant-strict', ANALYZE: 'savant-analyze' }`; rewrite the axis comment to describe the honest execution-scope contract (HYBRID = harness-bounded direct writing; STRICT = full Perfection Loop per change). Order = cycle order: HYBRID, SCAFFOLD, STRICT, ANALYZE.
2. **savant.ts:** add `'strict'` to the `SystemPromptMode` union (line ~471/507); `buildSystemPrompt('strict', …)` returns a preamble ("You are in STRICT mode. Every code change runs the full ECHO Perfection Loop…") and replaces the Hybrid-Mode section with a mandatory-loop section: Recorder FID per change → RED → GREEN (Forge writes) → AUDIT (Verifier + Law-4 greps); no self-verification; no phase-skipping for code changes; pure Q&A stays read-only.
3. **savant-strict.ts (new):** `export default { ...createSavant('strict'), id: 'savant-strict' }`.
4. **settings.ts:** `DEFAULT_SETTINGS.mode = 'HYBRID'`; `LEGACY_MODE_MIGRATION` += `{ EDIT: 'HYBRID' }`; `loadModePreference()` fallback `'EDIT'` → `'HYBRID'`.
5. **recorder.ts:94:** handoff string → "reverting to HYBRID mode"; regenerate `bundled-agents.generated.ts` (`bun run prebuild:agents`).
6. **Aliases:** keep `/mode:edit` (and alias `edit` for `hybrid`) so muscle memory and scripts don't break.
7. **Hover descriptions (hovertip):** add `MODE_DESCRIPTIONS: Record<AgentMode, string>` to constants.ts (one-line contract per mode); extend `Segment` with optional `description`; build `cli/src/components/mode-hovertip.tsx` — bordered box, `position: 'absolute'` above the control, `zIndex`, non-interactive (no mouse handlers → no flicker) — fed by `SegmentedControl`'s `hoveredId`; fallback content = active mode's description. Implementation gate: terminal smoke (tmux-cli) verifies absolute anchoring + viewport-top clamp; if negative offsets misbehave, fall back to the specced inline caption (both documented — zero re-work).
8. **Tests:** settings migration (`EDIT` → `HYBRID`); `AGENT_MODES` = `['HYBRID','SCAFFOLD','STRICT','ANALYZE']`; toggle renders the four labels; slash commands `mode:hybrid`/`mode:strict` (+ `edit` alias); free-agent-selection mapping for `HYBRID`/`STRICT`; strict prompt contains the mandatory-loop contract (FID per change, Forge, Verifier, no self-verify); caption renders the hovered mode's description and falls back to the active mode.
9. **Docs:** README mode table (EN + zh-CN + npm README) with the four modes and their contracts; feature bullet for STRICT mode + hover descriptions.
10. **Gates:** `bun run --cwd=agents typecheck`, typecheck ×4 (sdk/common/agent-runtime/cli), CLI test suites, `bun x eslint . --max-warnings 0`, `bun run lint:md`, prebuild:agents regen + bundle grep (STRICT present, EDIT label gone from mode axis), Law-4 greps (`HYBRID`/`STRICT` reachable in toggle, slash-commands, chat-store; `savant-strict` definition bundled).

### Verification

- Settings file with `"mode": "EDIT"` loads as `HYBRID`; a fresh settings file defaults to `HYBRID`.
- `/mode` menu shows HYBRID / SCAFFOLD / STRICT / ANALYZE; `/mode:edit` still resolves (alias → HYBRID).
- Toggle renders the four labels; keyboard cycle visits all four in order.
- A STRICT-mode run touching code produces a FID + Forge + Verifier per the prompt contract (prompt-text verification via bundle grep; runtime harness behavior unchanged at `warn`).
- Terminal smoke (tmux-cli): hovering a segment renders the hovertip above the control with the correct description, clamps at the viewport top, and does not flicker on mouseout.
- `bundled-agents.generated.ts` contains `savant-strict` with the mandatory-loop contract and zero stale `EDIT` axis labels.
- Typecheck ×5 (agents + the 4 hard gates), ESLint 0 warnings, markdownlint 0 issues, affected CLI suites pass.

## Perfection Loop

### Loop 1

- **RED:** Cataloged (a) the false `EDIT` label at constants.ts:131-135 vs. the actual hybrid prompt in `createSavant('default')` (savant.ts:709); (b) the absence of any guaranteed-full-ceremony mode after FID-009/010; (c) the data-driven mode axis (AGENT_MODES → toggle/slash/cycle/settings) that makes the rename cheap; (d) the FID-031 legacy-mode migration precedent in settings.ts that makes the persisted-value migration trivial; (e) the scaffold handoff string still referencing EDIT (recorder.ts:94); (f) the absence of any per-mode hover description (SegmentedControl tracks `hoveredId` but discards it; OpenTUI 0.2.2 ships no hovertip component but provides the absolute-positioning + mouse-coordinate primitives to build one).
- **GREEN:** Converged with the operator (2026-08-05 discussion) on a **four-mode axis: HYBRID / SCAFFOLD / STRICT / ANALYZE**. HYBRID = current EDIT behavior (honest label, zero behavior change); STRICT = new first-class full-ceremony mode via a `savant-strict` prompt variant; SCAFFOLD and ANALYZE unchanged. Operator explicitly chose "Keep Analyze as 4th" (read-only stays a hard guarantee) and "Strict" over "ECHO" for the ceremony-mode name (self-explanatory contrast with Hybrid).
- **AUDIT:** Static analysis (Method 1) verified the cited files/lines exist in the working tree (constants.ts:131-138, settings.ts:16-31/147/215, chat-store.ts:285/391-404, slash-commands.ts:22-27, command-registry.ts:653-655, agent-mode-toggle.tsx:15/106, segmented-control.tsx:9-16/38, status-bar.tsx absolute precedent, renderer.d.ts:116-117 MouseEvent.x/y, savant.ts:468/471/493-495/709, recorder.ts:94 handoff string, bundled-agents regeneration path; 0 `tooltip`/`hovertip` matches in @opentui/core). Design audit (Method 2): mode keys rename fully (not label-only) so /mode commands and persistence match the honest name; `mode:edit` kept as alias; STRICT stays prompt-contract + `warn` harness (hard `block` is FID-009 future work, out of scope); default mode unchanged (HYBRID); no confirm dialog for STRICT (unlike SCAFFOLD, which is a permission boundary); hover description is a floating hovertip built on the verified absolute/zIndex/mouse-coordinate primitives, with the inline caption as the specced fallback.
- **CHANGE DELTA:** 0% (design-only FID; no code written — FID-bound execution requires convergence + user approval before IMPLEMENT).

### Loop 2 (Independent Re-Audit + COMPLETE — 2026-08-05)

- **RED:** Fresh full sweep of every claim against the working tree — all 18 citation checks pass (constants.ts:131-138 keys, savant.ts:468/493-495/709, settings.ts:18/26-31/147/215, chat-store.ts:285/401-403, slash-commands.ts:25, command-registry.ts:653-655, agent-mode-toggle.tsx:15/106, segmented-control.tsx:9-16/38, recorder.ts:94 handoff, status-bar.tsx absolute precedent, renderer.d.ts:116-117 MouseEvent.x/y, zIndex ×21, zero `savant-strict` on disk, savant-analyze/savant-scaffold variant files present). No new issues found.
- **GREEN:** No design changes required — converged design from Loop 1 confirmed.
- **AUDIT:** Method 1 (static): markdownlint 0 issues; template fields complete; status `analyzed`; signed `Savant`; FID only in `dev/fids/`. Method 2 (re-derivation): design still minimal, internally consistent, and reachable. Zero actionable improvements.
- **Termination:** Both criteria met — deep audit yielded zero actionable improvements, and the operator explicitly authorized autonomous execution (automation lvl 3 = Autonomous per `protocol.config.yaml` `session.autonomy_level: 3`). Loop advances to **IMPLEMENT**.
- **CHANGE DELTA:** 0% at convergence; implementation begins per operator authorization.

### Loop 3 (Implementation + Independent Verification — 2026-08-05)

- **RED (independent ground-truth):** Full working-tree sweep before implementing — every hardcoded `EDIT` mode ref inventoried (5 false positives from `CREDIT`/`EDITOR`; the rest real mode refs); `prebuild-agents.ts` auto-discovers `agents/savant/*.ts` so `savant-strict.ts` needs zero script changes; no agent-count/prompt assertions to break.
- **GREEN (implementation):** All 10 production changes landed — (1) `constants.ts`: `AGENT_MODE_TO_ID` keys `EDIT→HYBRID` + `STRICT: 'savant-strict'`, honest axis comment, new `MODE_DESCRIPTIONS` map; (2) `savant.ts`: `'strict'` added to `SystemPromptMode`, strict preamble/step prompts, and the ECHO-Phase-Gating section made mode-aware (strict replaces the Hybrid-Mode boilerplate); (3) new `agents/savant/savant-strict.ts`; (4) `settings.ts`: `DEFAULT_SETTINGS.mode = 'HYBRID'`, `LEGACY_MODE_MIGRATION += { EDIT: 'HYBRID' }`, `loadModePreference` fallback `'HYBRID'`; (5) handoff strings → HYBRID (`recorder.ts:94`, `savant-scaffold.ts`, `set-scaffold-complete.ts`, `use-scaffold-revert-subscriber.ts`, `use-chat-input.ts`, `cli-args.ts` — `--edit` flag kept, `index.tsx`); (6) `savant-free-agent-selection.ts` mapping; (7) `/mode:edit` kept as alias for `mode:hybrid` in slash-commands + registry + router-input test; (8) `segmented-control.tsx`: `Segment.description` + `onHoverChange` + 150 ms hover-intent grace (anti-flicker); (9) new `mode-hovertip.tsx` (absolute, bottom-anchored, zIndex, non-interactive) + `agent-mode-toggle.tsx` wiring with collapsed-button tip (input-not-focused) + stale-hover reset; (10) bundle regenerated (`prebuild:agents`) — `savant-strict` present, zero stale EDIT axis labels.
- **Tests:** new `mode-hovertip.test.tsx` (SSR markup), `mode-hovertip.render.test.tsx` (real frame-buffer verification via `@opentui/core/testing` `createTestRenderer` + `MockMouse` — proves the tip renders ABOVE the control in the actual rendered cells, appears on hover, stays hidden pre-hover; required two empirical harness fixes: `footerHeight: 0` or the content area is 0 rows, and async-paint delays between `renderOnce` loops), `savant-strict.test.ts` (strict prompt contract), settings migration tests; updated `agent-mode-toggle.test.ts` (4-mode axis + descriptions), `segmented-control.test.ts`, `command-args.test.ts`, `router-input.test.ts`; blanket `'EDIT'→'HYBRID'` in test fixtures (verified no message-content strings).
- **Docs:** `README.md` + `README.zh-CN.md` + `cli/release/README.md` — four-mode table (HYBRID/SCAFFOLD/STRICT/ANALYZE with contracts) + STRICT + hover-description bullets.
- **AUDIT (independent review + gates):** code-reviewer-deepseek-flash reviewed all changes — fixes applied: collapsed-tip hover-intent grace, stale-hover reset on mode change, coupling/enforcement-gap comments, and the render test as the headless terminal-smoke gate. Full gate battery: typecheck ×9 all exit 0; ESLint `--max-warnings 0` clean (4 import-order warnings in the new render test auto-fixed); `lint:md` 0 issues; CLI full suite 2825 pass / 0 fail / 18 skip; common 523/0; agents 5/5 (incl. strict contract); affected suites 106/0; Law-4 reachability greps green (HYBRID in toggle/settings/cli-args/index; STRICT in toggle/cli-args/savant-strict; `savant-strict` bundled; `MODE_DESCRIPTIONS` consumed outside constants).
- **CHANGE DELTA:** 100% — implementation complete, verified, and green.

### Missed Questions

1. **Label-only or full key rename?** → Full key rename (`EDIT` → `HYBRID`). The keys leak into `/mode` commands and persisted settings; a label-only change would keep lying at the command layer. Migration handles old values.
2. **Does `/mode:edit` break?** → No — kept as an alias for `mode:hybrid`, so muscle memory and existing scripts keep working.
3. **Is a FID really required per change in STRICT?** → Yes — that is the point of the mode. The Recorder creates a lightweight FID per change; the FID sidebar (harness-tracked per the earlier sidebar fix) renders it automatically. Users who want speed use HYBRID.
4. **Does STRICT hard-block writes?** → Not in this FID. Enforcement is prompt contract + FID-009 harness warnings at `warn`. Hard `block` mode remains explicitly deferred future work (FID-009).
5. **Default mode?** → HYBRID, unchanged from today's EDIT default.
6. **Keyboard cycle order?** → HYBRID → SCAFFOLD → STRICT → ANALYZE (default first, SCAFFOLD keeps its position relative to the default, STRICT as the new entry, ANALYZE last).
7. **Free (SavantFree) builds?** → Unaffected: the toggle and mode commands are already excluded (`IS_SAVANT_FREE`), only the `savant-free-agent-selection` mapping must recognize the new keys.
8. **Should STRICT get a confirm dialog like SCAFFOLD?** → No. SCAFFOLD's gate exists because it opens project-root writes; STRICT changes no permission boundary.
9. **Does the harness tracker (FID-009) change?** → No. Its `warn` receipts already fire in every mode; STRICT simply sets the prompt contract to match. Block-mode wiring is a separate FID.
10. **Do existing settings.json files break?** → No — `LEGACY_MODE_MIGRATION` gains `EDIT → HYBRID`, so stored `"mode": "EDIT"` loads as HYBRID.
11. **What about the stale comment "EDIT is the default strict ECHO loop"?** → Rewritten as part of the rename; it was the root lie this FID removes.
12. **Does STRICT change ANALYZE/SCAFFOLD prompts?** → No; both unchanged (read-only / umbrella-FID respectively).
13. **Floating hovertip or inline caption?** → Floating hovertip (the standard OpenTUI pattern the operator surfaced): all primitives verified in 0.2.2 (`position: 'absolute'` via status-bar precedent, `zIndex`, `MouseEvent.x/y`). No native Hovertip component ships in the pinned version (only 3 unrelated `hint` hits), so it is a ~15-line component built by hand. The inline caption is the documented fallback if absolute anchoring proves broken in the live terminal.
14. **What does the hovertip show when nothing is hovered?** → The active mode's description (the `> ACTIVE` segment is default-highlighted).
15. **Does the collapsed button get a hovertip too?** → Yes — when the input is not focused (expansion suppressed), hovering the collapsed button shows the current mode's description; when focused, the control expands on hover and the segment hovertips take over. `OPEN_DELAY_MS = 0` is unchanged.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation matches the proposed solution (Loop 3 implementation + independent review)
- [x] Typecheck passes: typecheck ×9 (agents + sdk/common/agent-runtime/cli + evals/code-map/database/llm-providers) all exit 0
- [x] FID status reflects actual state: `closed` — design converged through Loop 1, re-audited in Loop 2, implemented + verified in Loop 3
- [x] RED evidence verified against working tree: constants.ts:131-138, settings.ts:16-31/147/215, chat-store.ts:285/391-404, slash-commands.ts:22-27, command-registry.ts:653-655, agent-mode-toggle.tsx:106, savant.ts:468/471/493-495/709, recorder.ts:94 handoff — all present

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-05
- **Fix Description:** Renamed `EDIT` → `HYBRID` (honest label; behavior unchanged), added `STRICT` mode (`savant-strict`) guaranteeing the full Perfection Loop per change, kept `SCAFFOLD`/`ANALYZE`, migrated persisted `EDIT` values to `HYBRID` via `LEGACY_MODE_MIGRATION`, kept `mode:edit` alias, added a floating mode hovertip (absolute-positioned, non-interactive, anti-flicker grace) fed by `MODE_DESCRIPTIONS`, regenerated bundled agents, updated EN/zh-CN/npm READMEs.
- **Tests Added:** Yes — settings migration, 4-mode axis, toggle labels + descriptions, slash-command aliases, free-agent mapping, strict prompt contract, hovertip SSR markup, and a real frame-buffer hovertip render test (`createTestRenderer` + `MockMouse`).
- **Verified By:** Independent code review + full gate battery — typecheck ×9 exit 0, ESLint `--max-warnings 0` clean, `lint:md` 0 issues, CLI 2825/0, common 523/0, agents 5/5, affected suites 106/0, Law-4 reachability greps green, bundle regen verified.
- **Commit/PR:** uncommitted working tree (0.0.19 release candidate)
- **Archived:** 2026-08-05 — moved to `dev/fids/archive/` after Loop 3 implementation + verification; CHANGELOG entry appended.

## Lessons Learned

Labels are contracts. The mode toggle's `EDIT` label asserted a strict-ECHO-loop contract while the prompt it selected ran the hybrid flow — the same documented-intent vs. implemented-behavior gap FID-009 closed at the enforcement layer, here closed at the naming layer. A mode name should describe what the harness + prompt actually deliver, and a ceremony mode (STRICT) should be an explicit opt-in rather than a threshold the model may or may not escalate past. The data-driven `AGENT_MODES` axis made the cascade (toggle/slash/cycle/settings) nearly free; the only real work is the prompt variant and the persisted-value migration.
