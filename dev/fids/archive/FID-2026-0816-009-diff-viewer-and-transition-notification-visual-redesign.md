# FID: Diff Viewer + Phase-Transition Notification — Visual Redesign

**Filename:** `FID-2026-0816-009-diff-viewer-and-transition-notification-visual-redesign.md`
**ID:** FID-2026-0816-009
**Severity:** medium
**Status:** closed
**Created:** 2026-08-16 18:00
**Closed:** 2026-08-16 (operator visual pass PASS — diff viewer confirmed;
phase bar renders identically in Cursor and classic PowerShell console)
**YAGNI-Compliance:** Complete

---

## Summary

Two low-quality terminal surfaces share one root cause — "correct but bare" —

and are redesigned together because both are leaf renderers in the same
transcript pipeline:

1. **Diff viewer** — every row is a flat full-width green/red tinted box with
   no container, header, line numbers, or sign gutter: "just green and red
   lines spanning the terminal." Redesign into a professional, structured diff
   block **on the working custom renderer** (the native `<diff>` renderable is
   out of scope — it painted nothing in the production renderer and was
   reverted in FID-2026-0816-006).

2. **Phase-transition notification** — `transition_phase` tool calls render
   through the unregistered-tool fallback as a bare one-line `┌─ Transition
   Phase ─┐` header with a muted sanitized-JSON fragment, collapsed by default.
   Redesign into a full-width, color-coded phase-transition bar. This one
   renderer covers *every* FSM transition (idle→red→green→audit→complete), so
   "all of the transition notifications" is a single fix point.

## Environment

- **OS:** Windows (win32); Git Bash shell
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** @opentui/core + @opentui/react 0.5.3
- **Commit/State:** main branch; uncommitted UI-overhaul working tree

## Detailed Description

### Problem A — bare diff rows

`DiffViewer` (FID-2026-0804-010) renders each parsed line as a bare
full-width `<box>` whose only styling is a background tint for add/remove rows.
It has no wrapper/border, no file/stat header, no line numbers, and the
`+`/`-` marker is just the first character of the content text rather than a
dedicated sign gutter. The result reads as unstructured color stripes.

### Problem B — bare transition notification

`transition_phase` is a real runtime tool
(`packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`) but is
**not** registered in the CLI's `toolComponentRegistry` (`registry.ts`). It
therefore falls through to the generic `ToolCallItem` fallback in
`tool-branch.tsx`, which is collapsed-by-default for unregistered tools and
shows only a muted italic sanitized-JSON fragment. The operator sees a
one-line "1-inch" `[Tool: transition_phase]` that carries no phase semantics,
no color, and no full-width structure — despite a phase visual language already
existing in the codebase.

### Expected Behavior

**Diff block** — a self-contained, professional diff:

- A bordered container (matching the existing code-block frame) that visually
  groups the diff and separates it from surrounding chat.
- A header strip: the edited file path (bold) + right-aligned `+N −M` counters.
- A fixed-width gutter: line numbers (old/new) in muted color, a colored sign
  column (`+`/`-`/` `), separated from the content.
- Hunk headers (`@@ -a,b +c,d @@ …`) as distinct full-width bars.
- Green/red tint applied deliberately (sign-column accent + row tint), with the
  marker column always distinguishable from context rows.

**Transition bar** — a full-width, color-coded notification:

- Full-width bar with a colored left accent + phase glyph + `Phase → Green`
  label, reusing the existing `phaseMapping(phase)` → `{ colorKey, glyph,
  label }` / `glyph()` / `resolveThemeColor()` helpers from
  `savant-ui/echo/phase-info.ts` + `phase-indicator.tsx`.
- The transition `reason` (from `input.reason`) rendered muted on the same bar,
  truncated (not wrapped) on narrow terminals.
- Not collapsed: the bar is the notification, always visible and scannable.

### Root Cause

The diff renderer was built for correctness only (tint semantics from
FID-2026-0804-010); the feature-rich native `<diff>` was meant to supply
structure in Phase 3 but rendered nothing and was reverted — leaving the
minimal custom renderer with no visual layer. The `transition_phase` tool has
no renderer at all, so it inherits the generic collapsed-tool fallback rather
than the phase visual language the sidebar already ships.

