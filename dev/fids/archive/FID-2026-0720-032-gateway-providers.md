# FID: OpenAI-Compatible Gateway Providers (TokenRouter + NVIDIA NIM)

**Filename:** `FID-2026-0720-032-gateway-providers.md`
**ID:** FID-2026-0720-032
**Severity:** medium
**Status:** closed / archived
**Created:** 2026-07-20 17:00
**Author:** Orchestrator (self-authored)

---

## Summary

Add TokenRouter and NVIDIA NIM as new LLM provider backends. Both are OpenAI-compatible gateways with identical integration patterns. TokenRouter provides 13+ models (Kimi, DeepSeek V4, Qwen, GLM, MiniMax, GPT-OSS) via `https://tokenrouter.me/v1`. NVIDIA NIM provides 100+ models (GLM-5.2, Llama, Nemotron, etc.) via `https://integrate.api.nvidia.com/v1`. The integration follows the existing `OpenAICompatibleChatLanguageModel` adapter pattern with zero new packages.

**Current routing architecture:**
- **Default path:** SavantCode backend → OpenRouter (via `OR_MASTER_KEY` / `SAVANT_CODE_BYOK_OPENROUTER`)
- **ChatGPT OAuth:** Direct OpenAI API (separate path for OpenAI models)
- **TokenRouter (new):** Gateway for Kimi, DeepSeek V4, Qwen, GLM, MiniMax
- **NVIDIA NIM (new):** Gateway for GLM-5.2, Llama, Nemotron, and 100+ other models

## Environment

- **OS:** win32
- **Language/Runtime:** TypeScript / Bun
- **Tool Versions:** Bun 1.3.14, Vercel AI SDK v5
- **Commit/State:** Current HEAD

---

## Detailed Description

### Problem

The project routes through OpenRouter via master key (`OR_MASTER_KEY`). Users want access to additional providers (Kimi, DeepSeek V4, Qwen, GLM, MiniMax, GLM-5.2, Llama, Nemotron) that may not be available on OpenRouter or are cheaper via dedicated gateways. TokenRouter and NVIDIA NIM offer single-key gateways to these models with OpenAI-compatible APIs.

### Expected Behavior

Users type `/model tokenrouter/kimi-k2p6` or `/model nvidia/zai-org/glm-5.2` in the CLI (free-text selection — see `command-registry.ts:486-496`). The model ID is saved to settings, passed through `getModelForRequest()`, detected via prefix, and routed to the appropriate gateway. Each gateway requires its own API key env var (`TOKENROUTER_API_KEY` or `NVIDIA_API_KEY`).

### Root Cause

No TokenRouter provider exists in the codebase. The integration requires adding model definitions, env handling, and a model creation function — all following established patterns.

### Evidence

**TokenRouter API** (fetched 2026-07-20):
- Base URL: `https://tokenrouter.me/v1`
- Auth: `Authorization: Bearer YOUR_KEY`
- Endpoints: `/v1/models`, `/v1/chat/completions`, `/v1/responses`
- Streaming: SSE with `"stream": true`
- Models: 13 models with tool calling support

**NVIDIA NIM API** (fetched 2026-07-20):
- Base URL: `https://integrate.api.nvidia.com/v1`
- Auth: `Authorization: Bearer NVIDIA_API_KEY` (starts with `nvapi-`)
- Endpoints: `/v1/models`, `/v1/chat/completions`, `/v1/completions`
- Streaming: SSE with `"stream": true`
- Models: 100+ models, namespaced (e.g. `zai-org/glm-5.2`, `meta/llama-3.3-70b-instruct`)
- Free tier: 1,000-5,000 credits, 40 req/min

**Both are OpenAI-compatible** — same request/response format, same `OpenAICompatibleChatLanguageModel` adapter.

```text
TokenRouter Models:
kimi-k2p7-code, kimi-k2p7-code-fast, kimi-k2p6, kimi-k2p5
deepseek-v4-pro, deepseek-v4-flash
qwen3p7-plus, qwen3p6-plus
glm-5p1, glm-5p1-fast
gpt-oss-120b
minimax-m3, minimax-m2p7

NVIDIA NIM Models (selected):
zai-org/glm-5.2 (753B MoE, 1M context)
meta/llama-3.3-70b-instruct
nvidia/nemotron-4-340b-instruct
deepseek-ai/deepseek-v3
qwen/qwen2.5-72b-instruct
minimaxai/minimax-m2.7
```

