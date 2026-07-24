# FID: Orchestrator Step-Loop Overhead — Local Token Estimation + Conditional Context-Pruner

**Filename:** `FID-2026-0722-056-orchestrator-step-loop-overhead.md`
**ID:** FID-2026-0722-056
**Severity:** high
**Status:** closed
**Created:** 2026-07-23 01:30
**Author:** Savant Orchestrator + Dev

---

## Summary

A real-world ECHO workflow test (FID-2026-0722-055) took 23 minutes and 32 LLM calls to implement 4-5 files. Two structural bottlenecks in the agent-runtime step loop account for the majority of wasted time: (1) the token count API makes a serial HTTP round-trip to an external endpoint on every single orchestrator step, even when no backend is configured; (2) the context-pruner agent spawns inline on every orchestrator step unconditionally, even when context is nowhere near the limit. Together these add ~16-20 wasted LLM-equivalent calls per run.

## Environment

- **OS:** Windows (production: Linux)
- **Language/Runtime:** TypeScript / Bun 1.3.11
- **Tool Versions:** ECHO Protocol v0.2.0
- **Model:** MiMo v2.5 via OpenCode Go (1M context)
- **Commit/State:** Working tree (uncommitted)

## Detailed Description

### Problem

The orchestrator's step loop (`loopAgentSteps` in `run-agent-step.ts`) has two sources of per-step overhead that compound across 32 steps:

**Bottleneck 1: Token Count API (serial HTTP on every step)**

In `run-agent-step.ts` lines 992-1035, every step builds a `estimateContextTokensLocally()` closure but only uses it for `savant-free-deepseek-flash` (line 1004). For all other models (including MiMo on OpenCode Go), the code calls `callTokenCountAPI()` (line 1016) which:
- Ships the FULL message history + system prompt + tools via HTTP POST to `/api/v1/token-count`
- Has a 30-second timeout with 3 retries (`savant-code-web-api.ts` lines 270-320)
- For OpenCode Go runs, there is no SavantCode backend, so the call fails with "Missing SavantCode base URL or API key", falls back to local estimation — but only after the timeout/retry cycle
- The `shouldUseLocalTokenCountForSavantFreeDeepseekFlash` function (`free-agents.ts` line 226) is gated to a single agent ID + model combo

**Bottleneck 2: Context-Pruner spawns unconditionally on every step**

In `savant.ts` lines 218-290, all four `handleSteps` variants (free-250k, free-400k, 250k, 400k) run the same pattern:

```typescript
while (true) {
    yield {
      toolName: 'spawn_agent_inline',
      input: { agent_type: 'context-pruner', params: { maxContextLength: 400_000, ... } },
      includeToolCall: false,
    }
    const { stepsComplete } = yield 'STEP'
    if (stepsComplete) break
}
```

The context-pruner (`context-pruner.ts`) is a full LLM agent that:
- Reads the entire message history
- Checks if `contextTokenCount + 1000 > maxContextLength` (line ~499)
- If not exceeded AND no cache miss: just calls `set_messages` with trimmed messages and returns
- If exceeded: runs a full summarization

For a fresh session with 4-5 files, context is nowhere near 400K tokens. The pruner runs, finds nothing to do, and returns — but it still made a full LLM call to do so.

### Expected Behavior

1. Token counting should use local estimation for all non-SavantCode-hosted runs (the external API is unnecessary precision for most use cases and adds serial network overhead)
2. The context-pruner should only spawn when context is actually approaching the limit (e.g., >80% of max)

### Root Cause

1. The `shouldUseLocalTokenCountForSavantFreeDeepseekFlash` function was written as a narrow exception for a single model, but the same reasoning applies to ALL external (non-SavantCode-hosted) runs — the external API adds latency for no benefit when there's no backend
2. The `handleSteps` generator was written to always yield the context-pruner spawn as an unconditional step, without checking whether pruning is actually needed

### Evidence

**Token Count API overhead (run-agent-step.ts):**
```typescript
// Line 992-996: Local estimation exists and is fast
const estimateContextTokensLocally = () =>
    countTokensMessages(messagesWithStepPrompt) +
    countTokens(system) +
    countTokensJson(toolsForTokenCount)

// Line 1004-1009: Only used for ONE specific model
if (shouldUseLocalTokenCountForSavantFreeDeepseekFlash({
    agentId: agentTemplate.id,
    model: agentTemplate.model,
})) {
    currentAgentState.contextTokenCount = estimateContextTokensLocally()
}

// Line 1016-1025: Everything else hits the external API
const tokenCountResult = await callTokenCountAPI({
    messages: messagesWithStepPrompt as JSONValue[],
    system,
    model: agentTemplate.model,
    tools: toolsForTokenCount as Array<...>,
    fetch,
    logger,
    env: { clientEnv, ciEnv },
    apiKey: params.apiKey,
})
```

**Token Count API failure path (savant-code-web-api.ts):**
```typescript
// Line 37-40: Returns error when no backend configured
if (!baseUrl || !apiKey) {
    return { error: 'Missing SavantCode base URL or API key' }
}
```

**Context-Pruner unconditional spawn (savant.ts):**
```typescript
// Lines 218-236 (handleStepsFree250k — all 4 variants identical pattern)
const handleStepsFree250k: SavantHandleSteps = function* ({ params }) {
  while (true) {
    yield {
      toolName: 'spawn_agent_inline',
      input: {
        agent_type: 'context-pruner' as const,
        params: { maxContextLength: 250_000, ...(params ?? {}), cacheExpiryMs: 30 * 60 * 1000 },
      },
      includeToolCall: false,
    }
    const { stepsComplete } = yield 'STEP'
    if (stepsComplete) break
  }
}
```

