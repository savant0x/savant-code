# FID: TokenHarbor Provider Integration

**Filename:** `FID-2026-0807-025-tokenharbor-provider-integration.md`
**ID:** FID-2026-0807-025
**Severity:** medium
**Status:** closed
**Created:** 2026-08-07 00:00
**Author:** Savant
**YAGNI-Compliance:** Verified

---

## Summary

TokenHarbor is a documented, OpenAI-compatible inference gateway that can be added to Savant Code through the existing
direct gateway/provider architecture. Its documented OpenAI endpoint is `https://tokenharbor.ai/v1/chat/completions`,
authentication is `Authorization: Bearer <thk_live_...>`, and streaming uses SSE with `stream: true`. The lowest-risk
integration is to reuse the existing `OpenAICompatibleChatLanguageModel`, add a first-class `tokenharbor/` internal
model namespace, add provider-key setup/persistence/catalog support, and route those models directly without Savant Code
backend calls. TokenHarbor also exposes a native Anthropic `/v1/messages` endpoint, but that is explicitly out of this
first FID unless a model capability or protocol requirement proves that OpenAI compatibility is insufficient.

## Environment

- **OS:** Windows development environment
- **Language/Runtime:** TypeScript monorepo, Bun runtime, Vercel AI SDK v5 provider contracts
- **Tool Versions:** Repository versions from `package.json` and `bun.lock`; TokenHarbor docs accessed 2026-08-07
- **Commit/State:** Implementation completed in the current working tree after FID-2026-0807-024 graph-export closeout.
  No live TokenHarbor credential was used.

## Detailed Description

### Problem

Savant Code currently supports direct gateway providers such as TokenRouter, NVIDIA NIM, OpenCode Go, CommandCode,
Cloudflare, and OpenRouter, but TokenHarbor is absent from the provider registry, model routing, key setup, and model
picker.

The existing seams are visible in:

- `common/src/constants/model-config.ts:4-22` — allowed provider/model prefixes
- `sdk/src/env.ts:93-133` — provider API-key environment helpers
- `sdk/src/impl/model-provider.ts:86-180` — gateway routing and missing-key failures
- `sdk/src/impl/model-provider/model-factories.ts:53-170` — OpenAI-compatible provider factories
- `cli/src/utils/provider-setup.ts:17-45` — provider labels, environment variables, and base URLs
- `cli/src/utils/openrouter-models/types.ts:4-32` — provider/catalog types
- `cli/src/utils/openrouter-models/gateway.ts:64-115` — combined gateway catalog
- `cli/src/utils/openrouter-models/static-catalogs.ts:261-302` — static catalogs for providers whose model APIs require
  authentication

Without these additions, a user cannot select TokenHarbor models through `/model`, configure a TokenHarbor key through
`/provider tokenharbor`, or route a `tokenharbor/...` model directly.

### Expected Behavior

1. `/provider tokenharbor` is recognized by the CLI provider picker and accepts a masked TokenHarbor Universal Key.
2. The key is stored using the existing local `credentials.json` provider-key mechanism, never in chat history or
   rendered messages; explicit shell environment values remain higher precedence.
3. `TOKENHARBOR_API_KEY` is the canonical environment variable for this provider, matching TokenHarbor's own integration
   guidance and the repository's provider-specific setup convention.
4. A model ID beginning with `tokenharbor/` routes directly to `https://tokenharbor.ai/v1/chat/completions` using the
   existing OpenAI-compatible chat adapter.
5. The internal namespace is stripped exactly once when building the API request. The matrix is:
   - `tokenharbor/th-orchestra` → API model `th-orchestra`
   - `tokenharbor/claude-opus-5` → `claude-opus-5`
   - `tokenharbor/anthropic/claude-opus-5` → `anthropic/claude-opus-5`
   - If the catalog exposes `tokenharbor/qwen3-max`, the selector is
     `tokenharbor/tokenharbor/qwen3-max` → API model `tokenharbor/qwen3-max`.
   No nested provider segment after the first internal prefix is stripped.
6. Streaming, tool calls, reasoning content, finish reasons, usage extraction, cancellation, and retryable network
   errors continue through the existing adapter contract.
