import { createHash } from 'node:crypto'

import { z } from 'zod/v4'

import { getEffectiveProviderRegistry } from './custom-providers'
import { providerAccountRevision } from './provider-account-revisions'

import type { ProviderConfig } from './types'
import type { ModelRoute } from '../templates/initial-agents-dir/types/agent-models'

export const modelRouteSchema = z
  .object({
    providerId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    authMode: z.enum(['provider', 'chatgpt-oauth']),
    configRevision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    accountRevision: z.uuid().optional(),
  })
  .strict()

export type { ModelRoute } from '../templates/initial-agents-dir/types/agent-models'

export const modelSelectionSchema = z
  .object({
    version: z.literal(1),
    model: z.string().trim().min(1),
    route: modelRouteSchema,
  })
  .strict()

export type ModelSelection = z.infer<typeof modelSelectionSchema>

/** Resolve a provider without admitting prototype properties or a stale route. */
export function getModelRouteConfig(route: ModelRoute): ProviderConfig {
  const registry = getEffectiveProviderRegistry()
  if (!Object.hasOwn(registry, route.providerId)) {
    throw new Error(
      'Selected provider is unavailable. Reselect it with /provider.',
    )
  }
  const original = registry[route.providerId]
  const config =
    original.kind === 'local' &&
    process.env.DIRECT_PROVIDER === original.id &&
    process.env.INFERENCE_BASE_URL
      ? { ...original, baseUrl: process.env.INFERENCE_BASE_URL }
      : original
  if (route.authMode === 'chatgpt-oauth' && config.id !== 'openai') {
    throw new Error('ChatGPT OAuth requires an explicit OpenAI serving route.')
  }
  if (
    route.configRevision &&
    route.configRevision !== providerConfigRevision(config)
  ) {
    throw new Error(
      'Selected provider configuration changed. Reselect it before retrying.',
    )
  }
  if (
    route.accountRevision &&
    route.accountRevision !== providerAccountRevision(config)
  ) {
    throw new Error(
      'Selected provider credentials changed. Reselect the provider before retrying.',
    )
  }
  return config
}

function providerConfigRevision(config: ProviderConfig): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        config.id,
        config.baseUrl,
        config.protocol,
        config.protocolMap,
        config.idTransform,
        config.credentials,
      ]),
    )
    .digest('hex')
}

/** Capture identity at selection/run start, before any asynchronous dispatch. */
export function captureModelRoute(
  providerId: string,
  authMode: ModelRoute['authMode'] = 'provider',
): ModelRoute {
  const route = modelRouteSchema.parse({ providerId, authMode })
  const config = getModelRouteConfig(route)
  return {
    ...route,
    configRevision: providerConfigRevision(config),
    accountRevision: providerAccountRevision(config),
  }
}

/** Compatibility only: unknown environment endpoints retain the legacy adapter. */
export function resolveModelRoute(
  model: string,
  preferred?: ModelRoute,
  activeProviderId = process.env.DIRECT_PROVIDER?.trim().toLowerCase(),
): ModelRoute | undefined {
  if (preferred) {
    const route = modelRouteSchema.parse(preferred)
    getModelRouteConfig(route)
    return route.configRevision
      ? route
      : captureModelRoute(route.providerId, route.authMode)
  }
  const registry = getEffectiveProviderRegistry()
  const prefix = Object.values(registry).find((entry) =>
    model.startsWith(`${entry.id}/`),
  )
  if (
    prefix &&
    activeProviderId &&
    Object.hasOwn(registry, activeProviderId) &&
    prefix.id !== activeProviderId
  ) {
    throw new Error(
      'Model serving provider is ambiguous. Select an explicit provider and model.',
    )
  }
  const id = prefix?.id ?? activeProviderId
  if (!id || !Object.hasOwn(registry, id)) return undefined
  // FID-2026-1003-006 D1 compatibility resolver: a bare-slug model names no
  // registry provider, so its serving identity is the environment endpoint.
  // When INFERENCE_BASE_URL is a custom endpoint (direct mode,
  // FID-2026-0929-005), synthesizing a registry route from active intent would
  // silently replace that endpoint and send the request — with that provider's
  // credential — elsewhere. Unregistered environment endpoints remain
  // supported: the request keeps the legacy custom-endpoint adapter.
  if (!prefix && !routeMatchesEnvironmentEndpoint(registry[id]))
    return undefined
  return captureModelRoute(id)
}

/**
 * A synthesized route may pin the registry endpoint only when it is the
 * endpoint the request would use anyway. Custom INFERENCE_BASE_URL endpoints
 * win for bare-slug models. Local providers route through INFERENCE_BASE_URL
 * by construction (getModelRouteConfig), so they are always consistent.
 *
 * Exported for the SDK bare-slug auth seam (FID-2026-1003-006): when this
 * returns false for the active provider, the environment endpoint owns the
 * request's credential — INFERENCE_API_KEY only, never the provider's key
 * chain.
 */
export function routeMatchesEnvironmentEndpoint(
  config: ProviderConfig,
): boolean {
  if (config.kind === 'local') return true
  const inferenceBaseUrl = process.env.INFERENCE_BASE_URL
  if (!inferenceBaseUrl?.trim()) return true
  return (
    normalizeEndpoint(inferenceBaseUrl) === normalizeEndpoint(config.baseUrl)
  )
}

function normalizeEndpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  try {
    const url = new URL(trimmed)
    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return trimmed.toLowerCase()
  }
}

/** A model replacement must replace its route as well, without a global reread. */
export function routeForModelReplacement(
  model: string,
): ModelRoute | undefined {
  return resolveModelRoute(model, undefined, '')
}

export function modelRouteKey(model: string, route?: ModelRoute): string {
  return route ? `${route.providerId}:${route.authMode}:${model}` : model
}
