# FID: Inject Accurate Runtime Model Metadata from OpenRouter into Agent Prompt

**Filename:** `FID-2026-0722-054-openrouter-model-metadata-in-prompt.md`
**ID:** FID-2026-0722-054
**Severity:** medium
**Status:** closed
**Created:** 2026-07-22 19:15
**Author:** Savant Orchestrator

---

## Summary

The orchestrator system prompt hardcodes a fallback model string (`anthropic/claude-opus-4.8`) at template-build time. When the runtime uses a different user-selected model, the agent is told it is running on the wrong model. This FID replaces the hardcoded claim with a dynamic, accurate model information block built from the live OpenRouter catalog, fetched and cached on each CLI launch.

## Environment

- **OS:** Windows 11 / win32
- **Language/Runtime:** TypeScript / Bun (1.3.14)
- **Affected files:**
  - `cli/src/utils/openrouter-models.ts`
  - `cli/src/index.tsx`
  - `agents/savant/savant.ts`
  - `packages/agent-runtime/src/templates/types.ts`
  - `packages/agent-runtime/src/templates/strings.ts`
  - `packages/agent-runtime/src/run-agent-step.ts`
  - `packages/agent-runtime/src/main-prompt.ts`
- **Test reports:** `dev/scratchpad/agent-capabilities-test-report.md`

## Detailed Description

### Problem

`agents/savant/savant.ts` builds the system prompt with a hardcoded fallback:

```ts
const model =
  modelOverride ??
  (mode === 'lite' || mode === 'free'
    ? SAVANT_FREE_MINIMAX_M3_MODEL_ID
    : 'anthropic/claude-opus-4.8')
```

That value is then embedded in the prompt:

```ts
You are running on the ${model} model.
```

The actual runtime model comes from the agent template's `model` field and is selected by the user via the CLI model picker or SavantFree model store. When a user selects, for example, `openai/gpt-5` or `tokenrouter/kimi-k2p7-code`, the prompt still claims the agent is on `anthropic/claude-opus-4.8`. This was observed in the capabilities test report where the agent self-identified as `anthropic/claude-opus-4.8` even though the runtime model may have been different.

### Expected Behavior

The system prompt should contain accurate, current information about the model the agent is actually running on, including:
- Human-readable name
- Canonical model id
- Provider
- Context window
- Max completion tokens
- Pricing (input/output per 1M tokens)
- Modalities
- Knowledge cutoff
- Description

If OpenRouter metadata is unavailable, the prompt should gracefully fall back to the model id and provider.

### Root Cause

The `createSavant` function resolves a model id at agent-definition time and interpolates it into the system prompt string. There is no mechanism to look up richer metadata or substitute it at runtime when the actual LLM call is made.

### Evidence

From `agents/savant/savant.ts`:

```ts
const model =
  modelOverride ??
  (mode === 'lite' || mode === 'free'
    ? SAVANT_FREE_MINIMAX_M3_MODEL_ID
    : 'anthropic/claude-opus-4.8')
```

And later:

```ts
You are running on the ${model} model.
```

## Impact Assessment

### Affected Components

- `cli/src/utils/openrouter-models.ts` — catalog type and parsing
- `cli/src/index.tsx` — boot-time catalog fetch
- `agents/savant/savant.ts` — system prompt template
- `packages/agent-runtime/src/templates/types.ts` — placeholder enum
- `packages/agent-runtime/src/templates/strings.ts` — placeholder substitution
- `packages/agent-runtime/src/run-agent-step.ts` — runtime parameter threading
- `packages/agent-runtime/src/main-prompt.ts` — runtime entry point

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Agent has incorrect self-knowledge; fix improves accuracy and user trust
- [ ] Low

## Proposed Solution

### Approach

1. Extend the `OpenRouterModel` type and `parseCatalog` in `cli/src/utils/openrouter-models.ts` to capture the full metadata available from OpenRouter's `/api/v1/models` endpoint.
2. Trigger a non-blocking fetch of the OpenRouter catalog early in `cli/src/index.tsx` so the cache is warm before the first chat prompt.
3. Add a `MODEL_INFO` placeholder to the agent template placeholder system.
4. Replace the hardcoded `You are running on the ${model} model.` line in `agents/savant/savant.ts` with `${PLACEHOLDER.MODEL_INFO}`.
5. At runtime, resolve `PLACEHOLDER.MODEL_INFO` by looking up the active model id in the cached OpenRouter catalog and formatting a concise markdown block.
6. For models not in the catalog (TokenRouter, NVIDIA, OpenCode Go, local/custom), fall back to a minimal block using the model id and provider.

### Detailed Model Block Format

```markdown
# Model Information

You are running on **<name>** (`<id>`).
- **Provider:** <provider>
- **Context window:** <context_length> tokens
- **Max completion tokens:** <max_completion_tokens>
- **Input price:** $<prompt_price> per 1M tokens
- **Output price:** $<completion_price> per 1M tokens
- **Modalities:** <modality>
- **Knowledge cutoff:** <knowledge_cutoff>
- **Description:** <description>
```

### Steps