7. The model picker includes a TokenHarbor baseline catalog without making
   unauthenticated requests to `/v1/models`. TokenHarbor documents `/v1/models`
   as the SDK catalog endpoint; an unauthenticated probe during reconnaissance
   returned HTTP 401. The implementation checks in the complete 20-ID snapshot observed on
   `https://tokenharbor.ai/models` across its Frontier, Value, Free, and Orchestra
   tabs, labels entries as convenience selections rather than availability
   guarantees, and permits exact free-text `/model <id>` selection for future
   authenticated catalog models.
8. TokenHarbor-specific optional headers are not sent by default. The initial provider must preserve prompt transparency
   and avoid changing steering/cache behavior unless the user explicitly opts in through a documented provider option.
9. `/health`, missing-key guidance, provider preference persistence, and all supported provider documentation identify
   TokenHarbor consistently.
10. The native Anthropic `/v1/messages` route remains a separately scoped future enhancement unless implementation
    evidence demonstrates that a supported TokenHarbor model cannot function through `/v1/chat/completions`.

### Root Cause

There is no TokenHarbor provider identity in the common model configuration or CLI `ModelProvider` union, no SDK
environment getter, no factory/routing branch, no setup metadata, and no catalog entry. The generic adapter already
supports the documented OpenAI-compatible request shape, so a separate transport would duplicate existing protocol logic
without evidence that it is needed.

TokenHarbor's public documentation creates two integration constraints that must not be papered over:

- The quickstart documents `https://tokenharbor.ai/v1` as the OpenAI-compatible base URL, while the native Anthropic
  base URL is `https://tokenharbor.ai`.
- The docs use both TokenHarbor aliases (`th-orchestra`, `claude-opus-5`,
  `deepseek-v4-flash`) and provider-qualified IDs (`anthropic/...`,
  `openai/...`, `deepseek/...`). The FID therefore treats the internal
  `tokenharbor/` prefix as a routing namespace and preserves the remainder as
  the exact API model ID.
- `/v1/models` is documented as a catalog endpoint. During reconnaissance, a
  credential-free `GET https://tokenharbor.ai/v1/models` probe returned `401
  Unauthorized`; this is observed runtime evidence, not a claim that the public
  docs explicitly promise authentication. The checked-in catalog snapshot is refreshed from the public models page rather
  than making credential-bearing discovery requests from the CLI. Authenticated
  `/v1/models` discovery remains a future design with explicit cache/redaction
  semantics.

### Evidence

Authoritative TokenHarbor documentation:

```text
https://tokenharbor.ai/docs/getting-started/quickstart
OpenAI-compatible Base URL: https://tokenharbor.ai/v1
API key: thk_live_…
Model: any id from /models; examples include th-orchestra, claude-opus-5, deepseek-v4-flash
```

```text
https://tokenharbor.ai/docs/getting-started/universal-key
Universal Key authenticates /v1/chat/completions and /v1/messages.
Format: thk_live_{64-char base64url random}
Auth is a bearer token; keys are shown once and rotation revokes the old key.
```

```text
https://tokenharbor.ai/docs/api/curl
OpenAI-compatible endpoint: /v1/chat/completions
Auth: Authorization: Bearer thk_…
Streaming: stream: true; server emits Server-Sent Events.
Model IDs come from /models; the page examples include tokenharbor/qwen3-max and th-orchestra.
Recon probe: GET https://tokenharbor.ai/v1/models without credentials returned HTTP 401 Unauthorized.
```

```text
https://tokenharbor.ai/docs/api/models
/v1/models returns the catalog as JSON for SDKs that pre-fetch it.
th-orchestra is a tool-aware smart-routing model; requests with tools engage
plan/build/review pools. Plain no-tools chat uses the chat pool.
```

```text
https://tokenharbor.ai/docs/compare/openrouter
Migration from OpenRouter is a base URL + key swap:
https://tokenharbor.ai/v1 and thk_…
```

Current repository provider seams:

```text
common/src/constants/model-config.ts:4-22       ALLOWED_MODEL_PREFIXES
sdk/src/env.ts:93-133                           provider key getters
sdk/src/impl/model-provider.ts:86-180           gateway dispatch and errors
sdk/src/impl/model-provider.ts:185-234          provider prefix predicates
sdk/src/impl/model-provider/model-factories.ts:53-77   TokenRouter OpenAI adapter pattern
sdk/src/impl/model-provider/model-factories.ts:149-170  OpenRouter adapter pattern
cli/src/utils/provider-setup.ts:17-45           setup registry
cli/src/utils/openrouter-models/types.ts:4-32   ModelProvider and catalog type
cli/src/utils/openrouter-models/gateway.ts:64-115 combined catalog
```

