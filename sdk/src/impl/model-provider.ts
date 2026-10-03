/**
 * Model provider abstraction for routing requests to the appropriate LLM provider.
 *
 * This module handles:
 * - ChatGPT OAuth: Direct requests to OpenAI API using user's OAuth token
 * - Registry gateway providers: one ordered loop over the effective provider
 *   registry (FID-2026-0809-001 Phase 2; effective view per FID-2026-0910-004
 *   Step 4) — base URL, protocol, id transform, and credential env vars all
 *   come from the registry, not hand-written branches.
 * - Default: generic OpenAI-compatible fallback via createDefaultInferenceModel.
 */

import {
  CHATGPT_OAUTH_ENABLED,
  isChatGptOAuthModelAllowed,
  isOpenAIProviderModel,
} from '@savant-code/common/constants/chatgpt-oauth'
import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import {
  resolveModelRoute,
  routeMatchesEnvironmentEndpoint,
} from '@savant-code/common/providers/model-route'

import { getValidChatGptOAuthCredentials } from '../credentials'
import { applyModelRequestBudget } from './model-provider/apply-request-budget'
import { createDefaultInferenceModel } from './model-provider/default-inference'
import { resolveExplicitModelRoute } from './model-provider/explicit-route'
import {
  createOpenAIOAuthModel,
  createProviderModel,
  resolveEntryProtocol,
} from './model-provider/model-factories'
import {
  isChatGptOAuthRateLimited,
  resetChatGptOAuthRateLimit,
} from './model-provider/oauth-rate-limit'
import {
  buildMissingKeyError,
  getActiveProviderId,
  resolveActiveProviderKey,
  resolveExtraCredentials,
  resolveProviderKey,
} from './model-provider/provider-credentials'

import type { ModelRequestParams, ModelResult } from './model-provider/types'

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
  return applyModelRequestBudget(await resolveModelForRequest(params), params)
}

async function resolveModelForRequest(
  params: ModelRequestParams,
): Promise<ModelResult> {
  void resetChatGptOAuthRateLimit
  // FID-2026-0929-005: the caller-supplied `apiKey` (the deleted backend
  // identity) is no longer read. Authorization comes from the registry / the
  // active provider's own credential chain.
  void params
  const { model, skipChatGptOAuth } = params
  if (params.modelRoute) return resolveExplicitModelRoute(params)
  resolveModelRoute(model)

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

  // Gateway providers — one ordered loop over the EFFECTIVE registry
  // (FID-2026-0809-001 Phase 2; FID-2026-0910-004 Step 4: the effective view
  // is built-ins + registered custom providers, so customs route through the
  // same loop with zero special-casing). Registry ids are disjoint routing
  // prefixes, so iteration order is a no-op; iterate in registry order for
  // determinism. Ollama (kind: 'local') is intentionally not routed here — it
  // uses the default path with the CLI-set INFERENCE_BASE_URL
  // (ollama-onboarding.ts).
  for (const config of Object.values(getEffectiveProviderRegistry())) {
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
  const activeProviderConfig = activeProviderId
    ? getEffectiveProviderRegistry()[activeProviderId]
    : undefined
  // FID-2026-1003-006: a custom INFERENCE_BASE_URL endpoint — set, and either
  // unnamed by the registry or different from the active provider's registry
  // base — owns its own credential. The active provider's key chain is never
  // resolved for such a request (no master-key network exchange, no
  // fail-closed throw on a missing provider key), and its key is never sent
  // to the operator's own endpoint: INFERENCE_API_KEY is the only
  // authorizing secret (FID-2026-0929-005 custom-endpoint flow; D1 "never
  // invoke an unrelated key or endpoint"). Local-kind actives are always
  // consistent — their routes follow INFERENCE_BASE_URL by construction — so
  // they keep the legacy flow below.
  if (
    process.env.INFERENCE_BASE_URL?.trim() &&
    (activeProviderConfig === undefined ||
      !routeMatchesEnvironmentEndpoint(activeProviderConfig))
  ) {
    return {
      model: await createDefaultInferenceModel('', model, {
        endpointOwnsAuth: true,
        providerId: activeProviderId,
        ...(activeProviderConfig !== undefined &&
        activeProviderConfig.protocolMap === undefined
          ? { protocol: resolveEntryProtocol(activeProviderConfig) }
          : {}),
      }),
      isChatGptOAuth: false,
    }
  }
  const activeProviderKey = await resolveActiveProviderKey(activeProviderId)
  if (
    activeProviderConfig !== undefined &&
    activeProviderConfig.kind !== 'local' &&
    !activeProviderKey
  ) {
    throw new Error(buildMissingKeyError(activeProviderConfig))
  }
  return {
    model: await createDefaultInferenceModel(activeProviderKey ?? '', model, {
      // Only a key resolved from the active provider is authoritative; the
      // caller-supplied fallback keeps the legacy env precedence inside the
      // factory (custom-endpoint INFERENCE_API_KEY flow preserved).
      preferApiKey: activeProviderKey !== undefined,
      // Backend-mode fallback retains its historical OpenRouter-compatible
      // extensions. Direct non-OpenRouter providers, including Nous, must
      // not receive OpenRouter attribution or structured-output assumptions.
      providerId: activeProviderId,
      // FID-2026-1001-001: dispatch on the ACTIVE provider's resolved wire
      // protocol — a single-protocol Responses entry (api.openai.com) must
      // not receive chat/completions on the bare-slug path. Undefined when
      // no active registry gateway is resolved (legacy env flow untouched).
      // Gated on protocolMap === undefined: bare ids have no map entry, so
      // a map-dispatched active provider (resolveProtocol throws for them)
      // keeps its legacy chat-format bare-slug construction byte-identical
      // (FID Loop-2 promise; guard discovered during verification).
      ...(activeProviderConfig !== undefined &&
      activeProviderConfig.protocolMap === undefined
        ? { protocol: resolveEntryProtocol(activeProviderConfig) }
        : {}),
    }),
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