### Evidence

```text
$ grep -n "export type DiffLineKind\|export interface DiffLine\|export interface DiffStats\|export function parseDiffLines" cli/src/utils/diff-stats.ts
15:export type DiffLineKind = 'add' | 'remove' | 'context' | 'hunk' | 'header'
17:export interface DiffLine {
22:export interface DiffStats {
71:export function parseDiffLines(diffText: string): DiffStats {

> parseDiffLines classifies every row (add/remove/context/hunk/header) but
> drops line-number position; the `@@` hunk rows carry the old/new start line
> numbers as raw text only.

$ grep -n "export const DiffViewer\|lines.map\|backgroundColor: isAdd\|<text>" cli/src/components/tools/diff-viewer.tsx
31:export const DiffViewer = ({ diffText }: DiffViewerProps) => {
47:      {lines.map((line, index) => {
64:              backgroundColor: isAdd
71:            <text>

> Each line is a single <box width:100% backgroundColor={tint}> with no
> border, header, or gutter; the +/- marker is part of line.text.

$ grep -n "transition_phase" cli/src/components/tools/registry.ts
(no match — transition_phase has no registered renderer)

$ grep -n "renderToolComponent(toolBlock\|hasRegisteredComponent\|isCollapsed =\|<ToolCallItem" cli/src/components/blocks/tool-branch.tsx
44:    const toolRenderConfig = renderToolComponent(toolBlock, theme, {
52:    const hasRegisteredComponent = toolRenderConfig !== undefined
53:    const isCollapsed =
55:      (hasRegisteredComponent
164:              <ToolCallItem
186:          <ToolCallItem

> Unregistered tools collapse by default (isCollapsed = true) and render the
> generic ToolCallItem fallback.

$ grep -n "┌─ " cli/src/components/tools/tool-call-item.tsx
106:            <span fg={theme.muted}>{'┌─ '}</span>

$ grep -n "export function getToolDisplayInfo" cli/src/utils/savant-code-client.ts
125:export function getToolDisplayInfo(toolName: string): {

> getToolDisplayInfo capitalizes `transition_phase` → "Transition Phase";
> the bare `┌─ Transition Phase ─┐` header is the operator-visible result.

$ ls cli/src/components/savant-ui/echo/
phase-info.ts  phase-indicator.tsx  ...

> Existing phase visual language to reuse: phaseMapping(phase) →
> { colorKey, glyph, label }, glyph(), resolveThemeColor().
```

## Impact Assessment

### Affected Components

- `cli/src/components/tools/diff-viewer.tsx` — rewrite the row loop into a
  framed gutter layout.
- `cli/src/utils/diff-stats.ts` — extend parsing with line-number tracking
  (or add a pure `parseDiffHunks` helper) to feed the gutter.
- `cli/src/components/tools/registry.ts` — register the new transition
  renderer.
- `cli/src/components/tools/transition-phase.tsx` — **new** renderer reusing
  the `savant-ui/echo` phase visual language.
- `cli/src/components/tools/__tests__/diff-viewer.test.tsx` + new
  `diff-stats` and `transition-phase` tests — structural + line-number
  assertions.
- Consumers unchanged (`str-replace.tsx`, `apply-patch.tsx`,
  `implementor-row.tsx`) — `DiffViewer` keeps its `{ diffText }` contract;
  `transition_phase` gains a renderer without touching the runtime handler.

### Risk Level

- [x] Medium: visual-only changes to two leaf renderers + a pure parser
  extension + one registry entry. No data-flow, focus, or runtime-tool
  change.

## Proposed Solution

### Approach (A — diff)

Keep the proven custom path (`parseDiffLines` + box-based tinting — boxes own
`backgroundColor`, text does not). Add a structural layer around it, reusing
the code-block frame styling from `markdown-leaves.tsx` (`border: true`,
`borderStyle: 'rounded'`, `borderColor: dividerFg`,
`backgroundColor: codeBackground`, `paddingLeft/Right: 1`) so the diff block
reads as part of the same visual language. No native `<diff>`, no new
dependency.

Each row becomes a `flexDirection: 'row'` box:

