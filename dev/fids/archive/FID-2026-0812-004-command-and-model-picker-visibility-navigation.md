<!-- markdownlint-disable MD013 -->

# FID: Slash Command and Model/Provider Picker Visibility and Navigation

**Filename:** `FID-2026-0812-004-command-and-model-picker-visibility-navigation.md`
**ID:** FID-2026-0812-004
**Severity:** medium
**Status:** closed
**Created:** 2026-08-12
**YAGNI-Compliance:** Verified

> This FID contains no author or agent attribution, per the single-agent ECHO signing policy. The primary `/model` correction and shared picker implementation are present; this FID was active only for residual direct evidence. The broader planning language below is historical context, not a claim that the landed implementation is absent or that new production work is authorized.

---

## Summary

The slash-command and picker implementation is present and the operator confirmed the primary `/model` defect is resolved. The operator also confirmed all residual provider/model picker checks passed across the intended interaction paths. This archived FID completed its local lifecycle closure; no picker behavior remains pending in this release scope. No provider behavior, model routing, sidebar policy, Savant-Free release work, or unrelated UI redesign is included.

## Current Status Reconciliation (2026-08-12)

- **Landed:** Exact `/model` ranking/selection, shared terminal-aware picker viewport, provider/model selection normalization, and focused regression coverage.
- **Operator-confirmed:** Typing `/model` correctly highlights/selects the model option; the original `/mode` confusion is not a current blocker.
- **Operator-confirmed:** The residual provider/model picker checks passed, including short-terminal behavior, scrolling/range handling, resize, focus, keyboard/mouse navigation, Enter/Escape behavior, and persistence.
- **Resolved:** No residual picker defect remains; the original `/model` ranking/selection issue and the broader interaction checks are accepted.
- **Closure requirements:** local implementation audit and lifecycle reconciliation only; no picker redesign is reopened.
- **Historical boundary:** Earlier problem/root-cause/loop sections preserve the original pre-fix symptoms and are not a claim that `/model` ranking remains broken.

## Environment

- **OS:** Windows workstation; cross-platform terminal behavior required
- **Language/Runtime:** TypeScript, Bun 1.3.14, React 19, OpenTUI 0.2.2
- **Tool Versions:** ECHO Protocol v0.2.0; single-agent ECHO adaptation v0.1.2; strict mode enabled
- **Commit/State:** `main`, dirty working tree containing pending v0.0.23 work; implementation and operator-confirmed interaction evidence are present, with local lifecycle closure completed
- **Governance:** `ECHO-single-agent.md` and `dev/echo-v0.1.2-single-agent.md` were read 0-EOF before authoring and looping this FID
- **Scope boundary:** Savant-Free is deferred/pending and is excluded from this FID

## Detailed Description

### Problem

The original picker surfaces combined three defects. The exact `/model` ranking/selection defect and the residual provider/model viewport and interaction checks are operator-confirmed resolved. The historical remaining work was local lifecycle closure only:

The original picker surfaces combined three defects:

1. The provider picker renders every provider at intrinsic height. This is correct only when the entire box fits inside the bottom chat panel. In a short terminal, the parent layout can clip or scroll the picker, making the complete provider list hard to inspect.
2. The model picker intentionally renders a fixed `MAX_VISIBLE = 12` item viewport. The underlying catalog remains searchable, but the visible panel does not clearly communicate that the list is a bounded viewport over a larger grouped result set, and the fixed height is not derived from the terminal height or the available bottom-panel space.
3. Slash command matching and selection are not tested as a single end-to-end contract. The command data contains a bare `mode` command and generated `mode:<name>` commands with `model:<name>` aliases, while paid builds also contain a distinct bare `model` picker command. The visible first row can therefore be confused with `/mode` during incremental typing or stale-index rendering even when the final command should be `/model`.

### Expected Behavior

#### Slash autocomplete

