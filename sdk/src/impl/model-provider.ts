/**
 * Model provider abstraction for routing requests to the appropriate LLM provider.
 *
 * This module handles:
 * - ChatGPT OAuth: Direct requests to OpenAI API using user's OAuth token
 * - Registry gateway providers: one ordered loop over PROVIDER_REGISTRY
 *   (FID-2026-0809-001 Phase 2) — base URL, protocol, id transform, and
 *   credential env vars all come from the registry, not hand-written branches.
 * - Default: generic OpenAI-compatible fallback via createDefaultInferenceModel.
 */

import {
  CHATGPT_OAUTH_ENABLED,
  isChatGptOAuthModelAllowed,
  isOpenAIProviderModel,
} from '@savant-code/common/constants/chatgpt-oauth'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { getValidChatGptOAuthCredentials } from '../credentials'
import { createDefaultInferenceModel } from './model-provider/default-inference'
import {
  createOpenAIOAuthModel,
  createProviderModel,
} from './model-provider/model-factories'
import {
  isChatGptOAuthRateLimited,
  resetChatGptOAuthRateLimit,
} from './model-provider/oauth-rate-limit'
import { resolveOpencodeApiKey } from './opencode-key-resolver'
import { resolveOpenRouterApiKey } from './openrouter-key-resolver'

import type { ModelRequestParams, ModelResult } from './model-provider/types'
import type { ProviderConfig } from '@savant-code/common/providers/types'

export type { ModelRequestParams, ModelResult } from './model-provider/types'
export {
  markChatGptOAuthRateLimited,
  isChatGptOAuthRateLimited,
  resetChatGptOAuthRateLimit,
} from './model-provider/oauth-rate-limit'

/**
 * Get the appropriate model for a request.
 *
 * If ChatGPT OAuth credentials are available and the model is an OpenAI model,
 * returns an OpenAI direct model. Otherwise, routes through the provider
 * registry (one ordered loop — FID-2026-0809-001 Phase 2), falling back to the
 * generic default inference model for unprefixed ids.
 *
 * This function is async because it may need to refresh the OAuth token or
 * resolve the OpenRouter master key.
 */
export async function getModelForRequest(
  params: ModelRequestParams,
): Promise<ModelResult> {
  void resetChatGptOAuthRateLimit
  const { apiKey, model, skipChatGptOAuth } = params

  // Check if we should use ChatGPT OAuth direct
  // Only attempt for allowlisted models; non-allowlisted models silently fall through.
  if (
    CHATGPT_OAUTH_ENABLED &&
    !skipChatGptOAuth &&
    isOpenAIProviderModel(model) &&
    isChatGptOAuthModelAllowed(model)
  ) {
    if (!isChatGptOAuthRateLimited()) {
      const chatGptOAuthCredentials = await getValidChatGptOAuthCredentials()

      if (chatGptOAuthCredentials) {
        return {
          model: createOpenAIOAuthModel(
            model,
            chatGptOAuthCredentials.accessToken,
          ),
          isChatGptOAuth: true,
        }
      }
    }
  }

  // Gateway providers — one ordered loop over the registry
  // (FID-2026-0809-001 Phase 2). Registry ids are disjoint routing prefixes,
  // so iteration order is a no-op; iterate in registry order for determinism.
  // Ollama (kind: 'local') is intentionally not routed here — it uses the
  // default path with the CLI-set INFERENCE_BASE_URL (ollama-onboarding.ts).
  for (const config of Object.values(PROVIDER_REGISTRY)) {
    if (config.kind === 'local') continue
    if (!model.startsWith(`${config.id}/`)) continue

    const key = await resolveProviderKey(config)
    if (!key) {
      throw new Error(buildMissingKeyError(config))
    }
    const extraCreds = resolveExtraCredentials(config)
    return {
      model: createProviderModel(config, key, model, extraCreds),
      isChatGptOAuth: false,
    }
  }

  // Default: generic OpenAI-compatible fallback for bare-slug ids (e.g.
  // `anthropic/claude-sonnet-4.5`). Phase 4 (FID-2026-0809-001 decision 10):
  // when DIRECT_PROVIDER names the active provider, the bare-slug path is
  // authorized with the active provider's own credential (registry-resolved —
  // including the OpenRouter master-key chain when active). An explicitly
  // active registry gateway fails closed when its own key is absent; it must
  // never send an unrelated caller or OpenRouter key to that endpoint. The
  // caller-supplied key remains the fallback only for custom/unknown routing.
  // The base URL still
  // follows INFERENCE_BASE_URL (set from the active provider's registry entry
  // at startup by the CLI / ollama-onboarding).
  const activeProviderId = getActiveProviderId()
  const activeProviderKey = await resolveActiveProviderKey(activeProviderId)
  const activeProviderConfig = activeProviderId
    ? (PROVIDER_REGISTRY as Record<string, ProviderConfig>)[activeProviderId]
    : undefined
  if (
    activeProviderConfig !== undefined &&
    activeProviderConfig.kind !== 'local' &&
    !activeProviderKey
  ) {
    throw new Error(buildMissingKeyError(activeProviderConfig))
  }
  return {
    model: await createDefaultInferenceModel(
      activeProviderKey ?? apiKey,
      model,
      {
        // Only a key resolved from the active provider is authoritative; the
        // caller-supplied fallback keeps the legacy env precedence inside the
        // factory (custom-endpoint INFERENCE_API_KEY flow preserved).
        preferApiKey: activeProviderKey !== undefined,
        // Backend-mode fallback retains its historical OpenRouter-compatible
        // extensions. Direct non-OpenRouter providers, including Nous, must
        // not receive OpenRouter attribution or structured-output assumptions.
        providerId: activeProviderId,
      },
    ),
    isChatGptOAuth: false,
  }
}

