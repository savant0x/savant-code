<!-- markdownlint-disable MD013 -->

# Nova Audit Response — FID-2026-0809-001 Unified Provider Registry (Design Approval)

**Date:** 2026-08-09
**Auditor:** Nova — independent third-party ECHO auditor
**FID:** `dev/fids/FID-2026-0809-001-unified-provider-registry.md`
**Request:** `dev/nova/outbox/2026-08-09-fid-2026-0809-001-unified-provider-registry-nova-audit-request.md`
**Method:** Source-verified review. Every claim independently verified against the codebase;
Cross-Agent Claim Rule applied.

---

## Mutation Boundary Confirmation

No production code was changed. No commits, tags, pushes, GitHub releases, npm publications,
credential mutations, or durable settings mutations were made. The only artifacts read were the
FID, the audit request, and the 20 source files listed in the request. The FID is at status
`analyzed`; implementation has not begun.

---

## Audit Target Verdicts

### Target 1 — The drift inventory is accurate

**PASS**

| Sub-claim | Verdict | Evidence |
|-----------|---------|----------|
| Base URLs duplicated across SDK factories and CLI setup | **PASS** | `model-factories.ts:67` (`https://api.tokenrouter.com/v1/`), `:93` (`https://tokenharbor.ai/v1/`), `:122` (`https://integrate.api.nvidia.com/v1/`), `:222` (`https://opencode.ai/zen/go/v1/`), `:280` (`https://api.commandcode.ai/provider/v1/`); `provider-setup.ts:35` (`https://api.tokenrouter.com/v1`), `:40` (`https://tokenharbor.ai/v1`), `:45` (`https://integrate.api.nvidia.com/v1`), `:30` (`https://opencode.ai/zen/go/v1`), `:50` (`https://api.commandcode.ai/provider/v1`). Cannot import each other (different package boundaries). |
| `.env.example:71` documents stale `tokenrouter.me` URL | **PASS** | `.env.example:71` reads `# https://tokenrouter.me/v1`; both `model-factories.ts:67` and `provider-setup.ts:35` use `https://api.tokenrouter.com/v1`. |
| Cloudflare absent from five code surfaces | **PASS** | (1) `provider-setup.ts:21` — 6 keys, no cloudflare. (2) `types.ts:4-11` — 7-member union, no cloudflare. (3) `settings.ts:233-241` — `validProviders` set of 7, no cloudflare. (4) `gateway.ts:107-114` — 6 catalog sources, no cloudflare. (5) `cli/release/README.md:48-55` — 8-row table, no cloudflare row. (6) `model-picker.tsx:43-55` — explicit cases for openrouter/tokenrouter/nvidia/opencode-go, default returns 4; no explicit cloudflare case. Cloudflare IS present in `ALLOWED_MODEL_PREFIXES` (`model-config.ts:18`) and `providerDomains` (`model-config.ts:468`), confirming the incoherent hand-maintained matrix. |
| `ALLOWED_MODEL_PREFIXES` omits `openrouter` and `ollama` | **PASS** | `model-config.ts:4-23` — 18-entry `as const` array: `anthropic`, `openai`, `google`, `x-ai`, `deepseek`, `minimax`, `mimo`, `tencent`, `tokenrouter`, `tokenharbor`, `nvidia`, `opencode-go`, `commandcode`, `cloudflare`, `moonshotai`, `bytedance-seed`, `xiaomi`, `miromind`. Neither `openrouter` nor `ollama` present. |
| Catalogs duplicated (34 + 15) | **PASS** | `tokenrouterModels` (`model-config.ts:67-115`): 34 entries. `TOKENROUTER_CATALOG` (`static-catalogs.ts:13-174`): 34 entries, same IDs. `opencodeGoModels` (`model-config.ts:163-181`): 15 entries. `OPENCODE_GO_CATALOG` (`static-catalogs.ts:199-249`): 15 entries, same IDs. No parity guard exists. |
| Default factory misnamed `createSavantCodeBackendModel` | **PASS** | `savant-backend.ts:28` — `export async function createSavantCodeBackendModel(`. This is the generic OpenAI-compatible fallback, not a backend adapter. |
| Context-window heuristics layered | **PASS** | `static-catalogs.ts:255-284` — `inferContextLength(name)` heuristic chain with 12+ model-family checks. Applied as fallback in `fetchTokenRouterModels()` (:294), `fetchOpenCodeGoModels()` (:320), `fetchCommandCodeModels()` (:336). |

