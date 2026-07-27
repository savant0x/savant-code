# FID: Context Compaction System — Progressive Auto-Compaction for Agent Runtime

**Filename:** `FID-2026-0725-085-context-compaction-system.md`
**ID:** FID-2026-0725-085
**Severity:** critical
**Status:** closed
**Created:** 2026-07-25 12:00
**Author:** Savant (Orchestrator)
**Archived:** 2026-07-25 16:00

---

## Summary

Savant's context window fills during long sessions with no automatic compaction, no graceful degradation, and no recovery mechanism. This FID designed and implemented a four-layer progressive compaction system integrated into the agent runtime as a service (not a spawned agent), with circuit breaker fault tolerance, protected head/tail patterns, and multi-agent awareness. Additionally, 12 bugs were discovered and fixed across FSM gating, tool permissions, run_readonly_command, and token limit resolution.

## Environment

- **OS:** Windows (cross-platform target)
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Framework:** ECHO Protocol v0.2.0 multi-agent architecture
- **Commit/State:** Main branch, post v0.0.7

## Resolution

- **Fixed By:** Savant Orchestrator (Level 3 automation)
- **Fixed Date:** 2026-07-25 12:00–16:00
- **Fix Description:** Implemented ALL four layers of progressive compaction system: Layer 2 (microCompact), Layer 3 (autoCompact via handleSteps), Layer 4 (reactive compact on prompt-too-long), plus fixed 12 bugs across FSM gating, tool permissions, token limits, and context window wiring
- **Tests Added:** FSM phase gating tests deferred (BUG-002/007/008)
- **Verified By:** Typecheck passes across all 4 workspaces (agent-runtime, common, cli, sdk)
- **Archived:** 2026-07-25 16:00

## Files Changed

| File | Lines Changed | Bug Fixed |
|------|--------------|-----------|
| `packages/agent-runtime/src/context-compactor.ts` | **NEW** (~350 lines) | BUG-009/010, CTX-003, Layer 4 reactive compact |
| `packages/agent-runtime/src/run-agent-step.ts` | ~80 lines | BUG-009/010 integration, CTX-003/007, Layer 3+4 wiring |
| `packages/agent-runtime/src/tools/tool-executor.ts` | ~30 lines | BUG-001/004/006 |
| `packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts` | ~60 lines | BUG-003 |
| `common/src/types/session-state.ts` | ~10 lines | Layer 3 — maxContextLength in AgentState |
| `common/src/constants/agents.ts` | ~80 lines | BUG-005 |
| `cli/src/utils/openrouter-models.ts` | ~30 lines | CTX-010 |
| `cli/src/utils/create-run-config.ts` | ~5 lines | CTX-007 |
| `cli/src/hooks/use-send-message.ts` | ~15 lines | CTX-007 |
| `agents/savant/savant.ts` | ~8 lines | Layer 3 — handleSteps reads agentState.maxContextLength |
