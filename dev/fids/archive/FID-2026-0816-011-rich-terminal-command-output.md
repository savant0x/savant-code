# FID: Rich Terminal Command Output Redesign

**Filename:** `FID-2026-0816-011-rich-terminal-command-output.md`
**ID:** FID-2026-0816-011
**Severity:** medium
**Status:** closed
**Created:** 2026-08-16 22:05
**Closed:** 2026-08-16 (operator visual pass PASS — check G in live test)
**Author:** Orchestrator

---

## Summary

The shared `TerminalCommandDisplay` component (used by both `run_terminal_command`
and `run_readonly_command`, in both ghost-message and history contexts) renders
command output as flat, unstructured inline text — green `$` + bold command,
then dumped muted-gray output with an underlined web-style "Show more" link. It
looks nothing like the rest of the Savant UI family (diff viewer, transition bar,
easter egg). This FID specifies a **Rich Terminal** redesign: a bordered rounded
panel with decorative traffic-light title bar, command row, status badge, meta
row (cwd/timeout), line-numbered output gutter, and a clean terminal-style
expand/collapse.

## Environment

- **OS:** Windows 11 (win32, Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14, React 19.2.8, OpenTUI 0.5.3
- **Commit/State:** main@HEAD + uncommitted UI-overhaul working changes
- **Design contract:** savant-cyberpunk (near-black `#050508` + cyan `#18faf9`)

---

## Detailed Description

### Problem

`cli/src/components/terminal-command-display.tsx` renders command output with
zero visual hierarchy. The current render is:

```text
$ npm test (30s)
PASS src/__tests__/foo.test.ts
PASS src/__tests__/bar.test.ts
4 passed, 0 failed
              [ Show 42 more lines ]
```

Five specific defects:

1. **No container** — output bleeds into surrounding message text with no frame,
   no border, no separation. Contrasts sharply with the diff viewer and
   transition bar, both of which use bordered rounded containers.
2. **No status indication** — success (exit 0) and failure (non-zero/null) look
   identical. The operator must read the output to know if a command failed.
3. **No metadata display** — `cwd` is silently dropped; `timeout` is crammed
   inline next to the command with no visual weight.
4. **Web-style expand/collapse** — an underlined link (`UNDERLINE` attribute)
   that belongs on a website, not in a terminal UI. Breaks the OpenTUI aesthetic.
5. **No line numbers** — long outputs are hard to reference ("scroll up to line
   42").

### Expected Behavior

Command output should render as a self-contained **Rich Terminal** panel — a
bordered rounded container (the established Savant grammar from the diff viewer)
with a decorative title bar, clear command + status + metadata rows, and a
line-numbered output body with a clean expand/collapse toggle.

### Root Cause

`TerminalCommandDisplay` was built as a minimal inline renderer and never received
the visual-identity pass that the diff viewer (FID-2026-0816-009) and transition
bar got. It predates the UI overhaul.

### Evidence

- `cli/src/components/terminal-command-display.tsx:73-90` — command header is
  a bare `<text>` with `$` + bold command + optional inline timeout label.
- `cli/src/components/terminal-command-display.tsx:113-141` — output is a muted
  `<text>` with no container, no gutter, no status.
- `cli/src/components/terminal-command-display.tsx:133-141` — expand/collapse is
  a `Button` with `UNDERLINE` text attribute (web-style link).
- `cli/src/components/tools/run-terminal-command.tsx:21-48` —
  `parseTerminalOutput` extracts `stdout`/`stderr`/`errorMessage`/`startingCwd`
  from the JSON value but **discards `exitCode`**, so the renderer cannot show
  success/failure status today.
- `cli/src/components/tools/registry.ts:68,78` — `RunTerminalCommandComponent`
  is registered for both `run_terminal_command` and aliased to
  `run_readonly_command` (line 68: `['run_readonly_command',
  RunTerminalCommandComponent]`).
- `cli/src/components/pending-bash-message.tsx:42-51` — confirmed ghost-message
  path: the pending-bash ghost renders through `TerminalCommandDisplay`, passing
  `isRunning={message.isRunning}` and `cwd={message.cwd}`. The component is used
  in BOTH contexts.

---

## Impact Assessment

### Affected Components

- `cli/src/components/terminal-command-display.tsx` — the renderer (full rewrite)
- `cli/src/components/tools/run-terminal-command.tsx` — must pass `exitCode`
  through to the renderer
- `cli/src/components/tools/__tests__/run-terminal-command.test.ts` — tests must
  be updated for the new structure + new `exitCode` extraction
- `cli/src/components/pending-bash-message.tsx` — ghost message automatically
  gets the redesign (shared component); verify the dashed-border ghost container
  still composes correctly with the new panel

### Risk Level

- [x] **Medium:** Feature degraded (cosmetic), workaround exists (the current
  renderer still works — it just looks bad). No functional breakage.

---

## Proposed Solution

### Approach — Option C: Rich Terminal

Full bordered-rounded-panel renderer reusing the established diff-viewer grammar
(container → header strip → body → footer). Same panel in both ghost-message
(pending bash) and history contexts.

### Target render

```text
╭─ ● ● ● ───────────────────────────────────╮
│ $ npm test                                 │
│ 📁 ~/dev/savant-code    ⏱ 30s    ✓ success │
│                                            │
│  1 │ PASS src/__tests__/foo.test.ts       │
│  2 │ PASS src/__tests__/bar.test.ts       │
│  3 │ 4 passed, 0 failed                   │
│                                            │
│              [ Show 42 more ]              │
╰────────────────────────────────────────────╯
```

### Steps

1. **`run-terminal-command.tsx` — enhance `parseTerminalOutput`** to extract
   `exitCode` from the JSON value and return it as `exitCode?: number`.
   `exitCode` may be `number | null | undefined` (null = signal/timeout,
   undefined = no result yet, number = exit code). Forward it to
   `TerminalCommandDisplay` as a new prop.

2. **`terminal-command-display.tsx` — full Rich Terminal redesign:**
   - New prop: `exitCode?: number | null`
   - Note: `isRunning` is an **existing prop** (already passed by
     `pending-bash-message.tsx:47`); the status badge uses it, no new prop
     needed for running-state.
   - **Container:** bordered rounded box (`border: true, borderStyle: 'rounded'`,
     neutral `backgroundColor: theme.surface`) — terminal output is not
     phase-specific, so a neutral surface (not phase-tinted) is correct.
   - **Title bar:** decorative traffic lights (`● ● ●` in `theme.error` /
     `theme.warning` / `theme.success`) on their own row.
   - **Command row:** green `$` + bold white command + **status badge**:
     - `✓` green if `exitCode === 0`
     - `✗` red if `exitCode !== undefined && exitCode !== 0` (covers non-zero
       number AND null = signal/timeout)
     - `⏳` amber if `exitCode === undefined && isRunning`
     - omitted if `exitCode === undefined && !isRunning`
   - **Meta row:** `📁 cwd` pill + `⏱ timeout` pill (only rendered when the
     value is present).
   - **Output body:** muted-gray line-number gutter (`  1 │`, `  2 │`) +
     output text. Preserves leading whitespace (tree/table output). Gutter
     hidden when `availableWidth < 50` (no room for the ~5-char gutter +
     readable content).
   - **Expand/collapse:** clean terminal-style toggle — NO underline web link.

3. **Tests** — update `run-terminal-command.test.ts`:
   - Existing tests stay green (`collapsedPreview`, `parseTerminalOutput`,
     registry reuse, leading-whitespace preservation).
   - Add: `exitCode` extraction test (number, null, undefined cases),
     status-badge logic test, render smoke test for the new panel structure.

### Verification

- `bun run --cwd=cli typecheck` exit 0
- `bun test cli/src/components/tools/__tests__/run-terminal-command.test.ts`
  green
- `bun run lint:md` exit 0
- Visual pass in terminal (tmux) for both ghost-message and history contexts

---

## Perfection Loop

### Loop 1 — RED

- **RED:** Cataloged five specific defects in `TerminalCommandDisplay`
  (no container, no status, no metadata display, web-style expand, no line
  numbers) with file:line evidence. Confirmed `exitCode` is discarded in
  `parseTerminalOutput` (`run-terminal-command.tsx:21-48`), preventing any status
  indication today. Confirmed the component renders in both ghost-message
  (`pending-bash-message.tsx:42-51`) and history (`run-terminal-command.tsx:55-68`)
  contexts via the shared import.
- **GREEN:** Specified Option C Rich Terminal — full bordered-rounded panel,
  traffic-light title bar, command row + status badge, meta row (cwd/timeout),
  line-numbered output gutter, clean expand/collapse. Backward-compatible props
  interface (additive-only `exitCode?`), so the ghost message (no exitCode)
  renders without a status badge.
- **AUDIT:** Independent Verifier audit found 3 FAILs + 4 NEEDS-REVIEWs:
  - **FAIL** `isRunning` prop inconsistency → resolved: `isRunning` is an
    *existing* prop (already used by `pending-bash-message.tsx:47`); no new prop
    needed.
  - **FAIL** container tint unspecified → resolved: terminal output is not
    phase-specific; spec now says `theme.surface` (neutral).
  - **FAIL** exitCode null handling missing → resolved: badge logic now covers
    `null` (signal/timeout → `✗` red) in addition to `number` and `undefined`.
  - **NEEDS-REVIEW** `parseTerminalOutput` exitCode claim → verified against
    `run-terminal-command.tsx:21-48`: function reads JSON but only returns
    `{ output, startingCwd }`. FID correct.
  - **NEEDS-REVIEW** ghost-message render path → verified against
    `pending-bash-message.tsx:42-51`: confirmed shared component usage. FID
    correct.
  - **NEEDS-REVIEW** line-number toggle mechanism → clarified: gutter is
    width-based only (hidden <50 cols); no separate prop. Width is the sole
    condition.
  - **NEEDS-REVIEW** leading-whitespace/gutter interaction → addressed: gutter
    adds ~5 chars (`  N │`); wrapping math subtracts gutter width from
    available width, and leading whitespace is preserved within the remaining
    space. At <50 cols the gutter is hidden entirely, avoiding the problem.
- **ADVERSARIAL:** _(pending — see Loop 2)_
- **CHANGE DELTA:** FID rewritten to resolve all FAILs and close all
  NEEDS-REVIEWs. ~40% of document text changed.

### Missed Questions

1. **Does the ghost message path pass `exitCode`?** → No — ghost messages are
   pending bash with no result yet, so `exitCode` is `undefined`. The renderer
   renders the `⏳` amber badge (because `isRunning` is true) or no badge
   (if not running). `isRunning` is an existing prop, already wired.
2. **Does `run_readonly_command` also flow through this component?** → Yes —
   `registry.ts:68` aliases it to `RunTerminalCommandComponent`. Both tools get
   the redesign automatically. No extra wiring needed.
3. **Does the diff-viewer bordered-container pattern work with dynamic content
   inside?** — Yes — the transition bar already nests a title box + body box
   inside a rounded container. Same grammar applies.
4. **What happens with very narrow terminals (the <60-col sidebar collapse
   breakpoint)?** — The panel uses `width: '100%'` and wraps by word. The
   line-number gutter (~5 chars) is hidden when `availableWidth < 50`, leaving
   full width for content.
5. **Does the leading-whitespace preservation interact badly with the gutter?**
   — The gutter consumes ~5 chars of width; wrapping math (`getLastNVisualLines`)
   subtracts gutter width from available width so wrapped content accounts for
   it. Leading whitespace is preserved within the remaining content width. At
   <50 cols the gutter disappears entirely, so narrow terminals revert to the
   current full-width behavior. The diff-viewer's `parseDiffLines` precedent
   proves leading-whitespace preservation works alongside a structured renderer.

### Loop 2 — ADVERSARIAL

- **ADVERSARIAL:** Meta-verification of the Verifier's findings:
  - **Traffic lights add visual noise** → **REFUTED**: universally recognized
    terminal-chrome convention; signals "this is a command window" instantly.
    The transition bar already uses decorative branding (the `SAVANT CODE`
    title bar) — this is the same class of chrome.
  - **Line numbers add width** → **REFUTED**: gutter hidden <50 cols; at ≥50
    cols there is room for a ~5-char gutter + 45+ chars of content.
  - **Status badge duplicates exit code in output** → **REFUTED**: at-a-glance
    status is the whole point (operator currently must read output to know
    success/failure).
  - **`isRunning` FAIL is a false positive** → **REFUTED**: the Verifier flagged
    that `isRunning` was referenced in Missed Questions but not listed as a new
    prop — but it is an *existing* prop (verified at
    `pending-bash-message.tsx:47`). The FID now makes this explicit.
  - **Container tint FAIL** → **CONFIRMED and FIXED**: "phase-tinted" was
    wrong; corrected to `theme.surface`.
  - **exitCode null FAIL** → **CONFIRMED and FIXED**: badge logic now covers
    null (signal/timeout).
- **CHANGE DELTA:** FID unchanged after adversarial — all findings resolved in
  Loop 1. Converged.

---

## Resolution

- **Closed Date:** 2026-08-16 — operator visual pass PASS (check G: rich
  terminal panel confirmed in the live closure test)
- **Fix Description:** Rich Terminal panel redesign of
  `TerminalCommandDisplay` — bordered rounded container on `theme.surface`;
  decorative traffic-light title bar (`● ● ●` in error/warning/success);
  command row with green `$` + bold command + status badge (✓ green on
  exitCode 0, ✗ red on non-zero/null, ⏳ amber while running, omitted when
  not running); meta row with `📁 cwd` + `⏱ timeout` pills (only when
  present); line-number gutter (`  N │`) hidden below 50 cols; clean
  expand/collapse (no underline web link). `parseTerminalOutput` now
  extracts `exitCode?: number | null` from the JSON value and forwards it
  (was parsed then discarded); ghost-message (`pending-bash-message.tsx`)
  and history contexts share the component; `run_readonly_command` aliased
  via registry.
- **Tests Added:** `run-terminal-command.test.ts` — `exitCode` extraction
  (number/null/undefined), status-badge logic, panel render smoke; existing
  tests (collapsedPreview, parse, registry reuse, whitespace) stay green.
- **Verification Evidence:** cli typecheck exit 0; cli suite **3158 pass / 0
  fail**; `eslint --max-warnings 0` exit 0; `lint:md` exit 0; prettier
  clean; operator visual pass PASS (2026-08-16) — closure gate met.
- **Archived:** 2026-08-16 → `dev/fids/archive/`

> When status is set to **closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

- The shared `TerminalCommandDisplay` was the last major component that hadn't
  received the UI-overhaul visual-identity pass. The diff viewer and transition
  bar now have a consistent grammar; this closes the gap.
- `exitCode` was being parsed out of the JSON value but immediately discarded —
  a classic "data available but not plumbed" defect. Always check whether parsed
  data is actually consumed.
- The ghost-message path (`pending-bash-message.tsx`) already passed `isRunning`
  and `cwd` to the shared component — meaning those props exist and are wired.
  Before flagging a "missing prop" in a shared component, grep all consumers to
  distinguish "new prop needed" from "existing prop, just not documented in the
  FID".
- Terminal output is not phase-specific, so the phase-tinting technique from
  `transition-phase.tsx` does not apply. Use a neutral `theme.surface`
  background instead.
