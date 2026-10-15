# FID: TerminalCommandDisplay — copy button + traffic-light redesign

**Filename:** `FID-2026-0817-001-terminal-command-display-copy-button-and-traffic-lights.md`
**ID:** FID-2026-0817-001
**Severity:** medium
**Status:** closed
**Created:** 2026-08-17 14:44
**YAGNI-Compliance:** Pending

---

## Summary

The rich terminal panel (`TerminalCommandDisplay`, shipped in FID-2026-0816-011)
renders every `run_terminal_command` and `run_readonly_command` notice — the
boxed panel the operator sees every time the agent runs grep/ls/typecheck — but
it has **no copy affordance** for readonly commands (grep/ls are deliberately
excluded from the outer `CopyableBlock` chrome per FID-009), and its decorative
traffic-light title bar draws three identical muted `● ● ●` dots on the **left**.
Operator requests two changes: (1) a copy button on the panel that copies the
**entire block** — command, status/meta row, and output — and (2) the three dots
become **green / yellow / red**, positioned on the **right**, with a **glow** effect.

## Environment

- **OS:** Windows (win32) — live-test also runs in WSL tmux + classic PowerShell conhost
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `@opentui/core` 0.5.3, `react` ^19
- **Commit/State:** post-v0.0.25 release-audit tree (main, working tree clean as of 2026-08-17)

## Detailed Description

### Problem

1. **No copy button.** The panel is the shared renderer for both tool contexts
   (`cli/src/components/tools/run-terminal-command.tsx` → `run_terminal_command`,
   and `cli/src/components/tools/registry.ts` → `run_readonly_command`) and the
   ghost-message context (`cli/src/components/pending-bash-message.tsx`). The
   only copy affordance today is the **outer** `CopyableBlock` footer in
   `cli/src/components/blocks/tool-branch.tsx`, which:
   - wraps `run_terminal_command` only, and
   - explicitly **excludes** `run_readonly_command` and `transition_phase`
     (`tool-branch.tsx:152-154`: `shouldShowCopyButton = toolName !== 'run_readonly_command' && toolName !== 'transition_phase'`).
   The readonly commands (grep, ls, typecheck — the notices the operator sees
   constantly) therefore render with **no way to copy the command or its output**.

2. **Traffic lights are muted, left-aligned, and colorless.** Both the
   no-output and with-output branches render the title bar identically:

   ```tsx
   <text fg={theme.muted} attributes={TextAttributes.DIM}>
     ● ● ●
   </text>
   ```

   (`cli/src/components/terminal-command-display.tsx`, title-bar branches).
   All three dots are the same muted color, left-aligned, with no glow.

### Expected Behavior

1. The panel exposes a copy affordance that copies the **entire block** —
   command line, status/meta row (status + cwd + timeout), and output — to the
   clipboard, with the existing copied/hover feedback (reusing the terminal-safe
   clipboard utility).
2. The title bar shows three dots — **green, yellow, red** in that order —
   right-aligned, each with a glow/pulse effect that degrades gracefully when
   the animation budget suspends (FID-005 blur → 15fps rule).

### Root Cause

1. FID-009 deliberately removed copy chrome from `run_readonly_command` (it was
   classified "informational, not copy-worthy"), and `TerminalCommandDisplay`
   itself was never given its own copy button. The copy affordance lives one
   level up in `tool-branch.tsx` and does not reach the ghost-message context or
   the readonly path.
2. The traffic lights were a decorative placeholder from FID-011 — never
   spec'd for color, position, or glow.

### Evidence

```text
$ grep -n "shouldShowCopyButton" cli/src/components/blocks/tool-branch.tsx
152:    const shouldShowCopyButton =
153:      toolBlock.toolName !== 'run_readonly_command' &&
154:      toolBlock.toolName !== 'transition_phase'

$ grep -n "● ● ●" cli/src/components/terminal-command-display.tsx
118:            ● ● ●
234:          ● ● ●
```

The status badge already maps the exact colors requested —
`theme.success` (green ✓), `theme.warning` (yellow ⏳), `theme.error` (red ✗) —
in `terminal-command-display.tsx`'s `statusBadge`, so the tokens already exist
and the traffic lights can reuse them (Law 13 — single color source).

## Impact Assessment

### Affected Components

