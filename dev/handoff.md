# Session Handoff — 2026-09-16

This file is a continuation cue, not a crash dump. If you are re-opening this
work in a different CLI tool, read this first, then the session summary it
points at.

## Where things stand

- Branch `main`, up to date with `origin/main`. **Nothing committed this
  session** — the working tree holds four closed FIDs' worth of uncommitted
  work (20 modified/deleted + 8 untracked files).
- **Active FID queue is empty** (`dev/fids/` holds only `README.md`).
  Archived this session chain: -005 (atria gateway), -006 (compaction
  contamination), -007 (learnings restructure), -008 (compaction signal).
- Session summary with the full evidence ledger:
  `dev/session-summaries/2026-09-16-2330-compaction-signal-pin-and-fold.md`

## What this session did

1. **A-Z release-readiness audit** (partially completed): 12 gates clean —
   typecheck ×12 workspaces, tests green, `version:check` (17 surfaces at
   0.0.31), protocol-bundle/design-systems/`validate:repository`/
   `quality:report`/`hygiene:check`/`lint:md`/`learnings:check` all PASS,
   no phantom assume-unchanged files. Severity-ranked findings were being
   cataloged when the operator pivoted.
2. **Idea farm** (completed): deep review of `resources/oh-my-pi-main`
   (omp — a pi-mono fork). Tier-S picks for Savant: compaction-surviving
   stream rules (TTSR), a live asynchronous Advisor model, hash-anchored
   edits, and semantic recall over LEARNINGS. Report delivered verbally;
   not yet written to a durable doc.
3. **Compaction signal pin & fold** (FID-2026-0916-008, closed): the
   in-stream "✓ Compaction complete" panel pinned below every later message
   forever and dumped its ~96K-char report excerpt unfoldable. Fixed at both
   root causes; independent Verifier audit passed after self-correct.

## The compaction fix (the freshest work)

- `cli/src/state/chat-store/sidebar-actions.ts:203-205` —
  `onNewUserMessage` (reached pre-run via `send-message-prepare.ts:165`)
  clears `compactionStatus`/`compactionEvents`/`lastCompactionReport`;
  `compactionCount` preserved.
- `cli/src/components/compaction-signal.tsx` — new prop-driven
  `CompactionReportExcerpt` sub-component: collapsed-by-default fold
  (`▾ expand`/`▴ collapse`), 160-char preview via
  `REPORT_EXCERPT_PREVIEW_CHARS`. Same shape as
  `CompactionSummaryBlock`'s `isCollapsed` (Law 11).
- Gates: typecheck cli 0, eslint 0, prettier clean, markdownlint clean,
  `compaction-signal.test.tsx` 13/0, `chat-store-compaction.test.ts` 10/0,
  `fid:verify --check` PASS.

**Not yet done:** the fix is verified mechanically but **not exercised live
in the TUI**. The operator plans to confirm the pin/fold behavior in a fresh
session after `/compact`.

## Pending after handoff

1. **Commit the working tree** — four FIDs' worth. Candidate split: one
   commit per FID (atria provider, contamination guards, learnings
   restructure, compaction signal). No commits have been made — the operator
   has not authorized `git commit` yet; ask before committing.
2. **Resume the A-Z release audit** — the 12-gate clean signal stands; the
   severity-ranked findings table was interrupted. One known flag from the
   earlier run: tag `v0.0.31` already exists on `origin` (verify what it
   points at before any release push).
3. **Idea-farm picks** — compaction-surviving rules, hash-anchored edits,
   semantic recall over LEARNINGS, or the live Advisor role. None started.

## Recurring tool pain (dev/agenda.md)

Two patterns are above the FID-promotion threshold:

- `str_replace` returning "tool result contains an error" — 12 recurrences
- `code_search` ripgrep ENOENT — 6 recurrences

## Pointers

- Session summary:
  `dev/session-summaries/2026-09-16-2330-compaction-signal-pin-and-fold.md`
- Governing protocol: `ECHO.md` (v0.2.0)
- Scope register: `SCOPE.md`
- FID ledger: `dev/fids/README.md` (all rows closed/archived; queue empty)