- **line-number column** — fixed width, right-aligned, muted foreground. Old
  number for `context`/`remove`, new number for `add`, blank otherwise
  (computed from each `@@ -a,b +c,d @@` hunk start).
- **sign column** — one char (`+` green / `-` red / ` ` muted), tinted
  background on add/remove so the marker reads as a gutter accent.
- **content** — flex-grow, wrapped text.

Hunk rows render as full-width bars (`@@ … @@` in muted-on-tint). Header rows
(`diff --git`, `index`, `---`/`+++`) are collapsed into the header strip or
rendered muted, not as tinted content.

### Approach (B — transition notification)

Register a `TransitionPhaseComponent` in `registry.ts` that parses
`input.phase` + `input.reason` and renders a full-width bar:

- Left accent + phase glyph from `phaseMapping(phase)` (color via
  `resolveThemeColor`, glyph via `glyph`).
- `Phase → {label}` in bold, phase-tinted.
- `reason` in muted text on the same row, `wrapMode: 'none'` with truncation
  (never a wrap) at narrow widths.
- Always expanded (no collapse/toggle) — the bar *is* the notification.

The unregistered-tool fallback stays as-is for genuinely unknown tools; only
`transition_phase` gets the dedicated renderer (smallest change that fixes the
reported surface without redesigning every generic tool item).

### Steps

1. Add a pure line-number tracker to `diff-stats.ts` (augment `DiffLine` with
   `oldLine`/`newLine` computed from hunk headers; keep `parseDiffLines`
   backward-compatible or add `parseDiffHunks`).
2. Build a `DiffFrame` container (bordered, header strip: file path + `+N −M`).
3. Rewrite the `DiffViewer` row loop into the gutter layout (number + sign +
   content), with hunk bars and header collapse.
4. Keep the `DiffStatsBar` `[-N/+M]` footer contract intact.
5. Create `transition-phase.tsx` + register it in `registry.ts`.
6. Tests: `diff-stats` line-number unit tests (multi-hunk, create/delete,
   blank lines) + `diff-viewer` SSR structural assertions (gutter present,
   header present, add/remove rows still tinted) + `transition-phase` render
   assertions (glyph/phase/reason present, full-width bar).

### Verification

- typecheck ×4; `cli` suite; `eslint --max-warnings 0`; `lint:md`; prettier.
- tmux (WSL) smoke: trigger a multi-line edit (diff) and a phase transition
  (transition bar) and confirm both render at 80/120 cols.
- Operator visual pass (the deciding gate for a design task).

## Perfection Loop

### Loop 1 — RED

- **RED:** Bare full-width tinted rows (`diff-viewer.tsx`); no container,
  header, line numbers, or sign gutter; `transition_phase` has no renderer and
  falls through to the collapsed generic tool item (`tool-branch.tsx:44-186`).
- **GREEN:** Framed container + header strip + number/sign gutter + hunk bars;
  a dedicated full-width `transition_phase` bar reusing the
  `savant-ui/echo` phase language.
- **AUDIT:** Evidence pasted above (`diff-viewer.tsx:31,47,64,71`;
  `diff-stats.ts:15,17,22,71`; `registry.ts` no-match; `tool-branch.tsx:44-186`;
  `tool-call-item.tsx:106`; `savant-code-client.ts:125`).
- **ADVERSARIAL:** Claim "boxes own backgroundColor" — verified (the reason
  every tinted row is a box, not a text span). Claim "no new dependency" —
  correct: both designs are pure layout + a pure parser extension + an existing
  helper reuse.
- **CHANGE DELTA:** Rename + scope addition (second work item).

### Loop 2 — RED (line-number correctness)

- **RED:** Naive "line index" numbering would drift across hunks and on
  add/remove-only hunks; `parseDiffLines` discards the `@@` position.
- **GREEN:** Numbering derives from `@@ -a,b +c,d @@`: `context` prints
  `old/new` and advances both; `remove` prints `old` and advances old only;
  `add` prints `new` and advances new only. Empty/malformed hunks degrade to a
  blank gutter (never a wrong number).
- **AUDIT:** The `@@` line already carries the two start numbers as text;
  parsing them is a pure regex split.
