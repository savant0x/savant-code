# FID: Model picker scroll offsets disagree with wrapped row heights

**Filename:** `FID-2026-1003-004-model-picker-scroll-geometry.md`
**ID:** FID-2026-1003-004
**Severity:** medium
**Status:** verified
**Created:** 2026-10-03 01:00
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

T120: the operator reported scroll movement issues in `/model` after adding
OpenAI. The picker computes its scroll offsets in item indices, assuming
one terminal row per item, but model names wrap and increase row heights.
Fix the geometry by keeping model and header rows one line tall; verify the
actual native renderer rather than relying on logical viewport math alone.

## Environment

- Windows, PowerShell, Bun 1.3.14; CLI OpenTUI 0.5.3 and React 19.
- Current working tree; unrelated existing changes preserved.
- Single-agent ECHO, automation level 3; no commit or push authorization.

## Detailed Description

### Problem

`model-picker.tsx:84-91` derives `viewport.start` from the selected item
index and assigns it directly to `scrollTop`.
Before correction, `model-picker-rows.tsx:88` rendered the display name
with `wrapMode="char"` and no fixed row height. Native layout therefore
counted physical lines differently from navigation and scrollbar positioning.

### Expected Behavior

Each provider header and selectable model occupies one terminal row,
regardless of terminal width or display-name length. Arrow/Tab navigation
keeps the selected model visible; wheel and scrollbar browsing move through
the same row geometry. Filtering and resizing retain valid offsets.
Visual clipping never changes the full ID passed to selection callbacks.

### Root Cause

The picker uses logical item indices as physical offsets without enforcing
the one-line row contract. Native rendering proves the mismatch. The
OpenAI integration commit `f099ded8` changed catalog fanout and `/provider`
ordering; its stat does not show changes to model-picker components. This
is a reproducible existing layout defect exposed by roster/content changes,
not evidence of a new OpenAI-specific scroll implementation.

### Evidence

Read-only native `createTestRenderer` reproduction on 2026-10-03:
30 OpenAI models with long display names, terminal 60×24. Initial model
heights `[1,3,3,3,3]` including the header, `scrollHeight: 91`, viewport
height 13. After 20 Down presses:

```json
{"selected":21,"scrollTop":16,"selectedY":47,"viewportY":2,"viewportHeight":13,"selectedRowHeight":3}
```

The selected row starts at 47 while the viewport ends at 15. The captured
frame shows models 05–08 and no selected marker, although selection points
at model 20. Source inspection independently identifies wrapping as the
extra height and item-index offsets as the scroll distance.

## Impact Assessment

### Affected Components

- `cli/src/components/model-picker-rows.tsx`: header and model row geometry.
- `cli/src/components/__tests__/model-picker-scroll.test.tsx`: native
  rendering and navigation regression coverage.
- Existing picker viewport, provider activation, and overlay behavior.

### Risk Level

Medium: active selection disappears from view and scrollbar distances are
misleading. The change clips display text to available width while leaving
model metadata, full IDs, provider grouping, and selection intact.

## Proposed Solution

### Approach

Enforce the existing one-terminal-row contract at the rendering boundary:
explicit height 1 and no shrinking for headers and models, plus nonwrapping
display names. Keep provider-independent viewport/navigation logic unchanged.
This directly fixes the measured mismatch without adding alternate scroll
state or provider-specific branches.

### Steps

1. Add native regression tests and prove they fail against the old geometry.
2. Set header/model rows to height 1 and `flexShrink: 0`; use nonwrapping
   display names. Preserve complete IDs in rendered data and callbacks.
3. Verify keyboard traversal including headers and wraparound, mouse wheel
   and scrollbar, filtering, and terminal resizing with native frames.
4. Run root typecheck, affected suites, zero-warning ESLint, Markdown lint,
   formatting and quality checks. Record evidence and stamp the FID only
   after the implementation gates pass.

### Verification

