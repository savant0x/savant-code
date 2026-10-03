/**
 * Settled-result ladder for the combined gateway catalog fan-out
 * (`gateway.ts`). Split from gateway.ts for the 300-line cap; the OpenAI
 * leg was added by FID-2026-1001-001.
 *
 * POSITIONAL CONTRACT: `restResults` is the tail of the Promise.allSettled()
 * array after [openrouter, nvidia], in exactly this order:
 * Nous, KiosAPI, APInex, OpenAI, OrcaRouter, B.AI, Vercel, CleanApis,
 * CodeCraft, xKiro, custom catalogs. Fulfilled values win; rejected sources degrade to their
 * per-provider cache — custom catalogs degrade to [] (lazily-built custom
 * fetchers have no cache, FID-2026-0910-004 D10).
 */
import { getCachedApinexModels } from './apinex'
import { getCachedBaiModels } from './bai'
import { getCachedCleanApisModels } from './cleanapis'
import { getCachedCodecraftModels } from './codecraft'
import { getCachedKiosapiModels } from './kiosapi'
import { getCachedNousModels } from './nous'
import { getCachedNvidiaModels } from './nvidia'
import { getCachedOpenAiModels } from './openai'
import { getCachedOpenRouterModels } from './openrouter'
import { getCachedOrcarouterModels } from './orcarouter'
import { getCachedVercelModels } from './vercel'
import { getCachedXkiroModels } from './xkiro'

import type { OpenRouterModel } from './types'

type SettledCatalog = PromiseSettledResult<OpenRouterModel[]>

export function resolveGatewayLiveCatalogs(
  orResult: SettledCatalog,
  nvidiaResult: SettledCatalog,
  restResults: readonly SettledCatalog[],
): {
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
  xkiroModels: OpenRouterModel[]
  customModels: OpenRouterModel[]
} {
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
    xkiroResult,
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
    xkiroModels:
      xkiroResult?.status === 'fulfilled'
        ? xkiroResult.value
        : getCachedXkiroModels(),
  }
}
