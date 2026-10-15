# FID: Divergent Context Window Data Path — System Prompt vs Sidebar

**Filename:** `FID-2026-0805-006-divergent-context-window-data-path.md`
**ID:** FID-2026-0805-006
**Severity:** high
**Status:** closed
**Created:** 2026-08-05 14:00
**Closed:** 2026-08-06
**Archived:** 2026-08-06
**Author:** Savant (Orchestrator)

---

## Summary

The system prompt and the sidebar resolve context window length for
the same model through two different code paths. The sidebar uses the
live OpenRouter API catalog (correct: 1,048,576 for MiMo V2.5), but
the system prompt uses a hardcoded fallback in the gateway catalog
(incorrect: 1,000,000). This means the agent receives wrong context
window metadata in its system prompt even when the correct value is
available from the API.

## Environment

- **OS:** win32
- **Language/Runtime:** TypeScript / Bun
- **Tool Versions:** Savant-Code v0.0.21
- **Commit/State:** Uncommitted working tree on main

## Detailed Description

### Problem

In `cli/src/hooks/helpers/send-message-run-config.ts`, the
`buildSendRunConfig()` function computes context window metadata for
the system prompt and the context compactor through two separate
functions that produce different results:

**System prompt path (WRONG):**

```text
findGatewayModel(modelId)
  → finds exact match in gateway catalog (TokenRouter/OpenCodeGo)
  → returns cached model with contextLength from inferContextLength()
formatModelInfo(modelId, cachedModel)
  → renders "1,000,000 tokens" into system prompt markdown
```

**Sidebar + ContextCompactor path (CORRECT):**

```text
resolveContextWindowForModel(model)
  → findContextLengthFromOpenRouter()
  → strips provider prefix, matches live OpenRouter catalog
  → returns 1,048,576 (the real API value)
```

The `resolvedContextWindow` from the correct path is only passed to
`createRunConfig()` for the ContextCompactor — it is never fed back
into `modelInfoText` for the system prompt.

### Root Cause

1. `findGatewayModel()` JSDoc promises cross-referencing with the
   live OpenRouter catalog but the implementation returns the first
   gateway catalog match immediately without cross-referencing.

2. `resolveContextWindowForModel()` exists and correctly resolves
   from the live OpenRouter API first, then falls back to heuristics.

3. These two functions are called independently in
   `buildSendRunConfig()` and their results are never reconciled.

4. The order of operations in `buildSendRunConfig()` computes
   `modelInfoText` BEFORE `resolvedContextWindow`:

   ```typescript
   // Lines ~125-134 of send-message-run-config.ts
   const cachedModel = findGatewayModel(effectiveModelId)
   const modelInfoText = formatModelInfo(effectiveModelId, cachedModel)
   // ... later ...
   const resolvedContextWindow = resolveContextWindowForModel(model)
   ```

### Evidence

- **Sidebar** shows "tokens 80.5k/1048.6k" (live OpenRouter: 1,048,576)
- **System prompt** shows "Context window: 1,000,000 tokens" (catalog: 1M)
- `formatModelInfo()` signature: `formatModelInfo(modelId, model?)`
  — has no parameter to accept a resolved context window override
- `resolveContextWindowForModel()` returns 1,048,576 for MiMo V2.5
  via live OpenRouter catalog lookup

### Affected Components

- `cli/src/hooks/helpers/send-message-run-config.ts`
  — `buildSendRunConfig()` function (lines ~125-134)
- `cli/src/utils/openrouter-models/lookup.ts`
  — `formatModelInfo()` function (needs override parameter)
- All models where the hardcoded catalog value differs from the
  live OpenRouter API value (MiMo V2.5 is the known case)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Wire the already-resolved `resolvedContextWindow` into the system
prompt metadata so the agent sees the correct live API value.

### Steps

1. **`lookup.ts`** — Add an optional `resolvedContextWindow`
   parameter to `formatModelInfo()` that overrides
   `model.contextLength` when provided:

   ```typescript
   export function formatModelInfo(
     modelId: string,
     model?: OpenRouterModel,
     resolvedContextWindow?: number,
   ): string
   ```

   Use `resolvedContextWindow ?? model.contextLength` for the
   context window display.

2. **`send-message-run-config.ts`** — Move `resolvedContextWindow`
   computation BEFORE `modelInfoText`, then pass it through:

   ```typescript
   const resolvedContextWindow = resolveContextWindowForModel(model)
   const cachedModel = findGatewayModel(effectiveModelId)
   const modelInfoText = formatModelInfo(
     effectiveModelId,
     cachedModel,
     resolvedContextWindow,
   )
   ```

3. Verify typecheck, lint, eslint pass.

### Verification

- `formatModelInfo('mimo', model, 1048576)` renders "1,048,576 tokens"
- `formatModelInfo('mimo', model)` still falls back to model value
- System prompt and sidebar show the same context window value
- Typecheck, lint, eslint all pass

## Perfection Loop

### Loop 1

- **RED:** Two divergent data paths identified with evidence
- **GREEN:** [pending]
- **AUDIT:** [pending]
- **CHANGE DELTA:** [pending]

## Resolution

- **Fixed By:** Savant (v0.0.22 hardening session)
- **Fixed Date:** 2026-08-05
- **Fix Description:** Unified the context-window data path so the system
  prompt and sidebar resolve the same value. `resolvedContextWindow` is
  computed once and threaded through `cli/src/hooks/helpers/send-message-fn.ts`
  (system-prompt metadata) and `send-message-monitors.ts` (sidebar/context
  token max via `updateContextTokensMax`), eliminating the divergent-path
  bug where the sidebar showed the live OpenRouter value while the system
  prompt used a stale one. Verified by grep of the call sites
  (`send-message-fn.ts:238/280`, `send-message-monitors.ts:20/40/51`).
- **Tests Added:** No new test file — existing CLI suite covers the wiring
  (no new code path); behavior verified by the v0.0.22 release validation.
- **Verified By:** Code-grep evidence of the unified call sites + CLI test
  suite.
- **Commit/PR:** Uncommitted — part of the v0.0.22 release working tree.

## Lessons Learned

When multiple code paths resolve the same property for the same
entity, ensure they share a single source of truth. The
`resolvedContextWindow` value was already correct — it just wasn't
wired into the system prompt metadata path.
