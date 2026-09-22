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
    // docs.b.ai: `GET /balance` reads the key's balance/quota. The gateway
    // refuses a request the balance cannot cover — this is that reading
    // (FID-2026-0919-026).
    quota: {
      url: 'https://api.b.ai/v1/balance',
      valuePath: 'data.personal_balance',
      unit: 'credits',
      note:
        'B.AI is prepaid (1 USD = 1,000,000 credits); requests are refused ' +
        'while the balance cannot cover them. Top up at https://chat.b.ai/chat.',
    },
    setupAvailable: true,
    domain: 'b.ai',
    order: 4,
  },
  // FID-2026-0916-004: the opencode-zen entry was removed — Zen's free tier
  // refuses non-OpenCode clients (account-type gate) and the credit path
  // duplicates opencode-go, which was removed in the same ruling.
  hcnsec: {
    id: 'hcnsec',
    label: 'HCNSec',
    kind: 'gateway',
    credentials: {
      envVar: 'HCNSEC_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'HCNSec API key not set. Set HCNSEC_API_KEY environment variable or run /provider hcnsec.',
    },
    // The api. subdomain is authoritative (the apex host is the marketing
    // site). OpenAI surface only — the gateway's /v1/messages Anthropic
    // shim is lossy (identity audit T43-B: burns max_tokens on invisible
    // reasoning).
    baseUrl: 'https://api.hcnsec.cn/v1',
    protocol: 'openai',
    idTransform: 'strip',
    // STATIC audited allowlist (identity audit T43-E,
    // docs/provider-identity-audit-2026-09-13.md): the live /v1/models
    // listing contains substituted, prompt-injected, and dead ids — the
    // catalog is exactly the confirmed set. Personal-use provenance.
    catalog: { source: 'static', modelsRef: 'hcnsec' },
    setupAvailable: true,
    domain: 'hcnsec.cn',
    order: 4,
  },
  tokenbom: {
    id: 'tokenbom',
    label: 'TokenBom',
    kind: 'gateway',
    credentials: {
      envVar: 'TOKENBOM_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'TokenBom API key not set. Set TOKENBOM_API_KEY environment variable or run /provider tokenbom.',
    },
    // Same host serves site + API (verified live); `sk-sub-` virtual keys
    // are Bearer-opaque.
    baseUrl: 'https://tokenbom.com/v1',
    protocol: 'openai',
    idTransform: 'strip',
    // STATIC audited allowlist (identity gauntlet T44-C): marketplace
    // telemetry measures availability, NOT identity integrity — the
    // top-15 gauntlet found substitutions on flagship listings, so only
    // verified channels are cataloged. The two M365 Copilot channels are
    // operator-approved (provenance in gateway-catalogs.ts).
    catalog: { source: 'static', modelsRef: 'tokenbom' },
    setupAvailable: true,
    domain: 'tokenbom.com',
    order: 4,
  },
  infron: {
    id: 'infron',
    label: 'Infron',
    kind: 'gateway',
    credentials: {
      envVar: 'INFRON_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'Infron API key not set. Set INFRON_API_KEY environment variable or run /provider infron.',
    },
    // Docs quickstart pins the INFERENCE host: llm.onerouter.pro/v1 (the
    // OpenAI SDK examples point there; api.infron.ai is the catalog/site
    // host only). Keyed probes this session confirmed the host is
    // authoritative for this key (Infron-specific credit errors).
    baseUrl: 'https://llm.onerouter.pro/v1',
    protocol: 'openai',
    idTransform: 'strip',
    // STATIC curated allowlist (operator rulings, FID-2026-0914-001): 4
    // free + 5 top coding, chat-served only — the Responses-only Codex
    // family is excluded (chat would 404). The 458-entry live catalog
    // stays unpicked; the free tier additionally requires a funded team
    // account (429 "Team balance" observed live — OrcaRouter-pattern
    // NEEDS-REVIEW on the live round-trip).
    catalog: { source: 'static', modelsRef: 'infron' },
    setupAvailable: true,
    domain: 'infron.ai',
    order: 4,
  },
  unorouter: {
    id: 'unorouter',
    label: 'UnoRouter',
    kind: 'gateway',
    credentials: {
      envVar: 'UNOROUTER_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'UnoRouter API key not set. Set UNOROUTER_API_KEY environment variable or run /provider unorouter.',
    },
    // Docs quickstart: BASE_URL = https://api.unorouter.com/v1. The api.
    // subdomain serves the QuantumNous console ("New API" fingerprint —
    // same reseller software class as hcnsec).
    baseUrl: 'https://api.unorouter.com/v1',
    protocol: 'openai',
    idTransform: 'strip',
    // STATIC curated allowlist (operator rulings, FID-2026-0914-001): 12
    // free (`:free` never bills, per vendor docs) + 5 top coding. The
    // 128-row free tier stays unpicked. Multi-supplier failover is a
    // documented substitution surface — personal-use provenance, Trust
    // Provenance in the FID. 5 free channels live-verified HTTP 200 this
    // session; the rest failed busy-class only (vendor-documented
    // peak-hour saturation).
    catalog: { source: 'static', modelsRef: 'unorouter' },
    setupAvailable: true,
    domain: 'unorouter.com',
    order: 4,
  },
  bazaarlink: {
    id: 'bazaarlink',
    label: 'BazaarLink',
    kind: 'gateway',
    credentials: {
      envVar: 'BAZAARLINK_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'BazaarLink API key not set. Set BAZAARLINK_API_KEY environment variable or run /provider bazaarlink.',
    },
    // Vendor quickstart (bazaarlink.ai/free) pins the inference base
    // api.bazaarlink.ai/v1; the apex aliases (bazaarlink.ai/v1 and
    // /api/v1) were verified byte-equivalent LIVE (FID-2026-0915-006).
    baseUrl: 'https://api.bazaarlink.ai/v1',
    protocol: 'openai',
    // Upstream free ids carry vendor namespaces with slashes
    // (qwen/qwen3.7-flash:free); `strip` removes only the internal
    // `bazaarlink/` routing prefix — infron precedent.
    idTransform: 'strip',
    // STATIC audited allowlist (identity gauntlet T51-C,
    // FID-2026-0915-006): the live /v1/models roster mixes the genuine
    // qwen free channel with substituted deepseek channels (EN self-IDs
    // claimed GPT-4 and Claude Opus 4.1) and the unreliable auto:free
    // router — the catalog is exactly the confirmed set. Personal-use
    // provenance.
    catalog: { source: 'static', modelsRef: 'bazaarlink' },
    setupAvailable: true,
    domain: 'bazaarlink.ai',
    order: 4,
  },
  atria: {
    id: 'atria',
    label: 'Atria AI',
    kind: 'gateway',
    credentials: {
      envVar: 'ATRIA_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'Atria AI API key not set. Set ATRIA_API_KEY environment variable or run /provider atria.',
    },
    // Docs quickstart (api.atria-asi.ai/docs) pins the OpenAI-compatible
    // inference base. The vendor also serves Anthropic /v1/messages and
    // Responses /v1/responses; the OpenAI surface is canonical for this
    // single-model integration (FID-2026-0916-005).
    baseUrl: 'https://api.atria-asi.ai/v1',
    protocol: 'openai',
    // The upstream id (Atria-Dawn-Preview) is sent verbatim; `strip`
    // removes only the internal `atria/` routing prefix.
    idTransform: 'strip',
    // STATIC one-model allowlist (FID-2026-0916-005): the vendor exposes
    // exactly one model (Atria-Dawn-Preview) and its /v1/models endpoint is
    // key-protected (401 without a key) — a static map is the checked-in
    // set with no authenticated-live fetcher overhead.
    catalog: { source: 'static', modelsRef: 'atria' },
    setupAvailable: true,
    domain: 'atria-asi.ai',
    order: 4,
  },
} as const satisfies Record<string, ProviderConfig>