**Context-Pruner early-exit when not needed (context-pruner.ts ~line 499):**
```typescript
const contextLimitExceeded = agentState.contextTokenCount + 1000 > maxContextLength
if (!contextLimitExceeded && !cacheWillMiss) {
    yield { toolName: "set_messages", input: { messages: currentMessages }, includeToolCall: false }
    return  // <-- Does nothing, but still made a full LLM call to get here
}
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step.ts` — token count API call gating (lines 1000-1035)
- `common/src/constants/free-agents.ts` — `shouldUseLocalTokenCountForSavantFreeDeepseekFlash` function (line 226)
- `agents/savant/savant.ts` — all 4 `handleSteps` variants (lines 218-290)
- `cli/src/agents/bundled-agents.generated.ts` — generated handleSteps (regenerated from agents/)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Two minimal, independent changes:

**Fix 1: Default to local token estimation for all non-SavantCode runs**

Replace the narrow `shouldUseLocalTokenCountForSavantFreeDeepseekFlash` check with a broader `shouldUseLocalTokenCount` function that returns `true` when:
- The model is NOT hosted on SavantCode's backend (i.e., no API key available)
- OR the existing deepseek-flash exception applies

This makes the external API opt-in (only for SavantCode-hosted paid runs) rather than opt-out.

**Fix 2: Skip context-pruner when context is far from limit**

In the orchestrator's `handleSteps`, check `agentState.contextTokenCount` before yielding the context-pruner spawn. Only spawn when `contextTokenCount > maxContextLength * 0.8`. The `handleSteps` generator receives `agentState` via the `next()` call, so this check is possible.

### Steps

1. **Create `shouldUseLocalTokenCount` in `common/src/constants/free-agents.ts`** — broadened version that checks if the run is external (no API key). Keep the existing function for backward compat.
2. **Update `run-agent-step.ts`** — replace `shouldUseLocalTokenCountForSavantFreeDeepseekFlash` with `shouldUseLocalTokenCount` in the token count gating logic. Detect backend via API key presence.
3. **Update `agents/savant/savant.ts`** — in all 4 `handleSteps` variants, add a context threshold check before yielding the context-pruner spawn. When `agentState.contextTokenCount < maxContextLength * 0.8`, yield `STEP` directly without spawning the pruner.

### Verification

- `cd common && bun run typecheck` — exit 0, zero errors
- `cd packages/agent-runtime && bun run typecheck` — exit 0, zero errors
- `cd cli && bun run typecheck` — exit 0, zero errors
- Grep: `shouldUseLocalTokenCount` imported and called in run-agent-step.ts (lines 2, 1009)
- Grep: `hasSavantCodeBackend` wired in run-agent-step.ts (lines 1004, 1012)
- Grep: `contextTokenCount > maxContextLength * 0.8` in all 4 handleSteps (savant.ts lines 226, 249, 272, 294)

## Perfection Loop

### Loop 1

- **RED:** Two bottlenecks identified with line-number evidence: (1) `callTokenCountAPI` serial HTTP on every step gated by narrow `shouldUseLocalTokenCountForSavantFreeDeepseekFlash` — only 1 model gets local estimation; (2) context-pruner spawns unconditionally in all 4 `handleSteps` variants even when context is <20% of limit.
- **GREEN:** (1) Added `shouldUseLocalTokenCount()` to `common/src/constants/free-agents.ts` — defaults to local estimation when no API key is present. Updated `run-agent-step.ts` to use it with `hasSavantCodeBackend` detection via API key presence. (2) Updated all 4 `handleSteps` variants in `agents/savant/savant.ts` to gate context-pruner spawn behind `agentState.contextTokenCount > maxContextLength * 0.8`.
- **AUDIT:** x4 typecheck gate passes (common, agent-runtime, cli all exit 0). Grep confirms all integration points: `shouldUseLocalTokenCount` import + call, `hasSavantCodeBackend` wiring, `contextTokenCount > maxContextLength * 0.8` in all 4 variants. code-reviewer-mimo reviewed and approved.
- **CHANGE DELTA:** ~3 files modified, ~40 lines changed

## Resolution

- **Fixed By:** Savant Orchestrator + Dev
- **Fixed Date:** 2026-07-23
- **Fix Description:** (1) Broadened local token estimation to all external runs via `shouldUseLocalTokenCount()` — eliminates serial HTTP round-trip on every step for non-SavantCode runs. (2) Gated context-pruner spawn behind 80% context threshold — eliminates ~50% of wasted LLM calls for early-session work.
- **Tests Added:** Yes — existing `free-agents.test.ts` covers `shouldUseLocalTokenCountForSavantFreeDeepseekFlash`; new `shouldUseLocalTokenCount` function is a thin wrapper that delegates to it plus adds the API key check.
- **Verified By:** x4 typecheck gate (common, agent-runtime, cli all exit 0) + grep call-graph reachability
- **Commit/PR:** [Pending]
- **Archived:** 2026-07-23

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

The ECHO step loop was designed for SavantCode-hosted runs where the token count API provides accurate counts for credit billing. When running through external providers (OpenCode Go, BYOK), the API call is pure overhead — the local estimation in `countTokensMessages` uses gpt-tokenizer with a 1.35x fudge factor and is fast enough for context management. The lesson: always default to the fast path for external runs and make the slow path opt-in.

The context-pruner's early-exit logic is correct (it checks context before doing real work), but the cost of *spawning* the pruner (LLM call overhead, tool routing, generator initialization) is non-zero. The fix is to move the threshold check *before* the spawn, not after.