## Impact Assessment

### Affected Components

- `common/src/constants/model-config.ts`
- `common/src/__tests__/model-config.test.ts`
- `sdk/src/env.ts`
- `sdk/src/index.ts` if the new getter is part of the public SDK surface
- `sdk/src/impl/model-provider.ts`
- `sdk/src/impl/model-provider/model-factories.ts`
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts`
- `cli/src/utils/provider-setup.ts`
- `cli/src/utils/__tests__/provider-setup.test.ts`
- `cli/src/commands/__tests__/router-provider-setup.test.ts`
- `cli/src/utils/openrouter-models/types.ts`
- `cli/src/utils/openrouter-models/static-catalogs.ts`
- `cli/src/utils/openrouter-models/gateway.ts`
- `cli/src/utils/__tests__/openrouter-models.test.ts`
- `cli/src/utils/settings.ts` and settings tests if the provider union requires updates
- `cli/src/commands/health-command.ts` and health tests if provider display is enumerated
- `README.md`, `README.zh-CN.md`, `docs/installation.md`, `docs/privacy.md`, `cli/release/README.md`, and
  `sdk/README.md`
- `CHANGELOG.md` after implementation closeout

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature unavailable, but existing providers and custom endpoints remain available
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Implement TokenHarbor as a first-class OpenAI-compatible gateway provider using the existing adapter and
provider-specific patterns. Do not add the OpenAI SDK, a second HTTP client, or a custom Anthropic adapter in this FID.

1. Add `tokenharbor` to the shared model/provider vocabulary and define a small baseline catalog of documented example
   IDs, not a stability guarantee. At minimum include `tokenharbor/th-orchestra`, `tokenharbor/claude-opus-5`, and
   `tokenharbor/deepseek-v4-flash`; preserve exact model IDs after the first internal prefix. Add a catalog comment that
   the credential-free `/v1/models` probe returned 401 and is intentionally not fetched by the initial picker path.
2. Add `getTokenHarborApiKeyFromEnv()` for `TOKENHARBOR_API_KEY` and export it only if the SDK's public
   environment-helper contract requires it. Keep the key out of logs and message content.
3. Add `isTokenHarborModel()` and a routing branch before the Savant Code backend fallback. Missing credentials must
   fail closed with an actionable error naming `TOKENHARBOR_API_KEY` and `/provider tokenharbor`.
4. Add `createTokenHarborModel()` using the existing chat adapter, base URL
   `https://tokenharbor.ai/v1/`, one-prefix API model normalization, bearer
   authentication, JSON content type, retryable fetch, and a provider-specific
   user-agent suffix. Set `supportsStructuredOutputs` to `false` initially. A
   mock proves request construction only; remote acceptance requires authoritative
   confirmation or an explicitly gated credentialed smoke test. Leave
   `includeUsage` unset unless streaming usage is verified.
5. Add `tokenharbor` to `PROVIDER_SETUP_CONFIG` with label `Token Harbor`, env var `TOKENHARBOR_API_KEY`, and base URL
   `https://tokenharbor.ai/v1`. Reuse masked input, local credential storage, environment precedence, provider picker,
   settings persistence, and missing-provider guidance.
6. Add TokenHarbor static catalog entries to the combined model picker. If the user enters an exact model ID not in that
   list, `/model <id>` must still persist it and route it through the provider prefix. Do not perform a catalog request
   without the key; if authenticated catalog discovery is later added, it must use a separate credential-aware cache and
   redaction-tested fetch path.
7. Keep TokenHarbor steering and cache controls opt-in. Do not emit `X-TH-Steering`, `th_steering`,
   `X-TH-Cache-Control`, or any TokenHarbor-specific metadata by default. A later FID may add explicit user/provider
   options after product design approval.
8. Update provider docs and privacy disclosures. Explain that prompts, tools,
   and model context leave the machine for the selected TokenHarbor endpoint,
   that TokenHarbor may add its documented input fence/agent steering for
   `th-orchestra`, and that TokenHarbor key rotation is controlled by TokenHarbor
   while Savant stores only the local BYOK copy entered through `/provider`.