- **ADVERSARIAL:** Edge cases enumerated — create-file (all `+`), delete-file
  (all `-`), hunks with `,0` counts, `\ No newline at end of file` markers
  (context row), and header-only diffs (no `@@`). Each resolves to a defined
  gutter state; none produces a fabricated number.
- **CHANGE DELTA:** ~10%.

### Loop 3 — RED (transition-bar reuse + phase coverage)

- **RED:** Does every FSM transition map to a defined visual state? Do
  `phaseMapping`/`glyph`/`resolveThemeColor` cover all `input.phase` values?
  Does the bar degrade on an unknown phase or missing reason?
- **GREEN:** Reuse `phaseMapping(phase)` (color/glyph/label) — the same source
  the sidebar consumes, so coverage matches it exactly. Unknown/missing phase
  degrades to a neutral glyph + the raw phase string; missing reason renders an
  empty muted segment (no fabricated text).
- **AUDIT:** `phaseMapping` is already exercised by `phase-indicator.tsx` /
  `right-sidebar.tsx`; the new renderer is a second consumer, not a fork.
- **ADVERSARIAL:** Claim "one renderer covers all transitions" — correct: every
  FSM transition is a `transition_phase` tool call; there is no other
  notification path. Claim "truncation not wrap" — verified against the
  `wrapMode: 'none'` precedent in `tool-call-item.tsx:104`.
- **CHANGE DELTA:** < 5%.

### Loop 4 — RED (operator feedback 2026-08-16: notices still low-quality)

- **RED:** Operator reports the transition/tool notices are *still* low
  quality after Loop 1-3. Two concrete gaps: (1) `run_readonly_command`
  results still render through the generic collapsed `ToolCallItem` fallback
  — it was never registered, so the shared `run_terminal_command` renderer
  never applied; (2) the `transition_phase` bar renders inside the
  `CopyableBlock` chrome (frame + copy button), which reads as clutter for a
  status notification.
- **GREEN:** (1) Register `run_readonly_command` with the shared
  `RunTerminalCommandComponent` — it shares the exact `command` +
  `terminalCommandOutputSchema` input/output shape with `run_terminal_command`
  (Law 13 — one renderer, two tools); (2) exclude `transition_phase` **and**
  `run_readonly_command` from the `CopyableBlock` copy-button chrome in
  `tool-branch.tsx` so both render as bare full-width notices.
- **AUDIT:** `registry.ts:57` — `['run_readonly_command',
  RunTerminalCommandComponent]` with the schema-reuse rationale comment;
  `tool-branch.tsx:150-154` — `shouldShowCopyButton` excludes both tool names;
  `tool-branch.tsx:183-201` — the no-copy-button branch renders the
  registered content directly. Registry-reuse test appended to
  `run-terminal-command.test.ts` proving `run_readonly_command` resolves to
  the shared renderer.
- **ADVERSARIAL:** Claim "same schema" — verified against the tool handler
  definitions (`run_terminal_command` and `run_readonly_command` share
  `command` input + `terminalCommandOutputSchema` output); the renderer is
  schema-driven, so reuse is safe, not a type lie. Claim "copy button is the
  remaining chrome" — verified: the bar itself was already full-width and
  phase-tinted from Loop 1-3; the operator-visible regression was the
  `CopyableBlock` frame wrapping it.
- **CHANGE DELTA:** ~5%.

### Loop 5 — RED (operator feedback 2026-08-16: brand header, idle contrast, ADVERSARIAL color)

- **RED:** Three issues on the transition bars: (1) no brand identity — the
  bar has no header; (2) the **idle** phase text is unreadable — root cause:
  `blendHex(color, background, 0.14)` interpolates *from* color toward
  background, so the idle chip is 86% `muted` = mid-tone gray, and the
  light-gray `muted` text on it vanishes; (3) `adversarial` shares RED's
  `error` color, so the meta-verification phase is indistinguishable from
  RED.
