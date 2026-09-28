# FID: The `@@` hunk header is rendered in the diff accent colour

**Filename:** `FID-2026-0927-004-hunk-header-diff-accent.md`
**ID:** FID-2026-0927-004
**Severity:** low
**Status:** closed
**Created:** 2026-09-27 18:32
**Automation level:** 3
> **Status 2026-09-27: `analyzed` → `fixed` → `closed`.** RED captured,
> implemented, audited, mutation-proven, receipt 3/3. **Closed on operator
> acceptance:** *"Now it's properly muted"* confirmed the colour change in the
> live TUI, and *"just trim/suppress the first row that contains @@"* directed
> step 4, which shipped in the same pass.

> **Operator report (verbatim):** *"on the EDIT block's, line 0 shows '@@', in
> teal. However, there is no reason for that first line to be a special color."*
> Reported against the deployed build; confirmed still present in this tree, so
> the report was not already-fixed.

## Summary

In the `EDIT` diff panel, line 0 — the `@@ -1,3 +1,3 @@` hunk header — renders
in the design system's primary cyan (`#18faf9`) on a cyan-tinted full-width bar
(`#15d5d5`). It is the loudest element in the panel while carrying no change
information: every hunk header looks identical regardless of what changed,
because the text is positional metadata, not a diff semantic.

The fix is to render the hunk row with the **same muted metadata treatment the
component already applies to every other metadata row** (`diffMeta`,
`#8f8f99`), honouring the principle the file states in its own docblock:
*"metadata rows render muted so the change content dominates."* The `@@` row is
the one metadata row that breaks it.

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`, React 19, `@opentui/core`
- **Workspace:** `cli`
- **Design system:** `savant-cyberpunk`; `primary: #18faf9`
- **Reported against:** the deployed build; **confirmed present in this tree**

## Detailed Description

### Grounded evidence

`cli/src/components/tools/diff-viewer.tsx` classifies four row kinds and gives
the hunk row two accent treatments that no other metadata row receives:

| Site | Line | Code | Effect |
|---|---|---|---|
| Foreground | `:73` | `else if (isHunk) foreground = theme.diffHunkHeader` | `@@` text in `#18faf9` |
| Background | `:147` | `blendHex(theme.diffHunkHeader, theme.background, 0.15)` | full-width `#15d5d5` bar |
| Row background | `:62-67` | `: isHunk ? hunkBackground : undefined` | bar applied to the row |

Contrast with the `header` row (the `diff --git` / `---` / `+++` rows), which
receives **one** treatment — `theme.diffMeta`, muted gray — and no background
tint. `header` is metadata. `hunk` is metadata. They are not treated alike.

### RED proof — the rendered markup

Captured from the failing leg in
`cli/src/components/tools/__tests__/diff-viewer.test.tsx`, which renders a diff
whose **only** metadata row is the `@@` line (no `diff --git` / `---` / `+++`),
so the colour is unambiguously the hunk row's:

```html
<box style="flex-direction:row;width:100%;background-color:#15d5d5">
  <text style="width:2px;wrap-mode:none"><span fg="#8f8f99"></span></text>
  <text style="flex-grow:1;flex-shrink:1;wrap-mode:word">
    <span fg="#18faf9">@@ -1,3 +1,3 @@</span>
  </text>
</box>
```

`expect(markup).not.toContain('#18faf9')` fails, and the received markup above
is the operator's report reproduced in full.

### Why the accent was there, and why it is wrong anyway

`diffHunkHeader` is a real theme token (`palette.ts:61` dark, `:164` light;
typed at `theme-system.ts:174`; declared in `icon-theme-keys.ts:40`), and the
docblock says *"Hunk headers render as tinted full-width bars"* — so the
treatment is deliberate, not an accident.

The problem is that the treatment is not *earned*:

1. **It carries no information.** Every hunk header is identical text modulo
   line numbers, which already occupy the gutter. Tinting all of them
   identically emphasises nothing.
