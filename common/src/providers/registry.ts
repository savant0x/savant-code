/**
 * PROVIDER_REGISTRY — single source of truth for all provider metadata
 * (FID-2026-0809-001 Phase 1).
 *
 * Every provider surface derives from this typed, data-only registry:
 * routing prefixes, credential env vars, base URLs, protocols, id transforms,
 * catalog sources, domains, picker ordering, and setup availability.
 *
 * Phase 1 deltas that ship with this registry (each verified against source):
 * - (a) derived ALLOWED_MODEL_PREFIXES gains `openrouter` and `ollama`
 * - (b) derived ModelProvider union / settings.validProviders gain `cloudflare`
 * - (c) derived providerDomains gains `openrouter`
 * - (d) `order` values replicate the current picker sort exactly
 *       (openrouter 0, tokenrouter 1, nvidia 2, opencode-go 3, and the 7-way
 *       tie of tokenharbor/commandcode/nous/ollama/cloudflare/kiosapi/opencode-zen
 *       at 4)
 */
import type { ProviderConfig } from './types'

export const PROVIDER_REGISTRY = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'gateway',
    credentials: {
      envVar: 'OPENROUTER_API_KEY',
      resolver: 'openrouter',
      // Resolver chain mentions OR_MASTER_KEY (openrouter-key-resolver.ts).
      missingKeyMessage:
        'OpenRouter API key not set. Set OPENROUTER_API_KEY or OR_MASTER_KEY environment variable.',
    },
    baseUrl: 'https://openrouter.ai/api/v1',
    protocol: 'openai',
    // `openrouter/` is part of the real slug (e.g. `openrouter/free`) and is
    // sent to the API unchanged.
    idTransform: 'keep',
    catalog: { source: 'live', url: 'https://openrouter.ai/api/v1/models' },
    setupAvailable: true,
    domain: 'openrouter.ai',
    order: 0,
  },
  tokenrouter: {
    id: 'tokenrouter',
    label: 'TokenRouter',
    kind: 'gateway',
    credentials: { envVar: 'TOKENROUTER_API_KEY' },
    baseUrl: 'https://api.tokenrouter.com/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'tokenrouter' },
    setupAvailable: true,
    domain: 'tokenrouter.com',
    order: 1,
  },
  tokenharbor: {
    id: 'tokenharbor',
    label: 'TokenHarbor',
    kind: 'gateway',
    credentials: {
      envVar: 'TOKENHARBOR_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'TokenHarbor API key not set. Set TOKENHARBOR_API_KEY environment variable or run /provider tokenharbor.',
    },
    baseUrl: 'https://tokenharbor.ai/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'tokenharbor' },
    setupAvailable: true,
    domain: 'tokenharbor.ai',
    order: 4,
  },
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    kind: 'gateway',
    credentials: {
      envVar: 'NVIDIA_API_KEY',
      // Message uses the short name, not the 'NVIDIA NIM' display label.
      missingKeyMessage:
        'NVIDIA API key not set. Set NVIDIA_API_KEY environment variable.',
    },
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: {
      source: 'live',
      url: 'https://integrate.api.nvidia.com/v1/models',
    },
    setupAvailable: true,
    domain: 'nvidia.com',
    order: 2,
  },
  'opencode-go': {
    id: 'opencode-go',
    label: 'OpenCode Go',
    kind: 'gateway',
    // Shared OpenCode credential (FID-2026-0905-003): one key powers Go and
    // Zen. `OPENCODE_GO_API_KEY` remains honored as a legacy fallback via
    // the `opencode` resolver chain.
    credentials: { envVar: 'OPENCODE_API_KEY', resolver: 'opencode' },
    baseUrl: 'https://opencode.ai/zen/go/v1',
    protocol: 'openai-anthropic',
    idTransform: 'strip',
    protocolMap: 'OPENCODE_GO_PROTOCOLS',
    catalog: { source: 'static', modelsRef: 'opencodeGo' },
    setupAvailable: true,
    domain: 'opencode.ai',
    order: 3,
  },
  commandcode: {
    id: 'commandcode',
    label: 'CommandCode',
    kind: 'gateway',
    credentials: { envVar: 'COMMAND_CODE_API_KEY' },
    baseUrl: 'https://api.commandcode.ai/provider/v1',
    protocol: 'openai-anthropic',
    idTransform: 'strip',
    protocolMap: 'COMMANDCODE_PROTOCOLS',
    catalog: { source: 'static', modelsRef: 'commandcode' },
    setupAvailable: true,
    domain: 'commandcode.ai',
    order: 4,
  },
  nous: {
    id: 'nous',
    label: 'Nous Research',
    kind: 'gateway',
    credentials: {
      envVar: 'NOUS_API_KEY',
      missingKeyMessage:
        'Nous Research API key not set. Set NOUS_API_KEY environment variable or run /provider nous.',
    },
    baseUrl: 'https://inference-api.nousresearch.com/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: {
      source: 'live',
      url: 'https://inference-api.nousresearch.com/v1/models',
    },
    setupAvailable: true,
    domain: 'nousresearch.com',
    order: 4,
  },
  cloudflare: {
    id: 'cloudflare',
    label: 'Cloudflare',
    kind: 'gateway',
    credentials: {
      envVar: 'CLOUDFLARE_API_TOKEN',
      extra: [
        {
          envVar: 'CLOUDFLARE_ACCOUNT_ID',
          label: 'Cloudflare Account ID',
          missingMessage:
            'Cloudflare account ID not set. Set CLOUDFLARE_ACCOUNT_ID environment variable.',
        },
      ],
      // "API token" wording is part of the canonical message.
      missingKeyMessage:
        'Cloudflare API token not set. Set CLOUDFLARE_API_TOKEN environment variable.',
    },
    // {ENV_VAR} placeholder is resolved by the generic factory; the account id
    // is embedded mid-path (model-factories.ts:147-154).
    baseUrl:
      'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1',
    protocol: 'openai',
    idTransform: 'cf-rewrite',
    catalog: { source: 'static', modelsRef: 'cloudflare' },
    // Phase 1: not added to the /provider setup picker yet — delta (b) only
    // adds cloudflare to the ModelProvider union and settings.validProviders.
    setupAvailable: false,
    domain: 'cloudflare.com',
    order: 4,
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    kind: 'local',
    // No API key; local runtime. Base URL is auto-detected at startup
    // (ollama-onboarding.ts); the registry holds the canonical default.
    credentials: {},
    baseUrl: 'http://localhost:11434/v1',
    protocol: 'openai',
    idTransform: 'keep',
    catalog: { source: 'none' },
    setupAvailable: false,
    order: 4,
  },
  kiosapi: {
    id: 'kiosapi',
    label: 'KiosAPI',
    kind: 'gateway',
    credentials: {
      envVar: 'KIOSAPI_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'KiosAPI key not set. Set KIOSAPI_API_KEY environment variable or run /provider kiosapi.',
    },
    baseUrl: 'https://kiosapi.com/v1',
    protocol: 'openai',
    // KiosAPI takes bare upstream ids (e.g. `gpt-4o-mini`); the internal
    // `kiosapi/` routing prefix is stripped before sending.
    idTransform: 'strip',
    catalog: { source: 'live', url: 'https://kiosapi.com/v1/models' },
    setupAvailable: true,
    domain: 'kiosapi.com',
    order: 4,
  },
  'opencode-zen': {
    id: 'opencode-zen',
    label: 'OpenCode Zen',
    kind: 'gateway',
    credentials: {
      resolver: 'opencode',
      envVar: 'OPENCODE_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'OpenCode Zen API key not set. Set OPENCODE_API_KEY environment variable or run /provider opencode-zen.',
    },
    baseUrl: 'https://opencode.ai/zen/v1',
    // Four wire protocols (chat, Anthropic messages, Responses, Gemini);
    // per-model dispatch comes from OPENCODE_ZEN_PROTOCOLS.
    protocol: 'multi',
    protocolMap: 'OPENCODE_ZEN_PROTOCOLS',
    // Zen takes bare upstream ids (e.g. `gpt-5.5`); the internal
    // `opencode-zen/` routing prefix is stripped before sending.
    idTransform: 'strip',
    catalog: { source: 'live', url: 'https://opencode.ai/zen/v1/models' },
    setupAvailable: true,
    domain: 'opencode.ai',
    order: 4,
  },
} as const satisfies Record<string, ProviderConfig>

/** Literal union of registry ids, e.g. 'tokenharbor' | 'opencode-go'. */
export type ProviderId = keyof typeof PROVIDER_REGISTRY
