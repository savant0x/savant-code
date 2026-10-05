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
  openrouterModels,
  PROVIDER_PROTOCOL_MAPS,
  tokenharborModels,
  TOKENROUTER_PROTOCOLS,
  XKIRO_PROTOCOLS,
  resolveMappedModelProtocol,
  tokenrouterModels,
} from './model-config/providers'

// Audited gateway catalogs (FID-2026-0913-001) + curated gateway catalogs
// (FID-2026-0914-001) + bazaarlink (FID-2026-0915-006) + atria
// (FID-2026-0916-005) + intern (FID-2026-1004-008).
export {
  atriaModels,
  bazaarlinkModels,
  hcnsecModels,
  infronModels,
  internModels,
  tokenbomModels,
  unorouterModels,
} from './model-config/gateway-catalogs'

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
  openrouterModel,
  TokenHarborModel,
  TokenrouterModel,
} from './model-config/providers'

export type {
  AtriaModel,
  BazaarlinkModel,
  HcnsecModel,
  InfronModel,
  InternModel,
  TokenbomModel,
  UnorouterModel,
} from './model-config/gateway-catalogs'