2. **It competes with the change.** `DIFF_ADD_FOREGROUND` / `DIFF_REMOVE_FOREGROUND`
   are the tokens that mean "this line changed". Spending the panel's most
   saturated colour on a non-semantic row raises the floor, so the rows that
   actually carry meaning have to work harder to stand out.
3. **It breaks the component's own stated rule** — the docblock already
   commits to muted metadata "so the change content dominates".

### Impact

Cosmetic. No functional, data, or security consequence; the diff content, line
numbers, and add/remove tinting are all correct and unchanged. The cost is
reduced signal-to-noise on the panel's most-read surface, on the first line the
eye lands on.

## Root Cause

`hunk` was given a *visual* treatment (accent foreground + tinted bar) where it
needed a *metadata* treatment (muted foreground, no tint). The row kind carries
no diff semantics, so it should have been classified for rendering alongside
`header` rather than given its own accent. The drift was possible because
nothing asserted the hunk row's colour — the existing suite pinned that hunk
rows are NOT tinted with the *add/remove* blends, but said nothing about the
hunk accent itself.

## Impact Assessment

- **Severity:** low — cosmetic, no workaround needed, nothing degraded.
- **Surface:** `cli` diff rendering only. `parseDiffLines` (the parser in
  `utils/diff-stats`) is unaffected; this is presentation only.
- **Blast radius:** every `DiffViewer` render, i.e. every `apply_patch` /
  `str_replace` block in the TUI. Visual only.

## Proposed Solution

1. Render the hunk row's foreground as `theme.diffMeta`, matching the `header`
   row — one branch instead of two, so metadata is metadata.
2. Drop the hunk background tint and the `hunkBackground` prop /
   `blendHex(...diffHunkHeader, ...)` computation, which become dead once the
   row is unfilled. Removing only the foreground would leave the line tinted,
   which is half the reported symptom.
3. Leave the `diffHunkHeader` **theme token** in place. It is part of the
   declared design-system contract (`theme-system.ts`, `icon-theme-keys.ts`,
   `palette.ts` dark + light) and removing it is a theme-system refactor, not a
   diff fix. This record stops *using* it for a row that does not merit it, and
   says so rather than silently orphaning a contract token.
