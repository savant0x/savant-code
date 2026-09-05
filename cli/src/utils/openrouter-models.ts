/**
 * Live + hardcoded model catalogs for the /model picker.
 *
 * Split into focused modules: types, the generic live-catalog fetcher
 * (OpenRouter + NVIDIA NIM + Nous Research + KiosAPI + OpenCode Zen instances —
 * FID-2026-0809-001 Phase 3), static catalogs derived from common (TokenRouter /
 * TokenHarbor / OpenCode Go / CommandCode), model-id lookup + context resolution,
 * and the combined gateway fetch.
 */
export {
  fetchGatewayModels,
  getCachedGatewayModels,
  subscribeGatewayCatalog,
  __resetOpenRouterModelsCacheForTest,
} from './openrouter-models/gateway'
export {
  fetchOpenRouterModels,
  getCachedOpenRouterModels,
  hasOpenRouterCatalog,
} from './openrouter-models/openrouter'
export {
  fetchNousModels,
  getCachedNousModels,
  hasNousCatalog,
  parseNousModelsForTest,
} from './openrouter-models/nous'
export {
  fetchKiosapiModels,
  getCachedKiosapiModels,
  hasKiosapiCatalog,
  parseKiosapiModelsForTest,
} from './openrouter-models/kiosapi'
export {
  fetchZenModels,
  getCachedZenModels,
  hasZenCatalog,
  parseZenModelsForTest,
} from './openrouter-models/opencode-zen'
export { fetchNvidiaModels } from './openrouter-models/nvidia'
export {
  fetchCommandCodeModels,
  fetchOpenCodeGoModels,
  fetchTokenRouterModels,
  getTokenHarborModels,
} from './openrouter-models/static-catalogs'
export {
  findGatewayModel,
  formatModelInfo,
  getProviderFromModelId,
  resolveContextWindowForModel,
} from './openrouter-models/lookup'
export type { ModelProvider, OpenRouterModel } from './openrouter-models/types'