Native tests use long OpenAI names and multiple provider headers at narrow
and normal widths. Assert actual row heights, scroll extents, selected-row
coordinates, captured frames, and complete selected IDs. Mouse scroll must
remain stable during a rerender; resize/filter must restore valid geometry.
Existing activation and overlay tests protect persistence and focus behavior.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/__tests__/model-picker-scroll.test.tsx
- gate: test cli/src/components/__tests__/picker-viewport.test.ts
- gate: test cli/src/chat/__tests__/model-picker-activation.test.ts
- gate: test cli/src/components/__tests__/dialog-overlay.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:9c5e7e60d2ae758dc5e7287c0df0dd98ebc968ff955587f9247374b09ae3cd70
- verified: 2026-10-03T06:30:29.734Z
- typecheck cli: exit 0
- test cli/src/components/__tests__/model-picker-scroll.test.tsx: exit 0
- test cli/src/components/__tests__/picker-viewport.test.ts: exit 0
- test cli/src/chat/__tests__/model-picker-activation.test.ts: exit 0
- test cli/src/components/__tests__/dialog-overlay.test.tsx: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — diagnosis and proposed correction

- **RED:** Native renderer produced three-line model rows and an invisible
  selection after navigation; exact measurements are in Evidence.
- **GREEN:** Specify one-line fixed row geometry and nonwrapping names.
- **AUDIT:** Source calculation (`scrollTop = viewport.start`) and native
  coordinates independently prove logical/physical height divergence.
- **ADVERSARIAL:** Changing only scrollbar speed or provider ordering cannot
  fix a threefold row-height mismatch. Logical viewport unit tests pass
  without proving native render height; add real-renderer tests.
- **CHANGE DELTA:** Initial document; no measured percentage claim.

### Missed Questions

1. Is OpenAI proven to have changed scroll code? No. The commit touches
   catalog aggregation; reproduce the actual layout rather than assign blame.
2. Does a fixed row hide models? No: every model remains in the list. Only
   text exceeding available width clips; callbacks retain the full ID.
3. Can resizing reintroduce wrapping? Nonwrapping text plus fixed row height
   keeps physical offsets stable; test both dimensions in the native renderer.
4. Can header rows become selection? Existing navigation skips headers;
   retain it and cover provider boundaries and keyboard wraparound.
5. Does wheel browsing need to change the selected model? No. It moves the
   viewport; later keyboard movement resumes selection visibility. Test
   manual scroll stability separately from keyboard focus.

### Loop 2 — production wiring and self-challenge

- **AUDIT:** `/model` opens the model-picker store; `chat/panels.tsx:168`
  renders `ModelPicker`, which imports and renders both row components.
  The corrected geometry therefore serves the production command path.
- **ADVERSARIAL:** The global chat dispatcher is disabled while the picker
  is open (`chat/use-chat-keyboard.ts:234`), so the reproduced failure is
  viewport geometry, not competing chat navigation. No new APIs/functions.
- **GREEN:** The implementation stays inside the existing shared row boundary
  and adds meaningful native behavior coverage.
- **Result:** Design converged from source and native evidence; the subsequent
  implementation and verification results are recorded below.

### Implementation Evidence

Steps 1–4 implemented. `model-picker-rows.tsx:19-20` fixes header height
and shrinking; lines 60–61 apply the same model-row geometry; line 92
prevents name wrapping. The native regression suite exercises the production
component. Before correction, mixed-provider fixtures rendered 122 rows
instead of 32 and resizing retained multiline rows. After correction,
all three native tests pass with 149 assertions. Commit/closure evidence
remains subject to the operator's version-control authority.

### Code Verification Evidence

Native regressions: 3 pass / 0 fail. Existing viewport, activation, and
overlay suites: 14 pass / 0 fail. Full root typecheck exited 0 across all
workspaces and scripts. Zero-warning ESLint, Markdown lint, changed-file
Prettier checks, and quality report pass. SDK: 570 pass / 1 POSIX-only
skip / 0 fail on the approved run outside the sandbox; the initial sandbox
run failed its Windows process-tree cancellation test. Production callers
still render both corrected row components. Evidence uses the native
headless renderer, not a full interactive chat-session smoke.

## Resolution

The one-line row correction and native behavior tests are implemented.
Scroll geometry now agrees with item-index offsets at narrow and normal
widths; full IDs remain unchanged on selection. No commit, closure, or
archive is claimed. The verification receipt records the declared gates.

## Lessons Learned

When scroll offsets are counted in logical items, enforce their physical
row height and test the rendered terminal cells. A larger/new catalog may
expose a geometry defect without changing scroll code.

The verification contract's novelty-path scanner matches `.test.tsx` as
`.test.ts` when the line also says "New". The suite is explicitly declared
as the correct `.tsx` gate and was actually executed; removing the redundant
novelty adjective avoids that false diagnostic without changing gate coverage.