- **GREEN:** (1) Add a `SAVANT CODE` brand title bar (bold `primary` cyan)
  on its **own row** (on the neutral `surface`), with the phase label + reason
  on the phase-tinted body below — the brand is a header, not a side-by-side
  label (operator correction 2026-08-16); (2) idle inverts its phase text +
  reason to `theme.background`
  (near-black on dark) so it reads on the mid-tone gray chip, and its border
  uses `theme.border` (a gray border on a gray chip was invisible); (3) add a
  dedicated `phaseAdversarial` theme token (dark `#c084fc` violet-400, light
  `#7c3aed` violet-600) and point the `adversarial` mapping at it — distinct
  from RED/GREEN/AUDIT/COMPLETE. Because the bar and sidebar share
  `phaseMapping`, the sidebar's ADVERSARIAL indicator picks up the violet too.
- **AUDIT:** `transition-phase.tsx` — `isIdle` branch sets `phaseTextColor` /
  `reasonColor` to `theme.background` and `borderColor` to `theme.border`;
  header row renders `SAVANT CODE` in `theme.primary`. `theme-system.ts` +
  `palette.ts` (dark+light) + `icon-theme-keys.ts` + `phase-info.ts` carry
  the new `phaseAdversarial` token; `buildTheme` clones the palette base so
  the token persists through design-system/plugin merges. Tests:
  `transition-phase.test.tsx` asserts the header, the idle black text (no
  `muted` in idle markup), and the violet ADVERSARIAL (no `error` hex);
  `syntax-theme.test.ts` + `segmented-control.test.ts` fixtures updated for
  the new required field.
- **ADVERSARIAL:** Claim "idle chip is mid-tone gray" — verified against
  `blendHex` (`mix(x,y)=x+(y-x)*t`; `blendHex(muted, background, 0.14)` ≈
  86% muted ≈ `#7b7b85`), which is exactly why light-gray text was
  invisible. Claim "violet is distinct" — compared against every phase color
  in use (RED `#ff2d55`, GREEN `#39ff14`, AUDIT `#ff9500`, COMPLETE
  `#18faf9`); violet `#c084fc` is the only hue not already claimed. Claim
  "sidebar inherits the fix" — verified: `phase-indicator.tsx` and
  `right-sidebar.tsx` consume the same `phaseMapping`, so no second edit.
- **CHANGE DELTA:** ~8%.

### Loop 6 — RED (operator feedback 2026-08-16: terminal-uniform rendering)

- **RED:** The phase bar drifted between terminals — in Cursor it rendered
  with dark text on a colored chip, but in classic PowerShell conhost it
  collapsed to a white header + colored text on near-black. Mechanism:
  OpenTUI approximates every hex color to the nearest ANSI-16 name when
  truecolor is unavailable, and the 14% theme tint (`blendHex(color,
  background, 0.14)`) becomes "black background" — so `theme.foreground`
  (`#e4e4e8`) read as white, the neon phase colors became ANSI names, and
  `muted` read as silver. A tinted design cannot render identically across
  truecolor and ANSI-16 terminals.
- **GREEN:** Redesign the bar as a **filled chip** — solid phase-color
  fill (the fill IS the color; nothing to collapse) with **inverted text**:
  BLACK on bright fills, WHITE on the red fill (black-on-red unreadable —
  operator spec), computed via a new `relativeLuminance` (WCAG 2.x) with a
  0.25 floor so future dark fills never get invisible black text. Idle
  keeps the approved mid-tone gray (86% muted) with black text. The border
  darkens to a rim (`fill → bg` 45%) so the rounded frame stays visible.
- **AUDIT:** `transition-phase.tsx` — `fill` = solid phase color (idle =
  `blendHex(muted, background, 0.14)`); `onFill` =
  `isRed || (!isIdle && relativeLuminance(fill) < 0.25)` ? white : black,
  applied to the `SAVANT CODE` header, phase row, and reason; `rim` =
  `blendHex(fill, background, 0.45)`. `diff-stats.ts` — new
  `relativeLuminance` beside `blendHex`/`parseHex` (Law 13 color-math
  home). Tests: idle gray fill + black text, red→white, green→black,
  luminance suite (0/1 endpoints, neon ordering, 0.25 floor coverage,
  malformed→0). Operator confirmed **PASS in both Cursor and classic
  PowerShell console** (identical rendering) — the closure gate.