- Typing `/model` produces a deterministic match set whose exact `model` command is ranked ahead of any broader alias/substring match.
- The visible selection corresponds to the current filtered array on the same render; it must not temporarily point at an item from the prior query while the user types.
- `/mode`, `/model`, `/mode:<name>`, and the legacy mode aliases remain distinct and executable according to the existing command registry. This FID must not remove valid mode commands or rename public command IDs.
- Selection reset, keyboard up/down, Tab/Shift-Tab behavior, Enter execution, completion, click selection, and Escape closing remain consistent.
- A regression test proves the paid command list returns `model` for query `model` and does not place bare `mode` ahead of it.

#### Provider picker

- The picker is fully visible whenever the terminal has enough space.
- When the provider count exceeds the available picker viewport, the picker uses a bounded scrollable viewport rather than being clipped by the bottom panel.
- The header/footer communicates the total provider count and visible range or an equivalent unambiguous scroll affordance.
- Arrow, Tab, Shift-Tab, Enter, Escape, and mouse selection operate on the complete provider array, not only the visible slice.
- The initial selection policy remains intentional and documented: preserve the existing first-unconfigured-provider default unless a stronger current-provider signal is already available through the established store contract.
- Provider identity, configured status, labels, ordering, and registry-derived setup behavior remain unchanged.

#### Model picker

- The model catalog remains a full searchable catalog; this FID does not hardcode a small availability list or remove models to make the panel fit.
- The picker viewport is derived from available terminal height and the surrounding bottom-panel constraints, with safe minimum and maximum bounds. It must not claim that every model is simultaneously rendered when the catalog is larger than the terminal.
- The header/footer clearly reports the active query, total matching model count, and whether the current result is a viewport over more items. Group headers do not become selectable model entries.
- The selected model remains visible while navigating and filtering. Navigation skips provider headers and wraps through model entries only.
- Query changes reset selection to the first selectable model and reset the viewport anchor synchronously enough that a stale prior index cannot make the first visible row appear selected incorrectly.
- Empty, one-result, many-result, and catalog-outage/degraded-catalog states remain usable.
- Existing exact model IDs, provider prefixes, persistence, and generic routing remain unchanged.

### Root Cause

#### Slash matching and selection

`cli/src/data/slash-commands.ts` defines the bare `mode` command and appends generated mode commands before the paid `model` command. Generated mode entries have aliases such as `model:<mode>`. `cli/src/hooks/suggestion-engine/filters.ts:15-91` performs prefix and substring matching in separate passes and preserves source order within each pass. `cli/src/hooks/use-suggestion-engine.ts:159-174` derives matches from the current query, while `cli/src/chat/use-chat-suggestions.ts:145-166` resets `slashSelectedIndex` in an effect after context/match changes. `cli/src/components/command-palette.tsx:54-157` renders the parent-controlled index but does not own or synchronously normalize it. `cli/src/chat/keyboard.ts:184-209` executes or completes `slashMatches[slashSelectedIndex]` with a first-item fallback. This leaves a timing and ranking contract that is not directly tested for `/model`; a stale index or broad match ordering can make `/mode` appear selected while typing.

`cli/src/commands/command-registry.ts:40-48,135-155` resolves runtime commands by first name/alias match. The paid build filters out `end-session`, whose `model` alias is retained only in Savant-Free data; this distinction is not currently exercised together with autocomplete filtering in one regression test.

#### Provider/model viewport

`cli/src/components/provider-picker.tsx:10-13,88-145` computes height as provider count plus two frame rows and renders all providers directly. It has no terminal-height input, no bounded viewport, and no scroll container. `cli/src/chat/panels.tsx:215-237` mounts the picker inside `BOTTOM_BOX_STYLE`, which is explicitly non-growing and therefore can become the clipping boundary for an intrinsic-height picker.

`cli/src/components/model-picker.tsx:14,125-156` uses a fixed `MAX_VISIBLE = 12`, slices grouped model/header items into that viewport, and sets the scrollbox height to `viewportHeight + 1`. The calculation does not account for the terminal height or the remaining bottom-panel space, and its header only reports total filtered model count without a visible-range/scroll context. The model selection index is an item index that includes non-selectable provider headers; navigation compensates for this, but selection validity and visible-window behavior are not covered by focused component tests.

### Evidence

The evidence below was read from the current working tree before this FID was authored:

