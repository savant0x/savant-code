/**
 * Settled-result ladder for the combined gateway catalog fan-out
 * (`gateway.ts`). Split from gateway.ts for the 300-line cap; the OpenAI
 * leg was added by FID-2026-1001-001.
 *
 * POSITIONAL CONTRACT: `restResults` is the tail of the Promise.allSettled()
 * array after [openrouter, nvidia], in exactly this order: Nous, KiosAPI,
 * APInex, OpenAI, OrcaRouter, B.AI, Vercel, CleanApis, CodeCraft, Mistral,
 * xKiro, Apixo, AIHubMix, DeepInfra, Venice, Ashna, BlazeRail, custom catalogs. Fulfilled values
 * win; rejected sources degrade to their per-provider cache — custom catalogs
 * degrade to [] (lazily-built custom fetchers have no cache, FID-2026-0910-004
 * D10).
 *
 * FID-2026-1007-006: the fan-out array itself also lives here. The array and
 * the ladder are one contract, and splitting them was how the 300-line cap
 * turned a positional list into two places to edit.
 */
import { fetchAihubmixModels, getCachedAihubmixModels } from './aihubmix'
import { fetchApinexModels, getCachedApinexModels } from './apinex'
import { fetchApixoModels, getCachedApixoModels } from './apixo'
import { fetchAshnaModels, getCachedAshnaModels } from './ashna'
import { fetchBaiModels, getCachedBaiModels } from './bai'
import { fetchBlazerailModels, getCachedBlazerailModels } from './blazerail'
import { fetchCleanApisModels, getCachedCleanApisModels } from './cleanapis'
import { fetchCodecraftModels, getCachedCodecraftModels } from './codecraft'
import { fetchAllCustomModels } from './custom-catalog'
import { fetchDeepInfraModels, getCachedDeepInfraModels } from './deepinfra'
import { fetchKiosapiModels, getCachedKiosapiModels } from './kiosapi'
import { fetchMistralModels, getCachedMistralModels } from './mistral'
import { fetchNousModels, getCachedNousModels } from './nous'
import { fetchNvidiaModels, getCachedNvidiaModels } from './nvidia'
import { fetchOpenAiModels, getCachedOpenAiModels } from './openai'
import { fetchOpenRouterModels, getCachedOpenRouterModels } from './openrouter'
import { fetchOrcarouterModels, getCachedOrcarouterModels } from './orcarouter'
import { fetchVeniceModels, getCachedVeniceModels } from './venice'
import { fetchVercelModels, getCachedVercelModels } from './vercel'
import { fetchXkiroModels, getCachedXkiroModels } from './xkiro'

import type { OpenRouterModel } from './types'

type SettledCatalog = PromiseSettledResult<OpenRouterModel[]>

/** The settled live legs of the combined gateway catalog. */
export interface GatewayLiveCatalogs {
  orModels: OpenRouterModel[]
  nvidiaModels: OpenRouterModel[]
  nousModels: OpenRouterModel[]
  kiosapiModels: OpenRouterModel[]
  apinexModels: OpenRouterModel[]
  openAiModels: OpenRouterModel[]
  orcarouterModels: OpenRouterModel[]
  baiModels: OpenRouterModel[]
  vercelModels: OpenRouterModel[]
  cleanApisModels: OpenRouterModel[]
  codecraftModels: OpenRouterModel[]
  mistralModels: OpenRouterModel[]
  xkiroModels: OpenRouterModel[]
  apixoModels: OpenRouterModel[]
  aihubmixModels: OpenRouterModel[]
  deepinfraModels: OpenRouterModel[]
  veniceModels: OpenRouterModel[]
  ashnaModels: OpenRouterModel[]
  blazerailModels: OpenRouterModel[]
  customModels: OpenRouterModel[]
}

/**
 * The live-provider fan-out behind `fetchGatewayModels` (FID-2025-1001-001 / M0
 * extraction): every live fetcher, settled so one provider's failure cannot
 * fail the catalog. Order is the POSITIONAL CONTRACT above, verbatim.
 */