- **ADVERSARIAL:** Claim "the tint collapses to black bg under ANSI
  approximation" — verified against OpenTUI's color fallback (hex →
  nearest ANSI name when truecolor is absent; classic conhost reports no
  truecolor). Claim "filled chip is theme-independent" — the fill is the
  phase color itself, not a theme blend, so dark/light themes and
  truecolor/ANSI-16 terminals all render the same fill + inverted text.
  Claim "white on red, black elsewhere matches operator spec" — operator
  feedback 2026-08-16: "all text is black with colored background except
  for red, on red background all text is white".
- **CHANGE DELTA:** ~6%.

## Missed Questions

1. "Should create/delete files show a diff?" → Create shows the header strip
   + `+N` only (all-additions); delete shows `−N` only. No fake empty diff.
2. "Long lines / narrow terminals?" → Content wraps (`wrapMode`), the gutter
   stays fixed, and the container never forces horizontal scroll; the
   transition `reason` truncates instead of wrapping.
3. "Do we re-try the native `<diff>`?" → No — out of scope; it blanked in
   production (FID-2026-0816-006). The custom renderer is the shipped path.
4. "Should the generic unregistered-tool fallback also be redesigned?" → No —
   out of scope. Only `transition_phase` gets a dedicated renderer; the
   fallback is left for genuinely unknown tools.

## Code Verification Evidence

> FID metadata is a claim; code is ground truth. Verified before planning.

- [x] Files referenced exist (`diff-viewer.tsx`, `diff-stats.ts`,
  `tool-branch.tsx`, `tool-call-item.tsx`, `registry.ts`,
  `savant-code-client.ts`, `savant-ui/echo/phase-info.ts`,
  `savant-ui/echo/phase-indicator.tsx`; evidence above with exact line
  numbers)- [x] Implementation matches the Proposed Solution — both specs implemented
  on the custom renderer + existing phase helpers; no native `<diff>`, no new
  dependency (see Resolution)
- [x] FID status reflects the actual implementation state — `closed` =
  implementation exists + gates pass + operator visual pass recorded
  (see Resolution)

## Resolution

- **Closed Date:** 2026-08-16 — operator visual pass PASS (diff viewer
  confirmed working; the filled-chip phase bar renders identically in
  Cursor and classic PowerShell console)
- **Fix Description:** Both redesign specs implemented (all six steps, none
  deferred):
  - `diff-stats.ts` — `parseDiffLines` now tracks `oldLine`/`newLine` from
    each `@@ -a,b +c,d @@` header (context advances both, remove advances
    old only, add advances new only; zero-start sides and malformed hunks
    degrade to a blank gutter — never a fabricated number). New
    `getDiffHeaderPath` extracts the `+++ b/…` / `+++b/…` file target for
    the header strip.
  - `diff-viewer.tsx` — `DiffViewer` is now a bordered rounded container
    (`borderColor: theme.border`, `backgroundColor: theme.surface`) with a
    header strip (bold file path + `+N −M` counters, U+2212 minus) and a
    dual old/new line-number gutter + sign column per row. Content drops the
    `+/−/space` prefix (it moved into the sign column). Hunk rows render as
    full-width tinted bars (`diffHunkHeader`-derived blend); `diff --git` /
    `index` / `---` / `+++` metadata rows render muted in `theme.diffMeta`.
    `DiffStatsBar` `[-N/+M]` footer contract untouched.
  - `transition-phase.tsx` (new) + registry wiring — every `transition_phase`
    tool call now renders a full-width, phase-tinted bar instead of the
    collapsed generic tool item: phase glyph + `Phase → GREEN` + muted reason
    (truncated, never wrapped). Reuses `phaseMapping`/`glyph()`/`resolveThemeColor`
    from `savant-ui/echo` — the same source the sidebar consumes.
  - `phase-info.ts` — added the missing `adversarial` phase mapping
    (phaseAudit glyph, error color); previously it fell back to IDLE/muted in
    the sidebar AND the new bar would have mis-colored ADVERSARIAL.
  - Loop 4 (operator feedback 2026-08-16): `registry.ts` now registers
    `run_readonly_command` with the shared `RunTerminalCommandComponent`
    (identical schema — Law 13 reuse) so readonly-command notices render like
    `run_terminal_command` instead of the generic collapsed fallback;
    `tool-branch.tsx` excludes `transition_phase` and `run_readonly_command`
    from the `CopyableBlock` copy-button chrome so both render as clean
    full-width notices with no frame/copy clutter.
  - Loop 5 (operator feedback 2026-08-16): the bar now carries a `SAVANT
    CODE` brand title bar on its **own row** (on the neutral `surface`), with
    the phase label + reason on the phase-tinted body below; the **idle**
    chip inverts its phase text + reason to
    `theme.background` (near-black on dark) because the idle chip is 86%
    `muted` (mid-tone gray) and light-gray text on it was unreadable, and its
    border switches to `theme.border`; ADVERSARIAL gets its own violet
    `phaseAdversarial` theme token (dark `#c084fc`, light `#7c3aed`) instead
    of sharing RED's `error` — the sidebar picks it up automatically via the
    shared `phaseMapping`.
  - Loop 6 (operator feedback 2026-08-16 — terminal-uniform rendering):
    the bar is now a **filled chip** — solid phase-color fill with
    **inverted text** (BLACK on bright fills, WHITE on the red fill),
    computed via new `relativeLuminance` in `diff-stats.ts` with a 0.25
    floor; idle keeps the mid-tone gray chip + black text; border darkens
    to a rim. Renders identically in truecolor (Cursor / Windows Terminal)
    and ANSI-16 fallbacks (classic PowerShell conhost) — the 14% tint that
    collapsed to "black bg + white header" is gone.