### Steps

1. Confirm the final supported TokenHarbor model-ID policy against the live
   authenticated catalog or operator-provided key. Preserve the exact
   normalization matrix above and do not silently treat documented examples as
   stable aliases.
2. Add the common `tokenharbor` namespace/catalog and provider type updates.
3. Add SDK environment access, model predicate, factory, routing branch, and public exports if required.
4. Add CLI provider setup metadata, picker/catalog entries, persistence/settings validation, and health/status display
   updates where the code enumerates providers.
5. Add focused tests for URL/model transformation, auth headers, SSE routing,
   missing-key failure, tool-call pass-through, provider persistence, picker
   inclusion, and no-secret rendering.
6. Update installation, privacy, README, Chinese README, release README, SDK README, and changelog documentation with
   authoritative TokenHarbor URLs and no unsupported pricing/availability claims.
7. Run the Perfection Loop on this FID before implementation; after implementation, run independent code verification
   and adversarial review.

### Verification

Required implementation evidence:

- `common` typecheck and model-config tests pass; every TokenHarbor static catalog model has a valid provider namespace.
- `sdk` typecheck and focused provider tests pass.
- `cli` typecheck and focused provider/setup/catalog/health tests pass.
- Mocked OpenAI-compatible request proves:
  - URL is `https://tokenharbor.ai/v1/chat/completions`
  - header is `Authorization: Bearer <test-key>`
  - body model is the exact post-prefix ID
  - `stream: true` produces the existing SSE path
  - tools and reasoning-compatible fields are not dropped by the adapter
- Missing-key test fails with the exact actionable env/provider message.
- Provider setup test proves `TOKENHARBOR_API_KEY` is trimmed, persisted locally, loaded for the current process,
  excluded from rendered messages, and not allowed to override an explicit shell key.
- Catalog test proves TokenHarbor entries join the combined picker without unauthenticated `/v1/models` calls.
- `bun x eslint . --max-warnings 0`, `bun run lint:md`, and `bunx prettier --check .` pass for the final change set.
- Law 4 call-graph grep must prove the implemented
  `getTokenHarborApiKeyFromEnv`, `isTokenHarborModel`,
  `createTokenHarborModel`, and setup metadata are production-reachable. The
  initial design intentionally has no `fetchTokenHarborModels` function: the
  picker uses static baseline entries and must not perform authenticated catalog
  discovery until a separate cache/redaction design is approved.
- Live credential/API verification is `NEEDS-REVIEW` until a user supplies a
  TokenHarbor key; no real key is required for mocked contract tests.

## Perfection Loop

### Loop 1 — RED (Reconnaissance complete)

- **RED:** The provider is absent from the shared namespace, SDK env getters,
  model routing/factory, CLI setup registry, provider union, static/live gateway
  catalog, provider tests, and user-facing provider documentation. Existing
  OpenAI-compatible providers demonstrate that no new transport is needed for
  the documented Chat Completions API. TokenHarbor docs establish
  `https://tokenharbor.ai/v1`, bearer `thk_live_...` keys,
  `/v1/chat/completions`, SSE streaming, and tool-aware `th-orchestra`. A
  credential-free `/v1/models` probe returned 401. The docs use both short and
  provider-qualified IDs; the internal namespace must remain distinct from the
  API model ID.
- **GREEN:** Proposed design: `tokenharbor/` routing namespace with exact
  one-prefix normalization, shared adapter, `TOKENHARBOR_API_KEY`,
  setup/picker/catalog integration, documented baseline examples plus exact
  free-text IDs, no unauthenticated catalog fetch, no default TokenHarbor
  steering/cache headers, and no native Anthropic transport in this FID. Remote
  capability claims remain NEEDS-REVIEW until docs or an explicitly gated
  credentialed smoke test proves them.
- **AUDIT:** Pending implementation. The FID is not eligible for code implementation until the operator accepts this
  scope and the FID completes the GREEN → AUDIT → ADVERSARIAL loop.
- **CHANGE DELTA:** FID-only reconnaissance and design; no product source files changed.

### Loop 2 — GREEN convergence, AUDIT, and ADVERSARIAL