---

### Target 2 — The registry location and data-only constraint are sound

**PASS**

| Sub-claim | Verdict | Evidence |
|-----------|---------|----------|
| `common` is the shared package for the registry | **PASS** | Both `sdk` and `cli` import from `@savant-code/common` at the source level (verified via import statements across `model-config.ts`, `settings.ts`, etc.). The FID's characterization that common is "the only package both depend on" is slightly imprecise — `@savant-code/llm-providers` is also imported by both — but this does not affect the design choice. A data-only `PROVIDER_REGISTRY` in `common/src/providers/` is the correct location: it is already bundled into both consumers, is serializable (pure constants), and carries no circular-import risk. |
| Entry shape covers all eight providers | **PASS (design claim)** | The FID's proposed `ProviderConfig` interface covers `kind: 'gateway'` (openrouter, tokenrouter, tokenharbor, nvidia, opencode-go, commandcode, cloudflare), `kind: 'local'` with optional `envVar` (ollama), and `kind: 'env-only'` (custom endpoints). The `credentials.envVar` is optional for local providers. The shape is adequate for all eight current providers. |

---

### Target 3 — Single user setting + env precedence

**PASS**

| Sub-claim | Verdict | Evidence |
|-----------|---------|----------|
| `activeProvider` is the one persisted selection | **PASS** | `provider-setup.ts:273-277` — `saveSettings({ savantCodeModelProviderPreference: provider, ... })` persists the selection. `provider-setup.ts:94-113` — `getMissingProviderSetup()` checks key *existence* (readiness), not which provider is active. Key presence is readiness, not selection. |
| `DIRECT_PROVIDER` / `INFERENCE_BASE_URL` remain explicit overrides; shell env wins | **PASS** | `sdk/src/env.ts:74-81` — `isDirectProviderMode()` reads `DIRECT_PROVIDER` and `INFERENCE_BASE_URL` from `process.env`. `provider-setup.ts:162` — `if (process.env[config.envVar]?.trim()) continue` — env key wins. `provider-setup.ts:173-188` — sets `DIRECT_PROVIDER` from stored credentials only if shell env is absent. `ollama-onboarding.ts:72-77` — checks `process.env.DIRECT_PROVIDER` and `INFERENCE_BASE_URL` before applying persisted settings. |
| Settings fields confirmed | **PASS** | `settings.ts:19` — `DEFAULT_SAVANT_CODE_MODEL_PROVIDER: ModelProvider = 'openrouter'`. `settings.ts:25` — `savantCodeModelPreference`. `settings.ts:26` — `savantCodeModelProviderPreference`. `settings.ts:71` — `savantCodeModelAutoConfigured?: boolean`. `settings.ts:368-370` — `loadSavantCodeModelPreference` function. All fields exist at stated locations. |

---

### Target 4 — The four semantic contracts that must not break

**PASS**