- `cli/src/data/slash-commands.ts:20-43` defines bare `mode` and generated `mode:<name>` entries; generated aliases include `model:<name>`.
- `cli/src/data/slash-commands.ts:225-252` defines the paid `model` and `provider` commands after `MODE_COMMANDS`.
- `cli/src/hooks/suggestion-engine/filters.ts:15-91` performs prefix/alias matching, then substring/alias matching, and preserves source order in each pass.
- `cli/src/hooks/use-suggestion-engine.ts:159-174` computes slash matches from `slashContext.query` and the filtered command list.
- `cli/src/chat/use-chat-suggestions.ts:145-166` resets and clamps `slashSelectedIndex` through React effects after query/match changes.
- `cli/src/components/command-palette.tsx:54-157` clamps only for rendering and delegates navigation/execution to the parent.
- `cli/src/chat/keyboard.ts:184-209` handles slash navigation, execution, and completion; execution falls back to `slashMatches[0]` when the selected index is unavailable.
- `cli/src/commands/command-registry.ts:40-48,135-155` uses first name/alias match for runtime routing.
- `cli/src/components/provider-picker.tsx:10-13` returns `providerCount + 2`, and `:88-145` renders the full provider list with no viewport or scrollbox.
- `cli/src/chat/panels.tsx:215-237` mounts provider/model pickers inside the non-growing bottom box.
- `cli/src/components/model-picker.tsx:14,125-156` defines the fixed 12-item viewport and slices the grouped item list.
- `cli/src/state/provider-picker-store.ts:31-50` initializes selection to the first unconfigured provider.
- `cli/src/state/model-picker-store.ts:44-64` initializes model selection to index 0 and resets it on every query change.

### Impact Assessment

#### Affected Components

- `cli/src/hooks/suggestion-engine/filters.ts` — deterministic slash-match ranking, if the existing filter utility is extended
- `cli/src/hooks/use-suggestion-engine.ts` or `cli/src/chat/use-chat-suggestions.ts` — query/index synchronization, only where the existing ownership seam requires it
- `cli/src/components/command-palette.tsx` — render-time selection contract and optional visible-range affordance
- `cli/src/chat/keyboard.ts` and/or `cli/src/chat/use-chat-keyboard.ts` — safe selection normalization if required by the chosen design
- `cli/src/components/provider-picker.tsx` — terminal-aware bounded viewport and scroll/navigation rendering
- `cli/src/components/model-picker.tsx` — terminal-aware viewport, result context, selectable-item indexing, and scroll anchoring
- `cli/src/chat/panels.tsx` / `cli/src/chat/styles.ts` — only if the existing bottom-panel layout needs a minimal overflow-safe contract
- `cli/src/state/model-picker-store.ts` and `cli/src/state/provider-picker-store.ts` — only if selection/index state needs a reusable normalization helper; no parallel state system
- `cli/src/components/__tests__/provider-picker.test.ts` and new focused model/command-palette/filter tests
- Existing keyboard/router/suggestion tests that cover the public contracts

#### Out of Scope

- Removing or renaming `/mode`, `/model`, mode aliases, provider IDs, or model IDs
- Changing provider registry contents, provider routing, API credentials, model persistence, or catalog-fetch semantics
- Replacing the existing OpenTUI/React picker architecture with a new UI framework
- Making the full model catalog render simultaneously regardless of terminal size
- A general chat-layout rewrite, sidebar redesign, or theme redesign
- Savant-Free changes or release artifact work; Savant-Free remains deferred/pending
- Release, tag, push, publication, deployment, unrelated dirty-tree cleanup, or mass documentation rewrite

#### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Interactive feature degraded; command/picker workarounds exist
- [ ] Low: Minor cosmetic issue only

## Proposed Solution

### Approach

**Historical converged approach:** Use the existing controlled picker and suggestion architecture, but make selection and viewport behavior explicit and testable. The solution has three coordinated parts.

**Current verification scope:** Do not rework exact `/model` ranking or selection. Verify and, only if observed, correct the residual provider/model viewport, scrolling, resize, focus, navigation, and persistence behavior.

