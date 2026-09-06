// Re-export shim (FID-2026-0805-003 methodology; FID-2026-0809-016 Batch B).
// Implementation moved to `model-config/{providers,aggregate}.ts`; this path
// keeps exporting the same public surface so no consumer changes.
export {
  ALLOWED_MODEL_PREFIXES,
  getLogoForModel,
  getModelFromShortName,
  models,
  providerDomains,
  providerModelNames,
  shortModelNames,
  supportsAssistantPrefill,
  supportsCacheControl,
} from './model-config/aggregate'

export type { Model } from './model-config/aggregate'

export {
  atlasCloudModels,
  cloudflareModels,
  commandcodeModels,
  COMMANDCODE_PROTOCOLS,
  deepseekModels,
  finetunedVertexModelNames,
  finetunedVertexModels,
  mimoModels,
  minimaxModels,
  moonshotModels,
  nvidiaModels,
  openaiModels,
  openCodeZenModels,
  opencodeGoModels,
  OPENCODE_GO_PROTOCOLS,
  OPENCODE_ZEN_PROTOCOLS,
  openrouterModels,
  PROVIDER_PROTOCOL_MAPS,
  tokenharborModels,
  TOKENROUTER_NAMES,
  tokenrouterModels,
} from './model-config/providers'

export type {
  AtlasCloudModel,
  CloudflareModel,
  CommandcodeModel,
  DeepseekModel,
  FinetunedVertexModel,
  MimoModel,
  MiniMaxModel,
  MoonshotModel,
  NvidiaModel,
  OpenAIModel,
  OpenCodeZenModel,
  OpencodeGoModel,
  openrouterModel,
  TokenHarborModel,
  TokenrouterModel,
} from './model-config/providers'
