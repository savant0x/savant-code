/**
 * Shared model-catalog registry (Phase 1 of FID-2026-0809-001).
 *
 * Maps a typed key to the model map in common/src/constants/model-config.ts.
 * `ProviderConfig.catalog.modelsRef` is typed as `keyof typeof MODEL_CATALOGS`,
 * so catalog references are compile-time checked. Phase 3 derives the cli-side
 * picker catalogs (TOKENROUTER_CATALOG, OPENCODE_GO_CATALOG) from these maps.
 */
import {
  cloudflareModels,
  commandcodeModels,
  hcnsecModels,
  opencodeGoModels,
  tokenbomModels,
  tokenharborModels,
  tokenrouterModels,
} from '../constants/model-config'

export const MODEL_CATALOGS = {
  tokenrouter: tokenrouterModels,
  tokenharbor: tokenharborModels,
  opencodeGo: opencodeGoModels,
  commandcode: commandcodeModels,
  cloudflare: cloudflareModels,
  hcnsec: hcnsecModels,
  tokenbom: tokenbomModels,
} as const
