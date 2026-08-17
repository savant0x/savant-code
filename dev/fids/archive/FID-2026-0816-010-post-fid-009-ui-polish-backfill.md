# FID: Post-FID-009 UI polish backfill — mode-selector cyan strokes + reactive trust matrix

**Filename:** `FID-2026-0816-010-post-fid-009-ui-polish-backfill.md`
**ID:** FID-2026-0816-010
**Severity:** medium
**Status:** closed
**Created:** 2026-08-16 22:00
**Closed:** 2026-08-16 (operator visual pass PASS — checks E/F in live test)
**YAGNI-Compliance:** Complete

---

## Summary

Backfill FID for two UI changes made during the post-FID-009 polish stretch
**without a formal FID**: (1) the mode-selector chips next to the input box
(`AgentModeToggle` collapsed button + `SegmentedControl` expanded list) turned
their stroke `theme.foreground` (off-white) on hover — the operator wants the
brand cyan; (2) the sidebar **Adversarial Trust Matrix** was a permanent,
expanded-by-default, amber-heavy panel that mounted on *any* provenance event
(signed or not) and never cleared its status — redesigned into a reactive,
collapsed, status-driven surface. The Perfection Loop surfaced four loose ends
that are folded back in: three remaining white hover-stroke spots
(`build-mode-buttons.tsx`, `load-previous-button.tsx`,
`chatgpt-connect-banner.tsx`) and an honesty gap in the trust-matrix resolved
count (`no_verdict` must not read as "verified").

## Environment

- **OS:** Windows (win32); Git Bash shell
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** @opentui/core + @opentui/react 0.5.3
- **Commit/State:** main branch; uncommitted UI-overhaul working tree

## Detailed Description

### Problem A — mode-selector hover stroke is white

The mode chips next to the input (`< HYBRID` collapsed button and the expanded
HYBRID / STRICT / ANALYZE / … segmented list) set their border/frame to
`theme.foreground` (off-white `#e4e4e8` on dark) on hover/highlight. On the
near-black/cyan Savant palette this reads as a stray white stroke. Operator:
"all of those have a white stroke, the stroke needs to be cyan."

### Problem B — trust matrix is not reactive

The sidebar `Adversarial Trust Matrix` was mounted whenever
`provenanceEvents.length > 0` (any event, signed or not — so it appeared even
when nothing was signed, showing a placeholder), was `defaultExpanded`, and
rendered every receipt as a full row (a `TRUST MATRIX · SIGNED EVENTS` header,
full file path, signature status, verdict text) forever. `pending` rows stayed
"awaiting audit" indefinitely and resolved rows never left the live list — a
permanent amber wall that read as errors. Operator: "it's not reactive, it's
always there no matter if the item is signed or not and never clears the
status."

### Expected Behavior

- **Mode chips:** the hover/highlight stroke is the brand cyan
  (`theme.primary`), not off-white.
- **Trust matrix:** mounts only when at least one **signed** receipt exists;
  collapsed by default with a live status dot (amber while work is in flight,
  green when everything resolved); only `pending` receipts render as live
  rows; terminal receipts collapse into a count; rows are compact (basename,
  no redundant internal header).

### Root Cause

- **A:** hover/highlight emphasis used `theme.foreground` — the off-white text
  color — instead of the brand `theme.primary`.
- **B:** the sidebar mount condition was `provenanceEvents.length > 0`
  (includes unsigned events), `defaultExpanded` was set, and the renderer
  showed every row regardless of status with no terminal-state cleanup. There
  was no concept of "active vs resolved", so the panel was permanent and
  non-reactive.

### Evidence

```text
$ grep -n "theme.foreground : theme.border\|frameColor = isHighlighted" cli/src/components/agent-mode-toggle.tsx cli/src/components/segmented-control.tsx
cli/src/components/agent-mode-toggle.tsx:247: borderColor: isCollapsedHovered ? theme.foreground : theme.border,
cli/src/components/segmented-control.tsx:201: const frameColor = isHighlighted ? theme.foreground : theme.border

$ grep -n "provenanceEvents.length > 0\|defaultExpanded" cli/src/components/right-sidebar.tsx
327: {provenanceEvents.length > 0 && (
329:   <SidebarSection title="Adversarial Trust Matrix" defaultExpanded>

> The trust matrix mounted on ANY provenance event (signed or not) and was
> expanded by default; rows never cleared their status.
```

## Impact Assessment

### Affected Components

- `cli/src/components/agent-mode-toggle.tsx` — collapsed mode-button hover
  border → `theme.primary`.
- `cli/src/components/segmented-control.tsx` — highlighted/hovered segment
  frame → `theme.primary`.
- `cli/src/components/savant-ui/echo/trust-matrix.tsx` — reactive summary +
  compact render.
