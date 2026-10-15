<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — FID-2026-0814-006 (Compaction Status Freshness + Visible Feedback)

**Date:** 2026-08-14
**Scope:** Planning review of the compaction UX remediation: snapshot emit on status/context change (no stale percent), single resolved-window denominator with fail-loud fallback, a kimi-style in-stream compaction transcript block, an OpenClaw-style `Compactions: N` session counter, color-banded sidebar percent, and a deterministic trigger path closing A–Z row P3-5.
**Status:** REQUESTED
**Priority:** High (operator-visible: "93% of window" vs "188.3k/262.1k"; "no visual feedback showing compact is even happening")

## Request

Please independently audit the **planning** FID below and return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request**. A PASS verifies the plan's ground-truth claims against the repo; it does **not** authorize implementation, closure, commit, push, release, publication, or deployment. Implementation (and a separate implementation-audit request) follows operator approval.

## Record under review

`dev/fids/FID-2026-0814-006-compaction-status-freshness-and-visual-feedback.md` — status `analyzed` (planning-converged via the Perfection Loop with AUDIT + ADVERSARIAL + a fresh Loop-2 re-audit). Landscape research in the FID cites kimi's `CompactionComponent`, OpenClaw's `ContextUsageBar`, and hermes' `native_compaction.py` under `resources/`.

## What the FID claims (verify each at source)

| ID | Claim | Cited source |
|---|---|---|
| C-01 (high) | Compaction status display goes stale across LLM-call gaps — the snapshot emitter skips ticks without a `messageHistory` identity change, so the sidebar shows the last step-boundary percent | `sdk/src/run/execution/snapshot.ts:40-44` (`if (history === lastSnapshotHistory) return`); `cli/src/hooks/helpers/send-message-monitors.ts:75-95` (heartbeat mirrors last snapshot); `packages/agent-runtime/src/run-agent-step/context-tokens.ts:208-235` (status written only at step boundaries) |
| C-02 (medium) | Runtime window fallback (`200_000`) can diverge from the CLI-resolved window (262.1k) — display percent and pruner trigger can reference different windows | `packages/agent-runtime/src/context-compactor.ts:74` (`?? 200_000`); `cli/src/utils/create-run-config.ts:192` → `run-agent-step/loop-context.ts:274` (resolved window); `context-tokens.ts:210` (denominator `autoCompact + 30k`) |
| C-03 (high) | No visible compaction lifecycle — no in-progress, completion, or failure signal in the render layer | `right-sidebar.tsx` (one-line row); `help-banner.tsx` (legend only); absence: `grep -rn "compaction" cli/src/components/blocks/ --include="*.tsx"` → 0 matches; no counter anywhere |
| C-04 (low) | A–Z row P3-5 (compaction transition visual) is uncloseable by an in-harness agent because the transition is invisible | `dev/scratchpad/az-v0.0.24-harness-live-test-report.md` (P3-5 NEEDS-REVIEW) |

## Hard questions Nova must verify at source

1. **Identity-skip is the staleness mechanism.** Confirm `snapshot.ts:40-44` returns when `messageHistory` reference identity is unchanged — so `compactionStatus`/`contextTokenCount` changes that do not coincide with a history change never emit to the heartbeat.
2. **Two windows.** Confirm `context-compactor.ts:74` (`?? 200_000`), the CLI-resolved window at `create-run-config.ts:192` → `loop-context.ts:274`, and the display denominator `autoCompact + 30_000` at `context-tokens.ts:210` — the display and the pruner trigger (`loop-context.ts:279-280`) can disagree.
3. **Trigger math is correct (the display lies, not the trigger).** Confirm for a 262.1k window: `maxContextLength = autoCompact + 30k = 262.1k`, pruner spawn at `> maxContextLength × 0.8 = 209.7k` (`agents/savant/handle-steps.ts:143-168`) — so 188.3k (72%) correctly does not trigger, and "93% of window" (≈243.8k) must be a stale snapshot.
4. **No visible lifecycle consumer.** Confirm the absence greps: no compaction consumer in `cli/src/components/blocks/`, no `Compactions:` counter in `cli/src`/`common/src`/`packages/agent-runtime/src`.
5. **Status writers exist (the data is there).** Confirm `handle-steps.ts:123,144,162` writes `phase: 'compacting'` and `spawn-agent-inline.ts:219,228,240` writes `pruned`/`warning` + `lastPrunerCompletionAt` — the lifecycle data already exists; only propagation/display are missing.
6. **Render-only boundary.** Confirm the GREEN claim that the in-stream transcript block is a UI-layer artifact that never enters `messageHistory` (a runtime mutation would corrupt ECHO compliance accounting).

## Adversarial checks already run in the FID's Perfection Loop

- The snapshot emit-policy change must preserve the identity-skip's purpose (suppress pure token-count-only ticks) while emitting on observable status/context changes.
- The transcript block is bounded (one block per lifecycle, not per heartbeat) and render-only (never `messageHistory`).
- The `Compactions: N` counter must join `provenanceEvents` in the reset paths (`sidebar-actions.ts:67-73, 205-213`).
- The trigger ratio/thresholds are out of scope — they work; only propagation, window consistency, and display are fixed.
- No collision with FID-004's tool-block renderer changes (`tool-branch.tsx` special-cases `run_readonly_command`); the compaction block is a separate render path.

## Authorization boundary

This request authorizes no implementation, closure, commit, push, release, publication, or deployment. A PASS marks the plan converged and code-grounded; operator approval is then required before any code, and a separate implementation-audit request must precede closure.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim.
4. Explicit confirmation this is planning review only and does not authorize production changes or release activity.
