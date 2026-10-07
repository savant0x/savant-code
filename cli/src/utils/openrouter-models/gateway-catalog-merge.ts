/**
 * The assembled `/model` catalog — the merge order is the load-bearing part.
 *
 * Split out of `gateway.ts` for the 300-line quality ceiling (FID-2026-1007-006,
 * the same seam shape as `gateway-live-results.ts`). The list is
 * sorted with a STABLE `localeCompare` on the id, so when two providers publish
 * the same id — OpenRouter and the OpenAI platform both serve `openai/gpt-5` —
 * the provider that appears EARLIER here wins every `catalog.find()` in
 * `findGatewayModel`. The order below is the historical one, byte for byte;
 * do not reorder it as a tidy-up.
 */
import {
  fetchCommandCodeModels,
  fetchHcnsecModels,
  fetchTokenBomModels,
  fetchTokenRouterModels,
  getTokenHarborModels,
} from './static-catalogs'
import {
  fetchAtriaModels,
  fetchBazaarlinkModels,
  fetchInfronModels,
  fetchInternModels,
  fetchUnorouterModels,
} from './static-catalogs-gateways'

import type { GatewayLiveCatalogs } from './gateway-live-results'
import type { OpenRouterModel } from './types'

/**
 * Merge the settled live legs with the checked-in static builders into the
 * sorted picker catalog. `live.customModels` is the last live leg, so every row
 * the picker can show passes through here and nothing is appended after the
 * sort.
 */
export function assembleGatewayCatalog(
  live: GatewayLiveCatalogs,
): OpenRouterModel[] {
  const combined = [
    ...live.orModels,
    ...fetchTokenRouterModels(),
    ...getTokenHarborModels(),
    ...live.nvidiaModels,
    ...live.nousModels,
    ...live.kiosapiModels,
    ...live.apinexModels,
    ...live.openAiModels,
    ...live.orcarouterModels,
    ...live.baiModels,
    ...live.vercelModels,
    ...live.cleanApisModels,
    ...live.codecraftModels,
    ...live.xkiroModels,
    ...fetchCommandCodeModels(),
    ...fetchHcnsecModels(),
    ...fetchTokenBomModels(),
    ...fetchInfronModels(),
    ...fetchUnorouterModels(),
    ...fetchBazaarlinkModels(),
    ...fetchAtriaModels(),
    ...fetchInternModels(),
    ...live.customModels,
  ]
  combined.sort((a, b) => a.id.localeCompare(b.id))
  return combined
}
