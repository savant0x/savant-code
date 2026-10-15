# Provider parity review — Savant vs kilocode-main

**Date:** 2026-10-12
**Status:** review complete; gateway probe round executed (Kilo proven, OpenCode product-locked); no source changes
beyond the checked-in probe
**Question:** what would it take for Savant's built-in provider roster to reach parity with the kilocode-main provider surface?

## Method and sources

| Surface       | Source of truth                                                                                                                                                                                                                                                                                               | Measured                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Savant        | `PROVIDER_REGISTRY` — `common/src/providers/registry.ts` + `registry-partitioned{,-2,-3}.ts`                                                                                                                                                                                                                  | 27 entries, read from source |
| kilocode-main | models.dev catalog (`https://models.dev/api.json?type=all`, fetched 2026-10-12) consumed by `packages/opencode/src/provider/models.ts` via `@opencode-ai/core/models-dev`, plus the bespoke loaders in `packages/opencode/src/provider/provider.ts` and `packages/opencode/src/kilocode/provider/provider.ts` | 227 providers                |

kilocode's catalog is **dynamic**: the models.dev API is fetched at runtime and cached, so the 227-provider figure is
today's snapshot, not a checked-in list. Savant's registry is a checked-in, audited, typed roster — the two products
have deliberately opposite philosophies, and the parity question is which of kilocode's providers are worth importing
into an audited registry.

## Headline numbers

