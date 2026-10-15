/** Measured shared CodeCraft/CleanAPIs catalog shape (2026-10-03). */
import {
  catalogCreated,
  catalogLimit,
  catalogObject,
  catalogPrice,
  catalogRows,
  catalogStrings,
} from './catalog-values'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

function parseChatModel(
  provider: 'codecraft' | 'cleanapis',
  value: unknown,
): OpenRouterModel | undefined {
  const row = catalogObject(value)
  const id = asOptionalString(row.id)
  if (!id) return undefined
  const architecture = catalogObject(row.architecture)
  const pricing = catalogObject(row.pricing)
  const top = catalogObject(row.top_provider)
  return {
    id: `${provider}/${id}`,
    name: asOptionalString(row.name) ?? id,
    description: asOptionalString(row.description),
    contextLength:
      catalogLimit(row.context_length) ?? catalogLimit(row.context_window),
    maxCompletionTokens:
      catalogLimit(row.max_completion_tokens) ?? catalogLimit(row.max_tokens),
    promptPricePerToken:
      catalogPrice(pricing.prompt) ?? catalogPrice(pricing.input_per_1k, 1000),
    completionPricePerToken:
      catalogPrice(pricing.completion) ??
      catalogPrice(pricing.output_per_1k, 1000),
    modality: asOptionalString(architecture.modality),
    tokenizer: asOptionalString(architecture.tokenizer),
    instructType: asOptionalString(architecture.instruct_type),
    capabilities: catalogStrings(row.capabilities),
    topProvider: row.top_provider
      ? {
          contextLength: catalogLimit(top.context_length),
          maxCompletionTokens: catalogLimit(top.max_completion_tokens),
          isModerated:
            typeof top.is_moderated === 'boolean'
              ? top.is_moderated
              : undefined,
        }
      : undefined,
    created: catalogCreated(row.created),
    provider,
  }
}

export function parseChatCatalog(
  provider: 'codecraft' | 'cleanapis',
  json: unknown,
): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const value of catalogRows(json)) {
    const model = parseChatModel(provider, value)
    if (model) parsed.push(model)
  }
  return parsed.sort((a, b) => a.id.localeCompare(b.id))
}