1. **Deterministic slash-command ranking and index synchronization**
   - Preserve the existing match categories, but rank an exact command ID match ahead of prefix/alias/substring matches. For query `model`, the bare `model` command must be the first result in the paid build; `/mode` must not be admitted as an exact `model` match.
   - Keep the filter pure and reusable. Do not add a second `/model` special case in the renderer.
   - Normalize the selected index against the current selectable match list whenever the query/result set changes. Selection reset must happen at the state ownership seam, not only as a post-render visual clamp.
   - Keep command execution safe if an index is temporarily out of range: do not silently execute an unrelated first command. Use the current valid selection or no-op until the state is normalized.
   - Add focused tests for `model`, `mode`, `mode:`, `model:hybrid`, aliases, paid/free gating where test isolation permits, query transitions (`/m` → `/mo` → `/mod` → `/mode` and `/m` → `/mo` → `/mod` → `/model`), Enter, completion, and click mapping.

2. **Shared terminal-aware picker viewport contract**
   - Add one small pure sizing/viewport helper in the existing CLI component/state seam rather than duplicating height arithmetic in model and provider pickers. The helper accepts terminal height and reserved surrounding rows, then returns a safe visible-row count and whether scrolling is required.
   - The helper must reserve the picker title, border, footer/scroll hint, and the existing bottom-panel/cwd/input rows. It must clamp to a minimum usable viewport and a maximum that prevents the picker from taking over the entire terminal. The exact constants must be named and tested.
   - Feed `terminalHeight` (already available to `ChatLayout`) into both pickers. If passing it through props is the least invasive established pattern, use that; otherwise use the existing `useTerminalDimensions` hook consistently. Do not invent a global layout singleton.
   - Provider picker: replace unbounded intrinsic height with a scrollbox or equivalent bounded list, keeping the complete provider array and selected index. Show a concise total/viewport hint when scrolling is active.
   - Model picker: retain grouped headers and full filtering, but calculate viewport from the helper, scroll only the grouped render window, and ensure the selected model—not a header—remains visible. Show query, total matches, and a scroll/range hint.
   - Ensure overlay/picker rows have `flexShrink: 0` where required and that the surrounding bottom panel cannot silently shrink list rows into clipped content.

3. **Regression and live verification**
   - Add pure helper tests for viewport sizing, selected-index normalization, selectable-index navigation, and exact slash ranking.
   - Add focused component/contract tests for provider/model counts, header exclusion, selection visibility, empty catalogs, one-result catalogs, and large catalogs.
   - Run CLI typecheck, focused tests, changed-file ESLint, and Prettier. Run the relevant complete CLI test suite before implementation closure.
   - Run `bun dev` in a direct operator session after implementation and inspect `/model` and `/provider` at normal, short, and wide terminal heights. Confirm all entries remain reachable, the selected row is correct, typing `/model` highlights `/model`, and no test depends on tmux or a binary.

### Design decisions and non-negotiable invariants

- The model catalog remains complete and searchable; bounded rendering is a viewport concern, not a data truncation concern.
- `/model` exact ID ranking wins over source-order coincidence, but valid mode aliases remain available when their full query is typed.
- A stale selection must never execute a different command or model. The safest fallback is no-op plus state normalization, not first-item execution from a changed result set.
- Provider/model picker navigation operates on the complete logical list even when only a window is rendered.
- Provider and model pickers share viewport math; no duplicate magic height formulas.
- Existing provider order, configured status, active model persistence, generic routing, and registry-derived data remain unchanged.
- Terminal-height limitations are handled in code and tested. Live visual inspection remains required for final renderer behavior; it cannot be replaced by unit tests.
- No production implementation occurs until this FID reaches COMPLETE and the operator approves the converged plan.

### Verification plan

FID Perfection Loop evidence:

```text
1. RED: source evidence, call graph, existing tests, and all issues cataloged.
2. GREEN: exact implementation seam, invariants, missed questions, and test plan documented.
3. AUDIT: independent static review plus command/test evidence; every claim cites path:line or exact output.
4. ADVERSARIAL: fresh challenge of ranking, stale-index execution, viewport clipping, accessibility, and scope.
5. COMPLETE: only after zero actionable planning findings; then present for operator approval.
```

Implementation verification after approval:

