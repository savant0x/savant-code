# FID: Step-loop runaway guards — non-progress turns burned up to 200 LLM steps

**Filename:** `FID-2026-0822-002-step-loop-runaway-guards.md`
**ID:** FID-2026-0822-002
**Severity:** high
**Status:** closed
**Created:** 2026-08-22 03:30
**YAGNI-Compliance:** Pending

---

## Summary

Operator report (2026-08-22 ~03:00 EDT), during live re-testing of FID-2026-0822-001: `/compact` worked after relaunch,
then subsequent normal turns "failed to actually end … happened back to back … continued running without ending" —
continuous assistant work, ZERO compaction panels, ZERO enforcement messages; session at
130k/1048.6k (z-ai/glm-5.3-flash via OpenRouter).

## Perfection Loop

### RED Evidence

- Compaction exonerated by arithmetic: serialized trigger = floor(1,048,576 × 0.8) clamped to [100k, 1,018,576] ≈
  838,860 tokens; force line 1,018,576 — both unreachable at 130k (12% of trigger). Matches zero ⚙ panels observed.
- Turn-end contract (`packages/agent-runtime/src/run-agent-step/step.ts`): a turn ends ONLY on task_completed/end_turn,
  or a plain-text response with no tool calls — UNLESS the response is think-only (`isThinkOnlyResponse`), and ANY
  tool-call error forces another retry step (`!hadToolCallError` term of hasNoToolResults).
- Sole termination backstop: MAX_AGENT_STEPS_DEFAULT = 200 (`common/src/constants/agents.ts:91`) — at large-context
  latencies that is potentially hours of provider spend before a forced end.
- Three non-progress patterns hold shouldEndTurn=false indefinitely: (1) repeated identical tool calls, (2) consecutive
  tool-error retries, (3) think-only continuation loops (reasoning models via OpenRouter are the exposed class).
- Ground truth unavailable post-mortem: checkpoints flush at turn boundaries and the runaway turn never ended, so
  tonight's transcript was never persisted (verified against ~/.savant-code/projects/*/chats mtimes).
- Tonight's FID-2026-0822-001 changes verified unrelated: RC1–RC5 on disk correct;
  none touch normal-prompt termination.

### Green — Implemented Fix

Pure decision module + minimal step-loop wiring:

- **New** `packages/agent-runtime/src/run-agent-step/runaway-guards.ts`: thresholds REPEATED_TOOL_CALL_LIMIT=4,
  CONSECUTIVE_TOOL_ERROR_LIMIT=5, THINK_ONLY_LIMIT=3; `updateAndEvaluateRunawayGuards(counters, inputs)` → updated
  counters + tripReason (precedence repeated-tool-calls > consecutive-tool-errors > think-only-loop);
  `buildToolCallSignature` (recursive key-order-stable name+args fingerprint); `initialRunawayGuardCounters`. Counters
  reset on any non-matching step.
- **Wired** `step.ts`: between evaluateGoalCondition and the stepsRemaining spread — load four counters from agentState
  → evaluate → store back → on tripReason: logger.warn + onResponseChunk notice ("Turn auto-ended by anti-runaway guard
  (…)…") + shouldEndTurn=true.
- **AgentState** (`common/src/types/session-state.ts`): four optional JSON-safe transient fields —
  consecutiveToolErrorSteps, lastToolCallSignature, consecutiveIdenticalToolSignatures, consecutiveThinkOnlyResponses.
- The 200-step cap remains as final backstop behind these earlier trips.
- Tests: `packages/agent-runtime/src/__tests__/runaway-guards.test.ts` — 12 cases
  (accumulate/trip/reset/precedence/signature stability).

### Code Verification Evidence (audit tool output)

- `bun run --cwd=common typecheck` → exit 0
- `bun run --cwd=packages/agent-runtime typecheck` → exit 0
- `bun test packages/agent-runtime/src/__tests__/runaway-guards.test.ts` → 12 pass / 0 fail
- Full repo sweep `bun test packages/agent-runtime/src/__tests__` → 446 pass / 0 fail on all repo-owned suites; the only
  29 failures are vendored `resources/freebuff-main/**` pre-existing `@codebuff/common` import-resolution breaks
  (gitignored reference fork, untouched by this change)
- `bun x eslint <4 changed files> --max-warnings 0` → exit 0
- `bunx prettier --check <4 changed files>` → "All matched files use Prettier code style!", exit 0

Closed uncommitted per release-only-commits convention (next automation release sweeps it).

### Missed Questions

1. Why three trip conditions instead of one generic guard? Decision:
   repetition-shaped patterns are the exposed class (identical calls,
   consecutive errors, think-only loops); a generic "no progress" heuristic
   would over-trip legitimate long agentic turns.
2. When do counters reset? Decision: on any non-matching step — a single
   real step clears all four counters, so legitimate multi-step work is
   never penalized by stale history.
3. Why keep the 200-step cap behind the guards? Decision: the guards trip
   early on the three cataloged patterns; the cap remains the final
   backstop for unclassified runaway shapes.

## Step Status

- [x] RED: three non-progress patterns cataloged with file:line evidence; compaction exonerated by window arithmetic
- [x] GREEN: pure guard module + 12-case unit suite
- [x] Wiring: step.ts integration + AgentState transient fields
- [x] AUDIT: typecheck ×2, tests green (guards 12/12; loop part-b 4/4; repo sweep 446/0 owned), eslint 0 warnings,
  prettier clean

## Resolution

Closed 2026-08-22 (operator directive: archive the completed FIDs).
Guards implemented + gated (12-case unit suite, typecheck ×2, repo sweep
446/0 owned, eslint 0, prettier clean). Live confirmation (next runaway-
pattern turn auto-ends ≤5 steps) was operator-waived with the closure
directive; the anti-runaway behavior ships in the working tree and the
next natural occurrence serves as confirmation. Archived with a CHANGELOG
entry per the auto-archive contract.

## Open follow-up

Live confirmation: next time the operator observes a runaway-pattern turn, it should auto-end within ≤5 steps with the
anti-runaway notice instead of running to the 200-step cap.