- **RED:** Independent repository evidence confirms that TokenHarbor is absent
  from production code: `grep -RIn -E 'TokenHarbor|tokenharbor|TOKENHARBOR'
  common/src sdk/src cli/src packages/llm-providers/src --include='*.ts'`
  returned no matches. Existing provider seams are present: the allowed-prefix
  list is `common/src/constants/model-config.ts:4-22`, provider environment
  getters are `sdk/src/env.ts:93-133`, gateway dispatch is
  `sdk/src/impl/model-provider.ts:89-180`, adapter factories are
  `sdk/src/impl/model-provider/model-factories.ts:58-170`, setup metadata is
  `cli/src/utils/provider-setup.ts:21-47`, and the catalog provider union is
  `cli/src/utils/openrouter-models/types.ts:4-10`.
- **GREEN:** The design is converged with the smallest compatible surface:
  reuse the existing OpenAI-compatible adapter; add the `tokenharbor/`
  namespace, `TOKENHARBOR_API_KEY`, routing/factory/setup/catalog seams, and
  focused tests. Strip only the first internal prefix; preserve nested API
  model segments. Use static documented examples plus exact free-text model
  selection. Do not add `fetchTokenHarborModels` or any authenticated catalog
  request in this FID. Keep structured outputs and live provider capability
  claims disabled/`NEEDS-REVIEW` until remote evidence exists. Native Anthropic
  support, steering headers, and cache controls remain future scope.
- **AUDIT:** PASS for design completeness, not implementation. Independent
  source evidence is quoted here:
  - `common/src/constants/model-config.ts:4-6`: `export const
    ALLOWED_MODEL_PREFIXES = [` / `  'anthropic',` / `  'openai',` establishes
    the shared provider-prefix seam.
  - `sdk/src/env.ts:96-98`: `export const
    getTokenRouterApiKeyFromEnv = (): string | undefined => {` / `return
    process.env['TOKENROUTER_API_KEY']` establishes the provider-key getter
    pattern.
  - `sdk/src/impl/model-provider.ts:89-98`: `if
    (isTokenRouterModel(model))` / `model: createTokenRouterModel(tokenRouterKey,
    model)` establishes reachable gateway dispatch and missing-key handling.
  - `sdk/src/impl/model-provider.ts:208-210`: `export function
    isTokenRouterModel(model: string): boolean {` / `return
    model.startsWith('tokenrouter/')` establishes the prefix-predicate pattern.
  - `sdk/src/impl/model-provider/model-factories.ts:58-76`: `export function
    createTokenRouterModel` / `const apiModelId =
    model.slice('tokenrouter/'.length)` / `supportsStructuredOutputs: false`
    establishes the reusable adapter, one-prefix stripping, and conservative
    capability pattern.
  - `cli/src/utils/provider-setup.ts:21-35`: `export const
    PROVIDER_SETUP_CONFIG = {` / `tokenrouter: {` / `envVar:
    'TOKENROUTER_API_KEY'` / `baseUrl: 'https://api.tokenrouter.com/v1'`
    establishes setup metadata and persistence reachability.
  - `cli/src/utils/openrouter-models/types.ts:4-10`: `export type ModelProvider =`
    followed by the provider union establishes the picker/provider type seam.
  - `cli/src/utils/openrouter-models/gateway.ts:64-73`: `Fetch the combined
    model catalog from all providers` and `TokenRouter (hardcoded, requires
    auth for API)` establishes the static-catalog integration pattern.
  - `cli/src/utils/openrouter-models/gateway.ts:100-109`: `const
    tokenrouterModels = fetchTokenRouterModels()` and the combined array entry
    establish production catalog consumption.
  - Exact absence check:
    `grep -RIn -E 'TokenHarbor|tokenharbor|TOKENHARBOR' common/src sdk/src
    cli/src packages/llm-providers/src --include='*.ts'`
    produced exactly `NO-MATCH`.
  These citations prove the analogous seams and prove that TokenHarbor itself
  is not yet wired, so implementation call-graph verification is correctly
  deferred. The credential-free `GET
  https://tokenharbor.ai/v1/models` probe returned `401 Unauthorized`;
  live inference, authenticated catalog contents, remote tool/reasoning
  behavior, structured outputs, and latency remain `NEEDS-REVIEW` and require a
  local credentialed smoke test after implementation.