4. **Suppress the FIRST hunk row** (operator directive 2026-09-27: *"just
   trim/suppress the first row that contains @@"*).

   The leading `@@` carries the start numbers that seed the gutter columns
   printed on every row beneath it, so on screen it restates what the gutter
   already shows. **Later `@@` rows are deliberately kept**: in a multi-hunk
   diff each one marks a real elision (rows jump from line 3 to line 20), and
   that discontinuity is information no other row carries. Suppressing the
   first is therefore more correct than suppressing all — the first marks
   nothing, because nothing precedes it.

   **Implementation constraint (load-bearing).** The filter lives in
   `DiffViewer`, NOT in `parseDiffLines`. The parser owns the counter reset
   (`diff-stats.ts:120`); dropping the row there would leave both counters at 0
   and blank the gutter on every row — a cosmetic change that silently
   destroys line numbers. The test *"suppression is DISPLAY-ONLY"* is the
   regression guard for exactly that wrong implementation.

### Verification

- The new leg passes, and the received markup shows the hunk row in `#8f8f99`
  with no row background.
- The five pre-existing `DiffViewer` legs still pass, including *"does not tint
  context, hunk, or header rows with the add/remove blends"*.
- `bun run --cwd=cli typecheck`, `eslint --max-warnings 0`, and the full `cli`
  suite are green.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/tools/__tests__/diff-viewer.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:fec0485761eb51f32ee5926bbffcb27b3e7f84ba6e2dd86574d5b919f6f64f14
- verified: 2026-09-27T23:04:31.793Z
- typecheck cli: exit 0
- test cli/src/components/tools/__tests__/diff-viewer.test.tsx: exit 0
- quality: exit 0

## Step Status

- [x] Locate the renderer and the two accent treatments — `diff-viewer.tsx:62-73`, `:147`
- [x] Confirm the token is the reported teal — `palette.ts:61` `diffHunkHeader: '#18faf9'`
- [x] RED-first leg capturing the rendered markup
- [x] Proposed Solution step 1 — hunk foreground shares the `header` branch
      (`else if (isHunk || isHeader) foreground = theme.diffMeta`)
- [x] Proposed Solution step 2 — hunk background tint, the `hunkBackground`
      prop, its `blendHex(...diffHunkHeader, ...)` `useMemo`, and the
      `: isHunk ? hunkBackground : undefined` row branch all removed;
      `grep -c hunkBackground` on the file returns **0**
- [x] Proposed Solution step 3 — theme token confirmed retained (no code change)
- [x] Proposed Solution step 4 — FIRST hunk row suppressed in `DiffViewer`
      (`firstHunkIndex` = `lines.findIndex(line => line.kind === 'hunk')`,
      `index === firstHunkIndex ? null : …`); later hunk rows still render;
      `findIndex` returns `-1` when no hunk exists, which matches no real index
      so a hunk-less diff is unaffected. Four new legs; suite 6 → 10.

## Perfection Loop

### Missed Questions

1. **Does removing the bar cost multi-hunk legibility?** It does lose the
   full-width separator between hunks. Accepted: the blank context row and the
   gutter line numbers already delimit a hunk, and a multi-hunk diff is where
   the extra emphasis is least useful, since the eye is scanning for the
   changed rows, not the boundaries.
2. **Should the hunk row keep a *neutral* separator instead?** A neutral tint
   is a third treatment for a row with no semantics, and the operator's
   instruction is that the line should not be specially coloured. Rejected as
   re-introducing the complaint in muted form.
3. **Is `diffHunkHeader` now orphaned, and does that break the design contract?**
   The token remains declared across the theme contract; this record changes
   only the diff renderer's use of it. If the contract gate later requires
   every token to have a consumer, that is a separate theme-system decision,
   not something to resolve by re-tinting this row.
4. **Does the same accent appear anywhere else?** `diffHunkHeader` is
   referenced only by `diff-viewer.tsx` in `cli/src`; the other references are
   the token's own declaration, typing, and test fixtures. So the renderer is
   the sole consumer and the fix is complete for this surface.

### Code Verification Evidence

- [x] Files referenced exist — `diff-viewer.tsx`, `palette.ts`,
      `theme-system.ts`, `icon-theme-keys.ts`, `diff-viewer.test.tsx` all read
- [x] Implementation matches the Proposed Solution — all four steps; the dead
      `hunkBackground` prop/`useMemo`/row-branch removed rather than left dead;
      the FIRST hunk row suppressed at the renderer (never the parser)
- [x] Typecheck/tests/lint pass — `bun run --cwd=cli typecheck` exit 0;
      `eslint --max-warnings 0` on `diff-viewer.tsx` exit 0;
      `diff-viewer.test.tsx` **10 pass / 0 fail** (5 pre-existing + 1 colour +
      4 suppression legs); `cli` components/tools regression 168 pass / 0 fail
      across 25 files; `bun run validate:repository` PASS; `bun run
      quality:report` PASS (1498 baselined); `bun run lint:md` clean
- [x] Call-graph evidence: `DiffViewer` is exported from
      `diff-viewer.tsx` and consumed by the tool-block renderer; the colour
      decision is local to `DiffRow`/`DiffViewer` and has no other production
      reader
- [x] Status reflects reality: `closed`, on operator acceptance of the rendered
      result plus the directive for step 4

- **ADVERSARIAL (step 4):** complete. The suppression was mutation-proven rather
  than assumed: rewriting the filter to drop **all** hunk rows instead of only
  the first yields **7 pass / 3 fail** (the multi-hunk survival test, the colour
  test, and the header-strip test), and restoring returns 10 pass / 0 fail with
  the file byte-identical (`diff -q` exit 0). Two implementation errors were
  found and fixed during this step rather than shipped: (1) the colour test
  became vacuous once single-hunk diffs stopped rendering a hunk row — it is now
  built on a TWO-hunk diff so a real row survives to be asserted on; (2) a patch
  **deleted** the whole `lines.map` block, leaving the panel rendering only its
  header strip — and `tsc` passed, because removing JSX is type-correct. Caught
  by re-reading the file after a subsequent patch failed to match.

- **RED:** complete. The failing leg's received markup is the reproduction
  (`background-color:#15d5d5`, `fg="#18faf9"` on the `@@` row), and it is
  reproduced verbatim in the Detailed Description above.
- **GREEN:** complete. `diff-viewer.tsx` — the hunk foreground now shares the
  `header` branch; the `hunkBackground` prop, its `useMemo`, and the
  `: isHunk ? …` row-background branch are removed. No other row kind touched.
- **AUDIT:** complete, and it caught a defect in this record's own test. The
  independent Verifier flagged that the first version of the RED leg was
  **vacuous**: it asserted `expect(markup).toContain(theme.diffMeta)` over the
  whole document, and in the dark palette `muted` and `diffMeta` are BOTH
  `#8f8f99` — so the **gutter spans alone satisfied it** and the test would
  have passed with the hunk row still teal. Rewritten to be structurally
  scoped: the foreground is read from the span that literally wraps `@@`
  (`/<span fg="([^"]+)">@@/`), and the tint check reads the `<box …>` tag opening
  that row. Both values can only be produced by the hunk row.
  **Mutation-proven:** restoring the teal yields `Expected: "#8f8f99" /
  Received: "#18faf9"` and 5 pass / 1 fail; restore is byte-identical
  (`diff -q` exit 0).
- **ADVERSARIAL:** complete. Two claims checked rather than accepted. (1) The
  `diffHunkHeader` token is **not** orphaned by any gate: `quality:report`
  reports PASS (1498 baselined) with the token now unused in the renderer, and
  the token remains declared across `palette.ts` (dark + light),
  `theme-system.ts`, and `icon-theme-keys.ts`. (2) The Verifier's
  accessibility concern — losing the hue cue that separated `@@` from `---` —
  is **accepted as a deliberate tradeoff, not waved away**: both rows are
  metadata and now differ by content alone, which is the operator's stated
  instruction for line 0. Re-tinting later is a design decision, not a
  regression.

## Resolution

- **Resolved by:** this record
- **Resolution date:** 2026-09-27
- **Verified by:** tool-mediated runs quoted in *Code Verification Evidence*
  (self-reported claims are not accepted as evidence under the protocol)
- **Verification date:** 2026-09-27
- **Verification receipt:** stamped (3/3 declared gates `exit 0`) — see
  `### Verification Receipt` above; re-stamped after the audit strengthened the
  RED leg, so the fingerprint covers the final test, not the first draft
- **Closed by:** operator acceptance, 2026-09-27 — *"Now it's properly muted"*
  for the colour change, and the explicit directive *"just trim/suppress the
  first row that contains @@"* for step 4.
- **Close date:** 2026-09-27
- **Archived:** yes — moved to `dev/fids/archive/`.
- **CHANGELOG entry:** written at closure.

## Lessons Learned

- A colour can be *deliberate* and still be *wrong*. `diffHunkHeader` is
  documented, typed, and shipped in two palettes — the design system did
  exactly what it was told. The defect is in the instruction, not the
  implementation, which is why "is it in the theme contract?" is the wrong
  question to stop at.
- A test that pins what a row must **not** be tinted with can pass while the
  row is tinted with something nobody pinned. The existing suite asserted
  hunk rows avoid the add/remove blends — true, and silent about the accent
  that was the actual complaint.
- Line 0 of a panel is read first. Colour spent there is the most expensive
  colour in the component, and this one was spent on a row whose text is
  identical in every hunk.