```text
bun run --cwd=cli typecheck
bun test cli/src/hooks/__tests__/ cli/src/components/__tests__/ cli/src/commands/__tests__/ cli/src/utils/__tests__/
bunx eslint <changed-files> --max-warnings 0
bunx prettier --check <changed-files>
bun run typecheck
bun run test
bun x eslint . --max-warnings 0
bun run lint:md
bunx prettier --check .
```

Direct operator verification after implementation:

- Start `bun dev` directly in the harness; do not use tmux, a binary, or Savant-Free.
- Type `/m`, `/mo`, `/mod`, `/mode`, and `/model`; verify exact-result ranking and highlight behavior at each step.
- Open `/provider` at normal and short terminal heights; verify the complete provider set is reachable, the current row stays visible, and the scroll hint/range is truthful.
- Open `/model`; verify total result count, query filtering, grouped provider headers, keyboard navigation, mouse selection, and exact model persistence.
- Resize the terminal while each picker is open and verify no row clipping, impossible selection, or input focus trap.
- Verify Escape closes the picker and Enter selects only the currently highlighted logical item.

## Perfection Loop

> The loop entries below preserve the original pre-fix planning and convergence trail. Their descriptions of `/model` confusion are historical. The current implementation state and narrowed pending scope are authoritative in **Current Status Reconciliation** and **Resolution** above/below.

### Loop 1 — RED

- **RED:** Identified three linked defects: source-order/alias ranking does not have a direct `/model` contract; slash index reset is effect-based and execution falls back to the first result; provider picker height is unbounded while model picker uses a fixed 12-item viewport inside a non-growing bottom panel. Existing tests cover provider-height arithmetic only and do not cover the model picker, command palette, exact slash ranking, or stale-index transitions.
- **GREEN:** Proposed deterministic exact-ID ranking, state-owner index normalization, safe no-op rather than unrelated first-item fallback, and a shared terminal-aware viewport helper used by both pickers. Preserved complete catalogs and existing provider/model semantics.
- **AUDIT:** PASS — source seams and call graph are present: `filterSlashCommands` is consumed by `useSuggestionEngine`; `slashSuggestionItems` flows through `useChatSuggestions` → `ChatLayout` → `ChatInputBar` → `CommandPalette`; `providerPicker` and `modelPicker` stores flow through `useChatPickers` → `ChatLayout` → `ChatLayout` picker components. The current provider and model picker code confirms the proposed seams are reachable without new architecture.
- **ADVERSARIAL:** FAILED — the initial plan did not explicitly require a no-op execution policy for stale command indices, did not require a shared sizing helper, and did not state that live catalog data must never be truncated. These findings are addressed in Loop 2.
- **CHANGE DELTA:** Initial planning pass; no production implementation changed.

### Missed Questions

1. **Does “show the full list” mean render every model at once?** → No. The catalog remains complete and searchable; the terminal renders a bounded, navigable viewport with truthful counts and scroll context. Rendering hundreds of rows at once would cause clipping and harm usability.
2. **Should `/mode` be removed because it is confused with `/model`?** → No. `/mode` is a valid public command. The fix is deterministic exact-ID ranking and index synchronization, not command removal.
3. **Should an invalid/stale selection fall back to the first item?** → No. That can execute an unrelated command after filtering changes. Normalize state and no-op if no current selection exists.
4. **Can provider/model viewport calculations be separate?** → No. They share the same terminal/bottom-panel constraints and must use one tested helper to avoid drift.
5. **Should provider ordering or initial unconfigured selection change?** → No. Preserve registry-derived order and the existing first-unconfigured default unless implementation evidence proves a separate defect.
6. **Can the model catalog be truncated to make it fit?** → No. Only rendering is bounded; filtering and exact free-text selection remain complete.
7. **Are unit tests enough to certify layout?** → No. Unit/static tests cover math and contracts; a direct `bun dev` operator session is required for final visual evidence.
8. **Does this FID include Savant-Free?** → No. Savant-Free is explicitly deferred/pending and excluded.
9. **Should the picker become a full-screen modal?** → Not by default. Reuse the current inline/bottom-panel architecture unless live evidence proves it cannot satisfy bounded visibility without a broader layout change; any such expansion requires a FID update before implementation.
10. **What if the terminal is too short even for the minimum viewport?** → Keep a minimum one-row logical viewport, preserve keyboard reachability, and show an explicit compact state; never silently clip rows or claim all entries are visible.

