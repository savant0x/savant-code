# Feature Spec: /goal & /loop — Autonomous Loop System

## Overview

Add autonomous loop capabilities to savant-code that let users set a goal and walk away. The agent iterates through the ECHO Perfection Loop until a verifiable condition is met, with circuit breakers to prevent runaway token consumption.

Two primitives:
- **`/goal`** — "keep going until this condition is true"
- **`/loop`** — "re-run this every N minutes"

## /goal Command

### Interface

```
/goal "all tests pass and lint is clean"
/goal status          # check progress
/goal pause           # pause the loop
/goal resume          # resume
/goal clear           # stop and clear
```

### State Machine

```
┌─────────┐    condition met     ┌──────────┐
│  ACTIVE │──────────────────────>│ ACHIEVED │
└────┬────┘                      └──────────┘
     │
     │ evaluator fails + max turns hit
     ▼
┌──────────┐
│  FAILED  │
└──────────┘

     ACTIVE ←────── resume ────── PAUSED
```

### State Model

```typescript
type GoalStatus = 'active' | 'paused' | 'achieved' | 'failed'

interface GoalState {
  id: string
  condition: string          // user-provided goal description
  status: GoalStatus
  startedAt: string          // ISO timestamp
  turnCount: number          // iterations completed
  maxTurns: number           // circuit breaker limit (default: 20)
  lastReason?: string        // evaluator's last assessment
  evaluatorFailures: number  // consecutive evaluator failures
  achievedAt?: string
  pausedAt?: string
}
```

### Evaluator

After each agent turn, a **separate evaluator** checks if the goal condition is met. The evaluator is a lightweight LLM call (not a full agent run) that receives:

1. The goal condition
2. The agent's last output (tool calls, test results, file changes)
3. The current state of the codebase (git diff, test results)

The evaluator returns:
- `achieved: boolean` — is the condition met?
- `reason: string` — why or why not

**Critical**: The evaluator is a DIFFERENT model than the one doing the work. This prevents the agent from "grading its own homework."

### Circuit Breakers

| Rule | Threshold | Action |
|------|-----------|--------|
| Max turns | 20 (configurable) | → FAILED |
| Token budget | 500K tokens total | → FAILED |
| Repetition | Same diff 3x in a row | → FAILED |
| Stagnation | No meaningful change for 5 turns | → FAILED |

### Integration with ECHO

The /goal command wraps the existing ECHO Perfection Loop:

1. User sets goal → GoalState created
2. Agent enters ECHO loop (RED → GREEN → AUDIT)
3. ECHO completes a cycle → evaluator checks goal condition
4. Condition not met → ECHO restarts with new context
5. Condition met → GoalState = ACHIEVED
6. Circuit breaker tripped → GoalState = FAILED, escalate to user

## /loop Command

### Interface

```
/loop 30m               # re-run every 30 minutes
/loop 1h "check for failing tests"
/loop status
/loop stop
```

### Behavior

- `/loop` wraps `/goal` with a timer
- Each iteration is a fresh /goal run (context resets between iterations)
- Results from previous iterations are available via /history
- If a /goal is already active, /loop queues after it completes

### State

```typescript
interface LoopState {
  intervalMs: number        // re-run interval
  condition?: string        // optional goal condition per run
  active: boolean
  lastRunAt?: string
  nextRunAt?: string
  runCount: number
}
```

## Circuit Breaker Module

### Token Budget

Track cumulative token usage across all turns in a goal. When the budget is hit, the goal fails gracefully with a summary of what was accomplished.

```typescript
interface TokenBudget {
  totalUsed: number
  limit: number            // default: 500_000
  perTurnLimit: number     // default: 50_000
}
```

### Repetition Detection

Store the last N diffs (git diff output). If the same diff appears 3 times, the agent is oscillating — trip the breaker.

```typescript
interface RepetitionDetector {
  recentDiffs: string[]    // last 5 diffs
  maxRepeats: number       // default: 3
}
```

### Stagnation Detection

If the agent's output shows no meaningful file changes for 5 consecutive turns, it's stuck — trip the breaker.

## TUI Rendering

### Active Goal Display

```
┌─ Goal: all tests pass and lint is clean ─────────────┐
│ Turn 3/20 · 142K tokens · 2m 30s elapsed            │
│                                                     │
│ [GREEN] Running tests...                             │
│ ✔ src/auth/login.ts — refactored                    │
│ ✗ test/auth.test.ts — 2 failures                    │
│                                                     │
│ Evaluator: "Tests still failing in auth.test.ts"    │
└─────────────────────────────────────────────────────┘
```

### Goal Achieved

```
┌─ Goal Achieved ─────────────────────────────────────┐
│ "all tests pass and lint is clean"                  │
│ 5 turns · 89K tokens · 4m 12s                       │
│                                                     │
│ ✔ All 412 tests passing                             │
│ ✔ ESLint: 0 warnings                                │
│ ✔ Typecheck: all 4 workspaces pass                  │
└─────────────────────────────────────────────────────┘
```

### Goal Failed (Circuit Breaker)

```
┌─ Goal Failed: Circuit Breaker ──────────────────────┐
│ Reason: Max turns reached (20)                       │
│ 20 turns · 487K tokens · 18m 30s                    │
│                                                     │
│ Last 3 diffs were identical — agent is oscillating  │
│                                                     │
│ Files changed:                                       │
│  + src/auth/login.ts (modified 3x)                  │
│  - src/auth/session.ts (modified 2x)                │
│                                                     │
│ /goal clear to dismiss · /history to review          │
└─────────────────────────────────────────────────────┘
```

## Implementation Notes

### What to build

1. **GoalState type + persistence** — serialize to disk, load on startup
2. **Evaluator module** — lightweight LLM call, separate from agent runtime
3. **Circuit breaker module** — token tracking, repetition detection, stagnation
4. **/goal command** — register in command-registry.ts, wire to goal state machine
5. **/loop command** — timer wrapper around /goal
6. **TUI components** — goal status display, achieved/failed screens
7. **Integration with agent runtime** — hook into existing ECHO loop, feed evaluator after each cycle

### What NOT to build

- Don't make the evaluator a separate service — keep it in-process
- Don't add new infrastructure — use existing Zustand stores + disk persistence
- Don't couple to ECHO — the goal system should work WITHOUT ECHO too (for users who want raw agent loops)
- Don't add new dependencies — use existing ai SDK for evaluator calls

### Token Economics

The /goal command must be profitable on the free tier:
- Circuit breaker caps total tokens at 500K per goal
- At $0.14/M input tokens, 500K tokens = $0.07 cost
- At $25 CPM with 12 impressions per goal, revenue = $0.30
- **Margin: 77%** — even worst-case, the goal system is profitable

### Testing Strategy

- Unit tests for state machine transitions
- Unit tests for circuit breaker rules
- Integration test: /goal with a simple test suite (verify loop terminates)
- Integration test: circuit breaker trips on repetition
- E2E test: /goal → achieved → verify final state

## Source References

- Addy Osmani: https://addyosmani.com/blog/loop-engineering/
- Cobus Greyling: https://github.com/cobusgreyling/loop-engineering
- LangChain: https://www.langchain.com/blog/the-art-of-loop-engineering
- OpenClaude /goal: resources/openclaude/src/commands/goal/goal.ts
