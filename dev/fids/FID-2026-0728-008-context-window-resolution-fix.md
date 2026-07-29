# FID: Context Window Resolution Fails for Gateway Models

**Filename:** `FID-2026-0728-008-context-window-resolution-fix.md`
**ID:** FID-2026-0728-008
**Severity:** high
**Status:** created
**Created:** 2026-07-28 18:00
**Author:** Savant (Orchestrator)

---

## Summary

`findContextLengthFromOpenRouter()` in `cli/src/utils/openrouter-models.ts` cannot match gateway model IDs (e.g. `opencode-go/mimo-v2.5`) to their OpenRouter counterparts (e.g. `xiaomi/mimo-v2.5`) because the vendor prefix stripping produces a canonical ID (`mimo-v2.5`) that doesn't exist in the OpenRouter catalog. This causes the function to return `undefined`, falling back to `inferContextLength()` which returns a hardcoded value (e.g. 128k) that may be inaccurate. The token counter then displays `x/128.0k` instead of the real context window from the live OpenRouter API.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript 5.5 / Bun 1.3.14
- **Tool Versions:** CLI v0.0.9 (pre-release)
- **Commit/State:** main branch, uncommitted changes from v0.0.9 launch tracks

## Detailed Description

### Problem

When a user selects a gateway model (e.g. `opencode-go/mimo-v2.5`), the context window displayed in the token counter shows `x/128.0k` instead of the actual context length from the OpenRouter API. This is because `findContextLengthFromOpenRouter()` fails to find the model in the live OpenRouter catalog.

### Expected Behavior

The context window should reflect the actual value returned by the OpenRouter API for the selected model (e.g. the real context length of MiMo V2.5, which may differ from 128k).

### Root Cause

`findContextLengthFromOpenRouter()` has a 3-step matching process:

1. **Exact canonical match:** `toCanonicalModelId('opencode-go/mimo-v2.5')` strips `opencode-go/` → `mimo-v2.5`. OpenRouter catalogs `xiaomi/mimo-v2.5`. No match.
2. **Without-provider match:** `mimo-v2.5` → no prefix to strip → same ID. No match.
3. **Family match:** strips `-2.5` → `mimo`. No OpenRouter ID starts with `mimo` (they start with `xiaomi/`).

All 3 steps fail. Returns `undefined`. Falls back to `inferContextLength('MiMo V2.5')` → `128_000`.

The core issue: gateway model IDs use `opencode-go/` as a provider prefix, but OpenRouter uses the actual vendor prefix (`xiaomi/`, `moonshotai/`, `deepseek/`, etc.). The canonical ID transformation strips the gateway prefix but doesn't restore the OpenRouter vendor prefix.

### Evidence

```text
// toCanonicalModelId strips opencode-go/ but doesn't map to OpenRouter vendor
toCanonicalModelId('opencode-go/mimo-v2.5') → 'mimo-v2.5'
// OpenRouter catalog has: 'xiaomi/mimo-v2.5' with context_length from API
// No match → falls back to inferContextLength('MiMo V2.5') → 128_000
```

The OpenCode Go catalog in `OPENCODE_GO_CATALOG`:
```typescript
{ id: 'opencode-go/mimo-v2.5', name: 'MiMo V2.5', provider: 'opencode-go' },
{ id: 'opencode-go/kimi-k3', name: 'Kimi K3', provider: 'opencode-go' },
{ id: 'opencode-go/deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'opencode-go' },
```

OpenRouter catalog (live from API):
```typescript
{ id: 'xiaomi/mimo-v2.5', name: 'MiMo V2.5', context_length: <actual> }
{ id: 'moonshotai/kimi-k3', name: 'Kimi K3', context_length: <actual> }
{ id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', context_length: <actual> }
```

## Impact Assessment

### Affected Components

- `cli/src/utils/openrouter-models.ts` — `findContextLengthFromOpenRouter()` function
- `cli/src/utils/openrouter-models.ts` — `resolveContextWindowForModel()` function
- Token counter UI (indirectly — displays incorrect context window)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

**Justification:** Users cannot see their actual context window for any gateway model. This affects model selection UX and could cause users to unknowingly exceed context limits.

## Proposed Solution

### Approach

Add a name-based fallback to `findContextLengthFromOpenRouter()`. When all ID-based matching fails, look up the model's display name from the gateway catalog (`GATEWAY_MODELS`) and search the OpenRouter catalog for a model with the same name (case-insensitive). Gateway and OpenRouter use the same human-readable names (e.g. "MiMo V2.5"), so name-based matching is reliable.

### Steps

1. Read `cli/src/utils/openrouter-models.ts` 0-EOF (Law 1)
2. In `findContextLengthFromOpenRouter()`, after the existing family-match step, add a name-based fallback:
   - Look up the model's `name` from `findGatewayModel(modelId)`
   - Search the OpenRouter catalog for a model whose `name` matches (case-insensitive)
   - Return that model's `contextLength` if found
3. Run `cd cli && bun run typecheck` to verify
4. Run ESLint on the changed file to verify zero warnings
5. Mark FID status as fixed → verified → closed

### Verification

- Typecheck passes: `cd cli && bun run typecheck`
- ESLint passes: `bun x eslint cli/src/utils/openrouter-models.ts --max-warnings 0`
- Context window for `opencode-go/mimo-v2.5` resolves to the OpenRouter API value instead of 128k

## Perfection Loop

### Loop 1

- **RED:** (pending — will catalog issues during RED phase)
- **GREEN:** (pending)
- **AUDIT:** (pending)
- **CHANGE DELTA:** ~10-15 lines expected (single function addition)

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: *"What questions should I have asked when this FID was created, but failed to?"*

1. *Could the name-based fallback match multiple OpenRouter models?* — Yes, but OpenRouter model names are unique per vendor. In the rare case of duplicates, the first match is returned (same behavior as ID-based matching). This is acceptable.
2. *What if the gateway model doesn't have a name?* — `findGatewayModel()` returns `undefined` if the model isn't in the gateway catalog, so the name check is null-safe. If `gatewayModel?.name` is undefined, the fallback is skipped.
3. *Does this affect non-gateway models (OpenRouter, TokenRouter, NVIDIA)?* — No. Those models already have IDs that match their OpenRouter counterparts directly. The name fallback is only reached when ID-based matching fails, which only happens for gateway models with different vendor prefixes.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that the code referenced in this FID actually exists.

- [ ] Files referenced in "Affected Components" exist in the codebase
- [ ] Implementation matches the proposed solution
- [ ] Typecheck passes
- [ ] FID status updated to reflect actual implementation state

### Loop 2 (if needed)

- **RED:** (pending)
- **GREEN:** (pending)
- **AUDIT:** (pending)
- **CHANGE DELTA:** (pending)

## Resolution

- **Fixed By:** (pending)
- **Fixed Date:** (pending)
- **Fix Description:** Added name-based fallback to `findContextLengthFromOpenRouter()` for gateway models whose IDs don't map 1:1 to OpenRouter IDs.
- **Tests Added:** No (existing typecheck coverage is sufficient; runtime verification requires live OpenRouter API)
- **Verified By:** Typecheck + ESLint
- **Commit/PR:** (pending)
- **Archived:** (pending)

## Lessons Learned

1. When matching models across different provider catalogs, don't rely solely on ID-based matching. Human-readable model names are a reliable secondary key.
2. `inferContextLength()` should be a last-resort fallback, not the primary source for context window values when live API data is available.
3. Gateway model IDs need a mapping layer to their provider-native IDs — this FID addresses the symptom (context window), but the same mapping issue could affect other features that compare models across catalogs.