| Metric                                         | Count |
| ---------------------------------------------- | ----- |
| Savant registry entries                        | 27    |
| models.dev providers (kilocode's catalog)      | 227   |
| Direct id overlap                              | 8     |
| Savant-only providers (absent from models.dev) | 19    |
| models.dev providers absent from Savant        | 219   |

## Direct overlap (8 ids)

| Provider      | Savant catalog | models.dev roster |
| ------------- | -------------- | ----------------- |
| `openai`      | live           | 53 models         |
| `openrouter`  | live           | 401 models        |
| `nvidia`      | live           | 106 models        |
| `mistral`     | live           | 42 models         |
| `vercel`      | live           | 408 models        |
| `tokenrouter` | static (31)    | 1 model           |
| `orcarouter`  | static (17)    | 117 models        |
| `unorouter`   | static (17)    | 23 models         |

The three curated gateways (`tokenrouter`, `orcarouter`, `unorouter`) show the philosophy gap directly: models.dev
carries thin or uncurated listings for them (1 model for TokenRouter) while Savant ships audited static catalogs.
Savant's roster is not a subset of kilocode's — it is a different cut.

## The parity gap, tiered

### Tier 1 — first-party labs missing entirely (parity-critical)

Every one of these is a vendor-operated API with a documented OpenAI- or Anthropic-compatible surface. This is the gap
that matters: a user cannot reach Claude, Gemini, Grok, DeepSeek, Groq, Cohere, Together, Qwen, Kimi, GLM, or MiniMax
from Savant today.

| Provider                  | models.dev models | Credential env var                  | Wire shape                                             |
| ------------------------- | ----------------- | ----------------------------------- | ------------------------------------------------------ |
| `anthropic`               | 17                | `ANTHROPIC_API_KEY`                 | Anthropic Messages                                     |
| `google`                  | 39                | `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Gemini-native (OpenAI-compatible endpoint also exists) |
| `xai`                     | 13                | `XAI_API_KEY`                       | OpenAI-compatible                                      |
| `deepseek`                | 4                 | `DEEPSEEK_API_KEY`                  | OpenAI-compatible                                      |
| `groq`                    | 16                | `GROQ_API_KEY`                      | OpenAI-compatible                                      |
| `cohere`                  | 17                | `COHERE_API_KEY`                    | OpenAI-compatible (`/compatibility/v1`)                |
| `togetherai`              | 29                | `TOGETHER_API_KEY`                  | OpenAI-compatible                                      |
| `cerebras`                | 2                 | `CEREBRAS_API_KEY`                  | OpenAI-compatible                                      |
| `deepinfra`               | 72                | `DEEPINFRA_API_KEY`                 | OpenAI-compatible                                      |
| `perplexity`              | 4                 | `PERPLEXITY_API_KEY`                | OpenAI-compatible                                      |
| `alibaba` (+`alibaba-cn`) | 59 / 91           | `DASHSCOPE_API_KEY`                 | OpenAI-compatible                                      |
| `moonshotai` (+`-cn`)     | 4 / 4             | `MOONSHOT_API_KEY`                  | OpenAI-compatible                                      |
| `zai` / `zhipuai`         | 18 / 17           | `ZHIPU_API_KEY`                     | OpenAI-compatible                                      |
| `minimax` (+3 variants)   | 7–8 each          | `MINIMAX_API_KEY`                   | Anthropic-compatible                                   |
| `meta`                    | 6                 | `META_MODEL_API_KEY`                | OpenAI-compatible (Llama API)                          |
| `fireworks-ai`            | 22                | `FIREWORKS_API_KEY`                 | OpenAI-compatible                                      |
| `baseten`                 | 24                | `BASETEN_API_KEY`                   | OpenAI-compatible                                      |
| `venice`                  | 118               | `VENICE_API_KEY`                    | OpenAI-compatible                                      |

### Tier 2 — platforms needing a new protocol or auth shape

These cannot be added as a pure registry entry; each needs work in the request path.

| Provider                                    | models.dev models | What it needs                                                                |
| ------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `amazon-bedrock`                            | 199               | SigV4 request signing + Converse streaming — a protocol Savant does not have |
| `azure` / `azure-cognitive-services`        | 97 / 87           | Per-resource URL derivation and an `api-key` header (not Bearer)             |
| `github-copilot`                            | 35                | OAuth device-flow login; Savant's credential model is env-var/api-key only   |
| `google-vertex` / `google-vertex-anthropic` | 60 / 17           | IAM token minting per request                                                |
| `sap-ai-core`                               | 55                | Service-key JSON credential, deployment-id routing                           |
| `snowflake-cortex`                          | 25                | Account-scoped URL, PAT/OAuth token                                          |
| `gitlab`                                    | 30                | Instance URL + Duo feature flags                                             |
| `watsonx`                                   | 5                 | Project-id-scoped IAM                                                        |
| `databricks`                                | 30                | Host + token pair                                                            |

### Tier 3 — aggregator gateways with meaningful rosters

OpenAI-compatible fronts over many upstreams. Each is a one-entry add once Tier 1 lands, but each is also a trust
decision (the gateway sees all traffic).

| Provider                              | models.dev models | Credential                  |
| ------------------------------------- | ----------------- | --------------------------- |
| `kilo` (the Kilo Gateway itself)      | 387               | `KILO_API_KEY`              |
| `opencode` (OpenCode Zen)             | 122               | `OPENCODE_API_KEY`          |
| `vercel` — already present            | —                 | —                           |
| `llmgateway` / `llmgateway-providers` | 215 / 446         | `LLMGATEWAY_API_KEY`        |
| `requesty`                            | 171               | `REQUESTY_API_KEY`          |
| `nano-gpt`                            | 614               | `NANO_GPT_API_KEY`          |
| `poe`                                 | 137               | `POE_API_KEY`               |
| `novita-ai`                           | 84                | `NOVITA_API_KEY`            |
| `huggingface`                         | 81                | `HF_TOKEN`                  |
| `siliconflow` (+`-cn`)                | 57 / 44           | `SILICONFLOW_API_KEY`       |
| `digitalocean`                        | 102               | `DIGITALOCEAN_ACCESS_TOKEN` |
| `zenmux`                              | 129               | `ZENMUX_API_KEY`            |
| `aihubmix`                            | 152               | `AIHUBMIX_API_KEY`          |
| `nebius`                              | 21                | `NEBIUS_API_KEY`            |
| `helicone`                            | 90                | `HELICONE_API_KEY`          |

### Tier 4 — the long tail (~180 providers)

The remainder of the 227 are regional variants (`alibaba-cn`, `stepfun-*`, `xiaomi-token-plan-*`, `tencent-*`,
`minimax-*`), single-model endpoints, and small OpenAI-compatible gateways. Per-provider registry parity here is not
meaningful: Savant already ships the user-defined-provider path (`/provider add <host>`, `CustomProviderConfig`) which
covers exactly this class with no code. The right parity answer for Tier 4 is documentation, not registry entries.

## Savant-only providers (19) — the differentiator

These have no models.dev listing; they are Savant's audited free-tier and curated-gateway roster, several with measured
evidence in `docs/providers.md`:

`tokenharbor` (68 static models), `commandcode` (33, dual-protocol), `nous`, `kiosapi`, `apinex`, `bai`, `hcnsec`,
`tokenbom`, `infron`, `bazaarlink`, `atria`, `codecraft`, `xkiro` (multi-protocol), `cleanapis`, `intern`,
`chatanywhere`, `tiarina`, plus `ollama` (the only `local`-kind provider — models.dev lists only hosted `ollama-cloud`)
and `cloudflare`.

Two asymmetries worth naming:

- **Cloudflare.** Savant's `cloudflare` entry is Workers AI (`cf-rewrite`, 14 static models). kilocode runs **two**
  Cloudflare products: `cloudflare-workers-ai` (30 models) and `cloudflare-ai-gateway` (58 models — unified billing/BYOK
  front for third-party upstreams). The AI Gateway product is a genuine Savant gap.
- **Local runtimes.** Savant's `ollama` (local daemon, auto-detected) has no models.dev equivalent; kilocode's local
  story is `lmstudio` (3 models) plus custom providers.

## Protocol parity

Savant's `ProviderProtocol` union (`common/src/providers/types.ts:52`) is
`'openai' | 'anthropic' | 'openai-anthropic' | 'multi' | 'responses'`, and `ProviderModelProtocol` (`:59`) already
includes `'gemini'` — declared but unused by any provider. kilocode runs the full Vercel AI SDK surface: native Gemini,
Bedrock Converse, Azure, Cohere, plus its own Effect-based `packages/llm` route runtime.

Consequences for the parity plan:

- **Anthropic is the cheapest high-value add.** The `anthropic` wire protocol is already exercised in production by the
  `COMMANDCODE_PROTOCOLS`, `TOKENROUTER_PROTOCOLS`, and `XKIRO_PROTOCOLS` maps; adding `anthropic` as a provider is a
  registry entry plus a live-catalog wrapper, with no new protocol code.
- **Google has two paths.** The registry-shaped path is an OpenAI-compatible base URL
  (`generativelanguage.googleapis.com/v1beta/openai/`) under `protocol: 'openai'`. The native path would activate the
  already-declared `gemini` model protocol, which needs a protocol map and factory work.
- **Bedrock, Azure, and Copilot are protocol projects, not entries** (Tier 2 above).

## Cost per addition (per `docs/adding-a-provider.md`)

Each Tier 1 provider costs: one typed registry entry (partition file), one `WINDOW_COVERAGE_REGISTER` entry (fail-closed
test), and for a `live` catalog a wrapper module + `gateway.ts` fan-out + a `gateway-live-results.ts` ladder slot
(positional contract — insert before the custom-catalogs tail) + an exception-manifest entry + three additive test
files + `bun run generate:provider-docs`. The runbook is written against the live enforcing modules and the validator
fails closed on every missed step, so the marginal cost per provider is low and the drift risk is gated.

## Gateway probe evidence (2026-10-12)

The Tier 1/2 per-vendor path is blocked on operator keys (none held for any target), so the aggregator path was probed
instead — one registry entry per gateway. Live, keyless + keyed, via the checked-in probe
`scripts/providers/audit-probes/parity-gateway-probe.ts`:

### Kilo Gateway — viable, proven end to end

| Leg | Result |
|---|---|
| Keyless catalog `GET api.kilo.ai/api/gateway/models` | 200, 391 rows, OpenRouter-shaped envelope |
| Field coverage | `id` 391/391, `context_length` 391/391, `pricing` 391/391 |
| Keyed catalog | 200, same 391 rows (the key adds no roster) |
| Inference smoke `liquid/lfm-2.5-2.6b:free` | **200, finish=stop, content `SAVANT-CHAIN-OK`**, usage 22/100, reasoning field present |
| Free rows | 16 by the `isFree` flag (18 counting `pricing.prompt = "0"`) |

Measured caveats: upstream 429s are per-route and intermittent — `inclusionai/ling-3.1-flash` returned 200 on one
attempt and 429 on the next, the latter routed to Novita with `is_byok: true` and
`limit_source: upstream_provider_account`; the gateway surfaces upstream overload as structured errors rather than
failing. Reasoning models return empty content at small `max_tokens` (probe budgets must be ≥128). The gateway
normalizes ids: `stepfun/step-5-preview-free` echoes as `stepfun/step-5-preview`.

### OpenCode — catalog public, inference product-locked

| Leg | Result |
|---|---|
| Keyless catalog | 200, **83 rows** (the models.dev snapshot claims 122 — stale again) |
| Field coverage | `id` 83/83, `context_length` 0/83, `pricing` 0/83 — minimal shape |
| Inference `big-pickle` | **403 `FreeTierError`: "OpenCode's free tier can only be used from within OpenCode"** |
| Inference free models | 400 "Model is unavailable" |

The 403 is decisive: the free tier is product-locked to OpenCode's own surfaces, so the gateway path is not viable for
Savant on a free key. The roster itself (`claude-opus-5-5`, `gpt-5.6-luna`, `gemini-3.8-flash`, `grok-4.7`, `kimi-k3`,
`glm-5.3`, `deepseek-v4-pro`, `minimax-m3`, `qwen3.8-max` …) shows what a paid key would reach, but that is a purchase
decision, not a parity step.

### Live-vs-snapshot divergence (both gateways)

Kilo live 391 vs snapshot 387; OpenCode live 83 vs snapshot 122; Kilo free rows 16 live vs 21 snapshotted. The
models.dev snapshot is a stale fallback — the same relationship kilocode's own `models.ts` has with it. Any Savant
entry for either gateway ships `catalog: { source: 'live' }`, never static.

### Tier 1 keyless catalog sweep (2026-10-12)

All 18 Tier 1 targets swept keylessly via
`scripts/providers/audit-probes/parity-tier1-catalog-probe.ts`. Per the operator ruling (SCOPE.md, 2026-10-12), the
program's deliverable is registry expansion — users add their own keys — so the sweep measures exactly what a
registry entry needs and no key can buy: endpoint reachability, envelope shape, field names, id conventions, and the
auth boundary.

| Target | Keyless verdict | Registry consequence |
|---|---|---|
| `deepinfra` | **200, 177 rows, `data[]`, no window/pricing fields** | live catalog viable (ids only); windows/pricing from models.dev |
| `venice` | **200, 130 rows, `data[]`, `context_length` published** | live catalog viable, `runtime-published` windows |
| `anthropic` | 401 | static; the `anthropic` protocol is already proven by the existing protocol maps |
| `xai`, `deepseek`, `groq`, `cohere`, `togetherai`, `alibaba`, `moonshotai`, `zai`, `minimax`, `meta`, `fireworks-ai`, `baseten` | 401 | static catalog from models.dev metadata |
| `cerebras` | 403 | static catalog from models.dev metadata |
| `google` | 404 — the OpenAI-compatible `/models` path does not exist | static; the native Gemini path is a protocol question, not an entry |
| `perplexity` | 404 — no public model list | static catalog from models.dev metadata |

Measured details that shape the entries: deepinfra publishes HuggingFace-style org-prefixed ids
(`zai-org/GLM-5.3`, `MiniMaxAI/MiniMax-M3` — 177 rows), so its `idTransform` strips only the Savant prefix and keeps
the vendor's org segment; venice publishes bare dashed ids (`gemini-3-8-flash`, `z-ai-glm-5-3` — 130 rows) with
`context_length` on every row. The 14 key-gated 401/403s are the expected result for first-party labs — the same
signal that classifies a catalog as `no-runtime-rows` rather than dead — and under the ruling they ship
surface-verified with the inference leg deferred to the user's own key.

## Recommended parity targets

**Wave 0 — the gateway play (1 entry, proven).** `kilo` is the Mistral template (`8d915d8f`) verbatim:
`protocol: 'openai'`, `idTransform: 'strip'`,
`catalog: { source: 'live', url: 'https://api.kilo.ai/api/gateway/models' }`
(public — no resolver needed), `kind: 'gateway'`, `envVar: 'KILO_API_KEY'`, window disposition `runtime-published`
(`context_length` on 391/391 rows), parser measured OpenRouter-compatible with the Kilo extras (`isFree`, `autoRouting`,
`terminalBench`, `preferredIndex`) ignored. One entry delivers 391 models across 54 upstream families — every Tier 1
lab — with the inference leg already proven. The remaining acceptance steps are the runbook's keyed round-trip and,
ideally, one paid cross-lab smoke (Claude or Gemini through the gateway), which spends from the operator key and is
therefore the operator's call.

**Wave 0-blocked — `opencode`.** Catalog public and rich, but the free tier is product-locked (403, measured
2026-10-12). Revisit only on a paid key, and note the FID-2026-0916-004 policy reversal that re-adding it implies.

**Wave 1 — first-party labs, all OpenAI/Anthropic-compatible (18 providers):** `anthropic`, `google`, `xai`, `deepseek`,
`groq`, `cohere`, `togetherai`, `cerebras`, `deepinfra`, `perplexity`, `alibaba`, `moonshotai`, `zai`, `minimax`,
`meta`, `fireworks-ai`, `baseten`, `venice`.

Rationale: these are the vendors users ask for by name; every one is a single registry entry under an existing
protocol; `anthropic` and `minimax` reuse the proven Messages path, the rest reuse the generic OpenAI factory. The
keyless sweep above has already measured every target's surface, so nothing here is probe-blocked: 14 ship as static
catalogs sourced from models.dev metadata (windows and pricing included), and `deepinfra` + `venice` ship as live
catalogs from their public endpoints. Under the operator ruling the inference leg is the user's — they add their own
key — so no developer credential is required for any of them.

**Wave 2 — protocol projects (4):** `amazon-bedrock`, `azure`, `github-copilot`, `google-vertex`. Each is a FID-sized
piece of work (signing, header shape, or OAuth), sequenced after Wave 1 so the registry patterns are settled.

**Wave 3 — selected aggregators:** `llmgateway`, `requesty`, `novita-ai`, `siliconflow`, `huggingface`, `nebius`,
`digitalocean` — one entry each, gated on the same audit bar as the existing curated gateways.

**Not recommended:** per-provider entries for the Tier 4 long tail; the custom-provider path already covers it.

## Boundaries

- The 227-provider figure is a live models.dev snapshot fetched 2026-10-12; kilocode's effective roster also includes
  its 23 bespoke loaders and 24 bundled AI-SDK providers, several of which (e.g. `github-copilot`, `azure`) change
  behavior beyond the catalog listing.
- Two gateways and all 18 Tier 1 targets were probed live on 2026-10-12 (evidence above); every other provider in
  this report is compared at the **surface** level only. Per the operator ruling recorded in SCOPE.md, the Tier 1
  entries ship surface-verified with the inference leg deferred to the user's own key — a conscious narrowing of the
  runbook's "assert the final leg with a real request" step for this wave, not a silent skip.
- Kilo's paid cross-lab route (Claude/Gemini/Grok through the gateway) is unproven: the free smokes establish
  transport and routing, not paid-route completion. That check spends from the operator key and is not required for
  the registry entry.
- Executing any wave is new scope: it needs `SCOPE.md` registration and, for the live-catalog providers, the
  positional-ladder and exception-manifest discipline the runbook names.
