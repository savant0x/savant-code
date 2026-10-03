import { createHash } from 'node:crypto'

import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { getModelRouteConfig } from '@savant-code/common/providers/model-route'

import { withRequestTokenBudget } from './request-budget'

import type { ModelRequestParams, ModelResult } from './types'

export function applyModelRequestBudget(
  result: ModelResult,
  params: ModelRequestParams,
): ModelResult {
  if (typeof result.model === 'string')
    throw new Error('Request budgeting requires a resolved provider model')
  const registry = getEffectiveProviderRegistry()
  const explicit = params.modelRoute
    ? getModelRouteConfig(params.modelRoute)
    : Object.values(registry).find(
        (config) =>
          config.kind !== 'local' && params.model.startsWith(`${config.id}/`),
      )
  const active = process.env.DIRECT_PROVIDER?.trim().toLowerCase()
  const catalogId = result.isChatGptOAuth
    ? `chatgpt-oauth/${params.model}`
    : params.modelRoute
      ? params.model.startsWith(`${params.modelRoute.providerId}/`)
        ? params.model
        : `${params.modelRoute.providerId}/${params.model}`
      : !explicit && active
        ? `${active}/${params.model}`
        : params.model
  // Separate OAuth, explicit gateway endpoints, and custom bare-slug endpoints.
  // Hash endpoint identity so credentials in custom URLs never become log data.
  const endpointTemplate = result.isChatGptOAuth
    ? 'chatgpt-oauth'
    : (explicit?.baseUrl ?? process.env.INFERENCE_BASE_URL ?? '')
  const endpoint = endpointTemplate
    .replace(
      /\{([A-Z0-9_]+)\}/g,
      (_match, variable: string) => process.env[variable] ?? '',
    )
    .replace(/\/+$/, '')
  const endpointId = createHash('sha256').update(endpoint).digest('hex')
  const routeId = `${params.modelRoute?.providerId ?? result.model.provider}:${result.model.modelId}:${endpointId}`
  return {
    ...result,
    model: withRequestTokenBudget(result.model, {
      catalogId,
      routeId,
      fallbackModelId: params.model,
      contextWindow: params.contextWindow,
      logger: params.logger,
    }),
  }
}