- `cli/src/components/savant-ui/primitives/sidebar-section.tsx` — new
  `statusTone` prop (amber/green/neutral dot).
- `cli/src/components/right-sidebar.tsx` — mount only when signed events
  exist; collapsed by default; status dot wired.
- `cli/src/components/savant-ui/index.ts` — barrel exports
  (`summarizeTrustRows`, `TrustMatrixSummary`).
- Tests: `segmented-control.test.ts`, `trust-matrix.test.ts`.

### Risk Level

- [x] Low: cosmetic color + a read-only governance surface; no data-flow,
  runtime-tool, or security change.

## Proposed Solution

### Approach

- **A:** replace `theme.foreground` with `theme.primary` for the hover/
  highlight stroke in the two mode-selector components (the non-hovered state
  keeps `theme.border` so cyan appears on hover).
- **B:** make the trust matrix status-driven: the sidebar mounts it only when
  ≥1 signed receipt exists and passes a live `statusTone`; the component
  renders only `pending` rows live, collapses terminal rows into a count, and
  shows basenames.

### Steps

1. Mode-selector: `agent-mode-toggle.tsx` + `segmented-control.tsx` hover/
   highlight stroke → `theme.primary`.
2. Trust matrix: add pure `summarizeTrustRows` (active vs resolved), compact
   row rendering, drop the redundant internal header.
3. Sidebar: mount-only-when-signed + collapsed-by-default + status dot via a
   new `SidebarSection` `statusTone` prop.
4. Missed-question fixes (Loop 2): remaining white hover strokes →
   `theme.primary`; trust-matrix `no_verdict` split out of the resolved count.
5. Tests + docs backfill.

### Verification

- typecheck ×4; `cli` suite; `eslint --max-warnings 0`; `lint:md`; prettier.
- Operator visual pass (the deciding gate for a design task).

## Perfection Loop

### Loop 1 — RED (catalog the un-FID'd changes)

