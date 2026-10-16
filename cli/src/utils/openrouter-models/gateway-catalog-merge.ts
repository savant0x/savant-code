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
import { fetchChatanywhereModels } from './chatanywhere'
import {
  fetchCommandCodeModels,
  fetchHcnsecModels,
  fetchTier1StaticModels,
  fetchTokenBomModels,
  fetchTokenRouterModels,
  getTokenHarborModels,
} from './static-catalogs'
import {
  fetchAtriaModels,
  fetchBazaarlinkModels,
  fetchInfronModels,
  fetchInternModels,
  fetchMarsaiModels,
  fetchUnorouterModels,
} from './static-catalogs-gateways'
import { fetchTiarinaModels } from './tiarina'

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
    ...live.mistralModels,
    ...live.xkiroModels,
    ...live.apixoModels,
    ...live.aihubmixModels,
    ...live.deepinfraModels,
    ...live.veniceModels,
    ...fetchCommandCodeModels(),
    ...fetchHcnsecModels(),
    ...fetchTokenBomModels(),
    ...fetchInfronModels(),
    ...fetchUnorouterModels(),
    ...fetchBazaarlinkModels(),
    ...fetchAtriaModels(),
    ...fetchInternModels(),
    // FID-2026-1007-005: the provider was registered, catalogued and window-
    // covered, and this fan-out never asked for it — the picker had no rows.
    ...fetchChatanywhereModels(),
    // FID-2026-1012-005: the same lesson applied up front — the static builder
    // is wired in the same change that registers the provider, and the census
    // pairing check (providers:parity) proves the rows reach the picker.
    ...fetchTiarinaModels(),
    // FID-2026-1012-026: measured first-party static catalogs share one
    // common row source so the registry and picker cannot drift.
    ...fetchTier1StaticModels(),
    // FID-2026-1016-004: the static builder ships in the same change that
    // registers the provider — the chatanywhere/tiarina lesson; the sole
    // checked-in row reaches /model.
    ...fetchMarsaiModels(),
    ...live.customModels,
  ]
  combined.sort((a, b) => a.id.localeCompare(b.id))
  return combined
}