| Sub-claim | Verdict | Evidence |
|-----------|---------|----------|
| **1. Bare-slug routing** — unprefixed ids route to active provider's gateway; `openrouter/`-prefixed ids keep dedicated branch | **PASS** | `model-provider.ts:148-159` — `isOpenRouterModel(model)` catches `openrouter/`-prefixed models (defined at `:214-216` as `model.startsWith('openrouter/')`), routes through dedicated `createOpenRouterModel()` with `resolveOpenRouterApiKey()` at `:149`. `model-provider.ts:193-197` — default branch (unprefixed slugs) calls `createSavantCodeBackendModel(apiKey, model)` — routes to the generic OpenAI-compatible factory. `model-factories.ts:168-173` — comment confirms "unlike tokenrouter/opencode-go the prefix is NOT stripped, and the model ID is sent unchanged." |
| **2. Default key is caller-supplied** — SDK's default branch does not resolve a key | **PASS** | `model-provider/types.ts:6-9` — `ModelRequestParams { apiKey: string; model: string; skipChatGptOAuth?: boolean }`. `llm/prompts.ts:46-50` — `{ apiKey: '', model: params.model, skipChatGptOAuth: true }`. `llm/stream.ts:75-79` — same pattern. `model-provider.ts:194-195` — default branch `createSavantCodeBackendModel(apiKey, model)` passes through caller's apiKey without resolving. The FID's retraction of the `resolvedOpenRouterKey ?? INFERENCE_API_KEY ?? apiKey` chain is correct — that mechanism does not exist in the SDK. |
| **3. ChatGPT OAuth stays a pre-loop gate** | **PASS** | `model-provider.ts:65-86` — Predicate at `:67-72`: `if (CHATGPT_OAUTH_ENABLED && !skipChatGptOAuth && isOpenAIProviderModel(model) && isChatGptOAuthModelAllowed(model))`. Lines 73-84: rate-limit check, credential acquisition, returns `createOpenAIOAuthModel(...)` or falls through. This is a pre-loop gate in `getModelForRequest()`, ahead of the routing branches. |
| **4. Cloudflare URL interpolation and `@cf/` rewrite** | **PASS** | `model-factories.ts:146` — `const apiModelId = \`@cf/${model.slice('cloudflare/'.length)}\`` — model id rewritten to `@cf/<id>`. `model-factories.ts:149-154` — URL constructed with `accountId` interpolated mid-path: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/`. The FID's proposed `{ENV_VAR}` placeholder syntax for the registry's `baseUrl` field is a design choice that maps cleanly to this existing behavior. |

**Supplementary verification — OpenRouter key resolver:**

`openrouter-key-resolver.ts:7-9` — Comment documents the three-level resolution: (1) `OR_MASTER_KEY` → exchange via `/api/v1/keys`, (2) `OPENROUTER_API_KEY`, (3) `INFERENCE_API_KEY`. Implementation at `:67-111` matches exactly. The FID's claim that this behavior is preserved is correct.

---

### Target 5 — Derivation table completeness

**PASS**

| Sub-claim | Verdict | Evidence |
|-----------|---------|----------|
| `ORG_PREFIXES` does not exist today (Phase-1 extraction) | **PASS** | `model-config.ts:4-23` — `ALLOWED_MODEL_PREFIXES` is a hand-maintained `as const` array of 18 inline org slugs. Regex search for `ORG_PREFIXES` across `model-config.ts` returns zero matches. The FID correctly identifies this as a Phase-1 extraction, not an existing symbol. |
| `providerDomains` carries org domains; `getLogoForModel` uses name-heuristic branches | **PASS** | `model-config.ts:457-473` — `providerDomains` is a flat `as const` object with 15 keys (google, anthropic, openai, deepseek, minimax, mimo, atlascloud, tencent, xai, tokenrouter, tokenharbor, nvidia, opencodeGo, cloudflare, commandcode). `model-config.ts:475-505` — `getLogoForModel` is a long `if/else if` chain mixing `Object.values()` membership checks with `modelName.startsWith()` and `modelName.includes()` heuristics. The FID's claim that these must be split into `ORG_DOMAINS` (static) + registry domains + kept heuristics is accurate. |
| `getProviderOrder` current sort: 0,1,2,3 + 4-way tie at 4 | **PASS** | `model-picker.tsx:43-56` — switch statement: `openrouter` → 0, `tokenrouter` → 1, `nvidia` → 2, `opencode-go` → 3, `default` → 4. Tokenharbor, commandcode, ollama, and cloudflare all fall into `default: 4`. The FID's Phase-1 constraint to replicate this exact sort is correct. |

---

### Target 6 — Phase plan and enumerated one-time deltas

**PASS**

The FID's Phase 1 is correctly characterized as zero-semantic-change with four enumerated deltas
and one constraint. The source code confirms the baseline that Phase 1 must preserve:

1. `ALLOWED_MODEL_PREFIXES` exists and is manually maintained (`model-config.ts:4-23`) — delta
   (a): gains `openrouter` and `ollama`.
2. `ModelProvider` union (`types.ts:4-11`) and `validProviders` (`settings.ts:233-241`) — delta
   (b): gains `cloudflare`.
3. `providerDomains` (`model-config.ts:457-473`) — delta (c): gains `openrouter` (currently absent
   from the object).
4. `getProviderOrder` (`model-picker.tsx:43-56`) — delta (d): registry `order` values must
   replicate the current sort exactly.

Each delta is a latent-gap fix (not a behavior change), and each is listed in the Phase-1 diff
description. Phases 2-5 are independently shippable, each gated by the full test suite.

---

### Target 7 — Robustness model

**PASS (design claims — not yet implemented)**

The FID's robustness model is forward-looking and introduces no contradictions with the current
codebase:

- **Compile-time `satisfies Record<string, ProviderConfig>` exhaustiveness**: No existing
  `Record` exhaustiveness check exists today; this is a new enforcement mechanism the FID will
  introduce. No contradiction.
- **Zod registry validation (fail fast)**: No registry exists today; this is new. No
  contradiction.
- **`derive*` and `validate` functions take the registry as their first argument**: No `derive*`
  functions exist in `model-config.ts` today. The existing functions (`getLogoForModel`,
  `getProviderOrder`) reference module-level constants directly. The FID's design to make them
  registry-injected pure functions is forward-looking and sound.
- **Fixture-provider test**: This is a Phase 5 test; no contradiction with current code.

---

### Target 8 — YAGNI and no behavior rewrite

**PASS**

| Sub-claim | Verdict | Evidence |
|-----------|---------|----------|
| No speculative features | **PASS** | The only shape additions (`{ENV_VAR}` placeholders, typed `MODEL_CATALOGS` refs, parameterized derive) are required by existing behavior or testability. No new provider types, no new routing mechanisms, no new auth flows. |
| Credential precedence (FID-2026-0804-001) preserved | **PASS** | `env.ts:74-81` — `isDirectProviderMode()` reads from `process.env`. `provider-setup.ts:162` — env key wins over stored key. No auth logic is modified by this FID. |
| Direct-mode gate (FID-2026-0806-009) preserved | **PASS** | `settings.ts:72-78` — `directProvider` and `directProviderBaseUrl` fields exist. The FID does not modify these fields; they remain as explicit override escape hatches. |
| OpenRouter master-key exchange preserved | **PASS** | `openrouter-key-resolver.ts:7-9` — Resolution chain: `OR_MASTER_KEY` → `OPENROUTER_API_KEY` → `INFERENCE_API_KEY`. Implementation at `:67-111` matches. The FID's decision to keep this as `credentials.resolver: 'openrouter'` in the registry preserves the existing behavior exactly. |
| SavantFree variant untouched | **PASS** | The FID targets `common/src/constants/model-config.ts`, `cli/src/components/model-picker.tsx`, and related provider plumbing. The `savant-free` workspace (`@savant-code/savant-free`) is a separate package. `isSupportedSavantFreeModelId` in `settings.ts:4` comes from a separate constants file, not `model-config.ts`. No conflict. |

---

## Overall Verdict

### PASS — The design is ready for Phase 1 implementation.

**Rationale:**

All eight audit targets pass with file:line evidence. The drift inventory (Target 1) is
accurate — every URL duplication, catalog duplication, incoherent provider enumeration, and
misnamed function is confirmed against the source. The registry location in `common` (Target 2)
is the correct choice. The single-setting model and env-precedence contract (Target 3) are
sound and preserve backward compatibility. The four semantic contracts (Target 4) — bare-slug
routing, caller-supplied default key, ChatGPT OAuth gate, and Cloudflare URL interpolation —
are all verified and the FID's design correctly preserves them. The derivation table (Target 5)
is complete and correctly identifies what exists today versus what is a Phase-1 extraction. The
phase plan (Target 6) is well-structured with honest delta enumeration. The robustness model
(Target 7) introduces no contradictions and the pure-function injection pattern is the right
choice for testability. YAGNI compliance (Target 8) is confirmed — no speculative features,
all behavior contracts preserved.

**No critical or high objections.** One minor imprecision noted: the FID characterizes
`common` as "the only package both sdk and cli already depend on" — `@savant-code/llm-providers`
is also imported by both. This does not affect the design choice (the registry belongs in
`common`), but could be tightened in a future FID revision for precision.

**The FID has been through three Perfection Loop iterations with two decision-level errors
caught and corrected (decision 6 retraction, decision 10 key-authorization separation). The
Loop 3 convergence under the diminishing-returns gate is justified — the design is stable.
Phase 1 implementation may proceed.**
