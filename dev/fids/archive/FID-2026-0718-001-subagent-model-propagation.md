# FID: Subagent Model Propagation Bug

**Filename:** `FID-2026-0718-001-subagent-model-propagation.md`
**ID:** FID-2026-0718-001
**Severity:** high
**Status:** closed
**Created:** 2026-07-18 00:00
**Author:** Savant Orchestrator

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0718-001`. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

When a user selects a model in Freebuff mode, only the root orchestrator uses that model. Subagents (basher, researcher-web, researcher-docs, browser-use, file-lister, scout) are hardcoded to `google/gemini-3.1-flash-lite` and ignore the parent agent's model. This causes inconsistent model usage and routes user work to a different model than the one selected.

## Environment

- **OS:** Windows / Linux / macOS (all platforms)
- **Language/Runtime:** TypeScript / Bun
- **Tool Versions:** ECHO Protocol v0.2.0
- **Commit/State:** main branch, post-FID-2026-0717-016

## Detailed Description

### Problem

The user-selected model is not propagated to spawned subagents. Utility subagents have hardcoded `model: GEMINI_3_1_FLASH_LITE_MODEL_ID` in their agent definitions. When the root agent spawns them, they continue using Gemini Flash Lite regardless of the parent's model.

### Expected Behavior

All agents spawned by a parent should inherit the parent's model unless explicitly configured otherwise. If the user selects Kimi, DeepSeek, MiniMax, etc., every subagent should use that same model.

### Root Cause

1. Agent definitions hardcode the model:
   - `agents/basher.ts`
   - `agents/researcher/researcher-web.ts`
   - `agents/researcher/researcher-docs.ts`
   - `agents/browser-use/browser-use.ts`
   - `agents/file-explorer/file-lister.ts`
   - `agents/scout/scout.ts`
2. `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` and `spawn-agent-inline.ts` load the child template but do not override its `model` with the parent template's model.
3. There is no runtime mechanism to propagate the parent model to children.

### Evidence

```text
agents/basher.ts:13:  model: GEMINI_3_1_FLASH_LITE_MODEL_ID,
agents/researcher/researcher-web.ts:11:  model: GEMINI_3_1_FLASH_LITE_MODEL_ID,
agents/researcher/researcher-docs.ts:11:  model: GEMINI_3_1_FLASH_LITE_MODEL_ID,
agents/browser-use/browser-use.ts:8:  model: GEMINI_3_1_FLASH_LITE_MODEL_ID,
agents/file-explorer/file-lister.ts:9:  model: GEMINI_3_1_FLASH_LITE_MODEL_ID,
agents/scout/scout.ts:19:  model: isMax ? GEMINI_3_1_FLASH_LITE_MODEL_ID : 'google/gemini-2.5-flash-lite',
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts`
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` (helper)
- All utility subagent definitions listed above

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Introduce a runtime model inheritance helper. When a subagent is spawned, clone the child agent template and override its `model` field with the parent agent template's `model`. Apply this in both `spawn_agents` and `spawn_agent_inline` handlers.

### Steps

1. Add `withParentModel(agentTemplate, parentAgentTemplate)` helper in `spawn-agent-utils.ts` that returns a cloned template with the parent's model.
2. In `spawn-agents.ts`, after `validateAndGetAgentTemplate`, apply `withParentModel` before creating subagent state or executing.
3. In `spawn-agent-inline.ts`, apply the same override before creating the inline template.
4. Add tests that verify spawned subagents inherit the parent's model.
5. Run typecheck and relevant tests.

### Verification

- Typecheck passes for modified `packages/agent-runtime` files.
- Unit tests for `spawn-agents-permissions.test.ts` pass (39/39).
- New tests verify that spawned subagents and inline subagents use the parent model.

## Perfection Loop

### Loop 1

- **RED:** Subagents ignore parent model; hardcoded to Gemini Flash Lite.
- **GREEN:** Add `withParentModel` helper and apply in spawn handlers.
- **AUDIT:**
  - `bun run --cwd=packages/agent-runtime typecheck` — no errors in modified files.
  - `bun test packages/agent-runtime/src/__tests__/spawn-agents-permissions.test.ts` — 39/39 passed.
- **CHANGE DELTA:** Minimal — one helper function and two spawn handler call sites plus two new tests.

## Resolution

- **Fixed By:** Savant Orchestrator
- **Fixed Date:** 2026-07-18
- **Fix Description:** Added `withParentModel` helper in `spawn-agent-utils.ts` and applied it in `spawn-agents.ts` and `spawn-agent-inline.ts` so every spawned subagent inherits the parent agent's model. Added unit tests verifying model inheritance for both `spawn_agents` and `spawn_agent_inline`.
- **Tests Added:** Yes — model inheritance tests for `spawn_agents` and `spawn_agent_inline`.
- **Verified By:** Typecheck + unit tests.
- **Commit/PR:** TBD
- **Archived:** 2026-07-18

## Lessons Learned

Agent defaults should be overridable by runtime context. Hardcoding models in subagent definitions without propagation creates surprising behavior for users who explicitly choose a model.

## Missed Questions

When this FID was created, the following questions should have been asked and answered:

1. **Will this work for ALL cases, not just the common case?**
   - Yes. Every spawned subagent will inherit the parent model, including nested subagents, because each child becomes a parent with the inherited model.

2. **Will this scale to 1000 agents, not just 10?**
   - Yes. The override is a shallow clone at spawn time; it adds negligible overhead and no shared mutable state.

3. **Will this survive a hostile attacker, not just an honest user?**
   - Yes. The model is inherited from the trusted parent template, not from user input. The existing agent validation and permission checks still run before the override.

4. **Will this be maintainable in 2 years, not just today?**
   - Yes. The helper is a single function in `spawn-agent-utils.ts` with a clear responsibility. Future subagents do not need to change their definitions.

5. **Does this set the standard for the industry, not just meet it?**
   - Yes. Model consistency across an agent hierarchy is expected behavior for any multi-agent system.
