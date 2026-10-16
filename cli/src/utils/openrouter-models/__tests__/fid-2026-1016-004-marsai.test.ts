/**
 * FID-2026-1016-004 — MarsAI gateway provider pins.
 *
 * Locks the static free-tier catalog integration:
 * 1. The 14 free-tier ids from the operator dashboard census (2026-10-16)
 *    are cataloged in the common model map and served by the cli fetcher.
 * 2. Windows: cross-gateway-sourced rows resolve from the fallback table;
 *    the four documented no-row ids keep the flagged 200k default.
 * 3. Dispatch keeps the full id — `marsai/` is part of the real vendor
 *    slug (the openrouter shape) — and /provider surfaces the masked
 *    MARSAI_API_KEY entry.
 */
import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import { marsaiModels } from '@savant-code/common/constants/model-config'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { fetchMarsaiModels } from '../static-catalogs-gateways'

const FREE_TIER_IDS = [
  'marsai/auto-free',
  'marsai/cat-jam-free',
  'marsai/deepseek-v4.1-flash-free',
  'marsai/laguna-xs-2.1-free',
  'marsai/Meta-Llama-3_3-70B-Instruct-free',
  'marsai/mimo-v2.6-flash-free',
  'marsai/MiniMax-M2.7-free',
  'marsai/muse-spark-1.3-free',
  'marsai/nemotron-3-super-120b-a12b:free',
  'marsai/nemotron-3-ultra-free',
  'marsai/north-mini-code:free',
  'marsai/Qwen3.6-27B-free',
  'marsai/Qwen3.8-27B-free',
  'marsai/step-5-preview-free',
] as const

describe('FID-2026-1016-004: marsai static catalog', () => {
  test('the 14 free-tier ids are cataloged with the routing prefix', () => {
    expect(Object.values(marsaiModels)).toEqual([...FREE_TIER_IDS])
  })

  test('cli fetcher serves all 14 ids with resolved windows', () => {
    const models = fetchMarsaiModels()
    expect(models).toHaveLength(14)
    expect(models.every((model) => model.provider === 'marsai')).toBe(true)
    const deepseek = models.find(
      (model) => model.id === 'marsai/deepseek-v4.1-flash-free',
    )
    expect(deepseek?.contextLength).toBe(1_048_576)
    const autoFree = models.find((model) => model.id === 'marsai/auto-free')
    expect(autoFree?.name).toBe('Auto (Free)')
    expect(autoFree?.contextLength).toBe(200_000)
  })

  test('fallback rows resolve sourced values; no-row ids keep the 200k default', () => {
    expect(CONTEXT_WINDOW_FALLBACKS.get('marsai/north-mini-code:free')).toBe(
      256_000,
    )
    expect(CONTEXT_WINDOW_FALLBACKS.get('marsai/step-5-preview-free')).toBe(
      1_000_000,
    )
    expect(CONTEXT_WINDOW_FALLBACKS.get('marsai/auto-free')).toBeUndefined()
    expect(getContextWindowFallback('marsai/auto-free').contextWindow).toBe(
      200_000,
    )
  })

  test('registry entry keeps the full id and surfaces MARSAI_API_KEY', () => {
    const entry = PROVIDER_REGISTRY.marsai
    expect(entry.setupAvailable).toBe(true)
    expect(entry.credentials.envVar).toBe('MARSAI_API_KEY')
    expect(entry.baseUrl).toBe('https://marsai.click/v1')
    expect(entry.protocol).toBe('openai')
    expect(entry.idTransform).toBe('keep')
  })
})