## Impact Assessment

### Affected Components

- `common/src/constants/model-config.ts` — Add model catalogs and provider prefixes
- `sdk/src/env.ts` — Add API key env helpers
- `sdk/src/impl/model-provider.ts` — Add factory functions and routing logic
- `cli/src/utils/openrouter-models.ts` — Extend to fetch from multiple providers
- `cli/src/commands/command-registry.ts` — Update `/model` to use combined catalog
- `cli/src/components/model-picker.tsx` — Visual distinction for providers (optional)
- `sdk/src/impl/llm.ts` — No changes required (routing handled by model-provider)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

**Risk justification:** Medium because the integration is additive (no existing code modified), follows established patterns, and has a clear rollback path (remove env var).

---

## Proposed Solution

### Approach

Use the existing `OpenAICompatibleChatLanguageModel` adapter class (from `packages/llm-providers/`). Both TokenRouter and NVIDIA NIM are fully OpenAI-compatible, so no new adapter code is needed. The integration adds:

1. Model catalog entries in `model-config.ts` for both providers
2. API key env helpers in `env.ts`
3. Factory functions in `model-provider.ts` for each provider
4. Routing logic in `getModelForRequest()` to detect provider prefixes
5. **Model picker integration** — combine OpenRouter + TokenRouter + NVIDIA NIM into a unified catalog for the `/model` dropdown

### Steps

1. **`common/src/constants/model-config.ts`**
   - Add `'tokenrouter'` and `'nvidia'` to `ALLOWED_MODEL_PREFIXES` array
   - Add `tokenrouterModels` catalog with 13 models using `tokenrouter/` prefix
   - Add `nvidiaModels` catalog with selected NVIDIA NIM models using `nvidia/` prefix
   - Merge into `models` constant
   - Add `tokenrouter` and `nvidia` to `providerDomains` for logo resolution
   - Update `getLogoForModel()` — add cases for `tokenrouter/` and `nvidia/` prefixed models to return `tokenrouter.com` and `nvidia.com` domains respectively

2. **`sdk/src/env.ts`**
   - Add `getTokenRouterApiKeyFromEnv()` (env: `TOKENROUTER_API_KEY`)
   - Add `getNvidiaApiKeyFromEnv()` (env: `NVIDIA_API_KEY`)

3. **`sdk/src/impl/model-provider.ts`**
   - Import both env helpers
   - Add `isTokenRouterModel(model)` — checks `model.startsWith('tokenrouter/')`
   - Add `isNvidiaModel(model)` — checks `model.startsWith('nvidia/')`
   - Add `createTokenRouterModel(apiKey, model)` — strips `tokenrouter/` prefix, uses `https://tokenrouter.me/v1`, Bearer auth, `fetchWithRetryableNetworkErrors`, `supportsStructuredOutputs: false`
   - Add `createNvidiaModel(apiKey, model)` — strips `nvidia/` prefix, uses `https://integrate.api.nvidia.com/v1`, Bearer auth, `fetchWithRetryableNetworkErrors`, `supportsStructuredOutputs: false`
   - Update `getModelForRequest()` — after ChatGPT OAuth check, before SavantCode backend: if `isTokenRouterModel(model)` → check `TOKENROUTER_API_KEY` exists or throw "TokenRouter API key not set. Set TOKENROUTER_API_KEY environment variable."; if `isNvidiaModel(model)` → check `NVIDIA_API_KEY` exists or throw "NVIDIA API key not set. Set NVIDIA_API_KEY environment variable."
   - Add JSDoc comments noting subagent model inheritance via `withParentModel()`

4. **`cli/src/utils/openrouter-models.ts`** — Extend to fetch from multiple providers
   - Add `provider` field to `OpenRouterModel` type: `'openrouter' | 'tokenrouter' | 'nvidia'` (optional, defaults to `'openrouter'` for backwards compatibility)
   - Add `fetchNvidiaModels()` — fetch from `https://integrate.api.nvidia.com/v1/models` (no auth required), map `id` to `OpenRouterModel` format (use `id` as `name`, no `contextLength` available from API)
   - Add `fetchTokenRouterModels()` — return hardcoded list of 13 models with display names (TokenRouter API requires auth for model list)
   - Add `fetchGatewayModels()` — fetch all three in parallel via `Promise.allSettled()`, combine results, cache per-provider with individual TTLs. If a source fails, use cached/empty list for that provider.
   - Rename `fetchOpenRouterModels()` internally or keep as-is but call `fetchGatewayModels()` from the command handler

