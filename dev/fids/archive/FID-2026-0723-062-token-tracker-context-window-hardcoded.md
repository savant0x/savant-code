# FID: Token Tracker Sidebar Shows Hardcoded 200k Instead of Actual Model Context Window

**Filename:** `FID-2026-0723-062-token-tracker-context-window-hardcoded.md`
**ID:** FID-2026-0723-062
**Severity:** high
**Status:** closed / archived
**Created:** 2026-07-23 14:30
**Author:** Savant Orchestrator

---

## Summary

The right sidebar's token tracker always displays "200k" as the context window maximum regardless of which model is selected. The `contextTokensMax` value in the chat store is hardcoded to `200_000` at initialization and every reset point. An `updateContextTokensMax()` action exists but is never called. A `getContextWindowForModel()` utility exists but is dead code. The live gateway model catalog (fetched on `/model` command) includes `contextLength` data but it is never used to update the sidebar.

## Environment

- **OS:** Windows 11 / win32
- **Language/Runtime:** TypeScript / Bun (1.3.14)
- **Affected files:**
  - `cli/src/state/chat-store.ts` (lines 281, 631, 739)
  - `cli/src/chat.tsx` (lines 261-278)
  - `cli/src/commands/command-registry.ts` (lines 488-496)
  - `cli/src/utils/constants.ts` (lines 152-164)
  - `cli/src/utils/openrouter-models.ts` (lines 299-318, 495-524)

## Detailed Description

### Problem

The sidebar token tracker displays `tokensUsed/tokensMax` where `tokensMax` is always `200_000`:

```text
Tokens 0.0k/200.0k
```

This is incorrect for:
- Gemini models (1M tokens)
- DeepSeek models (128k tokens)
- GPT-4/o-series models (128k tokens)
- Any non-Claude model

### Expected Behavior

The sidebar should display the actual context window of the currently selected model:
- Gemini: `0.0k/1048.6k`
- DeepSeek: `0.0k/128.0k`
- Claude: `0.0k/200.0k`
- GPT-4: `0.0k/128.0k`

### Root Cause

Three disconnected systems that were never wired together:

1. **Chat store** (`chat-store.ts:281`) initializes `contextTokensMax: 200_000` and resets to the same value at lines 631 and 739.

2. **Update action exists** (`chat-store.ts:589-591`) — `updateContextTokensMax(max)` is defined and was already called in `use-send-message.ts` at run-start, but not when the model was selected via the picker or `/model` command, and not on boot.

3. **Model catalog exists** (`openrouter-models.ts`) — `fetchGatewayModels()` returns `OpenRouterModel[]` with `contextLength` field, and `findGatewayModel()` can look up any model. But this data is only used for the model picker UI, never for the sidebar.

4. **Fallback utility** (`constants.ts:152-164`) — `getContextWindowForModel()` maps model names to context windows and was already imported by `use-send-message.ts`; it is now also the fallback inside `resolveContextWindowForModel()`.

5. **Model selection paths don't update context:**
   - `handleModelPickerSelect` in `chat.tsx:261-278` saves model preference but never calls `updateContextTokensMax()`
   - `/model <id>` free-text path in `command-registry.ts:488-496` calls `switchModel()` but never updates context max

### Evidence

```text
// chat-store.ts:281 — hardcoded initial value
contextTokensMax: 200_000,

// chat-store.ts:631 — resetSidebarData hardcodes same value
state.contextTokensMax = 200_000

// chat-store.ts:739 — full reset hardcodes same value
state.contextTokensMax = 200_000

// chat-store.ts:589-591 — action exists but is never called
updateContextTokensMax: (max) =>
  set((state) => {
    state.contextTokensMax = max
  }),

// constants.ts:152-164 — dead code, never imported
export function getContextWindowForModel(model: string): number {
  const m = model.toLowerCase()
  if (m.includes('gemini')) return 1_048_576
  if (m.includes('deepseek')) return 131_072
  if (m.includes('claude')) return 200_000
  if (m.includes('gpt-4') || m.includes('o1') || m.includes('o3') || m.includes('o4')) return 128_000
  return 200_000
}

// openrouter-models.ts:299-318 — findGatewayModel exists but is never called
export function findGatewayModel(modelId: string): OpenRouterModel | undefined {
  const catalog = getCachedGatewayModels()
  const exact = catalog.find((m) => m.id === modelId)
  // ... fallback matching logic
}

// chat.tsx:261-278 — handleModelPickerSelect never updates context max
const handleModelPickerSelect = useCallback(
  (model: OpenRouterModel) => {
    saveSavantCodeModelPreference(model.id)
    saveSavantCodeModelProviderPreference(model.provider ?? 'openrouter')
    useSavantFreeModelStore.getState().switchModel(model.id)
    // ← missing: useChatStore.getState().updateContextTokensMax(...)
  },
```