- **Tests Added:** `diff-stats.test.ts` line-numbering suite (single hunk,
  multi-hunk reset, zero-start create/delete, malformed hunk, header/hunk
  no-numbers, `getDiffHeaderPath`); `diff-viewer.test.tsx` rewritten for the
  framed layout (header strip, gutter numbers via `/>14</`-style text nodes,
  tint preservation, no-tint-for-meta); `transition-phase.test.tsx` (phase
  label + reason, glyph from shared mapping, ADVERSARIAL, missing-phase
  null) ; `apply-patch.test.tsx` updated for the marker-moved-to-gutter
  structure.
- **Verification Evidence:** typecheck ×4 exit 0; cli suite **3158 pass /
  0 fail**; `eslint --max-warnings 0` exit 0; `lint:md` exit 0; prettier
  clean; tmux (WSL) launch smoke clean. Operator visual pass **PASS**
  (2026-08-16): diff viewer + transition-bar checks B/C/D confirmed, and
  the filled-chip phase bar renders identically in Cursor and classic
  PowerShell console (uniformity check passed).
- **Archived:** 2026-08-16 → `dev/fids/archive/`

> This FID deliberately stays on the **custom** diff renderer: the native
> `<diff>` renderable remains out of scope (production-blanked, reverted in
> FID-2026-0816-006).

### Step-Level Accounting (anti-deferral)

| Step | Status |
| --- | --- |
| 1. Line-number tracker in `diff-stats.ts` (`oldLine`/`newLine`, `getDiffHeaderPath`) | `implemented` |
| 2. `DiffFrame` container + header strip (path + `+N −M`) | `implemented` |
| 3. Gutter row layout (old # + new # + sign + content), hunk bars, muted meta | `implemented` |
| 4. `DiffStatsBar` footer contract kept | `implemented` |
| 5. `transition-phase.tsx` renderer + registry entry | `implemented` |
| 6. Tests (diff-stats lines, diff-viewer structure, transition render) | `implemented` |
| 7. Loop 4: register `run_readonly_command` (shared renderer) + drop copy-button chrome on both notices | `implemented` |
| 8. Loop 5: `SAVANT CODE` header, idle black text, ADVERSARIAL violet token | `implemented` |
| 9. Loop 6: filled-chip phase bar (`relativeLuminance`-inverted text, terminal-uniform) | `implemented` |

## Lessons Learned

- A "correct" renderer without a visual container reads as noise, not a
  feature; structure (frame, header, gutter, hunk bars) is part of the
  correctness of a diff view, not decoration.
- Reusing the code-block frame and the existing phase visual language keeps a
  terminal UI visually coherent across surfaces (Law 7/11/13) instead of
  inventing a second container or phase dialect.