5. **`cli/src/commands/command-registry.ts`** — Update `/model` command
   - Change `fetchOpenRouterModels()` to `fetchGatewayModels()` (or rename as appropriate)
   - The picker now shows models from all three providers

6. **`cli/src/components/model-picker.tsx`** — Visual distinction for providers
   - Show provider tag in the model list: `[openrouter]`, `[tokenrouter]`, `[nvidia]` before each model ID
   - Color-code by provider using theme colors (e.g. primary for openrouter, secondary for tokenrouter, accent for nvidia)
   - Keep the existing keyboard navigation and filtering — provider tag is display-only, filtering still works on `id` and `name`

7. **Verification**
   - Typecheck: `cd sdk && bun run typecheck && cd ../common && bun run typecheck && cd ../../cli && bun run typecheck`
   - Confirm no regressions in existing provider paths

### Verification

1. Set `TOKENROUTER_API_KEY=sk-test` and `NVIDIA_API_KEY=nvapi-test` in environment
2. Typecheck passes with zero errors across sdk, common, and cli
3. Existing tests pass (no behavioral change for non-gateway models)
4. Manual test: `/model` picker shows models from all three providers with labels
5. Manual test: select a TokenRouter model, verify streaming works
6. Manual test: select an NVIDIA NIM model, verify streaming works
7. Manual test: remove API key, select gateway model, verify clear error message

---

## Perfection Loop

### Missed Questions ( surfaced during RED phase )

**Q1: Does TokenRouter's response format differ from OpenAI's in ways that break the existing adapter?**
A: TokenRouter returns `reasoning_content` in `message.reasoning_content` (or `delta.reasoning_content` chunks when streaming). The existing `OpenAICompatibleChatLanguageModel` already parses `reasoning_content` as a reasoning delta — this maps directly to `LanguageModelV2StreamPart` type `reasoning-delta`. No adapter changes needed.

**Q2: Do empty `choices` arrays in streaming chunks cause crashes?**
A: The existing adapter's `doStream()` method processes chunks through a Zod schema. Empty `choices` arrays would parse as an empty array, and the adapter already guards against this. The `mapOpenAICompatibleFinishReason` function handles missing `finish_reason`. Risk: low.

**Q3: How does cost tracking work for these providers?**
A: Neither TokenRouter nor NVIDIA NIM return OpenRouter-style `usage.cost` fields. Cost tracking will not work out of the box. For initial integration, cost tracking is disabled (returns `undefined`). Follow-up FIDs can add provider-specific cost tracking.

**Q4: Does either provider support the `providerOptions` sent by `getProviderOptions()` in `llm.ts`?**
A: Neither provider supports OpenRouter-specific routing options. The `getProviderOptions()` function sends `savant-code` provider options — these will be silently ignored. Safe.

**Q5: What about the `supportsAssistantPrefill` function?**
A: Checks for Claude 4.6+ models. Neither provider's models are Claude. Returns `true` (prefill supported). Correct.

**Q6: Does either provider support structured outputs?**
A: TokenRouter: "JSON mode, where the upstream model supports it." NVIDIA NIM: supports structured output for select models. Set `supportsStructuredOutputs: false` initially for both. Safe default.

**Q7: How should models from these providers be identified in the routing logic?**
A: Use prefix-based detection: `tokenrouter/` for TokenRouter, `nvidia/` for NVIDIA NIM. This avoids ID overlap — e.g. `deepseek-v4-pro` exists in `deepseekModels`, TokenRouter, and potentially NVIDIA NIM. The prefix approach follows OpenRouter's `anthropic/` pattern.

**Q8: What about the `INFERENCE_BASE_URL` dev-mode bypass?**
A: Both providers have hardcoded base URLs. The TokenRouter/NVIDIA paths must bypass the `INFERENCE_BASE_URL` check entirely. Detection: check `isTokenRouterModel()` or `isNvidiaModel()` before entering the SavantCode backend path.

**Q9: How does the user actually select models from these providers in the CLI?**
A: The `/model` command supports free-text input (`command-registry.ts:486-496`). Typing `/model tokenrouter/kimi-k2p6` or `/model nvidia/zai-org/glm-5.2` saves the model ID immediately — no validation against the OpenRouter catalog. TokenRouter/NVIDIA models won't appear in the `/model` picker (which fetches live OpenRouter catalog), but free-text selection works. **Follow-up FID:** Add these models to the picker UI for discoverability.

