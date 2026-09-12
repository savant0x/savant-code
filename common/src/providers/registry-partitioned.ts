/**
 * Partitioned registry entries (registry-file split, 300-line cap).
 *
 * These entries are SPREAD INTO PROVIDER_REGISTRY at module load — the
 * registry remains the single source of truth and `Object.keys`
 * ordering is unchanged: the partition module is imported and spread
 * BEFORE the remaining inline entries in registry.ts.
 *
 * Semantics are identical to inline entries: `as const satisfies
 * Record<string, ProviderConfig>` type safety is enforced on each
 * exported partial.
 */
import type { ProviderConfig } from './types'

export const PROVIDER_REGISTRY_PARTITION = {
  kiosapi: {
    id: 'kiosapi',
    label: 'KiosAPI',
    kind: 'gateway',
    credentials: {
      envVar: 'KIOSAPI_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'KiosAPI API key not set. Set KIOSAPI_API_KEY environment variable or run /provider kiosapi.',
    },
    baseUrl: 'https://kiosapi.com/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'live', url: 'https://kiosapi.com/v1/models' },
    setupAvailable: true,
    domain: 'kiosapi.com',
    order: 4,
  },
  apinex: {
    id: 'apinex',
    label: 'APInex',
    kind: 'gateway',
    credentials: {
      envVar: 'APINEX_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'APInex API key not set. Set APINEX_API_KEY environment variable or run /provider apinex.',
    },
    // apinex.bond/llms.txt: "Base URL: https://api.apinex.bond/v1 — drop-in
    // replacement for an OpenAI base URL." The documented api. subdomain is
    // authoritative (the apex host also answers, but the docs win).
    baseUrl: 'https://api.apinex.bond/v1',
    protocol: 'openai',
    // Upstream ids are vendor-namespaced WITH slashes (gpt/5.6-luna,
    // free/glm-5.3-flash); `strip` removes only the internal `apinex/`
    // routing prefix — the same multi-slash shape openrouter serves.
    idTransform: 'strip',
    // Authenticated live catalog (llms.txt: "list models (auth required)").
    // The public /api/public/models table is custom-shaped and unusable by
    // the generic fetcher; the key is supplied via the Nous-style resolver.
    catalog: { source: 'live', url: 'https://api.apinex.bond/v1/models' },
    setupAvailable: true,
    domain: 'apinex.bond',
    order: 4,
  },
  orcarouter: {
    id: 'orcarouter',
    label: 'OrcaRouter',
    kind: 'gateway',
    credentials: {
      envVar: 'ORCAROUTER_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'OrcaRouter API key not set. Set ORCAROUTER_API_KEY environment variable or run /provider orcarouter.',
    },
    // docs.orcarouter.ai/introduction: "Point your existing OpenAI SDK at
    // https://api.orcarouter.ai/v1". The docs' api. subdomain is
    // authoritative.
    baseUrl: 'https://api.orcarouter.ai/v1',
    protocol: 'openai',
    // Upstream ids are vendor-namespaced WITH slashes (anthropic/
    // claude-opus-5, deepseek/deepseek-v4-flash) plus orcarouter-native
    // routers (free, fusion, fusion-flash, fusion-mini). `strip` removes
    // only the internal `orcarouter/` routing prefix; the multi-slash
    // remainder goes verbatim — the same shape openrouter and apinex serve.
    idTransform: 'strip',
    // Public keyless catalog (probed HTTP 200 keyless: 195 models, OpenAI
    // shape) — the generic live-catalog fetcher consumes it verbatim, no
    // resolver wire-in (unlike nous/apinex, whose catalogs are
    // authenticated).
    catalog: { source: 'live', url: 'https://api.orcarouter.ai/v1/models' },
    setupAvailable: true,
    domain: 'orcarouter.ai',
    order: 4,
  },
  bai: {
    id: 'bai',
    label: 'B.AI',
    kind: 'gateway',
    credentials: {
      envVar: 'BAI_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'B.AI API key not set. Set BAI_API_KEY environment variable or run /provider bai.',
    },
    // docs.b.ai/llmservice/api/: "Production Base URL: https://api.b.ai/v1".
    baseUrl: 'https://api.b.ai/v1',
    protocol: 'openai',
    // Upstream id shape is not fully documented ("your-model-id");
    // `strip` removes exactly the internal `bai/` routing prefix so a
    // bare, vendor-namespaced, or already-prefixed upstream id all
    // round-trip exactly (the parser prefixes uniformly — the
    // FID-2026-0911-002 lesson).
    idTransform: 'strip',
    // AUTHENTICATED live catalog (keyless /v1/models probed → 401,
    // OpenAI-shaped with a nonstandard `success` extra field). The key is
    // supplied via the Nous/apinex-style resolver — NOT OrcaRouter's
    // keyless pattern.
    catalog: { source: 'live', url: 'https://api.b.ai/v1/models' },
    setupAvailable: true,
    domain: 'b.ai',
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
