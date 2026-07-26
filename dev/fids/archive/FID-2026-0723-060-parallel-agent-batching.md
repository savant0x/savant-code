# FID: Parallel Agent Batching (Fire All Independent Agents at Once)

**Filename:** `FID-2026-0723-060-parallel-agent-batching.md`
**ID:** FID-2026-0723-060
**Severity:** medium
**Status:** closed
**Created:** 2026-07-23 02:15
**Author:** Buffy (Orchestrator)

---

## Summary

The current orchestrator spawns agents sequentially: spawn Detective → wait → spawn Researcher → wait → spawn Thinker → wait. For agents with no data dependencies, this adds serial overhead. Parallel agent batching fires all independent agents in a single `spawn_agents` call, letting `Promise.allSettled` run them concurrently.

## Environment

- **OS:** Windows (production: Linux)
- **Language/Runtime:** TypeScript / Bun 1.3.11
- **Tool Versions:** ECHO Protocol v0.2.0
- **Commit/State:** Working tree (uncommitted)

## Detailed Description

### Problem

For a task requiring context gathering + research + reasoning, the current flow is:
```
Spawn Detective → wait (45s) → Spawn Researcher → wait (45s) → Spawn Thinker → wait (45s)
= 3 LLM calls × 45s = 135s serial overhead
```

### Expected Behavior

```
Spawn [Detective + Researcher + Thinker] → all run in parallel → wait (45s)
= 1 LLM call + 45s parallel overhead
```

### Root Cause

The current system prompt says to spawn context-gathering agents before making edits, but doesn't explicitly say to fire all independent agents in a single `spawn_agents` call. The infrastructure (`Promise.allSettled` in `spawn-agents.ts` line 91) already supports this.

### Evidence

```text
# Current parallel instruction (savant.ts line 349):
'- **Parallel context gathering:** When you need Detective and Researcher, spawn them in a single spawn_agents call — they have no data dependency and run in parallel via Promise.allSettled.'

# Infrastructure (spawn-agents.ts line 91):
Promise.allSettled(agents.map(...))

# But the instruction only mentions Detective + Researcher
# It doesn't mention Thinker, Scout, or other independent agents
```

## Impact Assessment

### Affected Components

- `agents/savant/savant.ts` — Parallel batching instructions
- `ECHO.md` — Parallel execution documentation

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Low: Minor issue, cosmetic, or edge case
- [x] Medium: Feature degraded, workaround exists

## Proposed Solution

### Approach

Expand the parallel execution instruction to cover all independent agents, not just Detective + Researcher.

### Steps

1. **Update `agents/savant/savant.ts`** — Expand parallel batching instruction:
   ```
   ## Parallel Agent Batching

   When spawning multiple agents that don't depend on each other, fire them
   ALL in a single spawn_agents call. They will run in parallel via Promise.allSettled.

   Independent agents (can run in parallel):
   - Detective + Researcher + Thinker (context gathering + reasoning)
   - Detective + Researcher + Scout (if Scout doesn't depend on Detective results)
   - Multiple bashers (if commands are independent)

   Dependent agents (must wait for predecessor):
   - Scout depends on Detective (needs Detective's file list)
   - Forge depends on Thinker (needs Thinker's plan)
   - Verifier depends on Forge (needs Forge's code changes)

   Batch all independent agents together. Only wait for dependencies when required.
   ```

2. **Update `ECHO.md`** — Document parallel agent batching:
   ```
   ### Parallel Agent Execution

   Infrastructure: `spawn-agents.ts` line 91 uses `Promise.allSettled(agents.map(...))`.
   All agents spawned in a single call run concurrently.

   | Agent Group | Can Parallel? | Dependencies |
   |-------------|---------------|--------------|
   | Detective + Researcher + Thinker | YES | None |
   | Scout | NO | Depends on Detective |
   | Forge | NO | Depends on Thinker |
   | Verifier | NO | Depends on Forge |
   | Multiple bashers | YES | None (if commands independent) |
   ```

### Verification

- `cd packages/agent-runtime && bun run typecheck` — zero errors
- Grep verification: parallel batching instructions present in savant.ts and ECHO.md

## Perfection Loop

### Loop 1

- **RED:** [Pending]
- **GREEN:** [Pending]
- **AUDIT:** [Pending]
- **CHANGE DELTA:** [Pending]

## Resolution

- **Fixed By:** [Pending]
- **Fixed Date:** [Pending]
- **Fix Description:** [Pending]
- **Tests Added:** No (prompt-only changes)
- **Verified By:** [Pending]
- **Commit/PR:** [Pending]
- **Archived:** [Pending — set when moved to `dev/fids/archive/` after implementation + verification]

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

[To be filled after Perfection Loop completion]