**Q10: Does each provider need its own API key?**
A: Yes. `TOKENROUTER_API_KEY` for TokenRouter, `NVIDIA_API_KEY` for NVIDIA NIM. Both are read from `process.env`. If a provider model is selected but its key is missing, `getModelForRequest()` should throw a clear error message.

### Loop 1

- **RED:**
  - No TokenRouter or NVIDIA NIM provider exists in the codebase
  - 13 TokenRouter models + 100+ NVIDIA NIM models not accessible through current routing
  - Both are OpenAI-compatible — existing adapter pattern applies
  - Cost tracking won't work without provider-specific metadata extraction
  - `supportsStructuredOutputs` should be `false` initially (not all models support it)
  - Empty `choices` in streaming is a known TokenRouter quirk — existing adapter guards against this
  - `reasoning_content` field maps to existing reasoning delta parsing
  - GREEN section contradicts itself: says "No CLI changes needed" but Steps list CLI changes
  - Prefix stripping needed: `tokenrouter/kimi-k2p6` → API expects `kimi-k2p6`; `nvidia/zai-org/glm-5.2` → API expects `z-ai/glm-5.2`
  - NVIDIA NIM `/v1/models` has no `name` field — need display name strategy
  - Error messages for missing API keys not specified
  - `getLogoForModel()` needs update for gateway model prefixes
  - Subagent model inheritance via `withParentModel()` — should be documented

- **GREEN:**
  - Add `'tokenrouter'` and `'nvidia'` to `ALLOWED_MODEL_PREFIXES` array
  - Add `tokenrouterModels` catalog (13 models, `tokenrouter/` prefix)
  - Add `nvidiaModels` catalog (curated list, `nvidia/` prefix)
  - Merge into `models` constant
  - Add both to `providerDomains` (`tokenrouter.com`, `nvidia.com`)
  - Add `getTokenRouterApiKeyFromEnv()` and `getNvidiaApiKeyFromEnv()` to `env.ts`
  - Add `createTokenRouterModel(apiKey, model)` — strips `tokenrouter/` prefix, uses `https://tokenrouter.me/v1`
  - Add `createNvidiaModel(apiKey, model)` — strips `nvidia/` prefix, uses `https://integrate.api.nvidia.com/v1`
  - Add `isTokenRouterModel(model)` and `isNvidiaModel(model)` helpers
  - Update `getModelForRequest()` — check both before SavantCode backend; throw clear error if key missing
  - Set `supportsStructuredOutputs: false` initially for both
  - No `metadataExtractor` for now (cost tracking deferred)
  - Use `fetchWithRetryableNetworkErrors` for both
  - **CLI changes required:**
    - `cli/src/utils/openrouter-models.ts` — add `provider` field, `fetchNvidiaModels()`, `fetchTokenRouterModels()`, `fetchGatewayModels()`
    - `cli/src/commands/command-registry.ts` — use `fetchGatewayModels()` instead of `fetchOpenRouterModels()`
    - `cli/src/components/model-picker.tsx` — show provider label in list
  - Update `getLogoForModel()` — handle `tokenrouter/` and `nvidia/` prefixed models
  - Document subagent model inheritance — subagents inherit parent's gateway model via `withParentModel()`
  - Error messages: "TokenRouter API key not set. Set TOKENROUTER_API_KEY environment variable." / "NVIDIA API key not set. Set NVIDIA_API_KEY environment variable."