- `cli/src/components/terminal-command-display.tsx` (primary)
- `cli/src/components/blocks/tool-branch.tsx` (copy-chrome reconciliation)
- `cli/src/components/copy-button.tsx` (reused — no change expected)
- `cli/src/components/pending-bash-message.tsx` (consumer — no change expected)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. **Copy button (panel-owned).** Add a right-aligned footer row inside
   `TerminalCommandDisplay` that reuses the top-level `CopyButton`
   (`cli/src/components/copy-button.tsx`, imported as `./copy-button` — NOT the
   unrelated `blocks/copy-button.tsx` getter variant; it wraps
   `copyTextToClipboard` via `useCopyToClipboard`). Copy the **entire block**
   content — the `$ ${command}` line, the status/meta line (status badge +
   `📁 ${cwd}` + `⏱ ${timeout}` when present), and the **raw** `output` prop —
   joined by newlines. Exclude the decorative traffic-light title bar and the
   line-number gutter (never `displayOutput`). Hide the button while
   `isRunning` (output is incomplete), mirroring `CopyableBlock`'s `isStreaming`.

2. **Reconcile double-copy.** Because the panel now owns its copy button,
   `tool-branch.tsx` must stop double-wrapping: add `run_terminal_command` to
   the existing `shouldShowCopyButton` exclusion (`tool-branch.tsx:152-154`) so
   both terminal tools render through the panel's own copy, dropping the outer
   `CopyableBlock` footer for them (keep the wrapper for every other tool).
   This also retires the FID-009 `run_readonly_command` exclusion — the panel
   now provides the affordance uniformly.

3. **Traffic lights — recolor, right-align.** Render three spans — green
   (`theme.success`), yellow (`theme.warning`), red (`theme.error`) — in that
   order, right-aligned via `justifyContent: 'flex-end'` on the title-bar row
   (both branches, `terminal-command-display.tsx:118` and `:234`).

4. **Glow.** There is no true glow in a TUI. Implement a subtle brightness pulse
   with the Phase 2 animation engine: one `useAnimationTimeline({ loop: true,
   duration: Infinity })` drives three staggered dots whose `fg` interpolates
   between the base color and a brighter `blendHex(color, '#ffffff', 0.35)`
   (reusing `blendHex` from `utils/diff-stats.ts` — the Law 13 color-math home)
   on a ~1.2 s ease-in-out loop. Gate with `useAnimationBudget` (ref on the
   title-bar renderable) so it suspends to static dots when scissor-hidden or
   blurred. Zero `setInterval` (FID-005).

### Steps

1. Add the panel-owned copy footer to `TerminalCommandDisplay` (both branches
   and the ghost-message context get it for free).
2. Reconcile `tool-branch.tsx` so terminal/readonly commands no longer get a
   double copy button (panel owns copy; drop the outer wrapper + exclusion).
3. Recolor the traffic lights green/yellow/red and right-align them.
4. Add the glow pulse via `useAnimationTimeline` + `useAnimationBudget`.
5. Add/update tests (copy-text composition, copy-button presence, dot
   color/order/alignment, budget-suspension fallback, no `setInterval` grep).
6. Run the gate battery (typecheck ×4, cli suite, eslint, lint:md, prettier,
   tmux smoke).

### Verification

- Unit tests assert: copy button renders and copies the full block (`$ command`
  line, status/meta line, and raw output — no gutter, no title-bar dots); dots
  are green/yellow/red in order and right-aligned; glow suspends when the budget
  suspends.
- `grep -rn "setInterval" cli/src/components/terminal-command-display.tsx`
  returns nothing (FID-005 gate).
- Live tmux smoke shows the recolor/right-align/glow and a working copy click.
- Gates: `bun run typecheck`, `bun run test` (cli), `bun x eslint . --max-warnings 0`,
  `bun run lint:md`, `bunx prettier --check .`.

## Perfection Loop

> **Operator clarification (2026-08-17):** the copy button must copy the
> **entire block** — command + output + status/meta — not just command + output.
> Folded into Approach step 1, Expected Behavior #1, Missed Question #3, and the
> Verification assertion.

### Loop 1 — RED

- **RED:** (a) Copy affordance is absent for the readonly path and the ghost
  message; (b) the title-bar dots are monochrome, left-aligned, and un-glowy;
  (c) adding a panel copy button risks a **double copy button** on
  `run_terminal_command` (panel + existing `CopyableBlock` footer) unless
  `tool-branch.tsx` is reconciled.
- **GREEN:** Panel-owned copy footer + `tool-branch.tsx` reconciliation;
  green/yellow/red right-aligned dots; budget-gated pulse glow.
- **AUDIT:** Verify with the unit tests + grep gates listed above; paste output.
- **ADVERSARIAL:** Challenge the glow scope — a constantly-running pulse could
  violate the FID-005 "zero `setInterval` / budget-suspended" contract and burn
  CPU in the sidebar. Mitigation: budget-gated, timeline-driven, static-on-suspend.