1. **Extend `cli/src/utils/openrouter-models.ts`**
   - Expand `OpenRouterModel` with: `description`, `contextLength`, `maxCompletionTokens`, `promptPricePerToken`, `completionPricePerToken`, `inputCacheReadPricePerToken`, `webSearchPricePerToken`, `provider`, `modality`, `tokenizer`, `instructType`, `knowledgeCutoff`, `created`, `reasoning`, `topProvider`, `benchmarks`, `links`.
   - Update `parseCatalog` to map these fields from the raw API response.
   - Keep graceful degradation when fields are missing.

2. **Fetch catalog on boot**
   - In `cli/src/index.tsx`, call `fetchOpenRouterModels()` after `initializeApp()` and before the TUI mounts.
   - Make it non-blocking. If it fails, log a warning and continue; the placeholder formatter will fall back.

3. **Add `MODEL_INFO` placeholder**
   - Add `MODEL_INFO` to the `PLACEHOLDER` enum in `packages/agent-runtime/src/templates/types.ts`.
   - Add it to `placeholderValues` so `formatPrompt` substitutes it.

4. **Update `agents/savant/savant.ts`**
   - Remove the `model` parameter from `buildDefaultSystemPrompt` context (or keep it only for the fallback formatter).
   - Replace `You are running on the ${model} model.` with `${PLACEHOLDER.MODEL_INFO}`.

5. **Resolve `PLACEHOLDER.MODEL_INFO` at runtime**
   - In `packages/agent-runtime/src/templates/strings.ts`, add a value provider for `PLACEHOLDER.MODEL_INFO`.
   - The provider receives the active `agentTemplate.model` id.
   - It looks up the id in the cached OpenRouter catalog (passed in from the CLI).
   - It formats the markdown block; unknown fields are omitted.
   - If the model is not found, it falls back to: `You are running on **<id>**. Provider: <provider>. Full metadata unavailable.`

6. **Thread the catalog from CLI to runtime**
   - The CLI already resolves the selected model. Pass the resolved `OpenRouterModel` (or a formatted string) into the runtime via `loopAgentSteps` / `callMainPrompt`.
   - Keep `agent-runtime` provider-agnostic by passing a pre-formatted `modelInfoText?: string` rather than the raw catalog.

7. **Handle non-OpenRouter providers**
   - TokenRouter, NVIDIA, OpenCode Go, and custom/local models may not have OpenRouter entries.
   - The formatter uses known provider name + model id and omits unknown fields.

8. **Tests**
   - Update `cli/src/utils/__tests__/openrouter-models.test.ts` to verify rich metadata parsing.
   - Update `packages/agent-runtime/src/templates/__tests__/strings.test.ts` to verify `PLACEHOLDER.MODEL_INFO` substitution and fallback.
   - Run the four-workspace typecheck gate (sdk, common, agent-runtime, cli).

### Verification

- The system prompt for the active session contains the actual model name and metadata.
- No hardcoded model string appears when a user-selected model is active.
- OpenRouter fetch failure degrades gracefully to a minimal fallback.
- All four workspace typechecks pass.
- Relevant unit tests pass.

## Missed Questions and Robust Answers

### Q1: What if the OpenRouter API is down or slow on launch?
**Answer:** The fetch is non-blocking with a 10-second timeout. On failure, the catalog remains empty and the placeholder formatter falls back to the model id + provider. The user experience is unchanged.

### Q2: What about models from TokenRouter, NVIDIA, or OpenCode Go?
**Answer:** The formatter checks the catalog by id. If the id is not present, it produces a minimal block with the model id and provider name. As these providers add OpenRouter pages, the block automatically enriches.

### Q3: Should the agent know pricing? Does that bias it?
**Answer:** Pricing is factual metadata, not instruction. It helps the agent answer user questions about cost and model choice accurately. The rest of the prompt's behavior instructions remain unchanged.

### Q4: Why not store the metadata in a file the agent reads?
**Answer:** Prompt injection via the existing placeholder system is simpler and guarantees the agent sees the information on every turn without an extra tool call. Context windows are large enough that the small metadata block is negligible.

### Q5: Will this affect prompt caching?
**Answer:** The model info block changes only when the model changes, which is rare within a session. It should not materially affect caching.

### Q6: Should this apply to sub-agents too?
**Answer:** The placeholder system is shared. Any agent template that includes `${PLACEHOLDER.MODEL_INFO}` will get accurate metadata. This FID targets the orchestrator (`savant.ts`) first; sub-agents can adopt the placeholder incrementally.

### Q7: What if the runtime model id does not exactly match any OpenRouter id?
**Answer:** We should normalize model ids before lookup. Common mismatches include version suffixes (`anthropic/claude-sonnet-4` vs `anthropic/claude-sonnet-4.6`), provider prefixes, or internal aliases. The implementation will:
1. Try exact match first.
2. Then try matching by stripping or adding common provider prefixes.
3. Then try matching the base model family (e.g., `claude-sonnet-4` prefix).
4. If still no match, fall back to the runtime model id + provider.
This ensures the best possible metadata without failing if ids drift.