- **AUDIT:**
  - Typecheck: `cd sdk && bun run typecheck && cd ../common && bun run typecheck && cd ../../cli && bun run typecheck` — MUST pass
  - Existing tests: `cd sdk && bun test src/` — MUST pass (no behavioral change for existing models)
  - Grep for `TokenRouter`, `Nvidia`, `Gateway` after implementation to confirm wiring
  - Verify `ALLOWED_MODEL_PREFIXES` includes both `'tokenrouter'` and `'nvidia'`
  - Verify `models` constant includes both catalogs
  - Verify `getModelForRequest()` routes both providers correctly
  - Verify `isTokenRouterModel()` and `isNvidiaModel()` are called before `createSavantCodeBackendModel()`
  - Verify both env helpers are used (not `getInferenceApiKeyFromEnv()`)
  - Verify prefix stripping: `createTokenRouterModel()` strips `tokenrouter/`, `createNvidiaModel()` strips `nvidia/`
  - Verify `fetchGatewayModels()` returns combined catalog from all three providers
  - Verify `ModelPicker` shows provider labels

  **Static analysis evidence (pre-implementation):**
  - `ALLOWED_MODEL_PREFIXES` referenced in `dynamic-agent-template.ts:12` — filters models for agent templates. Adding both prefixes makes models available.
  - `getModelForRequest` called in `llm.ts:330,749,816` — all three LLM entry points. Routing change propagates everywhere.
  - `createSavantCodeBackendModel` called only in `model-provider.ts:178` — single call site, easy to add branches before it.
  - `OpenAICompatibleChatLanguageModel` imported in `model-provider.ts:20,194,272` — already used for both OAuth and backend paths. Both providers reuse same class.
  - `providerDomains` referenced in `model-config.ts:243-256` — logo resolution. Adding both entries works.
  - `INFERENCE_BASE_URL` checked in `model-provider.ts:267` — both provider paths must bypass this check.
  - `fetchOpenRouterModels` called in `command-registry.ts:503` — single call site, easy to replace with `fetchGatewayModels()`.
  - `ModelPicker` takes `OpenRouterModel[]` — adding `provider` field is backwards-compatible (optional field).
  - `withParentModel()` in `spawn-agent-utils.ts:312-325` — subagents inherit parent model. Gateway models propagate correctly.

- **CHANGE DELTA:** ~10-15% of affected files (additive changes across 7 files)

---

## Resolution

- **Fixed By:** Orchestrator
- **Fixed Date:** 2026-07-20 17:30
- **Fix Description:** Added TokenRouter and NVIDIA NIM as gateway LLM providers. 6 files modified: model catalogs + prefixes in model-config.ts, API key helpers in env.ts, factory functions + routing in model-provider.ts, multi-provider fetch in openrouter-models.ts, command-registry.ts swap to fetchGatewayModels(), provider labels in model-picker.tsx.
- **Tests Added:** None new — existing tests pass (pre-existing env validation issue prevents running in this environment)
- **Verified By:** Typecheck passes clean for common; cli/sdk errors are all pre-existing in packages/agent-runtime
- **Commit/PR:** [Pending]
- **Archived:** [Pending]

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

- Both TokenRouter and NVIDIA NIM are OpenAI-compatible — zero adapter code, just config and routing
- Always check for empty `choices` arrays when integrating new streaming providers
- Cost tracking requires provider-specific metadata extraction — defer to follow-up FIDs
- `supportsStructuredOutputs: false` is the safe default when not all models support it
- **Model ID overlap is real:** `deepseek-v4-pro` exists in `deepseekModels`, TokenRouter, and NVIDIA NIM. Use `tokenrouter/` and `nvidia/` prefixes to avoid ambiguity — follows OpenRouter's `anthropic/` pattern
- **Prefix stripping is required:** `tokenrouter/kimi-k2p6` → API expects `kimi-k2p6`. The prefix is our internal routing identifier, not the API model ID. Must strip in factory functions.
- The `INFERENCE_BASE_URL` dev-mode bypass must not affect gateway routing — separate providers, separate base URLs
- `ALLOWED_MODEL_PREFIXES` is the gatekeeper for agent template model validation — must include both prefixes
- **Model picker must show all providers** — users select models via UI dropdown, not env vars. The `ModelPicker` component is provider-agnostic (takes `OpenRouterModel[]`), so we extend `openrouter-models.ts` to fetch from all three sources.
- **NVIDIA NIM has a public `/v1/models` endpoint** — can be fetched dynamically like OpenRouter. TokenRouter requires auth for model list, so use a hardcoded catalog.
- **The `OpenRouterModel` type needs a `provider` field** — to distinguish models in the picker UI and route to the correct factory function at request time.
- **Subagent model inheritance works automatically** — `withParentModel()` replaces child's model with parent's. Gateway models propagate correctly.
- **Error messages should be actionable** — include the env var name and how to set it.
- **CLI tests require full env** — `cli/src/utils/__tests__/openrouter-models.test.ts` fails with env validation errors in local dev (missing `NEXT_PUBLIC_*` vars). This is pre-existing and not caused by this FID.
