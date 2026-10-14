import {
  atlasCloudModels,
  alibabaModels,
  anthropicModels,
  basetenModels,
  cerebrasModels,
  cohereModels,
  cloudflareModels,
  deepseekModels,
  deepseekTier1Models,
  finetunedVertexModels,
  fireworksAiModels,
  googleModels,
  groqModels,
  metaModels,
  mimoModels,
  minimaxModels,
  moonshotaiModels,
  nvidiaModels,
  openaiModels,
  openrouterModels,
  perplexityModels,
  tier1MinimaxModels,
  tokenharborModels,
  tokenrouterModels,
  togetheraiModels,
  xaiModels,
  zaiModels,
} from './providers'
import {
  deriveAllowedModelPrefixes,
  deriveLogoDomain,
  deriveProviderDomains,
} from '../../providers/derive'
import { ORG_DOMAINS, ORG_PREFIXES } from '../../providers/org'
import { PROVIDER_REGISTRY } from '../../providers/registry'
import { isExplicitlyDefinedModel } from '../../util/model-utils'

import type {
  AtlasCloudModel,
  DeepseekModel,
  MimoModel,
  MiniMaxModel,
  OpenAIModel,
} from './providers'

// Allowed model prefixes for validation — derived from the provider registry
// (org slugs ∪ registry ids). FID-2026-0809-001 Phase-1 delta (a): the derived
// list gains `openrouter` and `ollama` (latent gaps fixed by derivation).
export const ALLOWED_MODEL_PREFIXES = deriveAllowedModelPrefixes(
  PROVIDER_REGISTRY,
  ORG_PREFIXES,
)

export const models = {
  ...openaiModels,
  ...deepseekModels,
  ...mimoModels,
  ...minimaxModels,
  ...atlasCloudModels,
  ...openrouterModels,
  ...anthropicModels,
  ...googleModels,
  ...xaiModels,
  ...deepseekTier1Models,
  ...groqModels,
  ...cohereModels,
  ...togetheraiModels,
  ...cerebrasModels,
  ...perplexityModels,
  ...alibabaModels,
  ...moonshotaiModels,
  ...zaiModels,
  ...tier1MinimaxModels,
  ...metaModels,
  ...fireworksAiModels,
  ...basetenModels,
  ...finetunedVertexModels,
  ...tokenrouterModels,
  ...tokenharborModels,
  ...nvidiaModels,
  ...cloudflareModels,
} as const

export const shortModelNames = {
  'gemini-2.5-pro': models.openrouter_gemini2_5_pro_preview,
  'flash-2.5': models.openrouter_gemini2_5_flash,
  'opus-4': models.openrouter_claude_opus_4,
  'sonnet-4.5': models.openrouter_claude_sonnet_4_5,
  'sonnet-4': models.openrouter_claude_sonnet_4,
  'sonnet-3.7': models.openrouter_claude_sonnet_4,
  'sonnet-3.6': models.openrouter_claude_3_5_sonnet,
  'sonnet-3.5': models.openrouter_claude_3_5_sonnet,
  'gpt-4.1': models.gpt4_1,
  'o3-mini': models.o3mini,
  o3: models.o3,
  'o4-mini': models.o4mini,
  'o3-pro': models.o3pro,
}

export const providerModelNames = {
  ...Object.fromEntries(
    Object.entries(openaiModels).map(([name, model]) => [
      model,
      'openai' as const,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(openrouterModels).map(([name, model]) => [
      model,
      'openrouter' as const,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(atlasCloudModels).map(([name, model]) => [
      model,
      'atlascloud' as const,
    ]),
  ),
}

export type Model = (typeof models)[keyof typeof models] | (string & {})

const nonCacheableModels = [
  models.openrouter_grok_4,
  models.openrouter_tencent_hy3_free,
  models.tencentHy3,
] satisfies string[] as string[]
export function supportsCacheControl(model: Model): boolean {
  if (model.startsWith('openai/')) {
    return true
  }
  if (model.startsWith('anthropic/')) {
    return true
  }
  if (!isExplicitlyDefinedModel(model)) {
    // Default to no cache control for unknown models
    return false
  }
  return !nonCacheableModels.includes(model)
}

/**
 * Claude 4.6+ (including Fable) rejects requests whose final message is an
 * assistant message ("This model does not support assistant message prefill"),
 * e.g. when routed through Amazon Bedrock. Older Claude models and other
 * providers accept a trailing assistant message as a prefill to continue from.
 */
export function supportsAssistantPrefill(model: Model): boolean {
  const match = model.match(/claude-(?:[a-z]+-)?(\d+(?:[.-]\d+)?)/)
  if (!match) {
    return true
  }
  const version = parseFloat(match[1].replace('-', '.'))
  return version < 4.6
}

export function getModelFromShortName(
  modelName: string | undefined,
): Model | undefined {
  if (!modelName) return undefined
  if (modelName && !(modelName in shortModelNames)) {
    throw new Error(
      `Unknown model: ${modelName}. Please use a valid model. Valid models are: ${Object.keys(
        shortModelNames,
      ).join(', ')}`,
    )
  }

  return shortModelNames[modelName as keyof typeof shortModelNames]
}

// Favicon/logo domains — derived from the provider registry (org-slug domains
// ∪ registry domains). FID-2026-0809-001 Phase-1 delta (c): the derived map
// gains `openrouter` (absent today). Ollama has no domain (local runtime).
export const providerDomains = deriveProviderDomains(
  PROVIDER_REGISTRY,
  ORG_DOMAINS,
)

export function getLogoForModel(modelName: string): string | undefined {
  let domain: string | undefined

  // Org value-membership + tencent prefix branches (kept in common).
  if (Object.values(openaiModels).includes(modelName as OpenAIModel))
    domain = providerDomains.openai
  else if (Object.values(deepseekModels).includes(modelName as DeepseekModel))
    domain = providerDomains.deepseek
  else if (Object.values(minimaxModels).includes(modelName as MiniMaxModel))
    domain = providerDomains.minimax
  else if (Object.values(mimoModels).includes(modelName as MimoModel))
    domain = providerDomains.mimo
  else if (
    Object.values(atlasCloudModels).includes(modelName as AtlasCloudModel)
  )
    domain = providerDomains.atlascloud
  else if (modelName.startsWith('tencent/')) domain = providerDomains.tencent
  else if (
    (domain = deriveLogoDomain(PROVIDER_REGISTRY, modelName)) !== undefined
  ) {
    // Registry-prefix match (tokenrouter, tokenharbor, nvidia, cloudflare,
    // opencode-go, commandcode, openrouter).
  } else if (modelName.includes('claude')) domain = providerDomains.anthropic
  else if (modelName.includes('grok')) domain = providerDomains.xai

  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256`
    : undefined
}