/**
 * Resolve the ACTIVE provider's credential for the default (bare-slug) path
 * (FID-2026-0809-001 decision 10). The CLI sets DIRECT_PROVIDER to the
 * selected provider at startup; when it names a registry gateway, bare-slug
 * model ids are authorized with that provider's own key — the same resolution
 * as prefixed routing, including the OpenRouter master-key chain. Local
 * providers (Ollama) and unknown/absent selections yield undefined. An
 * explicitly active gateway is checked by the caller and fails closed when its
 * own credential is absent; custom/unknown routing can use the caller key.
 */
function getActiveProviderId(): string | undefined {
  const value = process.env.DIRECT_PROVIDER?.trim().toLowerCase()
  return value || undefined
}

async function resolveActiveProviderKey(
  activeProviderId = getActiveProviderId(),
): Promise<string | undefined> {
  if (!activeProviderId) return undefined
  // The env var is arbitrary user input — index via a string record so an
  // unknown provider id yields undefined instead of a type error.
  const config = (PROVIDER_REGISTRY as Record<string, ProviderConfig>)[
    activeProviderId
  ]
  if (!config || config.kind === 'local') return undefined
  return resolveProviderKey(config)
}

/**
 * Resolve the API key for a registry provider. Providers with
 * `credentials.resolver: 'openrouter'` use the master-key exchange chain
 * (OR_MASTER_KEY → OPENROUTER_API_KEY → INFERENCE_API_KEY); providers with
 * `credentials.resolver: 'opencode'` share one OpenCode credential
 * (OPENCODE_API_KEY → legacy OPENCODE_GO_API_KEY); all others read their
 * primary env var directly.
 */
async function resolveProviderKey(
  config: ProviderConfig,
): Promise<string | undefined> {
  if (config.credentials.resolver === 'openrouter') {
    return resolveOpenRouterApiKey()
  }
  if (config.credentials.resolver === 'opencode') {
    return resolveOpencodeApiKey()
  }
  const envVar = config.credentials.envVar
  return envVar === undefined ? undefined : process.env[envVar]
}

/**
 * Read a provider's extra credentials (e.g. CLOUDFLARE_ACCOUNT_ID) from the
 * environment, fail-closed on any missing value, and return them keyed by env
 * var for base-URL placeholder resolution.
 */
function resolveExtraCredentials(
  config: ProviderConfig,
): Record<string, string> {
  const extra: Record<string, string> = {}
  for (const cred of config.credentials.extra ?? []) {
    const value = process.env[cred.envVar]
    if (!value) {
      throw new Error(
        cred.missingMessage ??
          `${config.label} ${cred.label} not set. Set ${cred.envVar} environment variable.`,
      )
    }
    extra[cred.envVar] = value
  }
  return extra
}

/** Missing-key error, templated from the registry (or an explicit override). */
function buildMissingKeyError(config: ProviderConfig): string {
  const envVar = config.credentials.envVar
  return (
    config.credentials.missingKeyMessage ??
    `${config.label} API key not set. Set ${envVar} environment variable.`
  )
}

/**
 * Check if a model ID targets OpenCode Go (prefix: `opencode-go/`).
 * Subagents inherit the parent's model via `withParentModel()` in
 * spawn-agent-utils.ts — gateway model prefixes propagate correctly.
 */
export function isOpenCodeGoModel(model: string): boolean {
  return model.startsWith('opencode-go/')
}

/**
 * Check if a model ID targets direct OpenRouter (prefix: `openrouter/`).
 * Unlike gateway prefixes, `openrouter/` is part of the real OpenRouter slug
 * (e.g. `openrouter/free`) and is sent to the API unchanged.
 */
export function isOpenRouterModel(model: string): boolean {
  return model.startsWith('openrouter/')
}

/**
 * Check if a model ID targets TokenRouter (prefix: `tokenrouter/`).
 * Subagents inherit the parent's model via `withParentModel()` in
 * spawn-agent-utils.ts — gateway model prefixes propagate correctly.
 */
export function isTokenRouterModel(model: string): boolean {
  return model.startsWith('tokenrouter/')
}

/**
 * Check if a model ID targets TokenHarbor (prefix: `tokenharbor/`).
 * Nested provider segments remain part of the upstream model ID.
 */
export function isTokenHarborModel(model: string): boolean {
  return model.startsWith('tokenharbor/')
}

/**
 * Check if a model ID targets NVIDIA NIM (prefix: `nvidia/`).
 * Subagents inherit the parent's model via `withParentModel()` in
 * spawn-agent-utils.ts — gateway model prefixes propagate correctly.
 */
export function isNvidiaModel(model: string): boolean {
  return model.startsWith('nvidia/')
}

/**
 * Check if a model ID targets Cloudflare Workers AI (prefix: `cloudflare/`).
 */
export function isCloudflareModel(model: string): boolean {
  return model.startsWith('cloudflare/')
}

/**
 * Check if a model ID targets CommandCode (prefix: `commandcode/`).
 * Subagents inherit the parent's model via `withParentModel()` in
 * spawn-agent-utils.ts — gateway model prefixes propagate correctly.
 */
export function isCommandCodeModel(model: string): boolean {
  return model.startsWith('commandcode/')
}