### Code Verification Evidence

- [x] Referenced production and test files were read 0-EOF or inspected through complete file reads before authoring.
- [x] Production call-graph seams are documented with source citations.
- [x] Proposed changes reuse existing filter, store, picker, and layout paths.
- [x] Production implementation matches the approved picker/autocomplete seams.
- [x] Typecheck/tests/lint pass — focused validation: 77 tests passed, CLI typecheck passed, ESLint passed with zero warnings, and Prettier passed.
- [x] Direct operator evidence: `/model` correctly highlights/selects the model option.
- [x] Direct operator evidence for residual provider/model viewport behavior — operator confirmed all requested checks passed.
- [x] FID status reflects the current implementation state: fixed; implementation, focused validation, and live interaction verification are complete.

> Historical planning note: the original loop below was authored before the current implementation evidence and operator confirmation. Its planning-only statements are retained for audit history and do not supersede the current reconciliation above.

### Loop 2 — Independent audit and self-correction

- **RED:** Fresh review challenged whether exact ranking alone would solve a stale visual selection, whether a model/provider shared helper could be introduced without duplicating layout ownership, whether grouped model headers would corrupt selection indices, and whether the “full list” requirement could be misread as data truncation.
- **GREEN:** Strengthened the plan with state-owner normalization, no-op stale execution, a single pure viewport helper, explicit selectable-header exclusion, truthful visible-range messaging, and a complete-catalog invariant. Added direct query-transition and large/short-terminal operator cases.
- **AUDIT:** PASS — `cli/src/components/model-picker.tsx:121-156` proves grouped items and the current fixed viewport are centralized in the component; `cli/src/components/provider-picker.tsx:88-145` proves provider rendering is centralized and currently unbounded; `cli/src/state/model-picker-store.ts:44-64` and `cli/src/state/provider-picker-store.ts:31-50` prove selection state has a single store owner per picker; `cli/src/chat/panels.tsx:215-237` proves both pickers share the bottom-panel mount. The corrected plan assigns viewport math to one helper while preserving each picker’s existing logical-item behavior.
- **ADVERSARIAL:** PASS — no unresolved planning contradiction remains. The FID now explicitly prevents command hijacking, stale fallback execution, model data truncation, provider-order drift, and Savant-Free scope creep.
- **CHANGE DELTA:** Self-correction pass; no production implementation changed.

### Loop 3 — Final convergence

- **RED:** Final challenge focused on the reported `/model` symptom: the bare `model` command must be tested independently from `mode:<name>` aliases and runtime command resolution; visual selection must be synchronized before Enter can act. It also challenged whether picker height could exceed the available bottom-panel space after accounting for title, footer, cwd, and input rows.
- **GREEN:** Added explicit paid-build exact-ranking tests, query-transition tests, runtime `findCommand('model')` parity checks, no-unrelated-fallback execution, and a viewport helper contract that reserves surrounding bottom-panel rows and exposes a compact minimum state. Added direct operator checks for typing transitions and short terminals.
- **AUDIT:** PASS — `cli/src/data/slash-commands.ts:225-252` provides distinct paid `model`/`provider` definitions; `cli/src/commands/command-registry.ts:135-155` provides the runtime resolution seam; `cli/src/chat/keyboard.ts:184-209` provides the execution/completion seam; `cli/src/components/model-picker.tsx:125-156` and `cli/src/components/provider-picker.tsx:88-145` provide the viewport/render seams. The final plan includes a test and implementation requirement for each seam and does not rely on unverified browser/tmux evidence.
- **ADVERSARIAL:** PASS — the FID is converged. It does not remove valid commands, truncate catalog data, change provider/model routing, or silently claim terminal-only visual behavior is unit-tested. All actionable planning findings are addressed, and the only remaining gate is operator approval before production implementation.
- **CHANGE DELTA:** Final convergence pass; no production implementation changed.

### Loop 4 — Historical current-scope convergence under master FID-2026-0812-006

> Historical loop entry. The later operator-confirmed picker closure in Loop 7 is authoritative for the current state.