export async function fetchGatewayLiveCatalogs(forceRefresh: boolean): Promise<{
  orResult: SettledCatalog
  nvidiaResult: SettledCatalog
  restResults: SettledCatalog[]
}> {
  const [orResult, nvidiaResult, ...restResults] = await Promise.allSettled([
    fetchOpenRouterModels(forceRefresh),
    fetchNvidiaModels(forceRefresh),
    fetchNousModels(forceRefresh),
    fetchKiosapiModels(forceRefresh),
    fetchApinexModels(forceRefresh),
    fetchOpenAiModels(forceRefresh),
    fetchOrcarouterModels(forceRefresh),
    fetchBaiModels(forceRefresh),
    fetchVercelModels(forceRefresh),
    fetchCleanApisModels(forceRefresh),
    fetchCodecraftModels(forceRefresh),
    fetchMistralModels(forceRefresh),
    fetchXkiroModels(forceRefresh),
    fetchApixoModels(forceRefresh),
    fetchAihubmixModels(forceRefresh),
    fetchDeepInfraModels(forceRefresh),
    fetchVeniceModels(forceRefresh),
    fetchAshnaModels(forceRefresh),
    // Keep new built-ins immediately before the custom-catalogs tail.
    fetchBlazerailModels(forceRefresh),
    // FID-2026-0910-004 Step 9 remainder: custom catalogs (live + inline)
    // merge here; per-provider failures degrade to [] (D10 ladder).
    fetchAllCustomModels(forceRefresh),
  ])
  return { orResult, nvidiaResult, restResults }
}

export function resolveGatewayLiveCatalogs(
  orResult: SettledCatalog,
  nvidiaResult: SettledCatalog,
  restResults: readonly SettledCatalog[],
): GatewayLiveCatalogs {
  const [
    nousResult,
    kiosapiResult,
    apinexResult,
    openAiResult,
    orcarouterResult,
    baiResult,
    vercelResult,
    cleanApisResult,
    codecraftResult,
    mistralResult,
    xkiroResult,
    apixoResult,
    aihubmixResult,
    deepinfraResult,
    veniceResult,
    ashnaResult,
    blazerailResult,
    customResult,
  ] = restResults

  return {
    orModels:
      orResult.status === 'fulfilled'
        ? orResult.value
        : getCachedOpenRouterModels(),
    nvidiaModels:
      nvidiaResult.status === 'fulfilled'
        ? nvidiaResult.value
        : getCachedNvidiaModels(),
    nousModels:
      nousResult.status === 'fulfilled'
        ? nousResult.value
        : getCachedNousModels(),
    kiosapiModels:
      kiosapiResult.status === 'fulfilled'
        ? kiosapiResult.value
        : getCachedKiosapiModels(),
    apinexModels:
      apinexResult.status === 'fulfilled'
        ? apinexResult.value
        : getCachedApinexModels(),
    openAiModels:
      openAiResult && openAiResult.status === 'fulfilled'
        ? openAiResult.value
        : getCachedOpenAiModels(),
    orcarouterModels:
      orcarouterResult.status === 'fulfilled'
        ? orcarouterResult.value
        : getCachedOrcarouterModels(),
    baiModels:
      baiResult.status === 'fulfilled' ? baiResult.value : getCachedBaiModels(),
    vercelModels:
      vercelResult && vercelResult.status === 'fulfilled'
        ? vercelResult.value
        : getCachedVercelModels(),
    cleanApisModels:
      cleanApisResult && cleanApisResult.status === 'fulfilled'
        ? cleanApisResult.value
        : getCachedCleanApisModels(),
    customModels:
      customResult && customResult.status === 'fulfilled'
        ? customResult.value
        : [],
    codecraftModels:
      codecraftResult?.status === 'fulfilled'
        ? codecraftResult.value
        : getCachedCodecraftModels(),
    mistralModels:
      mistralResult?.status === 'fulfilled'
        ? mistralResult.value
        : getCachedMistralModels(),
    xkiroModels:
      xkiroResult?.status === 'fulfilled'
        ? xkiroResult.value
        : getCachedXkiroModels(),
    apixoModels:
      apixoResult?.status === 'fulfilled'
        ? apixoResult.value
        : getCachedApixoModels(),
    aihubmixModels:
      aihubmixResult?.status === 'fulfilled'
        ? aihubmixResult.value
        : getCachedAihubmixModels(),
    deepinfraModels:
      deepinfraResult?.status === 'fulfilled'
        ? deepinfraResult.value
        : getCachedDeepInfraModels(),
    veniceModels:
      veniceResult?.status === 'fulfilled'
        ? veniceResult.value
        : getCachedVeniceModels(),
    ashnaModels:
      ashnaResult?.status === 'fulfilled'
        ? ashnaResult.value
        : getCachedAshnaModels(),
    blazerailModels:
      blazerailResult?.status === 'fulfilled'
        ? blazerailResult.value
        : getCachedBlazerailModels(),
  }
}
