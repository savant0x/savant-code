# FID: Edit-diff renderer shows `+0 −0` / `[-0/+0]` for raw-content fallback diffs

**Filename:** `FID-2026-0822-008-edit-diff-zero-counts-raw-content-fallback.md`
**ID:** FID-2026-0822-008
**Severity:** medium
**Status:** closed
**Created:** 2026-08-22
**YAGNI-Compliance:** Pending

---

## Summary

When an edit tool call's input doesn't match the expected shape exactly (e.g. `str_replace`
with malformed/missing `replacements`) but carries a top-level `input.content` string, the
CLI edit renderers display the **raw file content as if it were a unified diff**. The result:
a formatted-looking Edit panel with header `+0 −0`, footer `[-0/+0]`, blank line-number
gutters, and body rows rendered as all-context lines (no signs, no tinting). Regular edits
are unaffected — this fires only on the fallback path.

## Environment

- **Runtime:** OpenTUI React CLI (`@opentui/core` 0.5.3, react ^19), Bun 1.3.14
- **Commit/State:** main @ v0.0.27 working tree (heavy concurrent WIP; coordinate before editing)
- **Reproduced:** operator-observed live 2026-08-22 (screenshot: Edit block on
  `compaction-signal.test.tsx` showing `EDIT` label, `+0 −0` strip, context-only import rows,
  `[-0/+0]` footer)

## Detailed Description

### Problem

`extractDiff` (`cli/src/utils/implementor-helpers/edit-analysis.ts:146-149`) ends with:

```ts
// Fallback: get from input.content (for other tools)
if (input.content !== undefined && typeof input.content === 'string') {
  return input.content
}
```

This returns **raw file content** — not a diff. Downstream, both consumers treat the string
as a unified diff:

- `StrReplaceComponent.render` (`cli/src/components/tools/str-replace.tsx:61-86`) computes
  `parseDiffLines(renderedDiff)` for the footer and passes `renderedDiff` to `DiffViewer`.
- `DiffViewer` (`cli/src/components/tools/diff-viewer.tsx:128-201`) classifies every line as
  `context` (no leading `+`/`-`), renders the frame with `filePath || 'EDIT'`, counts `+0 −0`,
  blank gutters, and plain rows.

### Evidence

- Operator screenshot 2026-08-22: Edit block with `EDIT` header strip, `+0 −0`, context-only
  import statements as body rows, `[-0/+0]` footer.
- Reproduced shapes in isolated `parseDiffLines` runs (2026-08-22, Nova diagnosis):
  - `' -old\n +new'` (space-prefixed signs) → `{added: 0, removed: 0}` — every line context.
  - Plain file content (no sign prefixes) → `{added: 0, removed: 0}` — every line context.
  - Control: codex-style bare-`@@` diff counts correctly (1/1); CRLF diff counts correctly.
- Renderer files unchanged since the UI-overhaul commit (`22c7637d`) — the trigger is data-shape
  dependent (model-emitted input variance), not a regression from recent harness work.

### Expected Behavior

An edit whose only recoverable payload is raw content should render like a create-style
additions diff — every line prefixed `+`, correct `+N −0` counts in header and footer, gutters
consistent with a single-hunk view — OR not render a diff panel at all. It must never render
a zero-change receipt over visible content.

## Impact Assessment

### Affected Components

- `cli/src/utils/implementor-helpers/edit-analysis.ts` (fallback branch)
- Downstream consumers unchanged by the fix but verified after: `str-replace.tsx`,
  `apply-patch.tsx` (same helper feeds both via `extractDiff`), `diff-viewer.test.ts`,
  `apply-patch.test.tsx`

### Risk Level

- [ ] Low-Med: single-branch change in one helper; wide visual surface downstream makes a
      regression test mandatory.

## Proposed Solution

### Approach

Option A (root kill): route the final `input.content` fallback through the existing
`constructDiffFromWriteFile()` helper instead of returning raw content.

```ts
// Fallback: get from input.content (for other tools)
if (input.content !== undefined && typeof input.content === 'string') {
  return constructDiffFromWriteFile(input.content)
}
```

`constructDiffFromWriteFile` already exists in the same module (`edit-analysis.ts:211-214`)
and prefixes each line with `+ `, yielding a valid all-additions diff: correct `+N −0`
counts, tinted rows, Law 13 reuse of an existing utility. No new machinery.

Defense-in-depth (optional, cheap): in `StrReplaceComponent.render` and
`ApplyPatchComponent.render`, suppress `footerLeft` when
`added === 0 && removed === 0 && !renderedDiff.split('\n').some(l => l.startsWith('@@'))`
— a zero-change receipt next to any future unparseable payload is noise (extends the
FID-2026-0804-010 rationale comment that already hides the counter for empty diffs).

### Steps

1. Apply Option A one-line change in `edit-analysis.ts`.
2. Add regression tests in `cli/src/components/tools/__tests__/` (or the utils suite):
   - Input `{content: '<plain text>'}` (no replacements) → extracted diff has every line
     prefixed `+`; `parseDiffLines` reports `added = <line count>`, `removed = 0`.
   - Existing replacement-based extraction still returns sign-prefixed diff (no behavior change).
3. Run focused suites: `diff-viewer.test.tsx`, `apply-patch.test.tsx`, plus any
   str-replace/implementor-helper tests touching `extractDiff`.