- **RED:** Re-audited the picker record against the then-current `/model` confirmation before the residual checks were completed.
- **GREEN:** Restricted the then-current verification scope to short-terminal visibility, scrolling, resize, focus, navigation, and persistence while preserving picker invariants.
- **AUDIT:** PASS — the then-current reconciliation and implementation seams were cited.
- **ADVERSARIAL:** PASS — no unrelated picker, routing, or Savant-Free scope was introduced.
- **CHANGE DELTA:** Historical current-scope reconciliation; no production implementation changed.

### Loop 6 — Historical operator picker closure reconciliation

> Historical loop entry. Loop 7 is the authoritative current closure reconciliation.

- **RED:** Reconciled the picker boundary against the operator's confirmation that the residual checks passed.
- **GREEN:** Preserved provider order, model data, viewport architecture, routing, and Savant-Free boundaries.
- **AUDIT:** PASS — picker seams and focused validation were recorded.
- **ADVERSARIAL:** PASS — no unrelated behavior or unsupported scope was introduced.
- **CHANGE DELTA:** Historical operator-confirmed picker closure; documentation only.

### Loop 7 — Operator-confirmed picker closure reconciliation

- **RED:** Reconciled the remaining picker boundary against the operator's confirmation that all residual checks passed beyond the known `/model` fix.
- **GREEN:** Closed the residual evidence scope without changing provider order, model data, viewport architecture, routing, or Savant-Free boundaries.
- **AUDIT:** PASS — picker implementation seams remain `cli/src/components/model-picker.tsx:95-156` and `cli/src/chat/panels.tsx:213-237`; focused validation recorded 77 passing tests; and the operator confirmed the live short-terminal, scrolling, resize, focus, keyboard/mouse, Enter/Escape, and persistence checks.
- **ADVERSARIAL:** PASS — no `/mode` regression, catalog truncation, provider-routing change, or unsupported visual claim is introduced; local lifecycle closure is complete.
- **CHANGE DELTA:** Operator-confirmed picker closure; documentation only.

### Loop 8 — Local lifecycle closure

- **RED:** Reconciled the operator-confirmed `/model` and residual picker checks with the landed implementation and focused test evidence. No picker behavior remains pending in this release scope.
- **GREEN:** Closed only the picker scope. Preserved full catalog behavior, provider order, routing, persistence, Savant-Free exclusion, and the bounded viewport architecture.
- **AUDIT:** PASS — focused picker/autocomplete/router evidence includes 77 passing picker tests and the individually rerun relevant picker, suggestion, router, and model-catalog tests; CLI typecheck passed. The local FID ledger and documentation gates are run after the archive move.
- **ADVERSARIAL:** PASS — no `/mode` regression, catalog truncation, provider-routing change, unsupported visual claim, release action, or GitHub operation is introduced.
- **CHANGE DELTA:** Lifecycle closure only; no production implementation change.

## Resolution

- **Closed Date:** 2026-08-12
- **Fix Description:** Exact `/model` ranking/selection and shared terminal-aware picker viewport are implemented. Operator confirmation resolves the residual provider/model viewport and interaction evidence boundary.
- **Tests Added:** Yes — shared picker viewport, selectable-index, slash-ranking, query-transition, provider viewport, and runtime `/model` resolution coverage.
- **Verification Evidence:** Focused picker/autocomplete/router set: 77 passed; CLI typecheck, changed-file ESLint, and Prettier passed. Operator confirmed `/model` correctly selects the model option and confirmed all residual provider/model picker checks passed in the live harness.
- **Archived:** Moved to `dev/fids/archive/` after closure; no remote or GitHub operation is involved.

## Lessons Learned

- A bounded viewport is not the same as a truncated catalog; the UI must make that distinction visible.
- Selection state must be normalized at the state ownership seam, not merely clamped during rendering.
- Exact command ranking and runtime command resolution are separate contracts and require separate tests.
- Bottom-panel overlays must account for the complete terminal budget, not only their own intrinsic content height.
- Direct operator sessions are the authoritative check for terminal clipping and focus behavior; automated tests should make the expected contract precise but must not invent visual PASS evidence.
