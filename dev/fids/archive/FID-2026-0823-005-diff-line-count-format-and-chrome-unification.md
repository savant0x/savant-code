# FID: Unified edit line-count format (`+N -N` via one utility) + traffic-lights chrome migration

**Filename:** `FID-2026-0823-005-diff-line-count-format-and-chrome-unification.md`
**ID:** FID-2026-0823-005
**Severity:** low
**Status:** closed
**Created:** 2026-08-23
**YAGNI-Compliance:** Satisfied — extends the existing pure `diff-stats.ts`
utility module (Law 13, one function one truth, no new module); deletes one
wrapper format and one hand-rolled chrome copy in favor of the shared
`TrafficLightPanel` primitive.

---

## Summary

The Edit tool renderers display the same line-count data in two divergent textual
formats — `DiffViewer`'s header strip renders `+5 −1` (Unicode minus, added-first)
while the `DiffStatsBar` footer counter renders `[-1/+5]` (bracket wrapper,
removed-first). Separately, the Edit diff output hand-rolls its own bordered
container instead of using the system chrome that command output uses
(`TrafficLightPanel` + a sidebar line-number gutter). Operator directive
(2026-08-23): replace the count formats project-wide with a single utility
rendering the wrapper-free `+1 -1` form, reused at every site (including the
per-side bar sections via a shared per-side helper), AND re-skin the Edit
output onto the traffic-lights wrapper with the sidebar line counts.

## Environment

- **Runtime:** TypeScript strict monorepo, Bun 1.3.14, OpenTUI 0.5.3 CLI, working tree @ v0.0.27 (release-only-commits)
- **Owner module:** `cli/src/utils/diff-stats.ts` (FID-2026-0804-010 lineage)
- **Chrome primitive:** `cli/src/components/traffic-light-panel.tsx` (FID-2026-0822-005/006 lineage; width allowance FID-2026-0822-009)
- **Sidebar-gutter reference:** `cli/src/components/terminal-status-utils.ts`
  (`computeTerminalDisplayOutput`, FID-2026-0817-001 lineage)

## Detailed Description

### Problem

1. **Two count formats, zero shared formatter.** FID-2026-0804-010 introduced two
   independent render sites (diff-panel header strip + copy-footer counter) with
   no shared text formatter, so each site chose its own syntax: Unicode minus vs.
   ASCII bracket, added-first vs. removed-first.
2. **Edit chrome diverges from the system design.** The Edit diff renders in its
   own hand-rolled box (rounded border, surface fill, bespoke header row) while
   command output — and every other result-bearing panel since FID-2026-0822-005/
   006 — renders inside the shared `TrafficLightPanel` with a line-numbered
   sidebar gutter. The Edit output is the odd surface out.

### Expected Behavior

- One utility `formatDiffCounts(added, removed)` returns the canonical
  `+N -N` text (ASCII hyphen, no wrapper, added-first). Every edit line-count
  surface derives its text from it.
- The Edit diff renders inside the shared `TrafficLightPanel` chrome with the
  sidebar line-number gutter, matching how command output renders.
- Zero functional change: counts still come from `parseDiffLines`; only
  presentation differs.

### Root Cause

FID-2026-0804-010 (counter) and FID-2026-0816-009 (diff redesign) each shipped a
self-contained renderer with no dependency on a shared count formatter or the
shared panel primitive that FID-2026-0822-005/006 later established as the
single chrome owner (Law 13 not yet in force for these two components).

### Evidence (render sites, `cli/src`)

| Site | Location | Format today |
|---|---|---|
| Header strip (inside `DiffViewer`) | `components/tools/diff-viewer.tsx:187` | `` ` +${added} \u2212${removed}` `` → `+5 −1` (Unicode minus, added-first, leading space) |
| Footer counter (`DiffStatsBar`) | `components/tools/diff-viewer.tsx:216-224` (body line 221) | `[-{removed}/+{added}]` → `[-1/+5]` (bracket, removed-first) |
| Per-side bars (`CompactFileStats`) | `components/blocks/implementor-file-stats.tsx:42,46,96,97` | `+${linesAdded}` / `-${linesRemoved}` — no-wrapper ASCII; converted to `formatDiffCountSide` (operator decision 2026-08-23) |

