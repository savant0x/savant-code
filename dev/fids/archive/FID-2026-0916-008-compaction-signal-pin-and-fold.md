# FID-2026-0916-008 — Compaction Signal Pin & Fold

## Metadata

- **Filename:** `FID-2026-0916-008-compaction-signal-pin-and-fold.md`
- **ID:** FID-2026-0916-008
- **Severity:** high
- **Status:** closed
- **Created:** 2026-09-16

## Problem

Two defects in the in-stream compaction lifecycle signal (`CompactionSignal`):

1. **Pinned forever.** `cli/src/chat/panels.tsx:148` renders `<CompactionSignal />`
   as the last child of the scrollbox, after `visibleTopLevelMessages`. The panel
   renders `compactionEvents[len-1]` (`compaction-signal.tsx:80`) as its fallback
   body. Those events are only cleared on session `reset()` — never at a run
   boundary — so after the first compaction the panel shows "✓ Compaction
   complete (−N tokens) — P% of window" indefinitely, pinned below every later
   message. New user messages render above it because they append to
   `visibleTopLevelMessages`, which precedes the panel in the layout.
2. **Unfoldable.** `compaction-signal.tsx:143–156` dumps the full
   `lastCompactionReport.summaryExcerpt` (up to ~96K chars) with no toggle. The
   code comment admits: "the expander is an always-visible block instead of a
   toggle (nothing hidden)."

The same information is *also* delivered correctly as a first-class **foldable,
in-stream transcript block** — `CompactionSummaryBlock` (FID-2026-0828-001),
collapsed by default with a working toggle. The broken panel is a redundant,
unfoldable duplicate.

## Fix

1. **Retire on next message** (`cli/src/state/chat-store/sidebar-actions.ts`):
   `onNewUserMessage` — the canonical pre-run zeroing path — now clears
   `compactionStatus`, `compactionEvents`, and `lastCompactionReport`.
   `compactionCount` (the session sidebar stat) is preserved. The signal shows
   for the remainder of the run that compacted, then retires on the next
   message — no more pinning.
2. **Fold toggle** (`cli/src/components/compaction-signal.tsx`): the report
   excerpt is now collapsed by default behind a `▾ expand` affordance, reusing
   the existing `Button`/`CollapseButton` pattern from `CompactionSummaryBlock`
   (Law 11). A 160-char preview + removed-count render in the header row.
3. **Prop-driven sub-component** (Law 11): the excerpt renders through a new
   presentational `CompactionReportExcerpt` that takes `reportExpanded` as a
   prop — the same shape as `CompactionSummaryBlock`'s `isCollapsed` prop. The
   static-render test harness cannot simulate clicks, so the fold state must
   be injectable rather than internal; the extraction also removed the
   duplicated toggle logic between the header and the collapse control.

## Verification

All gates run after the fix (evidence: tool output, exit 0):

- `typecheck` cli workspace — **exit 0**, zero errors
- `eslint` on both changed files `--max-warnings 0` — **exit 0**, clean
- `prettier --check` on both changed files — clean (post `--write`)
- `cli/src/state/__tests__/chat-store-compaction.test.ts` — **10 pass / 0 fail**
  (29 expects); covers the retirement accounting, bounded event history, and
  the render-only boundary
- `cli/src/components/__tests__/compaction-signal.test.tsx` — **13 pass / 0
  fail** (35 expects); covers collapsed-by-default (full excerpt hidden behind
  preview), explicitly-expanded (full excerpt visible), and the no-ellipsis
  short-excerpt edge case
- Law 4 reachability: `CompactionReportExcerpt` is used in production at
  `compaction-signal.tsx:118`; `onNewUserMessage` is reached via
  `send-message-prepare.ts:165`

## Audit outcome

Independent Verifier AUDIT returned 4 PASS (fold-toggle correctness, prop
contract + reachability, test non-tautology, gates) plus 2 actionable FAILs,
both fixed in self-correct:

1. Magic number `160` inline -> extracted to
   `REPORT_EXCERPT_PREVIEW_CHARS` (`compaction-signal.tsx`).
2. FID status flipped to `verified` before the audit ran -> set to `fixed`,
   then `closed` only after the re-verified gates passed.

The Verifier's two NEEDS-REVIEW items (retirement clears all three fields;
no race vs the run-end terminal-state mirror) were resolved with direct
grep evidence: `sidebar-actions.ts:203-205` clears `compactionStatus`,
`compactionEvents`, and `lastCompactionReport` inside `onNewUserMessage`
(:186) with `compactionCount` preserved (comment at :201);
`onNewUserMessage` fires pre-run from `send-message-prepare.ts:165`, before
the stream starts, so it cannot race the run-end mirror. The in-stream
`CompactionSummaryBlock` transcript block lives in separate store state and
is untouched by this retirement.

Post-self-correct gates: typecheck cli exit 0; eslint `--max-warnings 0` exit
0; prettier clean; `compaction-signal.test.tsx` 13/0 (35 expects);
`chat-store-compaction.test.ts` 10/0 (29 expects).