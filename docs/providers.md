# Providers, model selection, and metadata

Run `/provider` to configure a provider key with masked input, then use
`/model` to browse and filter its models. Saved CLI credentials are local;
shell environment variables take precedence. SDK applications resolve their
own environment credentials and do not automatically load CLI key storage.
The [root provider setup](../README.md#configure-a-hosted-provider-key) and
[installation guide](installation.md) cover the full built-in registry.

## CodeCraft API, xKiro, and CleanAPIs

| Service | Setup | Environment key | Internal model ID | Default protocol |
|---|---|---|---|---|
| CodeCraft API | `/provider codecraft` | `CODECRAFT_API_KEY` | `codecraft/<upstream-id>` | OpenAI chat |
| xKiro | `/provider xkiro` | `XKIRO_API_KEY` | `xkiro/<vendor>/<model>` | Explicit map below |
| Clean APIs | `/provider cleanapis` | `CLEANAPIS_API_KEY` | `cleanapis/<upstream-id>` | OpenAI chat |

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

Supply `CODECRAFT_API_KEY`, `XKIRO_API_KEY`, or `CLEANAPIS_API_KEY` in the host
environment, and set a full prefixed model ID on the selected agent definition.
SDK hosts can pass their own `modelInfoText` to `client.run()`; the CLI's catalog
cache is not automatically imported into SDK-only applications. Only verified
metadata should be included. See the [SDK README](../sdk/README.md#model-information)
and [SDK reference](sdk-overview.md#provider-routing-and-credentials).

## Adding another provider

Follow the [provider integration runbook](archive/design/Adding%20New%20Providers.md).
The shared registry owns credentials, API roots, catalog declarations, ID
transforms, and map names. A live source also requires normalization, gateway
fanout/results/reset, exception ownership, tests, and generated references.
Generate provider tables from the registry and verify hand-maintained mentions.