Exact grep evidence (pasted verbatim):

```text
u2212                                   → 1 production hit: components/tools/diff-viewer.tsx:187
[-{removed}/+{added}]                   → 1 production hit: components/tools/diff-viewer.tsx:221 (DiffStatsBar body)
linesAdded|linesRemoved (non-test)      → implementor-file-stats.tsx:42,96,97 (bar width calc + per-side strings)
DiffStatsBar consumers                  → components/tools/apply-patch.tsx:4,120-123; components/tools/str-replace.tsx:3,87-91
DiffViewer consumers                    → apply-patch.tsx (PatchOperationItem), str-replace.tsx (EditBody), implementor-file-stats.tsx:115 (inline selected-file diff)
TrafficLightPanel reference pattern     → terminal-command-display.tsx:126,169; sidebar gutter: terminal-status-utils.ts:112,148 (`${String(n).padStart(gutterWidth - 2)} │ `), shown when width >= 50 (terminal-command-display.tsx:99-101)
```

Test assertions on the legacy formats (must be updated): `diff-viewer.test.tsx:84-108`
(`[-5/+20]`, `[-0/+0]`, `[-2/+3]`), `apply-patch.test.tsx:92-98` (`[-2/+3]`),
`:116-117` (`[-0/+1]`), `:131-134` (zero-sign suppression, no `[-0/+0]` receipt).

Non-render references — NO change: `utils/implementor-helpers/edit-analysis.ts:149`
(comment about zero-change receipt parsing, not rendering); CHANGELOG + archived
FIDs (historical records, immutable).

## Impact Assessment

### Affected Components

- `cli/src/utils/diff-stats.ts` — NEW `formatDiffCounts` (extend existing module)
- `cli/src/components/tools/diff-viewer.tsx` — header count text + `DiffStatsBar` body + chrome migration to `TrafficLightPanel`
- `cli/src/components/tools/apply-patch.tsx`, `str-replace.tsx` — consumers; unchanged (keep passing counts to `DiffStatsBar`)
- `cli/src/components/blocks/implementor-file-stats.tsx` — bar strings +
  width math → `formatDiffCountSide` (layout untouched; operator decision
  2026-08-23)
- Tests: `diff-viewer.test.tsx`, `apply-patch.test.tsx`, `diff-stats.test.ts`
  (+ str-replace/implementor-helpers suites re-run)

### Risk Level

- [x] Low: Minor issue, cosmetic, or edge case — zero functional change;
      counts still derive from `parseDiffLines`; test suite updated in lockstep

## Proposed Solution

### Approach

1. **One utility pair (Law 13).** Add to `cli/src/utils/diff-stats.ts` — a
   per-side helper plus the canonical pair built on it, so sign+number text
   exists in exactly one place:
   ```ts
   /** Signed count text for one side: `+5` / `-1`. Shared by the per-side
    *  bar sections (FID-2026-0823-005, operator decision 2026-08-23). */
   export function formatDiffCountSide(count: number, sign: '+' | '-'): string {
     return `${sign}${count}`
   }
   /** Canonical edit line-count text: `+5 -1` (added first, ASCII hyphen,
    *  no wrapper). Single source of truth for every edit line-count surface
    *  (FID-2026-0823-005). */
   export function formatDiffCounts(added: number, removed: number): string {
     return `${formatDiffCountSide(added, '+')} ${formatDiffCountSide(removed, '-')}`
   }
   ```
2. **Re-point both textual sites at it.** `DiffViewer` header (diff-viewer.tsx:187)
   → `` {` ${formatDiffCounts(added, removed)}`} `` (keeps muted styling + leading
   space). `DiffStatsBar` body (line 221) → `formatDiffCounts(added, removed)`
   (keeps the component, its `footerLeft` slot, `syntaxComment` styling, and both
   consumers; operand order flips to added-first — the canonical order).
