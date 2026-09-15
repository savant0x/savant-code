/**
 * Shared model-catalog registry (Phase 1 of FID-2026-0809-001).
 *
 * Maps a typed key to the model map in common/src/constants/model-config.ts.
 * `ProviderConfig.catalog.modelsRef` is typed as `keyof typeof MODEL_CATALOGS`,
 * so catalog references are compile-time checked. Phase 3 derives the cli-side
 * picker catalogs (TOKENROUTER_CATALOG, OPENCODE_GO_CATALOG) from these maps.
 */
import {
  bazaarlinkModels,
  cloudflareModels,
  commandcodeModels,
  hcnsecModels,
  infronModels,
  opencodeGoModels,
  tokenbomModels,
  tokenharborModels,
  tokenrouterModels,
  unorouterModels,
} from '../constants/model-config'

export const MODEL_CATALOGS = {
  tokenrouter: tokenrouterModels,
  tokenharbor: tokenharborModels,
  opencodeGo: opencodeGoModels,
  commandcode: commandcodeModels,
  cloudflare: cloudflareModels,
  hcnsec: hcnsecModels,
  tokenbom: tokenbomModels,
  infron: infronModels,
  unorouter: unorouterModels,
  bazaarlink: bazaarlinkModels,
} as const
