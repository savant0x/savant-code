# Providers, model selection, and metadata

Run `/provider` to configure a provider key with masked input, then use
`/model` to browse and filter its models. Saved CLI credentials are local;
shell environment variables take precedence. SDK applications resolve their
own environment credentials and do not automatically load CLI key storage.
The [root provider setup](../README.md#configure-a-hosted-provider-key) and
[installation guide](installation.md) cover the full built-in registry.
Contributors adding a new built-in provider follow
[adding-a-provider.md](adding-a-provider.md).

## Built-in provider registry

Every built-in provider derives from `PROVIDER_REGISTRY`
(`common/src/providers/registry.ts`) — the single source of truth for routing
prefixes, credentials, API roots, protocols, and catalogs. The table below is
**generated** from it by `bun run generate:provider-docs`, so a new registry
entry appears here on the next run, and `generate:provider-docs:check` fails
closed if this section drifts from the registry.

| Column | Meaning |
|---|---|
| Provider | Display label shown in `/provider` and `/model` |
| ID | The routing prefix — `intern/<model-id>` selects through this provider |
| Kind | `gateway` (hosted), `local` (a local daemon), or `env-only` |
| Credential | The env var(s) the `/provider` wizard stores and the runtime resolves |
| API root | The API base; the protocol layer appends the endpoint path |
| Protocol | The wire protocol, naming the dispatch map where one applies |
| Catalog | `live` (fetched from the vendor), `static` (checked in), `inline`, or `none` |

<!-- GENERATED:registry-table-start -->
| Provider | ID | Kind | Credential | API root | Protocol | Catalog |
| --- | --- | --- | --- | --- | --- | --- |
| OpenAI | `openai` | gateway | `OPENAI_API_KEY` | `https://api.openai.com/v1` | responses | live |
| OpenRouter | `openrouter` | gateway | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | openai | live |
| TokenRouter | `tokenrouter` | gateway | `TOKENROUTER_API_KEY` | `https://api.tokenrouter.com/v1` | multi (`TOKENROUTER_PROTOCOLS`) | static (31 models) |
| NVIDIA NIM | `nvidia` | gateway | `NVIDIA_API_KEY` | `https://integrate.api.nvidia.com/v1` | openai | live |
| APInex | `apinex` | gateway | `APINEX_API_KEY` | `https://api.apinex.bond/v1` | openai | live |
| Atria AI | `atria` | gateway | `ATRIA_API_KEY` | `https://api.atria-asi.ai/v1` | openai | static (1 model) |
| B.AI | `bai` | gateway | `BAI_API_KEY` | `https://api.b.ai/v1` | openai | live |
| BazaarLink | `bazaarlink` | gateway | `BAZAARLINK_API_KEY` | `https://api.bazaarlink.ai/v1` | openai | static (12 models) |
| ChatAnywhere | `chatanywhere` | gateway | `CHATANYWHERE_API_KEY` | `https://api.chatanywhere.tech/v1` | openai | static (27 models; evidence: console-verified 2026-10-05) |
| Clean APIs | `cleanapis` | gateway | `CLEANAPIS_API_KEY` | `https://cleanapis.com/v1` | openai | live |
| Cloudflare | `cloudflare` | gateway | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | `https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1` | openai | static (14 models) |
| CodeCraft API | `codecraft` | gateway | `CODECRAFT_API_KEY` | `https://codecraftapi.com/v1` | openai | live |
| CommandCode | `commandcode` | gateway | `COMMAND_CODE_API_KEY` | `https://api.commandcode.ai/provider/v1` | openai-anthropic (`COMMANDCODE_PROTOCOLS`) | static (33 models) |
| HCNSec | `hcnsec` | gateway | `HCNSEC_API_KEY` | `https://api.hcnsec.cn/v1` | openai | static (7 models) |
| Infron | `infron` | gateway | `INFRON_API_KEY` | `https://llm.onerouter.pro/v1` | openai | static (9 models) |
| Intern InkStone | `intern` | gateway | `INTERN_API_KEY` | `https://discovery-api.intern-ai.org.cn/v1` | openai | static (10 models) |
| KiosAPI | `kiosapi` | gateway | `KIOSAPI_API_KEY` | `https://kiosapi.com/v1` | openai | live |
| Mistral AI | `mistral` | gateway | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` | openai | live |
| Nous Research | `nous` | gateway | `NOUS_API_KEY` | `https://inference-api.nousresearch.com/v1` | openai | live |
| Ollama | `ollama` | local | — | `http://localhost:11434/v1` | openai | none |
| OrcaRouter | `orcarouter` | gateway | `ORCAROUTER_API_KEY` | `https://api.orcarouter.ai/v1` | openai | live |
| TokenBom | `tokenbom` | gateway | `TOKENBOM_API_KEY` | `https://tokenbom.com/v1` | openai | static (7 models) |
| TokenHarbor | `tokenharbor` | gateway | `TOKENHARBOR_API_KEY` | `https://tokenharbor.ai/v1` | openai | static (68 models) |
| UnoRouter | `unorouter` | gateway | `UNOROUTER_API_KEY` | `https://api.unorouter.com/v1` | openai | static (17 models) |
| Vercel AI Gateway | `vercel` | gateway | `AI_GATEWAY_API_KEY` | `https://ai-gateway.vercel.sh/v1` | openai | live |
| xKiro | `xkiro` | gateway | `XKIRO_API_KEY` | `https://api.xkiro.com/v1` | multi (`XKIRO_PROTOCOLS`) | live |
<!-- GENERATED:registry-table-end -->

### Notable providers

- **OpenRouter** is the default boot provider (`openrouter/free` free tier).
  Its credential resolves through a chain: `OR_MASTER_KEY` is exchanged for a
  regular key via `/api/v1/keys`, then `OPENROUTER_API_KEY`, then
  `INFERENCE_API_KEY`. It is the one provider whose `idTransform` is `keep`,
  because `openrouter/` is part of the real upstream slug.
- **Cloudflare** is the only provider needing **two** credentials —
  `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`, which is embedded
  mid-path in the API root. The `/provider` wizard prompts for both.
- **Ollama** is the only `local` provider: no API key, detected at startup, and
  no catalog section in the picker.
- **CommandCode, TokenRouter, and xKiro** carry multi-protocol rosters. Their
  per-model wire protocol comes from a shared dispatch map, so a Claude id can
  route to `/v1/messages` while a GPT id routes to `/v1/chat/completions`.
- **Intern InkStone and Atria AI** are the same vendor on two deployments, each
  with a checked-in static catalog. Intern InkStone's `/v1/models` is
  key-protected and publishes context windows in a non-OpenRouter
  `schema_version: "2.4"` shape the shared parser does not read, so its windows
  are pinned in the fallback table rather than read from a live catalog.
- **HCNSec, TokenBom, Infron, UnoRouter, and BazaarLink** are curated static
  allowlists. Their live `/v1/models` rosters exist but are not the catalog: the
  audited set is checked in deliberately, because identity substitutions and
  dead channels were measured on the live listings.

### Live catalogs

CodeCraft and CleanAPIs fetch authenticated `/v1/models` catalogs. xKiro's
chat catalog is public. Rosters are live rather than pinned to a model list
in source. Catalog requests returned 33 CodeCraft, 129 xKiro, and 33 CleanAPIs
models on 2026-10-03; these are observed counts, not fixed limits.

The runtime removes exactly one internal provider prefix before transmission.
For example, `xkiro/mistralai/ministral-14b` sends
`mistralai/ministral-14b`; nested upstream slashes and casing are retained.
Select the full prefixed ID shown in `/model` when choosing a gateway model.

xKiro uses the operator-selected routing policy:

- `xkiro/anthropic/*` uses `/v1/messages` with API-key authentication.
- Other `xkiro/*` IDs use `/v1/chat/completions` with Bearer authentication.
- Exact map entries take precedence, followed by the longest explicit prefix.

This is Savant's routing choice, not a claim that xKiro requires one protocol
per family. Catalog membership and `accessTier` do not establish entitlement
for a particular key. In verification, mapped Claude Haiku returned HTTP 403
requiring an active paid plan or real deposited balance. A free Mistral model
passed through both transports; its Messages smoke used an explicit test
override, while its production route remains chat.

## Model picker and catalog failures

`/model` groups models by provider and supports typing a filter, arrow/Tab
navigation, Enter to select, Escape to cancel, wheel scrolling, and a scrollbar.
Headers and models occupy one terminal line even after resize. Long text clips
visually; the full ID remains in the selected model and routing callback.
`/model <exact-id>` also works when catalog discovery is unavailable.

Each live catalog has its own cache and in-flight request deduplication. A
failed refresh retains that source's cached models and does not shift results
into another provider. Custom catalog results remain after the built-in results.

## Reported model information

The CLI resolves the effective model against the combined provider catalog,
formats its metadata, and passes `modelInfoText` through the SDK to the
`{SAVANT_CODE_MODEL_INFO}` system-prompt placeholder. Known fields include:

| Field | Meaning |
|---|---|
| ID, name, provider, description | Exact selection ID and reported identity |
| Context window and max completion tokens | Reported limits; absent values remain unknown |
| Input/output prices | USD per token internally; USD per million tokens in the prompt |
| Modalities and capabilities | Vendor-reported values when available |
| Catalog access tier | Vendor's access category, not account entitlement |
| Reasoning efforts and default | Reported controls; does not set request options automatically |
| Tokenizer, instruct type, creation date, knowledge cutoff | Included when available |

CodeCraft/CleanAPIs retain existing per-token prices and support the reported
per-1,000-token aliases, divided by 1,000. Their numeric creation timestamps
normalize to ISO dates. xKiro's USD per-million-token prices divide by 1,000,000;
its placeholder creation value does not create a fabricated date. Zero is a
reported free price; malformed/negative prices and absent limits stay unknown.

The context window used by the run can override the displayed catalog window.
`contextWindow` and `maxOutputTokens` are separate runtime options; a descriptive
metadata block does not itself configure these limits. Missing catalog metadata
produces a model-ID fallback without inventing capabilities, prices, or limits.

## SDK hosts

Supply `CODECRAFT_API_KEY`, `XKIRO_API_KEY`, `CLEANAPIS_API_KEY`, or
`INTERN_API_KEY` in the host environment, and set a full prefixed model ID on
the selected agent definition. SDK hosts can pass their own `modelInfoText` to
`client.run()`; the CLI's catalog cache is not automatically imported into
SDK-only applications. Only verified metadata should be included. See the
[SDK README](../sdk/README.md#model-information) and
[SDK reference](sdk-overview.md#provider-routing-and-credentials).

## Adding another provider

Follow the [provider integration runbook](adding-a-provider.md).
The shared registry owns credentials, API roots, catalog declarations, ID
transforms, and map names. A live source also requires normalization, gateway
fanout/results/reset, exception ownership, tests, and generated references.
The registry table above is generated — run `bun run generate:provider-docs`
after a registry change, then verify the hand-maintained mentions it reports.