3. **Chrome migration.** `DiffViewer`'s outer box drops its hand-rolled
   `border`/`borderStyle`/`borderColor`/`backgroundColor` + title-box (owned by
   the shared primitive, per the FID-2026-0822-006 migration pattern) and wraps
   in `<TrafficLightPanel>`. The file-path + counts header row becomes the first
   content row (mirroring TerminalCommandDisplay's command row). The dual
   old/new sidebar gutter, sign column, neon tinting, and hunk bars are
   preserved — they ARE the diff-native sidebar line counts. Any explicit wrap
   width subtracts `TRAFFIC_PANEL_WIDTH_ALLOWANCE` (4) per FID-2026-0822-009.
4. **Bars share the formatter (operator decision 2026-08-23).** The
   `CompactFileStats` bar strings (`implementor-file-stats.tsx:42,46,96,97`)
   move to `formatDiffCountSide(count, sign)` — byte-identical output, so the
   width math (`+N`.length / `-N`.length) and the split-bar layout are
   preserved exactly; only the construction site changes.

### Steps

1. Add `formatDiffCountSide` + `formatDiffCounts` to
   `cli/src/utils/diff-stats.ts` + unit tests (zero/zero, positive, mixed;
   per-side both signs) in `diff-stats.test.ts`
2. `diff-viewer.tsx`: header count text → `formatDiffCounts`; `DiffStatsBar`
   body → `formatDiffCounts`; outer box → `TrafficLightPanel`
3. `implementor-file-stats.tsx`: bar strings + width math →
   `formatDiffCountSide` (lines 42, 46, 96, 97)
4. Update assertions: `diff-viewer.test.tsx` (`[-5/+20]` → `+20 -5`,
   `[-0/+0]` → `+0 -0`, `[-2/+3]` → `+3 -2`), `apply-patch.test.tsx`
   (`[-2/+3]` → `+3 -2`, `[-0/+1]` → `+1 -0`); add a traffic-lights title-bar
   chrome assertion to `diff-viewer.test.tsx` (mirrors the FID-2026-0822-006
   chrome-test pattern)
5. Gates: `bun run --cwd=cli typecheck` exit 0; focused suites (`diff-stats`,
   `diff-viewer`, `apply-patch`, `str-replace`, `implementor-helpers`);
   `bun x eslint <touched files>` `--max-warnings 0`; `bunx prettier --check`
   on touched files
6. Law 4 grep (paste into AUDIT): `\u2212` → 0 production hits; `[-N/+M]`
   → 0 production hits; `formatDiffCounts` has ≥ 2 production callers;
   `formatDiffCountSide` has ≥ 1 production caller (bars); `TrafficLightPanel`
   imported in diff-viewer.tsx

### Verification

- `bun run --cwd=cli typecheck` exit 0
- Focused CLI suites green with the new `+N -N` format and the chrome assertion asserted
- eslint zero-warning on touched files; prettier clean
- Grep evidence pasted into AUDIT (Law 4)

## Perfection Loop

### Loop 1 — RED

- **RED:** Cataloged above — 2 divergent count formats at `diff-viewer.tsx:187`
  and `diff-viewer.tsx:216-224` (plus the already-no-wrapper bars at
  `implementor-file-stats.tsx:96-97`), no shared formatter; Edit diff chrome
  hand-rolled (`diff-viewer.tsx:160-196`) while the system standard is
  `TrafficLightPanel` + sidebar gutter (terminal-command-display.tsx:126,169;
  terminal-status-utils.ts:112,148). Test assertions on legacy formats:
  `diff-viewer.test.tsx:84-108`, `apply-patch.test.tsx:92-98/116-117/131-134`.
- **GREEN:** One `formatDiffCounts` utility in the existing `diff-stats.ts`
  (Law 13); both textual sites re-pointed at it; `DiffViewer` migrated onto
  `TrafficLightPanel` preserving the dual old/new sidebar gutter, sign column,
  neon tinting, and hunk bars; `hasSignOrHunk` zero-suppression logic untouched;
  `CompactFileStats` bars documented no-change (Q6); tests updated in lockstep.
- **AUDIT:** See evidence below. Greps run against the working tree:
  `u2212` → 1 hit (the site being replaced); bracket template → 1 hit (the site
  being replaced); all consumers identified (`apply-patch.tsx:4,120-123`,
  `str-replace.tsx:3,87-91`, `implementor-file-stats.tsx:115`). All design
  decisions answered in Missed Questions. No self-reporting — evidence is
  grep output + file:line citations.
- **ADVERSARIAL:** Single-agent adaptation (v0.1.2) has no Adversary role; the
  Five Questions self-audit is applied below in place of it.
- **CHANGE DELTA:** n/a — new FID.

### Missed Questions

1. **Which operand order?** → Added-first, `+N -N`: matches the header's existing
   order and the operator's stated `+1 -1` example. The footer flips from
   removed-first — intentional unification.
2. **ASCII `-` or Unicode `−`?** → ASCII hyphen: matches the operator's stated
   format, the footer's existing ASCII, the bars, and avoids double-width glyph
   rendering issues in CJK terminals.
3. **Leading space in the utility?** → None. The utility returns exactly
   `+N -N`; render sites own their spacing (the header keeps its leading space).
4. **Keep the `DiffStatsBar` component?** → Yes. Two consumers + a distinct
   styled footer slot (`footerLeft`); it becomes a thin wrapper whose body is
   `formatDiffCounts(...)`. Deletes nothing structural.
5. **Does the zero-count suppression survive?** → Yes. `hasSignOrHunk`
   (`apply-patch.tsx:105-110`, `str-replace.tsx:75-77`) decides WHETHER to
   render; the utility decides the TEXT. Orthogonal.
6. **What about the `CompactFileStats` bars?** → Operator decision
   (2026-08-23): ROUTE THROUGH the utility. The bars' `+N`/`-N` strings and
   their width math (`implementor-file-stats.tsx:42,46,96,97`) move to the
   per-side helper `formatDiffCountSide(count, sign)`; the pair utility
   delegates to it, so sign+number concatenation exists in exactly one place.
   The split colored-bar layout and padding are untouched — output is
   byte-identical.
7. **Dual old/new gutter or single command-style numbering under the new
   chrome?** → Keep the dual old/new gutter. The operator's "sidebar line counts"
   is read as the line-number-on-the-side design language; the diff's two-column
   gutter IS its sidebar (old and new side). A single-number column would drop
   the old/new semantics. **Operator confirmed 2026-08-23: keep the dual
   gutter.**
8. **Width model inside the panel?** → Rows are flex/percentage-based and adapt;
   any explicit wrap-width math must subtract `TRAFFIC_PANEL_WIDTH_ALLOWANCE = 4`
   (FID-2026-0822-009 live-smoke border-bleed lesson).
9. **`EditHeader` (`• Edit path`) above the panel?** → Unchanged — it is the tool
   label row, outside the diff chrome, shared with create/delete branches.
10. **Historical records edited?** → No. CHANGELOG + archived FIDs are immutable;
    this FID's closure entry records the format change.

**Five Questions self-audit:** (1) ALL count surfaces covered — grep-verified
zero residue after change; (2) utility scales — pure string fn, no state;
(3) hostile-input safe — numbers are `parseDiffLines` counts, template-string
only; (4) maintainable 2 yrs — one formatter, one chrome owner, mirrors the
-006 migration precedent; (5) sets the standard — every result panel now shares
`TrafficLightPanel`, matching the design system.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** n/a — release-only-commits; work lands in the working tree
- [x] **File:line ranges:** `cli/src/utils/diff-stats.ts:169,178`
      (`formatDiffCountSide` + `formatDiffCounts`); `cli/src/components/tools/diff-viewer.tsx`
      (TrafficLightPanel import `:15`, header `:176`, DiffStatsBar `:210`);
      `cli/src/components/blocks/implementor-file-stats.tsx:5,44,50,103-104`;
      comment sync `str-replace.tsx:70`, `edit-analysis.ts:148-149`;
      tests `diff-stats.test.ts`, `diff-viewer.test.tsx`, `apply-patch.test.tsx`
- [x] **Gate output:** cli typecheck exit 0; full cli suite **3320 pass / 18
      skip / 0 fail** (9181 expects); focused suites **145 pass / 0 fail**
      (330 expects); eslint `--max-warnings 0` exit 0 on all 8 touched files;
      prettier `--check` clean (one `--write` pass on implementor-file-stats.tsx)
- [x] **Reproducibility:** `grep -E '\[[0-9-]+/\+[0-9]+\]' cli/src` → **0**;
      `grep 'u2212' cli/src` → **0**; `formatDiffCounts` → 2 production
      callers (diff-viewer.tsx:176,210); `formatDiffCountSide` → 4 production
      sites (implementor-file-stats.tsx:44,50,103-104); `TrafficLightPanel`
      wired in diff-viewer.tsx (import :15, JSX :162-189)
- [x] **Step statuses:** steps 1-6 all `implemented` (see Verification below)

### Code Verification Evidence

- [x] `diff-stats.ts` exists and exports `formatDiffCounts` + `formatDiffCountSide` (lines 169, 178)
- [x] `diff-viewer.tsx` imports `TrafficLightPanel` (:15) + `formatDiffCounts` (:9); no `\u2212` or `[-N/+M]` remains
- [x] Typecheck/tests/lint pass — output pasted in Implementation Evidence
- [x] Production call-graph evidence pasted (2 pair callers, 4 per-side sites, panel wired)
- [x] FID status reflects actual implementation state (`fixed`)

### Implementation record (2026-08-23)

Operator approved implementation at presentation (2026-08-23); the Loop 4
re-run folded the Q2 decision; T8-B landed in the working tree this session.
All six Proposed Solution steps implemented. Carried boundary to closure:
operator live TUI smoke of one edit diff (traffic-lights chrome + `+N -N`
counts in header and copy-footer) in dark AND light themes — out-of-reach
evidence, never claimed passed. **Operator directed closure 2026-08-23 —
the carried smoke boundary is waived by the close directive** (termination
criterion: "user explicitly requests to ship").

### Loop 2 — Independent audit and self-correction

- **RED:** Re-scan for missed surfaces: `linesAdded`/`linesRemoved` non-test hits
  are confined to the bar component (documented no-change) and the `FileStats`
  computation (parse-side, not a render format). The `+N −M` phrase in
  `diff-viewer.test.tsx:23` and `diff-viewer.tsx:124` comments is prose, not a
  render site — no code change, but tests asserting the Unicode minus
  (`diff-viewer.test.tsx:32` `expect(markup).toContain('+1 −1')`) MUST move to
  ASCII. Corrected here.
- **GREEN:** Test-update list augmented: `diff-viewer.test.tsx:32` (`+1 −1` →
  `+1 -1`). No other corrections needed.
- **AUDIT:** Re-verified `TrafficLightPanel` exports only `TrafficLightPanel` +
  `TRAFFIC_PANEL_WIDTH_ALLOWANCE`; no `footerLeft` coupling — the footer counter
  stays a `CopyableBlock` footer-row element and is unaffected by the chrome
  migration.
- **ADVERSARIAL:** Self-challenge — could the count utility belong next to the
  panel instead? No: counts are diff data, `diff-stats.ts` already owns
  `parseDiffLines`; Law 13 keeps the pair together.
- **CHANGE DELTA:** trivial (one test-update line added to the plan).

### Loop 3 — Final convergence

- **RED:** Residual risk — a future render site could re-introduce a count
  format without the utility (the same drift that created this FID). Guard: the
  closure's reproducibility greps + the `diff-stats` unit tests pin the format;
  the archived FID-2026-0804-010 counter precedent is superseded.
- **GREEN:** No further corrections.
- **AUDIT:** Convergence reached — plan stable, all questions answered with the
  most robust defaults, change deltas trivial for 2 consecutive passes.
- **ADVERSARIAL:** No remaining challenge.
- **CHANGE DELTA:** 0% (no document change this pass) → convergence per
  convergence-detection rule.

### Loop 4 — Re-run after operator decisions (2026-08-23)

Operator approved the FID and answered both presentation questions:
Q1 = keep the dual old/new gutter under the traffic-lights chrome; Q2 = route
the `CompactFileStats` bars through the utility too. Loop re-run folds both
into the plan.

- **RED:** The Q2 decision converts the bars from "documented no-change" to a
  conversion site: the four per-side construction sites at
  `implementor-file-stats.tsx:42,46,96,97`. Completeness re-grep over
  `` `+${ `` / `` `-${ `` (production, non-test) returns exactly those four diff
  sites plus three UNRELATED surfaces that are a different domain and stay out
  of scope, documented here: `right-sidebar-sections.tsx:109` (FID-count
  badge, `+N more active`), `drive-status-panel.tsx:29` (trend delta),
  `config-dir.ts:27` (env suffix) — none are edit line counts; widening is a
  separate operator decision if ever wanted.
- **GREEN:** Per-side helper `formatDiffCountSide(count, sign)` added to
  `diff-stats.ts`; the pair `formatDiffCounts` delegates to it (Law 13 — the
  pair is a special case of the general form, one concatenation site). Bars +
  their width math move to the helper with byte-identical output, so
  `+N`.length-based alignment is preserved exactly. Q1 confirmed: the dual
  old/new gutter stays; only the container chrome changes.
- **AUDIT (evidence):** grep `cli/src` production `` `+${ `` → 4 hits, all
  `implementor-file-stats.tsx` (42, 96) plus 2 unrelated; `` `-${ `` → 2 hits,
  both `implementor-file-stats.tsx` (46, 97) plus 1 unrelated. Byte-identity
  argument: `formatDiffCountSide(n, '+')` === `` `+${n}` `` and
  `formatDiffCountSide(n, '-')` === `` `-${n}` `` by construction — no test
  change needed for bar output; the diff-stats unit suite gains the new
  helper coverage, and the legacy-format render assertions are updated.
- **ADVERSARIAL (self-challenge):** Is the per-side helper over-engineering?
  Counter: the operator explicitly directed it; without it the bars would keep
  a second sign+number concatenation site, recreating the exact drift this
  FID exists to kill; the helper is a one-line pure function with one
  consumer pair. Is the pair wrapper redundant given the helper? Counter: the
  header/footer need the joined `+N -N` string, so the pair is the shared
  form for those surfaces; delegation keeps both consistent.
- **CHANGE DELTA:** ~8% (approach + steps + evidence + Q6 + Loop 4) — one
  pass, within the 10% cap; next pass expected trivial → converge.

### Loop 5 — Convergence confirmation

- **RED:** Residual — could the width math (`+N`.length) drift if helper
  output ever differed? Guard: the diff-stats unit tests assert the per-side
  output equals `` `${sign}${count}` `` exactly, and the
  implementor-file-stats suite re-runs in the gate set.
- **GREEN:** No corrections.
- **AUDIT:** Plan stable after the operator-decision fold; change delta
  trivial for 2 consecutive passes (Loops 3→5).
- **ADVERSARIAL:** No remaining challenge.
- **CHANGE DELTA:** 0% → convergence confirmed. COMPLETE state reached on the
  document; status remains `analyzed` per active-ledger admission until
  implementation lands (implementation already operator-approved 2026-08-23).

## Resolution

- **Closed Date:** 2026-08-23 (operator-directed; carried smoke boundary waived by the close directive)
- **Fix Description:** `formatDiffCountSide` + `formatDiffCounts` added to
  `diff-stats.ts`; `DiffViewer` header + `DiffStatsBar` render `+N -N` via the
  pair utility; `DiffViewer` outer chrome migrated to the shared
  `TrafficLightPanel`; `CompactFileStats` bar strings + width math routed
  through the per-side helper; every legacy `[-N/+M]` / `\u2212` reference
  removed incl. comments.
- **Tests Added:** Yes — 3 `formatDiffCountSide`/`formatDiffCounts` units +
  updated diff-viewer/apply-patch assertions + traffic-lights chrome
  assertion (`●`)
- **Verification Evidence:** cli typecheck exit 0; full cli suite 3320/18/0
  (9181 expects); focused 145/0 (330 expects); eslint 0 warnings on 8 files;
  prettier clean; Law-4 greps green (bracket format 0 across cli/src)
- **Archived:** 2026-08-23 (moved to `dev/fids/archive/`; CHANGELOG entry appended; working-tree closure per release-only-commits)

## Lessons Learned

Count formats and panel chrome are system-design surface: any new count display
must route through the shared formatter utility, and any new result panel must
use the shared `TrafficLightPanel` primitive — never a bespoke copy. The
FID-2026-0804-010 counter and FID-2026-0816-009 renderer predate both rules;
this FID retires their last bespoke remnants.