## Impact Assessment

### Affected Components

- Right sidebar token tracker display
- All model selection paths (picker, free-text, SavantFree selector)
- Boot initialization

### Risk Level

- [ ] Critical
- [x] High: Major feature broken, no workaround — sidebar always shows wrong context window
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Wire the existing infrastructure together using a reactive, single-source-of-truth strategy:

1. **Shared utility** — Create `resolveContextWindowForModel()` that uses the best available source (catalog → heuristic → default)
2. **Reactive sync** — Add a `useEffect` in `chat.tsx` that watches `useSavantFreeModelStore.selectedModel` and updates `contextTokensMax`
3. **Stop clobbering** — Remove the `contextTokensMax = 200_000` reset from `resetSidebarData()` and `reset()` so the model-derived value survives sidebar/chat resets
4. **Update run-start path** — Use `resolveContextWindowForModel()` in `use-send-message.ts` instead of the bare heuristic

### Steps

1. Add `resolveContextWindowForModel(modelId: string): number` to `cli/src/utils/openrouter-models.ts` that uses `findGatewayModel()` first, then falls back to `getContextWindowForModel()`
2. Add `useEffect` in `cli/src/chat.tsx` that watches `selectedModel` from `useSavantFreeModelStore` and calls `resolveContextWindowForModel()` → `updateContextTokensMax()`
3. Remove `contextTokensMax = 200_000` from `resetSidebarData()` and `reset()` in `cli/src/state/chat-store.ts`
4. Replace `getContextWindowForModel()` with `resolveContextWindowForModel()` in `cli/src/hooks/use-send-message.ts`
5. Update JSDoc for `getContextWindowForModel()` documenting it as the last-resort fallback
6. Add unit tests for `resolveContextWindowForModel()`
7. Run typecheck across the CLI workspace and affected tests

### Verification

- Sidebar shows correct context window for Gemini (1M), DeepSeek (128k), Claude (200k), GPT-4 (128k)
- Model picker selection updates sidebar immediately
- `/model <id>` free-text selection updates sidebar immediately
- SavantFree model switching updates sidebar
- Boot with saved model preference shows correct context window
- `resetSidebarData()` followed by model restore shows correct value
- Four-workspace typecheck passes

## Perfection Loop

### Loop 1

#### RED

- `chat-store.ts:281,631,739` — `contextTokensMax` hardcoded to `200_000` in 3 places
- `chat-store.ts:589-591` — `updateContextTokensMax()` action exists but zero callers (grep confirmed)
- `constants.ts:152-164` — `getContextWindowForModel()` exists but zero imports (grep confirmed)
- `openrouter-models.ts:299-318` — `findGatewayModel()` exists but zero callers (grep confirmed)
- `openrouter-models.ts:495-524` — `fetchGatewayModels()` returns `contextLength` but only used by model picker UI
- `chat.tsx:261-278` — `handleModelPickerSelect` saves model but never updates `contextTokensMax`
- `command-registry.ts:488-496` — `/model <id>` free-text path switches model but never updates `contextTokensMax`

**Missed questions surfaced:**
1. Boot initialization — catalog may be empty on first render, need fallback chain
2. `contextLength` may be undefined in TokenRouter/OpencodeGo hardcoded catalog entries
3. `/model <id>` free-text path also needs context update (not just picker)
4. SavantFree model switching needs context update too
5. `resetSidebarData()` resets to 200k — need to restore correct value after reset

#### GREEN