- **ADVERSARIAL:** PASS with one adjustment. The proposed verification list
  previously named `fetchTokenHarborModels` as a required production caller,
  contradicting the no-live-catalog design. The adjustment is evidenced by
  the corrected verification requirement above: it now requires reachability
  only for the symbols the implementation will actually add and explicitly
  forbids an initial authenticated catalog fetch. No other critical/high scope
  or security findings remain.
- **CHANGE DELTA:** FID-only convergence update; no product source files,
  credentials, or implementation behavior changed.

### Missed Questions

1. **Does TokenHarbor require a new transport?** No for the first scope. Its
   documented Chat Completions request/streaming shape matches the existing
   adapter. Representative tool/reasoning payloads must be tested through that
   endpoint; a native Anthropic adapter gets a follow-up FID if those tests fail
   or TokenHarbor documents an endpoint-specific capability.
2. **What should the internal model prefix be?** `tokenharbor/`, because existing gateway providers use unique prefixes
   and the provider router dispatches by prefix.
3. **Should the prefix be sent to TokenHarbor?** No. Strip only the first `tokenharbor/`; preserve all nested provider
   slashes in the remaining API model ID.
4. **Should a bare `th-orchestra` automatically mean TokenHarbor?** No. Bare IDs currently fall through to the Savant
   backend/custom model path. Users select `tokenharbor/th-orchestra`; aliases must not silently hijack existing
   routing.
5. **Should `th-orchestra` be the default model?** No. Preserve the existing OpenRouter default until an explicit
   product decision changes default-provider policy; TokenHarbor is opt-in.
6. **Should `/v1/models` be fetched by the picker?** Not without an approved
   credential-aware design. The docs describe it as a catalog endpoint and the
   credential-free reconnaissance probe returned 401. Use a small baseline of
   documented examples and exact free-text selection; authenticated discovery
   is future work with explicit cache, redaction, and failure semantics.
7. **What happens when a documented example model is removed or renamed?** The
   provider should surface TokenHarbor's upstream error; baseline entries are
   convenience selections, not availability promises. Keep the list small and
   documented, while exact free-text IDs remain available.
8. **Should the provider send `X-TH-Steering` or `th_steering`?** No by default. The user did not explicitly request
   steering and it changes prompts/agent behavior. Add only as opt-in provider configuration in a later FID.
9. **Should the provider send `X-TH-Cache-Control`?** No. Cache policy changes billing and freshness semantics; preserve
   TokenHarbor defaults until an explicit user control exists.
10. **Does `th-orchestra` require tools?** The docs say tools engage its plan/build/review pools, while no-tools
    requests use its chat pool. The adapter should pass tools unchanged and tests should prove that behavior; the
    product should not force fake tools.
11. **Are structured outputs supported?** Unknown from the authoritative docs.
   Default `supportsStructuredOutputs` to false. A mock verifies serialization,
   not remote capability; promotion requires provider confirmation or a gated
   credentialed smoke test.
12. **Are Anthropic messages required for any target model?** Not for the first
   documented OpenAI-compatible path. Add a representative endpoint test and
   create a follow-up native-Anthropic FID if a supported model's
   tools/thinking/streaming contract fails there or TokenHarbor documents an
   endpoint-specific capability.
13. **What key format should local validation enforce?** Do not hard-reject by prefix. The docs describe `thk_live_...`,
    but server-side key evolution should not brick users; trim and require non-empty, matching existing provider setup
    behavior.
14. **Should keys be shared with `INFERENCE_API_KEY`?** No. Use the provider-specific `TOKENHARBOR_API_KEY` so
    precedence and health reporting remain unambiguous.
15. **Does TokenHarbor's gateway-added prompt fence affect privacy docs?** Yes. Document the provider's own documented
    prompt handling without claiming Savant adds it.
16. **Should live API tests run in CI?** No. Use mocked fetch contract tests in normal CI; gate credentialed live smoke
    tests behind an explicit environment variable and never print the key.
17. **Should this integration change privacy or telemetry defaults?** No. Add TokenHarbor to the chosen-provider
    data-boundary list; do not alter global telemetry policy.
18. **Should a TokenHarbor-specific SDK package be installed?** No. Reuse `@savant-code/llm-providers` and existing
    retry/fetch code.

### Code Verification Evidence

