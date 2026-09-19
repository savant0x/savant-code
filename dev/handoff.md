# Session Handoff — 2026-09-18

This file is a continuation cue, not a crash dump. If you are re-opening this
work in a different CLI tool, read this first, then the session summary it
points at.

## Where things stand

- Branch `main`, **ahead of `origin/main` by 4** (all prior sessions, local-only
  per operator instruction — ask before pushing).
- **Working tree:** 7 modified files + 2 untracked, **all uncommitted** — the
  FID-2026-0918-004 fix is complete and verified but has not been committed.
- **Active FID: none.** `dev/fids/` holds only `README.md`. Last closure was
  `FID-2026-0918-004` (compaction-signal re-pin retirement), archived with a
  `verified` receipt.
- Session summary with the full evidence ledger:
  `dev/session-summaries/2026-09-18-1945-compaction-signal-repin-retirement.md`

## What this session did

1. **Root-caused the compaction re-pin** (FID-2026-0918-004, high, verified +
   archived). The operator reported that after any compaction the summary
   pinned to the window and every later message rendered above it — the second
   compaction-signal fix in two days. The FID-2026-0917-006 retirement scheme
   was the fragile layer: its suppression keyed on a **nullable epoch string**,
   and `compactionStatusEpochOf` returns `null` for every *live* phase
   (`warning`/`blocked`/`compacting`/`idle`). That is the ordinary
   post-compaction regime — after a compaction that doesn't drop context back
   below threshold, every subsequent run ends on `warning`, so `onNewUserMessage`
   stamped a `null` that suppressed nothing. A second hole in
   `applyCompactionStatus` then cleared both stamps on any non-matching status,
   letting the stale seed re-mirror resurrect the panel **and** double-count
   `compactionCount`.
2. **Part 1 — retirement hardening.** Replaced the nullable epoch with an
   explicit active flag + captured retired values
   (`compactionSignalRetired` / `retiredCompactionStatus` /
   `retiredCompactionReport`). Suppression is now an equality test that works
   across the full phase domain; a retirement ends **only** on a genuinely new
   *terminal* outcome. `setLastCompactionReport` defers reports while armed
   (lossless — both re-mirror sites mirror status before report, so a genuine
   terminal outcome disarms first). Six store files touched.
3. **Part 2 — micro-compact in-stream record.** `runMicroCompactPass` now emits
   a dedupe-guarded `compaction_summary` print-mode event (WeakMap keyed by
   agentState, mirroring `emitCompactionStatus`) when `tokensSaved > 0` and the
   agent has no parent, so micro-compact outcomes get a permanent in-stream
   `CompactionSummaryBlock` instead of living only in the pinned panel. No type
   widening — `onResponseChunk` already accepted the full `PrintModeEvent`
   union.
4. **AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE.** The Verifier returned
   zero FAILs but three NEEDS-REVIEW items it could not check without disk
   access; all three were resolved by the Orchestrator with disk evidence. The
   Adversary confirmed all PASSes, then found two real findings, both fixed:
   an **OMISSION** (the FID's promised Part 2 runtime test had never been
   written — added, 4 tests) and a low **ADJUSTED** (the armed-window
   live-phase branch skipped `recordRun`, swallowing the ineffective-pruner
   lifecycle count — now falls through).

## Final verification (all green)

| Gate | Result |
|---|---|
| typecheck cli / agent-runtime / common | ✓ |
| eslint `--max-warnings 0` | ✓ (one `import/order` warning auto-fixed) |
| prettier `--check` (8 files) | ✓ |
| markdownlint | ✓ (one MD040 fixed by tagging the evidence fence `text`) |
| chat-store-compaction | 18/18 ✓ (60 expect calls) |
| agent-runtime step + compactor | 83/83 ✓ (192 expect calls) |
| Law 4 call-graph | ✓ `runMicroCompactPass` ← `context-tokens.ts:204` ← `loop-iteration.ts:107` |

## Files changed (8 + archived FID)

| File | Change |
|---|---|
| `cli/src/state/chat-store/types.ts` | 3 retirement fields replace 2 epochs |
| `cli/src/state/chat-store/initial-state.ts` | matching initial values |
| `cli/src/state/chat-store/compaction-helpers.ts` | `sameCompactionReport`; epoch helper re-documented as terminal predicate |
| `cli/src/state/chat-store/sidebar-reset.ts` | `applyCompactionStatus` suppression + fallthrough-to-`recordRun` |
| `cli/src/state/chat-store/sidebar-actions.ts` | report deferral, `onNewUserMessage` arming, reset paths |
| `cli/src/state/__tests__/chat-store-compaction.test.ts` | migrated assertions (141 lines) |
| `cli/src/state/__tests__/chat-store-compaction-retirement.test.ts` | new — the 8 retirement tests, split out so the original stays under the 300-line quality ceiling |
| `packages/agent-runtime/src/run-agent-step/context-tokens-compaction.ts` | Part 2 `compaction_summary` emission |
| `packages/agent-runtime/src/run-agent-step/__tests__/context-tokens-compaction-micro-summary.test.ts` | new, 4 tests |

## Pending after handoff

1. **Commit the work** — nothing from this session is committed. A single
   `fix(compaction):` atomic commit covering the 8 files + the archived FID is
   the natural shape. The operator has not authorized a commit or a push; ask
   first (4 prior local commits also unpushed).
2. **Live TUI confirmation** that the re-pin is gone in a real session —
   verified mechanically (18/18 + 83/83) but never exercised live. Worth a
   `/compact` run before the next release.
3. **Decide on the process findings** the incident report surfaced — the EHEL
   circular block (severe, recurred twice this session) and the FID
   verification-contract gap are both above the promotion threshold and have no
   FID yet.

## Recurring tool pain (carried forward)

- `str_replace` overlapping replacements corrupted a test file mid-batch —
  prefer `write_file` for whole-block rewrites.
- `run_readonly_command` rejects `;`, `||`, and `$()` — keep commands plain.

## Pointers

- Session summary:
  `dev/session-summaries/2026-09-18-1945-compaction-signal-repin-retirement.md`
- FID record:
  `dev/fids/archive/FID-2026-0918-004-compaction-signal-repin-retirement.md`
- Governing protocol: `ECHO.md` (v0.2.0)
- Scope register: `SCOPE.md`
- FID ledger: `dev/fids/README.md` (queue empty; all rows closed/archived)