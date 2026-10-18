import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { RIVER_CONTEXT_WINDOW_FALLBACKS } from '@savant-code/common/constants/context-window-table-river'
import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { resolveGatewayLiveCatalogs } from '../gateway-live-results'
import {
  __resetRiverCacheForTest,
  fetchRiverModels,
  getCachedRiverModels,
  parseRiverModelsForTest,
} from '../river'

import type { OpenRouterModel } from '../types'

const fulfilled = (value: OpenRouterModel[]) =>
  ({ status: 'fulfilled', value }) as const
const realFetch = globalThis.fetch
let configDir: string
let originalConfigDir: string | undefined
let originalKey: string | undefined

beforeEach(() => {
  originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
  originalKey = process.env.RIVER_AI_API_KEY
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-river-catalog-'))
  process.env.SAVANT_CODE_CONFIG_DIR = configDir
  delete process.env.RIVER_AI_API_KEY
  __resetRiverCacheForTest()
})

afterEach(() => {
  globalThis.fetch = realFetch
  __resetRiverCacheForTest()
  if (originalKey === undefined) delete process.env.RIVER_AI_API_KEY
  else process.env.RIVER_AI_API_KEY = originalKey
  if (originalConfigDir === undefined) delete process.env.SAVANT_CODE_CONFIG_DIR
  else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
  fs.rmSync(configDir, { recursive: true, force: true })
})

describe('FID-2026-1017-015: River AI provider', () => {
  test('registry uses the operator key and authenticated OpenAI catalog', () => {
    expect(PROVIDER_REGISTRY.river).toEqual({
      id: 'river',
      label: 'River AI',
      kind: 'gateway',
      credentials: { envVar: 'RIVER_AI_API_KEY' },
      baseUrl: 'https://api.river.ai/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'live', url: 'https://api.river.ai/v1/models' },
      setupAvailable: true,
      domain: 'river.ai',
      order: 4,
    })
  })

  test('parser preserves the complete upstream id and does not invent window metadata', () => {
    const models = parseRiverModelsForTest({
      data: [
        { id: 'zai-org/GLM-5.3-Flash', object: 'model' },
        { id: 'deepseek-ai/DeepSeek-V4.1-Flash', object: 'model' },
        {
          id: 'nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4',
          object: 'model',
        },
      ],
    })
    expect(models.map(({ id }) => id)).toEqual([
      'river/deepseek-ai/DeepSeek-V4.1-Flash',
      'river/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4',
      'river/zai-org/GLM-5.3-Flash',
    ])
    expect(models.every((model) => model.provider === 'river')).toBe(true)
    expect(models.every((model) => model.contextLength === undefined)).toBe(
      true,
    )
  })

  test('all documented River windows are exact fallback rows', () => {
    const fallbacks = new Map(RIVER_CONTEXT_WINDOW_FALLBACKS)
    expect(fallbacks.size).toBe(3)
    expect(fallbacks.get('river/deepseek-ai/DeepSeek-V4.1-Flash')).toBe(
      1_048_576,
    )
    expect(
      fallbacks.get(
        'river/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4',
      ),
    ).toBe(1_048_576)
    expect(fallbacks.get('river/zai-org/GLM-5.3-Flash')).toBe(1_048_576)
    expect(WINDOW_COVERAGE_REGISTER.get('river')?.disposition).toBe(
      'table-section',
    )
  })

  test('malformed envelopes and rows degrade without fabricating metadata', () => {
    for (const value of [
      null,
      [],
      {},
      { data: null },
      { data: 'invalid' },
      { data: [null, [], 42, {}, { id: null }, { id: 7 }, { id: '' }] },
    ]) {
      expect(parseRiverModelsForTest(value)).toEqual([])
    }
    const models = parseRiverModelsForTest({
      data: [
        null,
        { id: 'vendor/Exact-Model:free', name: '', created: Infinity },
        { id: 'named', name: 'Published name', created: 1790773175 },
      ],
    })
    expect(models).toHaveLength(2)
    expect(
      models.find((row) => row.id === 'river/vendor/Exact-Model:free'),
    ).toEqual({
      id: 'river/vendor/Exact-Model:free',
      name: 'vendor/Exact-Model:free',
      created: undefined,
      provider: 'river',
    })
    expect(models.find((row) => row.id === 'river/named')?.created).toBe(
      new Date(1790773175 * 1000).toISOString(),
    )
    expect(models.every((row) => row.maxCompletionTokens === undefined)).toBe(
      true,
    )
  })

  test('authenticated fetch uses stored keys, prefers env, and degrades to cache until reset', async () => {
    fs.writeFileSync(
      path.join(configDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { RIVER_AI_API_KEY: 'stored-river-key' },
      }),
    )
    const auth: Array<string | null> = []
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('https://api.river.ai/v1/models')
        auth.push(new Headers(init?.headers).get('authorization'))
        return auth.length < 3
          ? Response.json({ data: [{ id: 'vendor/exact-model' }] })
          : new Response('', { status: 503 })
      },
      { preconnect: realFetch.preconnect },
    )
    const models = await fetchRiverModels()
    expect(models.map((row) => row.id)).toEqual(['river/vendor/exact-model'])
    expect(await fetchRiverModels()).toEqual(models)
    expect(auth).toEqual(['Bearer stored-river-key'])
    process.env.RIVER_AI_API_KEY = 'env-river-key'
    expect(await fetchRiverModels(true)).toEqual(models)
    expect(auth[1]).toBe('Bearer env-river-key')
    expect(await fetchRiverModels(true)).toEqual(models)
    expect(getCachedRiverModels()).toEqual(models)
    __resetRiverCacheForTest()
    expect(getCachedRiverModels()).toEqual([])
    expect(await fetchRiverModels()).toEqual([])
  })

  test('live-catalog exception is owned and River occupies its settled slot', () => {
    const manifest = PROVIDER_EXCEPTION_MANIFEST.find(
      (entry) => entry.providerId === 'river',
    )
    expect(manifest?.kinds).toEqual(['live-catalog'])
    expect(manifest?.owner).toBe('cli/src/utils/openrouter-models/river.ts')

    const row: OpenRouterModel = {
      id: 'river/model',
      name: 'model',
      provider: 'river',
    }
    const restResults = Array.from({ length: 20 }, () => fulfilled([]))
    restResults[17] = fulfilled([row])
    const resolved = resolveGatewayLiveCatalogs(
      fulfilled([]),
      fulfilled([]),
      restResults,
    )
    expect(resolved.riverModels).toEqual([row])
    expect(resolved.customModels).toEqual([])
  })
})