- [x] TokenHarbor docs were read from authoritative pages and URLs are recorded above
- [x] Existing OpenAI-compatible provider seam exists and is reusable
- [x] Shared namespace/catalog is implemented in
  `common/src/constants/model-config.ts:4-22,119-153,331-353,463-479`; it
  contains all 20 IDs observed on the TokenHarbor models page.
- [x] SDK environment access and public key helper are implemented in `sdk/src/env.ts:100-105,` and `sdk/src/index.ts:145-168`.
- [x] SDK routing is production-reachable through `sdk/src/impl/model-provider.ts:103-114,228-233`; the factory in
  `sdk/src/impl/model-provider/model-factories.ts:80-103` strips exactly one prefix, builds the documented URL, and
  sends bearer auth without TokenHarbor-specific steering/cache headers.
- [x] CLI setup/persistence metadata is implemented in `cli/src/utils/provider-setup.ts:21-52,216-283`; provider type and
  settings validation include `tokenharbor` in `cli/src/utils/openrouter-models/types.ts:4-11` and
  `cli/src/utils/settings.ts:229-243`.
- [x] The complete static catalog snapshot and combined picker reachability are implemented in
  `cli/src/utils/openrouter-models/static-catalogs.ts:176-197,298-308` and
  `cli/src/utils/openrouter-models/gateway.ts:102-115`; no unauthenticated `/v1/models` request is added.
- [x] Model lookup normalization recognizes `tokenharbor/` in `cli/src/utils/openrouter-models/lookup.ts:89-103`.
- [x] Focused regression tests pass: common model config **5/5**, SDK provider routing **9/9**, CLI setup/catalog **33/33**.
- [x] The SDK mocked fetch test proves the TokenHarbor Chat Completions URL, bearer header, exact post-prefix model ID,
  and SSE request path without contacting TokenHarbor.
- [x] No live TokenHarbor key was read or used; live inference and authenticated catalog verification remain `NEEDS-REVIEW`.
- [x] RED/GREEN/AUDIT/ADVERSARIAL implementation review completed; no critical/high findings remain.
- [x] Operator authorization was granted by the `code` request following the converged FID.

> **AUDIT evidence-citation rule (FID-2026-0805-004):** every PASS and every FAIL in the AUDIT phase must cite
> `path/to/file.ts:LINE` with quoted code; absence-shaped checks paste exact NO-MATCH searches; out-of-reach
> runtime/credential evidence is `NEEDS-REVIEW` and names the screen/system requiring a human check.

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-07
- **Fix Description:** Added TokenHarbor as an opt-in OpenAI-compatible direct gateway. The implementation adds the shared
  `tokenharbor/` namespace and complete 20-ID catalog snapshot from the public Frontier/Value/Free/Orchestra models page,
  `TOKENHARBOR_API_KEY` access, fail-closed SDK routing, one-prefix model
  normalization, `https://tokenharbor.ai/v1` request construction, masked CLI provider setup and persistence, settings and
  picker integration, static catalog entries without unauthenticated discovery, model lookup normalization, privacy/docs
  coverage, and conservative `supportsStructuredOutputs: false` behavior. Native Anthropic transport, steering/cache
  headers, authenticated model discovery, and live credential verification remain out of scope.
- **Tests Added:** Common model-config test asserting all 20 published IDs; SDK missing-key and mocked request/routing
  tests; CLI provider setup and static/combined catalog tests asserting the complete 20-entry snapshot.
- **Verification:** Common typecheck + 5 focused tests; SDK typecheck + 9 focused tests; CLI typecheck + 33 focused tests;
  Prettier, ESLint, and markdownlint all pass. No live key or network request was used.
- **Verified By:** Independent RED evidence, GREEN implementation review, AUDIT test/typecheck/lint evidence, and
  ADVERSARIAL review with no critical/high findings.
- **Commit/PR:** Not committed
- **Archived:** 2026-08-08 — live credentialed smoke verification remains `NEEDS-REVIEW`.

## Lessons Learned

An OpenAI-compatible gateway can often reuse the provider adapter, but provider identity still crosses many seams: model
namespace, API-key environment access, dispatch, setup persistence, picker catalog, settings validation, health display,
tests, and privacy documentation. TokenHarbor's authenticated model catalog and mixed short/qualified model IDs make
explicit namespace handling and conservative static catalog behavior safer than an assumed anonymous live fetch.
