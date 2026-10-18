# FID: Model picker blank screen during live agent updates

**Filename:** `FID-2026-1018-003-model-picker-live-update-investigation.md`
**ID:** FID-2026-1018-003
**Severity:** high
**Status:** closed
**Created:** 2026-10-18
**Automation level:** 3
**YAGNI-Compliance:** Verified — reuse React memo, no virtualization subsystem.

## Summary

Operator reports a blank CLI after opening /model with three active bashers.
No error was visible. Process exit versus a live blank screen is not established.

## Environment

- **OS:** Windows
- **Language/Runtime:** TypeScript, Bun 1.3.14, OpenTUI 0.5.3
- **Tool Versions:** pinned repository dependencies
- **Commit/State:** abe727a7 before intake

## Detailed Description

### Problem

Opening the model picker during the live acceptance run blanked the terminal.

### Expected Behavior

The picker opens and remains navigable while agents continue reporting.

### Root Cause

The original incident's cause is not established. A narrower defect is
reproduced: ModelPicker is not memoized, so unchanged parent updates revisit
every model row. A matched synthetic 4,075-row, 30-update native probe measured
1,103 MB RSS / 5,809 ms unchanged versus 596 MB / 934 ms when wrapped with
React memo. This is a render-load repair, not a verified crash explanation.

### Evidence

The local dev cache contains 4,075 models. Native read-only probes opened it
successfully at about 657 MB RSS; 30 simulated parent updates reached about
1,178 MB. A 30-model control reached about 164 MB. Ten existing picker/open
tests pass. Relevant debug logs show restart/resume without a fatal record.
RSS is whole-process resident memory, not a proven leak or out-of-memory kill.

## Impact Assessment

### Affected Components

- `cli/src/components/model-picker.tsx`
- `cli/src/components/__tests__/model-picker-load.test.tsx`

### Risk Level

- [x] High: interactive session becomes inaccessible in reported incident.

## Proposed Solution

### Approach

Memoize ModelPicker to avoid full-catalog traversal on unchanged parent
updates. React state/store updates and changed props still render normally.
Preserve full search/selection, mouse scrolling and viewport behavior. Do not
introduce virtualization or change row presentation without a reproduced need.

### Steps

1. Add a native regression proving catalog names are not revisited during
   three independent simulated agent-status updates with unchanged props.
2. Wrap the picker with React memo; verify changed query and catalog still
   update, and run existing keyboard, mouse and resize tests.
3. Commit and archive the proven render-load repair; retain original incident
   uncertainty in internal follow-ups without asserting observed recovery.

### Verification

`cli/src/components/__tests__/model-picker-load.test.tsx` uses native rendering
and model-name access counts as a deterministic work oracle. It also proves
changed query and refreshed catalog still render. Existing scroll/open suites
cover interaction. Do not gate on RSS or wall time, which are environment-dependent.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/__tests__/model-picker-load.test.tsx
- gate: test cli/src/components/__tests__/model-picker-scroll.test.tsx
- gate: test cli/src/utils/__tests__/model-picker-open.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:e7a1579699d75cb593c5e094c9a41d9df316ff1105620ec39551860f24af2704
- verified: 2026-10-18T19:21:57.999Z
- typecheck cli: exit 0
- test cli/src/components/__tests__/model-picker-load.test.tsx: exit 0
- test cli/src/components/__tests__/model-picker-scroll.test.tsx: exit 0
- test cli/src/utils/__tests__/model-picker-open.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Catalog-scale memory pressure measured; original blank screen not reproduced.
Stable-prop parent updates revisit the entire picker. Memoized control avoids
that work while keeping the panel visible. Plan converged before editing.

### Missed Questions

1. Did the process die? Operator clarification remains pending.
2. Did three bashers cause the failure? Unproven; simulated UI updates are
   not equivalent to real agent inference or process concurrency.

### Loop 2 — Independent audit and self-correction

Only memoize the component boundary. Skipping changed queries/catalogs would
be incorrect, so no custom comparator is introduced. Existing Zustand/theme
subscriptions continue to invalidate a memoized component directly. Duplicate
cache routes were tested through filtering and refresh without reproducing a
blank screen; do not call that observation a root cause.

### Loop 3 — Final convergence

Matched probes support removing redundant work. Native regression must fail
before memo and pass after it. Five Questions: no catalog cap, unchanged
validation/security boundary, standard React behavior and no new API. Original
incident acceptance remains explicitly unclaimed, separate from code closure.

### Implementation Evidence

ModelPicker now uses React memo with its default shallow comparison. Native
regression failed before repair (expected 300 name reads; observed 500 after
the first agent update), then passed after repair. Focused suite run: 11 pass,
0 fail, 185 expect calls. Implementation commit: `dd57660c`; 5/5 declared
gates exit 0 at the stamped receipt.
Original incident repair remains unclaimed.

### Code Verification Evidence

model-provider-commands calls openModelPicker; ChatLayout mounts ModelPicker;
ModelPicker maps every grouped row into native nodes.
The exported component boundary now wraps that existing implementation with
memo. Query/catalog updates still render in the new regression; existing
keyboard, scrolling, resize and refresh suites pass. Initial mount remains
proportional to catalog size. tmux is unavailable, so live TUI acceptance is
NEEDS-REVIEW, linked to LIVE-003 in internal-followups.json.

## Resolution

- **Closed Date:** 2026-10-18
- **Commit SHA:** dd57660c
- **Fix Description:** Skip unchanged parent renders at the picker boundary.
- **Tests Added:** Native three-update regression with live query/catalog pins.
- **Verification Evidence:** 5/5 declared gates exit 0; root typecheck/build pass.
- **Archived:** 2026-10-18

All three code-repair steps implemented; normal progress push remains subject
to mandatory gates. LIVE-003 preserves missing original-incident evidence
independently of implementation closure. This closes redundant rendering,
not the unobserved original crash cause or live recovery claim.

## Lessons Learned

Keep a resource-pressure measurement distinct from a reproduced process crash.