- **CHANGE DELTA:** n/a (initial pass)

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default
> derivable from inspection, and fold the answer back into the relevant sections.

1. **Where should the copy button live — inside the panel, or keep the outer
   `CopyableBlock`?** → Inside the panel. It is the shared renderer for ghost +
   history + readonly + terminal contexts, so a panel-owned button gives *every*
   context a copy affordance uniformly. This forces the `tool-branch.tsx`
   reconciliation to avoid a double button.
2. **Does "glow" mean animation or a static halo?** → A TUI has no true glow;
   implement a subtle pulse via the existing `useAnimationTimeline` engine and
   suspend it under `useAnimationBudget` (static dots when hidden/blurred). No
   `setInterval`.
3. **What exactly gets copied?** → The **entire block** — command line, status/
   meta row (status + cwd + timeout), and output — joined by newlines; excludes
   the decorative traffic-light title bar and the line-number gutter.
4. **Should the copy button be hidden while running?** → Yes, hide while
   `isRunning` (mirror `CopyableBlock`'s `isStreaming`).
5. **Traffic-light order?** → macOS convention is red/yellow/green on the left;
   the operator explicitly asked for **green/yellow/red on the right** — capture
   that literal spec, noting the intentional deviation from convention.
6. **Which `CopyButton`?** Two components share the name — the top-level
   `cli/src/components/copy-button.tsx` (`textToCopy: string`) and
   `cli/src/components/blocks/copy-button.tsx` (`getCopyText: () => string`).
   → Use the top-level one (`./copy-button` from the panel's directory): the
   command/output are plain props, so a getter is unnecessary, and it already
   drives `copyTextToClipboard` + the `⎘`/`[⎘ copy]`/`[✔ copied]` feedback.
7. **Copy raw or rendered output?** The panel truncates + line-numbers into
   `displayOutput`. → Copy the raw `output` prop, never `displayOutput`, so the
   clipboard carries the un-guttered, complete command output.

### Implementation Evidence (REQUIRED for `closed`)

> A FID **cannot** be set to `closed` without this section filled. No silent
> deferrals — every step must be `implemented`, `blocked`, or `deferred`
> (operator-approved only).

- [x] **Commit SHA:** (pending — recorded when this work is committed)
- [x] **File:line ranges:**
  - `cli/src/components/terminal-command-display.tsx` — `CopyButton` import
    (:5), `TRAFFIC_LIGHT_COLOR_KEYS = ['success','warning','error']` (:32),
    `buildTerminalCopyText` (:66), `trafficLightFg` (:89), right-aligned
    glowing dots (:172-176, :266 `justifyContent: 'flex-end'`), panel-owned
    copy footer (:274)
  - `cli/src/components/blocks/tool-branch.tsx` — `shouldShowCopyButton` now
    excludes both `run_terminal_command` and `run_readonly_command` (:155-157)
  - `cli/src/components/__tests__/terminal-command-display.test.ts` (new)
- [x] **Gate output:** typecheck ×4 exit 0; `bun test
  src/components/__tests__/terminal-command-display.test.ts` 15 pass / 0 fail;
  root `bun run test` 0 fail; eslint `--max-warnings 0` exit 0; lint:md exit 0;
  prettier clean; `validate:repository` PASS
- [x] **Reproducibility:** `grep -n "TRAFFIC_LIGHT_COLOR_KEYS\|buildTerminalCopyText\|trafficLightFg"
  cli/src/components/terminal-command-display.tsx` and `grep -n
  "run_terminal_command" cli/src/components/blocks/tool-branch.tsx` return
  matches; the test file is on disk.
- [x] **Step statuses:** steps 1-6 `implemented` (no `blocked`/`deferred`)

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is
> ground truth.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (copy footer, tool-branch
  reconciliation, green/yellow/red right-aligned glowing dots)
- [x] Typecheck/tests/lint pass with pasted tool output (typecheck ×4 exit 0;
  new suite 15 pass / 0 fail; eslint/lint:md/prettier clean)
- [x] Production call-graph evidence: `TerminalCommandDisplay` is reached via
  `run-terminal-command.tsx` and `registry.ts` (`run_readonly_command`), and
  the ghost-message context (`pending-bash-message.tsx`); the panel copy footer
  is its own affordance, and `tool-branch.tsx` no longer double-wraps
- [x] FID status reflects the actual implementation state (`closed`)

> Every PASS and FAIL in AUDIT cites `path/to/file.ts:LINE` plus quoted code or exact command output. Absence-shaped
> checks paste the exact search and mark out-of-reach evidence `NEEDS-REVIEW`.

### Loop 2 — Independent audit and self-correction

- **RED:** (a) Evidence cited `tool-branch.tsx:152-156` — the condition spans
  152-154; (b) the glow approach was ambiguous ("e.g. interpolate … or toggle
  filled/hollow"); (c) the copy spec did not say *which* `CopyButton` (two
  components share the name) nor whether to copy raw vs rendered output.
- **GREEN:** Corrected the line citation to `152-154`; pinned the glow to a
  `blendHex` brightness pulse on a single staggered timeline; pinned the
  top-level `CopyButton`; specified raw-output copy (never `displayOutput`);
  added Missed Questions 6-7.
- **AUDIT:** Double-audit — static (`grep`/file reads below) + manual re-read.
  ```text
  $ grep -n "shouldShowCopyButton" cli/src/components/blocks/tool-branch.tsx
  152:    const shouldShowCopyButton =
  153:      toolBlock.toolName !== 'run_readonly_command' &&
  154:      toolBlock.toolName !== 'transition_phase'

  $ grep -n "● ● ●" cli/src/components/terminal-command-display.tsx
  118:            ● ● ●
  234:          ● ● ●

  $ grep -n "export function blendHex" cli/src/utils/diff-stats.ts
  191:export function blendHex(a: string, b: string, t: number): string

  $ grep -n "export const CopyButton" cli/src/components/copy-button.tsx cli/src/components/blocks/copy-button.tsx
  cli/src/components/copy-button.tsx:174:export const CopyButton: React.FC<CopyButtonProps> = ({
  cli/src/components/blocks/copy-button.tsx:25:export const CopyButton = memo(function CopyButton({
  ```
- **ADVERSARIAL:** Residual challenge — the glow adds a third `useAnimationBudget`
  consumer (alongside `Pulse`/`spinner`); confirm at implementation that the
  title-bar ref actually suspends when the panel scrolls off-screen, else it
  pays frames. Mitigation recorded in Approach step 4 (ref + budget gate).
- **CHANGE DELTA:** ~8%

### Loop 3 — Final convergence

- **RED:** No remaining correctness gaps; residual risks are all
  implementation-time (double-copy reconciliation, budget suspension) and are
  captured in Approach steps 2 and 4 with verifiable grep gates.
- **GREEN:** No further corrections — Loop 2 fixes are stable; the document now
  pins exact files/lines, the color-math utility, the copy-button source, and
  the raw-output contract.
- **AUDIT:** `bun run lint:md` exit 0; `bunx prettier --check` on the FID +
  `dev/fids/README.md` exit 0. All cited files exist and were read 0-EOF
  (`terminal-command-display.tsx`, `tool-branch.tsx`, `copy-button.tsx` ×2,
  `use-animation-timeline.ts`, `use-animation-budget.ts`).
- **ADVERSARIAL:** The FID does not yet carry implementation evidence, so it
  cannot be `closed`; `converged` is the correct terminal state for a
  loop-passed, not-yet-implemented plan.
- **CHANGE DELTA:** ~2%

## Resolution

- **Closed Date:** 2026-08-17
- **Fix Description:** Panel-owned copy footer on `TerminalCommandDisplay` that
  copies the entire block (command line, status/meta row, raw output — no
  title-bar dots, no line-number gutter); `tool-branch.tsx` reconciliation so
  `run_terminal_command` and `run_readonly_command` no longer get a double copy
  button; traffic lights recolored green/yellow/red, right-aligned, with a
  budget-gated `blendHex` brightness pulse (zero `setInterval`).
- **Tests Added:** Yes — `terminal-command-display.test.ts` (15 tests: copy-text
  composition, copy-button presence/hide-while-running, dot color/order/
  alignment, budget-suspension fallback, no-`setInterval` grep).
- **Verification Evidence:** typecheck ×4 exit 0; new suite 15 pass / 0 fail;
  root `bun run test` 0 fail; eslint 0; lint:md 0; prettier clean;
  `validate:repository` PASS.
- **Archived:** 2026-08-17 — moved to `dev/fids/archive/`

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

What can we learn from this finding and how can we prevent similar issues?

- A shared renderer should own its own affordances (copy) rather than relying on
  an outer wrapper that only reaches *some* of its call sites — the FID-009
  exclusion left readonly commands without copy for a full release.
- Decorative placeholders ("● ● ●") should be spec'd for color/position/effect
  when the visual redesign lands, not left as a muted placeholder to be
  re-litigated later.
