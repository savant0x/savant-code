import { LRUCache } from './lru-cache'

export type ModelRequestLimits = {
  contextWindow?: number
  maxOutputTokens?: number
}

type CatalogModel = {
  id: string
  provider?: string
  contextLength?: number
  maxCompletionTokens?: number
  topProvider?: {
    contextLength?: number
    maxCompletionTokens?: number | null
  }
}

export function validTokenLimit(
  value: number | null | undefined,
): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined
}

export function smallerTokenLimit(
  ...values: Array<number | undefined>
): number | undefined {
  const valid = values.filter(
    (value): value is number => validTokenLimit(value) !== undefined,
  )
  return valid.length > 0 ? Math.min(...valid) : undefined
}

/** Exact catalog ids and route-specific serving corrections; no family matching. */
export class ModelRequestLimitsStore {
  private catalog = new Map<string, ModelRequestLimits>()
  private readonly observed = new LRUCache<string, ModelRequestLimits>(1000)

  replaceCatalog(
    models: readonly CatalogModel[],
    defaultProvider?: string,
  ): void {
    const catalog = new Map<string, ModelRequestLimits>()
    for (const model of models) {
      if (!model || typeof model.id !== 'string' || model.id.length === 0)
        continue
      // OpenRouter upstream ids can collide with a direct provider's routing
      // prefix (openai/gpt-5). Preserve the serving provider's identity.
      const id =
        (model.provider ?? defaultProvider) === 'openrouter' &&
        !model.id.startsWith('openrouter/')
          ? `openrouter/${model.id}`
          : model.id
      const limits = {
        contextWindow: smallerTokenLimit(
          model.contextLength,
          model.topProvider?.contextLength,
        ),
        maxOutputTokens:
          validTokenLimit(model.topProvider?.maxCompletionTokens) ??
          validTokenLimit(model.maxCompletionTokens),
      }
      const previous = catalog.get(id)
      catalog.set(id, {
        contextWindow: smallerTokenLimit(
          previous?.contextWindow,
          limits.contextWindow,
        ),
        maxOutputTokens: smallerTokenLimit(
          previous?.maxOutputTokens,
          limits.maxOutputTokens,
        ),
      })
    }
    this.catalog = catalog
  }

  get(catalogId: string, routeId: string): ModelRequestLimits {
    const catalog = this.catalog.get(catalogId)
    const observed = this.observed.get(routeId)
    return {
      contextWindow: smallerTokenLimit(
        catalog?.contextWindow,
        observed?.contextWindow,
      ),
      maxOutputTokens: smallerTokenLimit(
        catalog?.maxOutputTokens,
        observed?.maxOutputTokens,
      ),
    }
  }

  getCatalog(catalogId: string): ModelRequestLimits {
    return { ...this.catalog.get(catalogId) }
  }

  observe(routeId: string, limits: ModelRequestLimits): void {
    const previous = this.observed.get(routeId)
    this.observed.set(routeId, {
      contextWindow: smallerTokenLimit(
        previous?.contextWindow,
        limits.contextWindow,
      ),
      maxOutputTokens: smallerTokenLimit(
        previous?.maxOutputTokens,
        limits.maxOutputTokens,
      ),
    })
  }
}

export const modelRequestLimits = new ModelRequestLimitsStore()