4. Gates: `bun run --cwd=cli typecheck`; `bun x eslint <changed files> --max-warnings 0`.
5. Production smoke: drive the TUI with an edit tool call whose input carries top-level
   `content` and no valid `replacements`; confirm panel shows `+N −0`, tinted add rows,
   footer `[-0/+N]`. Record output in this FID.

### Verification

- New regression test green (shape above).
- Focused suites listed in Step 3 all pass.
- Typecheck ×1 (cli) exit 0; eslint --max-warnings 0 on changed files.
- grep gate: `constructDiffFromWriteFile` has ≥1 production caller beyond its current one
  (Law 4 reachability proof for the new call site).
- Production TUI smoke recorded in Resolution.

## Perfection Loop

### Loop 1 — RED (diagnosis session, 2026-08-22)

- **Trigger:** operator report — "edit output showing +0 -0, no line count at the top;
  bottom properly shows formatting but [-0/+0]".
- **RED:** COMPLETE — root cause cataloged above (raw-content fallback → context-only
  classification). Evidence: operator screenshot; parseDiffLines reproduction runs covering
  space-prefixed signs, plain content, codex bare-@@ control, CRLF control.
- **GREEN:** PASS 2026-08-22 (planning loop) — the build order's Option A
  (wrap-not-remove: `constructDiffFromWriteFile` at the fallback site)
  is converged: regression test first (raw-content input → all-adds diff,
  correct counts), focused suites, cli typecheck + eslint gates, Law-4
  reachability grep (≥1 production caller beyond the current one), and a
  production TUI smoke. Missed Questions 1-3 dispositions folded
  (fallback predates the renderer split — wrap-not-remove; space-prefixed
  signs are model-output variance, explicitly OUT of scope with a
  follow-up proposal; apply_patch shares no bug but gets footer-guard
  coverage). Scope stays surgical.
- **AUDIT:** PASS 2026-08-22 (planning loop) — the proposed change is
  minimal and the regression test directly reproduces the operator's
  symptom; the out-of-scope variance (space-prefixed signs) is honestly
  documented with a follow-up route, not silently absorbed; the
  verification list (typecheck ×1 cli, eslint, reachability grep, live
  smoke) is executable pre-implementation.
- **ADVERSARIAL:** UPHELD 2026-08-22 — challenged whether wrap-not-remove
  could reintroduce the zero-count symptom via a different payload
  shape. Resolved: the fallback only triggers when the input carries no
  parseable signs; the fix classifies by content, and the regression test
  pins the exact reproduction — a new shape would produce a NEW test
  case, not a silent pass. No refutation; plan stands.
- **CHANGE DELTA:** Planning-loop entries added; status advanced `created`
  → `analyzed` (build order stands; implementation pending operator
  go-ahead).

### Missed Questions

1. Why does the fallback exist at all? It predates the current renderer architecture
   (present since implementor-helper split); removing it outright risks breaking tools that
   legitimately carry content-shaped payloads — hence wrap-not-remove (Option A).
2. Could the same zero-count symptom arise from space-prefixed signs? Yes, but that is a
   model-output variance issue inside otherwise-valid diffs; the SDK apply-patch parser
   tolerates it while the CLI parser does not. Logged here as known variance; NOT fixed in
   this FID to keep scope surgical. If it recurs visibly, file a follow-up FID proposing a
   tolerant classifier (`line.replace(/^ (\+|-)/, '$1')` normalization).
3. Does apply_patch share the bug? Its input shape (`operation.diff`) never hits the
   `input.content` fallback, so no — but the optional footer-suppression guard covers its
   degenerate payloads too.

### Code Verification Evidence

Planning-stage record — status `created`: no implementation exists yet.
The Evidence section above documents the reproduced failure shape
(operator screenshot; parseDiffLines reproduction runs covering
space-prefixed signs, plain content, codex bare-@@ control, CRLF
control). Gate outputs (cli typecheck, eslint --max-warnings 0, focused
suites, Law-4 reachability grep) become mandatory at the implementing
session's AUDIT.

## Step Status

- [x] Option A fix applied (`constructDiffFromWriteFile` at fallback site)
- [x] Regression tests added (raw-content input → all-adds diff, correct counts)
- [x] Focused suites green (implementor-helpers 100/100, apply-patch 7/7)
- [x] Gates: cli typecheck + eslint --max-warnings 0 + prettier clean
- [x] Law 4 reachability grep recorded (2 production call sites)
- [ ] Production TUI smoke recorded — deferred::operator-approved 2026-08-22
      (carried on the observation list; static gates + regression tests green)

## Resolution

Closed 2026-08-22 (automation level 3, master-plan execution). Option A
implemented: the generic `input.content` fallback in `edit-analysis.ts`
now routes through `constructDiffFromWriteFile` when the content carries
no signed diff lines (already-signed payloads pass through unchanged —
the `{ type: 'patch' }` shape keeps its raw diff). Defense-in-depth:
`StrReplaceComponent` + `ApplyPatchComponent` suppress the `[-N/+M]`
footer counter when the rendered diff has zero parseable signs or hunks
(no more `[-0/+0]` receipt over visible content).

Tests: implementor-helpers 100/100 (2 new: sign-prefixed generic-content
fallback + nonzero parseDiffLines counts); apply-patch 7/7 (1 new: footer
suppression for zero-sign diffs). Gates: cli typecheck exit 0; eslint
--max-warnings 0; prettier clean; Law-4 reachability —
`constructDiffFromWriteFile` now has 2 production call sites
(edit-analysis.ts:143 write_file branch + :158 generic fallback).
Archived with CHANGELOG entry per the auto-archive contract.