- **RED:** Two UI changes shipped without a FID during the post-FID-009
  polish stretch: mode-selector white hover strokes (operator: "the stroke
  needs to be cyan") and a non-reactive trust matrix (operator: "always there
  no matter if signed or not and never clears the status").
- **GREEN:** (1) hover/highlight stroke → `theme.primary` in
  `agent-mode-toggle.tsx` + `segmented-control.tsx`; (2) trust matrix made
  status-driven — `summarizeTrustRows` splits active (`pending`) from
  terminal rows, the sidebar mounts only when signed receipts exist and is
  collapsed by default with a live `statusTone` dot, rows render compactly
  (basename, no redundant header).
- **AUDIT:** `segmented-control.tsx:201` — `frameColor = isHighlighted ?
  theme.primary : theme.border`; `agent-mode-toggle.tsx:247` —
  `borderColor: isCollapsedHovered ? theme.primary : theme.border`;
  `right-sidebar.tsx` — `trustState.rows.length > 0` mount condition + no
  `defaultExpanded`; `trust-matrix.tsx` — `summarizeTrustRows` filters
  `pending` as active, `TERMINAL_STATUSES` = complete/superseded/no_verdict.
  Tests: `segmented-control.test.ts` frame assertions → `theme.primary`; new
  `summarizeTrustRows` suite (pending-active, all-resolved→green,
  empty→neutral); zero-control audit + empty-placeholder + live-count
  contracts preserved.
- **ADVERSARIAL:** Claim "the trust matrix now clears" — challenged: a
  `no_verdict` receipt (session closed without an independent verdict) is
  terminal but is NOT "verified"; collapsing it into the green `✓ resolved`
  count would overstate trust. Claim "all white strokes fixed" — challenged:
  `build-mode-buttons.tsx`, `load-previous-button.tsx`, and
  `chatgpt-connect-banner.tsx` still use `theme.foreground` on hover.
- **CHANGE DELTA:** n/a (backfill record).

### Loop 2 — GREEN (missed questions + loose ends)

- **RED:** The adversarial pass surfaced four loose ends: three remaining
  white hover-stroke spots and the `no_verdict`-counts-as-resolved honesty
  gap.
- **GREEN:** (1) `build-mode-buttons.tsx` (Build DEFAULT/MAX/LITE),
  `load-previous-button.tsx`, `chatgpt-connect-banner.tsx` hover strokes →
  `theme.primary`; (2) `summarizeTrustRows` now returns `resolvedCount`
  (complete/superseded) and `noVerdictCount` (no_verdict) separately, and the
  tone goes neutral when nothing was verified (all `no_verdict`); the render
  shows `✓ N resolved` (green) plus `N closed without verdict` (muted).
- **AUDIT:** `build-mode-buttons.tsx` — three `hoveredButton === 'x' ?
  theme.primary : theme.secondary`; `load-previous-button.tsx` —
  `borderColor={isHovered ? theme.primary : theme.border}`;
  `chatgpt-connect-banner.tsx` — `borderColor: hovered ? theme.primary :
  theme.border`; `trust-matrix.tsx` — `noVerdictCount` split + neutral tone
  when `resolvedCount === 0`. New test: all-`no_verdict` → tone `neutral`,
  `noVerdictCount` counted, `resolvedCount` 0.
- **ADVERSARIAL:** Claim "cyan on hover is consistent" — verified: the mode
  selector, build-mode buttons, load-previous, and connect banner all now
  share the same dark→cyan hover stroke. Claim "no `theme.foreground`-as-
  hover-stroke remains" — verified with one residual scoped out: the
  feedback form's submit border uses `theme.foreground` for its **enabled**
  state (`canSubmit`), which is a different semantic (enabled vs disabled)
  than a hover stroke and is not in the operator-reported surface; the other
  residual `theme.foreground` uses are text colors (`fg`), not strokes.
  Claim "no_verdict honesty is preserved" — verified: the honest terminal is
  never rendered green.
- **CHANGE DELTA:** ~10%.

### Loop 4 — Operator closure-check feedback, round 2 (2026-08-16)

- **RED:** The operator's manual closure pass reported two defects on the
  reactive trust matrix: (1) the `statusTone` status dot rendered as an
  **unwanted icon on the left of the "Trust Matrix" title**; (2) the section
  **persisted after completion** (it stayed mounted as long as any signed
  receipt existed, even fully resolved).
- **GREEN:** (1) Removed the `statusTone` prop from `SidebarSection` entirely
  — the trust matrix was its only consumer (`grep statusTone cli/src` →
  `right-sidebar.tsx` only), so the prop + glyph rendering block are deleted
  (Law 5 — no dead API); (2) the sidebar now mounts the section only while
  `trustSummary.hasPending` — once every receipt resolves, the section
  **unmounts completely**, so it never lingers after completion. Presence is
  now the signal (mounted = work in flight), so the dot was redundant.
- **AUDIT:** `right-sidebar.tsx` — `{trustSummary.hasPending && (
  <SidebarSection title="Trust Matrix">…)}` (no `statusTone`);
  `sidebar-section.tsx` — `SidebarSectionProps` has no `statusTone`, no glyph
  render; `trust-matrix.tsx` — `summarizeTrustRows` keeps `hasPending`/`tone`
  (tone still asserted by tests; doc comment updated to state that `hasPending`
  drives the mount). cli typecheck exit 0; trust-matrix + sidebar-collapse
  suites pass; eslint 0; prettier clean.
- **ADVERSARIAL:** "Does removing the dot lose the resolved-state signal?" →
  Refuted: with mount-on-`hasPending`, the section exists only while work is
  pending; when it unmounts, the sidebar is cleaner and there is nothing left
  to signal. "Does `tone` become dead?" → No: it remains part of the tested
  `TrustMatrixSummary` contract and the per-row `tone` still drives live-row
  colors; only the sidebar stopped consuming `summary.tone`.
- **CHANGE DELTA:** ~6%.

### Loop 3 — Final convergence

- **RED:** Residual risk — the collapsed trust-matrix status dot could drift
  from the expanded body if the sidebar and component reduce independently.
- **GREEN:** Both consume the same pure `reduceTrustMatrixEvents` +
  `summarizeTrustRows`; the sidebar's `trustState`/`trustSummary` are
  `useMemo`-derived from the same `provenanceEvents` the component receives,
  so the dot and body cannot disagree.
- **AUDIT:** `right-sidebar.tsx` — `trustState = React.useMemo(() =>
  reduceTrustMatrixEvents(provenanceEvents), [provenanceEvents])`,
  `trustSummary = React.useMemo(() => summarizeTrustRows(trustState.rows),
  [trustState.rows])`; the component re-reduces the same events.
- **ADVERSARIAL:** No residual challenge — the two consumers are driven by one
  reducer over one store slice.
- **CHANGE DELTA:** < 5%.

## Missed Questions

> Surface every question that should have been asked when this FID was
> created, answer it with the most robust default derivable from inspection,
> and fold the answer back into the relevant sections.

1. **Are there other white hover strokes (not just the mode selector)?** → Yes:
   `build-mode-buttons.tsx` (Build DEFAULT/MAX/LITE), `load-previous-button.tsx`,
   and `chatgpt-connect-banner.tsx` all used `theme.foreground` on hover.
   Folded back: all three now use `theme.primary`, matching the mode selector
   (Loop 2).
2. **Does the trust-matrix resolved count overstate trust for `no_verdict`?** → Yes:
   `no_verdict` means "session closed without an independent verdict", not
   "verified". Folded back: `summarizeTrustRows` now reports `noVerdictCount`
   separately and the tone goes neutral when nothing was verified (Loop 2).
3. **Is the empty-state placeholder contract preserved?** → Yes (FID-2026-0813-023):
   the `TrustMatrix` component still renders the "No signed provenance events
   yet" placeholder (never a blank panel); the *sidebar* simply stops mounting
   it when no signed receipt exists — the two are separate decisions.
4. **Is the live-count contract preserved?** → Yes (FID-2026-0814-001): the
   "signed event(s) this session — live via write/verdict stream" footer is
   retained in the populated state.
5. **Does the status dot update reactively while collapsed?** → Yes: the
   sidebar derives `trustSummary.tone` from `provenanceEvents` via `useMemo`,
   so the collapsed dot flips amber→green as audits resolve without needing
   the section open.
6. **What about `superseded` receipts?** → Terminal: they count toward
   `resolvedCount` (the receipt was superseded by a newer one — resolved, not
   pending), and `statusLabel` returns the raw label.

## Code Verification Evidence

> FID metadata is a claim; code is ground truth. Verified before planning.

- [x] Files referenced in Affected Components exist (evidence with line
  numbers above)
- [x] Implementation matches the Proposed Solution — all five steps
  implemented, including the Loop-2 missed-question fixes (see Resolution)
- [x] Typecheck/tests/lint pass with pasted tool output (see Verification
  Evidence)
- [x] FID status reflects the actual implementation state — `fixed` =
  implemented + all gates pass; closure requires the operator visual pass
  (Ground-Truth rule)

## Resolution

- **Closed Date:** 2026-08-16 — operator visual pass PASS (checks E/F:
  mode-selector cyan strokes + reactive trust matrix confirmed in the live
  closure test)
- **Fix Description:** Both changes backfilled + all Loop-2 loose ends fixed:
  - **Mode-selector cyan strokes:** `agent-mode-toggle.tsx` collapsed-button
    hover border and `segmented-control.tsx` highlighted/hovered segment frame
    now use `theme.primary` instead of `theme.foreground`; the non-hovered
    stroke stays `theme.border` so cyan appears on hover/highlight.
  - **Reactive trust matrix:** `trust-matrix.tsx` gained a pure
    `summarizeTrustRows` (active `pending` rows vs `resolvedCount`
    complete/superseded vs `noVerdictCount`), renders only active rows live,
    collapses terminal rows into a count, shows basenames, and dropped the
    redundant `TRUST MATRIX · SIGNED EVENTS` header. `sidebar-section.tsx`
    gained an optional `statusTone` prop (amber/green/neutral dot).
    `right-sidebar.tsx` mounts the section only while ≥1 receipt is still
    `pending` (round-2 operator feedback: it must not persist after
    completion), collapses it by default, and carries no title icon (the
    `statusTone` dot was removed — round-2 feedback). The empty-placeholder
    (FID-2026-0813-023) and live-count (FID-2026-0814-001) contracts are
    preserved.
  - **Loop-2 loose ends:** `build-mode-buttons.tsx`,
    `load-previous-button.tsx`, `chatgpt-connect-banner.tsx` hover strokes →
    `theme.primary`; the trust matrix no longer counts `no_verdict` as
    "resolved" — it renders `✓ N resolved` (green) + `N closed without
    verdict` (muted) and the tone is neutral when nothing was verified.
- **Tests Added:** `segmented-control.test.ts` frame assertions updated to
  `theme.primary`; `trust-matrix.test.ts` gained a reactive-summary suite
  (pending-active, all-resolved→green, empty→neutral, all-`no_verdict`→neutral).
- **Verification Evidence:** cli typecheck exit 0; `cli` suite **3122 pass /
  18 skip / 0 fail** (3140 tests); `eslint --max-warnings 0` exit 0;
  `lint:md` exit 0; prettier clean. Operator visual pass PASS (2026-08-16):
  mode-selector cyan strokes (check E) + reactive trust-matrix mount/signed/
  disappear behavior (check F) confirmed in the live closure test — closure
  gate met.
- **Archived:** 2026-08-16 → `dev/fids/archive/`

## Lessons Learned

- A backfill FID must still run the Perfection Loop: the adversarial pass
  caught that the same `theme.foreground`-on-hover pattern existed in three
  other components and that the trust-matrix resolved count would have
  misrepresented `no_verdict` — both would have shipped as silent
  inconsistencies without the loop.
- A trust surface's resolved count must never overstate trust: `no_verdict`
  (closed without an independent verdict) is a terminal state but not a
  verified one, and must render neutral, not green.
- "Reactive" for a status panel means the *mount decision*, the *default
  visibility*, and the *row lifecycle* are all driven by state — not just the
  content inside an always-visible, always-expanded panel.