### Q8: How does the agent-runtime package access the OpenRouter catalog cached in the CLI package?
**Answer:** It should not access it directly. The CLI (which already resolves the user's selected model) formats the model info string and passes it into the runtime as a `modelInfoText?: string` parameter. This keeps `agent-runtime` provider-agnostic and avoids cross-package coupling. The runtime only needs to know the placeholder substitution string, not the catalog structure.

### Q9: What about sub-agents that inherit the parent's system prompt via `inheritParentSystemPrompt`?
**Answer:** Sub-agents that inherit the parent system prompt will also inherit the resolved `${PLACEHOLDER.MODEL_INFO}` text from the parent's prompt. This is correct for sub-agents running on the same model as the parent. If a sub-agent ever runs on a different model, its own prompt should resolve its own `PLACEHOLDER.MODEL_INFO` using its own `agentTemplate.model`.

### Q10: How do we test this without hitting the real OpenRouter API?
**Answer:**
1. Add unit tests for `parseCatalog` that feed it a mocked JSON response and assert the parsed `OpenRouterModel` fields.
2. For `formatPrompt` / `getAgentPrompt` tests, pass a mocked `modelInfoText` and assert the placeholder is replaced.
3. Use `__resetOpenRouterModelsCacheForTest()` to reset state between tests.
4. Do not make real network calls in unit tests; mock `fetch` or the catalog data.

### Q11: What if the user switches models mid-session?
**Answer:** Each prompt resolution reads the current `agentTemplate.model` and looks it up in the cached catalog. If the cache is stale (5-minute TTL), the next lookup will refresh it. The model info block always reflects the model about to be called for that step. If the new model isn't in cache yet, the fallback block is used until the cache refreshes.

### Q12: Should we fetch the full catalog or just the active model?
**Answer:** Fetch the full catalog. The full catalog is needed anyway for the `/model` picker, and it lets the placeholder resolve any model the user might switch to. Fetching the full `/api/v1/models` endpoint is a single lightweight request and is already the existing pattern.

### Q13: What if OpenRouter metadata is wrong or missing for a model?
**Answer:** The formatter omits any field that is undefined, empty, or nonsensical. It never makes up values. If a field like `contextLength` is missing, that line is simply not included in the prompt. This keeps the prompt truthful even when third-party metadata is incomplete.

### Q14: Does this change the agent definition format or break backward compatibility?
**Answer:** No. The change is additive: a new placeholder string is recognized by `formatPrompt`. Existing agent definitions without the placeholder are unaffected. The only change to existing prompts is in `agents/savant/savant.ts`, which replaces a hardcoded string with a placeholder.

### Q15: How will we know the feature is working after deployment?
**Answer:**
1. Unit tests verify placeholder substitution and fallback formatting.
2. The capabilities test will check that the agent no longer self-identifies as `anthropic/claude-opus-4.8` when a different model is selected.
3. Manual verification: start a session with a non-default model and inspect the resolved system prompt (via logs or a test harness) to confirm the correct model name and metadata appear.

## Perfection Loop

### Loop 1

- **RED:** Agent self-identifies as `anthropic/claude-opus-4.8` regardless of actual runtime model.
- **GREEN:** Replace hardcoded model string with `${PLACEHOLDER.MODEL_INFO}` and resolve it from the cached OpenRouter catalog.
- **AUDIT:** Verify the prompt contains the correct model name and metadata for the selected model.
- **CHANGE DELTA:** ~0% at FID stage; implementation targets a small set of files.

### Loop 2

- **RED:** Review for edge cases, integration risks, and testing gaps.
- **GREEN:** Added robust missed questions covering: model id normalization (Q7), CLI/runtime boundary (Q8), inherited sub-agent prompts (Q9), test mocking (Q10), mid-session model switching (Q11), full vs. partial catalog fetch (Q12), incomplete metadata (Q13), backward compatibility (Q14), and post-deployment verification (Q15).
- **AUDIT:** FID now covers technical approach, edge cases, fallbacks, testing strategy, and verification. No remaining gaps identified.
- **CHANGE DELTA:** ~0% (FID documentation only).

### Loop 3

- **RED:** Re-audit FID for convergence and completeness.
- **GREEN:** All questions answered with robust, implementation-ready answers. Scope is clear and bounded.
- **AUDIT:** FID converged. No further loops required.
- **CHANGE DELTA:** ~0%.

**Convergence:** The FID is ready for implementation approval.

## Resolution

- **Fixed By:** TBD
- **Fixed Date:** TBD
- **Fix Description:** TBD
- **Tests Added:** Yes — `openrouter-models.test.ts`, `strings.test.ts`
- **Verified By:** Typecheck gate + unit tests
- **Commit/PR:** TBD
- **Archived:** TBD

## Lessons Learned

- Hardcoding runtime-varying values in static system prompts leads to stale or incorrect agent self-knowledge.
- The existing placeholder substitution system is the right extension point for injecting runtime-resolved values without changing the agent-definition model.
- Fetching external metadata at launch and caching it keeps the prompt current without adding per-prompt latency.
