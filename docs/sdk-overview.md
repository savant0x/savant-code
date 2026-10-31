# SDK overview (`@savant-code/sdk`)

The SDK embeds Savant-Code's agent runtime. The CLI and eval runner use
`SavantCodeClient.run()`; library hosts can supply local agent definitions,
tools, filesystem adapters, event handlers and provider configuration.

## Distribution

| Field | Value |
| --- | --- |
| Version | `0.0.36` |

The SDK is an **unpublished workspace package**. Version metadata follows
the repository's `VERSION`, but a version bump does not publish a package.
The default public release publishes the CLI only. Build and local packaging
instructions are in the [SDK README](../sdk/README.md#installation) and
[packaging guide](../sdk/PUBLISHING.md). SDK publication is an explicit scope
selection in the [public release pipeline](public-release.md).

The SDK manifest declares Node >=18 and emits ESM, CJS and TypeScript
declarations. Native capabilities and platform support must be checked through
the SDK verification command; a successful Bun source run alone does not prove
the packed artifact works in Node.

## Package boundaries

| Surface | Responsibility |
| --- | --- |
| `sdk/src/client.ts` | Client construction, custom-provider registration and run entrypoint |
| `sdk/src/run/` | Execution lifecycle, options, streaming and snapshots |
| `sdk/src/impl/` | Provider dispatch, inference, credentials and runtime dependencies |
| `sdk/src/tools/` | File, search, network and terminal tool implementations |
| `sdk/src/agents/` | Local agent and MCP configuration loading |
| `sdk/src/skills/` | Skill discovery and loading |
| `packages/agent-runtime/` | Agent loop, tool execution, ECHO enforcement and delegation |
| `common/` | Shared schemas, contracts, provider registry and utilities |
| `sdk/scripts/` | Bundling, declarations, asset packaging and consumer verification |

Workspace runtime dependencies are bundled into SDK output. A source import
of a workspace package does not by itself establish a missing npm dependency;
inspect the compiled artifact and its external imports before changing the
published dependency contract.

## Client and runs

`SavantCodeClient` takes configuration rather than a hosted Savant API key.
Pass an inline `AgentDefinition`, or register definitions through
`agentDefinitions` and select one by ID. There is no implicit hosted agent
store lookup. A run returns `RunState`; pass it as `previousRun` to continue.
Handle `output.type === 'error'` and exceptional promise rejections.

| Option | Purpose |
| --- | --- |
| `cwd` | Working directory |
| `agentDefinitions` | Locally supplied agent definitions |
| `customToolDefinitions`, `overrideTools` | Add tools or override host implementations |
| `handleEvent` | Structured run/tool/agent events |
| `handleStreamChunk` | Incremental text, reasoning and subagent chunks |
| `signal` | Cooperative cancellation |
| `permissionMode` | Tool permission policy |
| `fileFilter` | Host-owned file filtering when supplied |
| `knowledgeFiles`, `userKnowledgeFiles` | Context overrides |
| `modelInfoText` | Host-supplied descriptive model metadata |
| `contextWindow`, `maxOutputTokens` | Runtime limits, independent of descriptive metadata |
| `checkpointDir`, `checkpointTurnId` | Persistent pre-write checkpoints |

The source types in `sdk/src/run/types.ts` and `sdk/src/run-state.ts` are
authoritative for the complete API. See the [SDK API examples](../sdk/README.md#usage).

## Provider routing and credentials

Explicit route and selected-provider configuration determine transport;
model-prefix inference is a fallback when the host has not supplied that
authority. A nested vendor namespace in a model ID must not override the
selected provider. The [provider reference](providers.md) describes the
registry, wire protocols, catalogs and metadata. Follow the current
[provider integration runbook](adding-a-provider.md) when adding a service.

The checked dispatch prefixes are `openai/`, `openrouter/`, `tokenrouter/`,
`nvidia/`, `aihubmix/`, `alibaba/`, `anthropic/`, `apinex/`, `apixo/`, `ashna/`,
`atria/`, `bai/`, `baseten/`, `bazaarlink/`, `blazerail/`, `cerebras/`,
`chatanywhere/`, `cleanapis/`, `cloudflare/`, `codecraft/`, `cohere/`,
`commandcode/`, `deepinfra/`, `deepseek/`, `fireworks-ai/`, `google/`, `groq/`,
`hcnsec/`, `hyper/`, `infron/`, `intern/`, `kiosapi/`, `meta/`, `minimax/`, `mistral/`,
`moonshotai/`, `nous/`, `orcarouter/`, `perplexity/`, `river/`, `tiarina/`,
`togetherai/`, `tokenbom/`, `tokenharbor/`, `unorouter/`, `venice/`, `vercel/`,
`xai/`, `xkiro/`, `zai/`, and `zylo/`.

Their registry credential variables are `OPENAI_API_KEY`, `OPENROUTER_API_KEY`,
`TOKENROUTER_API_KEY`, `NVIDIA_API_KEY`, `AIHUBMIX_API_KEY`, `DASHSCOPE_API_KEY`,
`ANTHROPIC_API_KEY`, `APINEX_API_KEY`, `APIXOAI_API_KEY`, `ASHNA_API_KEY`,
`ATRIA_API_KEY`, `BAI_API_KEY`, `BASETEN_API_KEY`, `BAZAARLINK_API_KEY`,
`BLAZERAIL_API_KEY`, `CEREBRAS_API_KEY`, `CHATANYWHERE_API_KEY`,
`CLEANAPIS_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`CODECRAFT_API_KEY`, `COHERE_API_KEY`, `COMMAND_CODE_API_KEY`,
`DEEPINFRA_API_KEY`, `DEEPSEEK_API_KEY`, `FIREWORKS_API_KEY`, `GEMINI_API_KEY`,
`GROQ_API_KEY`, `HCNSEC_API_KEY`, `HYPER_API_KEY`, `INFRON_API_KEY`, `INTERN_API_KEY`,
`KIOSAPI_API_KEY`, `META_MODEL_API_KEY`, `MINIMAX_API_KEY`, `MISTRAL_API_KEY`,
`MOONSHOT_API_KEY`, `NOUS_API_KEY`, `ORCAROUTER_API_KEY`, `PERPLEXITY_API_KEY`,
`RIVER_AI_API_KEY`, `TIARINA_API_KEY`, `TOGETHER_API_KEY`, `TOKENBOM_API_KEY`,
`TOKENHARBOR_API_KEY`, `UNOROUTER_API_KEY`, `VENICE_API_KEY`,
`AI_GATEWAY_API_KEY`, `XAI_API_KEY`, `XKIRO_API_KEY`, `ZHIPU_API_KEY`, and
`ZYLO_API_KEY`. The provider-documentation drift check validates this inventory.

SDK hosts configure their provider environment. They do not automatically load
the CLI's interactive saved keys. For a custom `INFERENCE_BASE_URL`,
`INFERENCE_API_KEY` is the endpoint's exclusive credential; another provider's
key chain must never cross that boundary. OpenRouter's supported credential
chain is `OR_MASTER_KEY`, `OPENROUTER_API_KEY`, then `INFERENCE_API_KEY`.

Catalog membership and reported capabilities do not establish account access
or prove upstream model identity. Missing output/context limits remain unknown
unless the runtime's documented resolver supplies an independently known value.

## Build and verification

From the repository root:

```bash
bun run build:sdk
bun run --cwd=sdk verify:skip-build
bun run --cwd=sdk test
bun run typecheck
```

The build emits `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.ts` and
required assets. Verification includes artifact smoke checks and Node consumer
compatibility fixtures. The full project gates additionally check clean-install
CLI bundling, undeclared imports, workspace tests, lint and generated references.
Live inference/eval runs require their own provider credentials and authority;
passing offline controls does not imply live service acceptance.
