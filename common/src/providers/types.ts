import type { MODEL_CATALOGS } from './model-catalogs'

/**
 * Unified Provider Registry — typed, data-only provider metadata (FID-2026-0809-001).
 *
 * "Data-only" means: no functions, no side effects — pure constants — so the
 * registry is serializable, bundle-safe for `bun --compile`, and importable from
 * the SDK dist and the CLI without circular import risk.
 *
 * The single user setting is the provider selected in the UI (`/provider`); the
 * registry supplies everything else about that provider (routing prefix,
 * credential env var, base URL, protocol, id transform, catalog source, domain,
 * picker ordering, setup availability).
 */

/** Provider categories: cloud gateways, local runtimes (ollama), env-only. */
export type ProviderKind = 'gateway' | 'local' | 'env-only'

/** Wire protocol(s) the provider endpoint speaks. */
export type ProviderProtocol =
  'openai' | 'anthropic' | 'openai-anthropic' | 'multi'

/**
 * Per-model wire protocol for protocol-mapped providers. `responses` is the
 * OpenAI Responses API; `gemini` is the provider-native Gemini path.
 */
export type ProviderModelProtocol =
  'openai' | 'anthropic' | 'responses' | 'gemini'

/**
 * How a model id is rewritten before hitting the provider API:
 * - `strip` — remove the internal `{provider}/` routing prefix (tokenrouter/…).
 * - `keep` — send the id unchanged; `openrouter/` is part of the real slug.
 * - `cf-rewrite` — strip `cloudflare/` and prepend `@cf/` (Workers AI naming).
 */
export type ProviderIdTransform = 'strip' | 'keep' | 'cf-rewrite'

/** Shared multi-protocol maps (see common/src/constants/model-config.ts). */
export type ProviderProtocolMap =
  'OPENCODE_GO_PROTOCOLS' | 'COMMANDCODE_PROTOCOLS' | 'OPENCODE_ZEN_PROTOCOLS'

/**
 * Key resolution strategy. `openrouter` = master-key exchange chain.
 * `opencode` = shared OpenCode credential (`OPENCODE_API_KEY`, legacy
 * `OPENCODE_GO_API_KEY` fallback) — the only resolver two registry entries
 * may share one env var through (see validate claimEnvVar).
 */
export type ProviderResolver = 'default' | 'openrouter' | 'opencode'

export interface ProviderConfig {
  /** Routing prefix, e.g. 'tokenharbor'. Must match the registry object key. */
  id: string
  /** Canonical display label, e.g. 'TokenHarbor'. */
  label: string
  kind: ProviderKind
  credentials: {
    /** Primary API key env var. Absent for kind: 'local' (ollama). */
    envVar?: string
    /** Additional required credentials, e.g. CLOUDFLARE_ACCOUNT_ID. */
    extra?: Array<{
      envVar: string
      label: string
      /** Optional missing-value error message (defaults to a templated form). */
      missingMessage?: string
    }>
    resolver?: ProviderResolver
    /**
     * Full missing-key error message. Defaults to
     * `${label} API key not set. Set ${envVar} environment variable.`
     * Overridden where the canonical message differs (resolver chains,
     * "API token" wording, provider-label mismatch).
     */
    missingKeyMessage?: string
  }
  /**
   * API root. The protocol layer appends the path suffix
   * (`/chat/completions` vs `/messages`). Supports `{ENV_VAR}` placeholders
   * resolved by the generic factory (Cloudflare account id is mid-path).
   */
  baseUrl: string
  protocol: ProviderProtocol
  idTransform: ProviderIdTransform
  /** Present for dual-protocol providers; a typed key into the protocol maps. */
  protocolMap?: ProviderProtocolMap
  catalog:
    | { source: 'live'; url: string }
    | {
        source: 'static'
        /** Typed key into the shared MODEL_CATALOGS map (compile-time checked). */
        modelsRef: keyof typeof MODEL_CATALOGS
        /** Optional human-readable names map ref for a static catalog. */
        namesRef?: string
      }
    | {
        /** FID-2026-0910-004 D3: user-supplied model list (custom providers).
         *  Keys are full model ids carrying the routing prefix; values are
         *  display names. */
        source: 'inline'
        models: Record<string, string>
      }
    | { source: 'none' }
  /** Whether the provider appears in the `/provider` setup picker. */
  setupAvailable: boolean
  /** Favicon/logo domain. Omitted for providers with no logo (ollama). */
  domain?: string
  /** Deterministic picker group order (routing order is prefix-disjoint). */
  order: number
}

/**
 * User-defined provider record (FID-2026-0910-004 D1) — a flat, JSON-shaped
 * subset of `ProviderConfig` produced by the `/provider add` wizard, stored
 * in settings.json, and accepted by `SavantCodeClient({ customProviders })`.
 * Data only: the D1 constraints (gateway/openai/strip, no resolver, no
 * protocolMap) are enforced by `parseCustomProviders` and made concrete by
 * `toProviderConfig`, never hand-written by users.
 */
export type CustomProviderConfig = {
  /** Routing prefix + identity. Immutable after creation (edit never renames). */
  id: string
  /** Display label shown in pickers and messages. */
  label: string
  /** API root; the protocol layer appends the path suffix. */
  baseUrl: string
  /** The provider's own credential env var (resolved via the generic read). */
  apiKeyEnvVar: string
  /**
   * Wire protocol (FID-2026-0911-003). Optional; legacy records without
   * the field lift to 'openai'. 'anthropic' targets Claude-style
   * `/v1/messages` outlier endpoints.
   */
  protocol?: 'openai' | 'anthropic'
  /** Model catalog: live URL fetch, user-supplied inline list, or none. */
  catalog:
    | { source: 'live'; url: string }
    | { source: 'inline'; models: Record<string, string> }
    | { source: 'none' }
  /**
   * FID-2026-0914-003: provenance stamp added by the discovery pipeline when
   * a candidate is accepted through the provider wizard. Unstamped records
   * are hand-written (never health-tracked). Validated fail-closed in
   * custom-providers-parse.ts via discovery-stamp.ts (single truth).
   */
  source?: 'discovery-pipeline'
  acceptedAt?: string
}