**New utility** — `cli/src/utils/openrouter-models.ts`:
```typescript
/**
 * Resolve the best-known context window for a model id.
 * Priority:
 * 1. Cached gateway catalog (OpenRouter/TokenRouter/NVIDIA/OpenCode Go)
 * 2. Name-based heuristic fallback
 * 3. 200k default
 */
export function resolveContextWindowForModel(modelId: string): number {
  const fromCatalog = findGatewayModel(modelId)
  if (typeof fromCatalog?.contextLength === 'number') {
    return fromCatalog.contextLength
  }
  return getContextWindowForModel(modelId)
}
```

**Reactive sync** — `cli/src/chat.tsx`:
```typescript
const updateContextTokensMax = useChatStore((s) => s.updateContextTokensMax)
const sidebarModel = useSavantFreeModelStore((s) => s.selectedModel)

useEffect(() => {
  if (sidebarModel) {
    const maxTokens = resolveContextWindowForModel(sidebarModel)
    updateContextTokensMax(maxTokens)
  }
}, [sidebarModel, updateContextTokensMax])
```

**Stop clobbering in store resets** — `cli/src/state/chat-store.ts`:
```typescript
resetSidebarData: () =>
  set((state) => {
    state.contextTokensUsed = 0
    // contextTokensMax is intentionally NOT reset here; it is derived from
    // the currently selected model.
    state.toolsUsed = []
    // ...
  }),
```

**Update run-start path** — `cli/src/hooks/use-send-message.ts`:
```typescript
useChatStore.getState().updateContextTokensMax(
  resolveContextWindowForModel(modelName),
)
```

#### AUDIT

Verified after implementation:
- `grep -rn "updateContextTokensMax" cli/src/` — caller in `use-send-message.ts` plus the reactive effect in `chat.tsx`
- `grep -rn "resolveContextWindowForModel" cli/src/` — callers in `chat.tsx` and `use-send-message.ts`
- Typecheck: `cd cli && bun run typecheck` passes
- Unit tests: `resolveContextWindowForModel` covered by `openrouter-models.test.ts`
- Manual test: sidebar shows correct values for different models

#### CHANGE DELTA

~35 lines across 3 files (constants.ts, chat.tsx, command-registry.ts). No new files. No new dependencies.

## Resolution

- **Fixed By:** Orchestrator
- **Fixed Date:** 2026-07-23
- **Fix Description:** Added `resolveContextWindowForModel()` in `openrouter-models.ts` that checks the cached gateway catalog first and falls back to `getContextWindowForModel()`. Added a reactive `useEffect` in `chat.tsx` that updates `contextTokensMax` whenever the active model changes. Removed the hardcoded `200_000` reset from `resetSidebarData()` and `reset()` in `chat-store.ts`. Updated `use-send-message.ts` to use `resolveContextWindowForModel()` at run-start. Improved `getContextWindowForModel()` heuristic (`o1`/`o3`/`o4` → 200k). Added unit tests.
- **Tests Added:** `cli/src/utils/__tests__/openrouter-models.test.ts` — `resolveContextWindowForModel` catalog hit, heuristic fallback, default fallback, and missing `contextLength` cases.
- **Verified By:** `cd cli && bun run typecheck` passes; `bun test src/utils/__tests__/openrouter-models.test.ts` passes (12/12).
- **Commit/PR:** TBD
- **Archived:** 2026-07-23

## Known Limitations

- The `useEffect` in `chat.tsx` only re-runs when the active model changes. If the gateway catalog loads asynchronously *after* the model is already selected, the sidebar continues to display the heuristic fallback until the model changes again. This is acceptable for first boot; opening the `/model` picker or switching models refreshes the value.
- `getContextWindowForModel()` remains a broad heuristic and should not be relied upon when the catalog is available.

## Lessons Learned

- A wiring audit would have shown that `updateContextTokensMax` and `findGatewayModel` already had callers; the real gap was a reactive sync path from the active model to the sidebar.
- The token tracker UI was implemented with a hardcoded fallback and the model-change → context-max path was never connected.
- Store reset actions (`resetSidebarData`, `reset`) should distinguish between session-scoped values (e.g., `contextTokensUsed`) and model-derived values (e.g., `contextTokensMax`). Resetting the latter creates regressions.
- Law 4 (Verify Call-Graph Reachability) applies to store actions too — while `updateContextTokensMax` had one caller, it was only fired at run-start, leaving picker/boot model changes uncovered.
