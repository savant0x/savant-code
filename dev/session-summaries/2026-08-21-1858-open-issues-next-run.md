# Open Issues & Next-Run Targets — Auto-Compact Session (2026-08-21)

Companion to `2026-08-21-1858-auto-compact-redesign-handoff.md`. Read that
first for what landed. This file lists everything that went wrong or stayed
open, prioritized for the next run.

## 1. Context value jumping low/high (OPERATOR PRIORITY)

The sidebar context number oscillates between a low and a high value across
steps. Leading hypothesis: the new P2-1 reconcile alternates its source —
fresh provider usage (true count, LOWER) vs the ×1.35 estimator (HIGHER)
whenever usage goes stale/fresh between steps; post-prune recounts add a
third source. Investigate: add per-step logging of reconcileTokenCount
inputs (usage capturedAt, lastPrunerCompletionAt, chosen source) and check
whether the sidebar wires the raw value or something smoothed. Fix options:
display-only damping, a wider freshness window, or dropping the estimator
entirely once usage is proven reliable.

## 2. basher pipeline delivered NO-OUTPUT twice

Two basher mv attempts returned NO-OUTPUT AND did not execute (ground-truth
ls proved the file unmoved). Rule for next run: never trust basher for
must-happen mutations without an immediate ground-truth check; prefer
apply_patch create+delete or direct tools.

## 3. Large-payload write truncation late in session

write_file began failing with "Incomplete arguments" at ~3.5KB+ payloads,
and apply_patch diffs truncated mid-string once context filled late in the
session. Workarounds that worked: apply_patch create_file for small chunks,
str_replace appends anchored on tail lines, Recorder-agent dispatches (fresh
transport), and splitting files into 2 chunks.

## 4. Template-literal backtick landmine

Backticks inside a comment in agents/savant/handle-steps-factory.ts (inside
the generated-source template literal) terminated the string early →
TS2362 + TS2304. Caught by agents typecheck; fixed by stripping backticks.
Rule: never put backticks inside handle-steps-factory.ts template content —
use plain quoting in comments and messages there.

## 5. EHEL per-file Law-3 gating blocks multi-file batches

Forge multi-file dispatches stall after the first unverified write. Pattern
that worked: author exact edit-pairs, apply file-by-file (direct str_replace
or single-file dispatches), run typecheck/eslint between each write.

## 6. Index/glob tools are blind to resources/**

gitignored tree → glob/code_search return zero hits even for existing
files; this caused a false "fabricated citation" verdict during the
adversarial audit. Rule: audit resources/ via shell reads only
(ls/grep/read_files); spawn-based search tools inherit the same blindness.

## 7. Interleaved workstream files share the working tree

SCOPE.md, dev/LEARNINGS.md, dev/LEARNING-RULES.md, scripts/public-release.*,
and dev/fids/archive/README.md carry changes from the parallel
FID-2026-0821-002 release-engine stream. When committing this FID's work,
use path-scoped `git add` so checkpoints stay atomic.

## 8. Process notes

- FSM claim-before-audit ordering occurred once (status flipped to verified
  before the final Verifier ran); the APPROVE retroactively grounded it,
  but the ordering should not recur.
- Parity between the inline computeTriggerThreshold (serialized generator)
  and the runtime resolver is VALUE-pinned only; add an extraction/eval
  parity test so future drift fails loudly.
- Sub-agent search tools share the resources/** blindness (issue 6) —
  brief any spawn accordingly.

## Next-Run Priority Order

1. Commit checkpoint (path-scoped add — see issue 7).
2. Issue 1 investigation (context jumping).
3. Live smoke-test /compact + TrafficLights panel.
4. Parity-extraction test (issue 8).
