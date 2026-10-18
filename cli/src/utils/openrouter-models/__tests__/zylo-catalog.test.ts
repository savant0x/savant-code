import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { assembleGatewayCatalog } from '../gateway-catalog-merge'
import { resolveGatewayLiveCatalogs } from '../gateway-live-results'
import {
  __resetZyloCacheForTest,
  fetchZyloModels,
  getCachedZyloModels,
  parseZyloModelsForTest,
} from '../zylo'

import type { OpenRouterModel } from '../types'

const TEXT_ROW = {
  id: 'vendor/Exact-Text:variant',
  name: 'Exact Text',
  description: 'A text model',
  context_window: 131072,
  capabilities: ['reasoning'],
  pricing: { prompt: '0', completion: '0.000002' },
  min_plan: 'BASIC',
}
const response = {
  text: [TEXT_ROW],
  image: [{ id: 'image-only' }],
  submodels: [{ id: 'custom-submodel' }],
}
const realFetch = globalThis.fetch
const fulfilled = (value: OpenRouterModel[]) =>
  ({ status: 'fulfilled', value }) as const
let configDir: string
let originalConfigDir: string | undefined
let originalKey: string | undefined

beforeEach(() => {
  originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
  originalKey = process.env.ZYLO_API_KEY
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-zylo-catalog-'))
  process.env.SAVANT_CODE_CONFIG_DIR = configDir
  delete process.env.ZYLO_API_KEY
  __resetZyloCacheForTest()
})

afterEach(() => {
  globalThis.fetch = realFetch
  __resetZyloCacheForTest()
  if (originalKey === undefined) delete process.env.ZYLO_API_KEY
  else process.env.ZYLO_API_KEY = originalKey
  if (originalConfigDir === undefined) delete process.env.SAVANT_CODE_CONFIG_DIR
  else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
  fs.rmSync(configDir, { recursive: true, force: true })
})

describe('Zylo AI text catalog contract', () => {
  test('keeps sparse-capability text rows and excludes other catalog arrays', () => {
    expect(parseZyloModelsForTest(response)).toEqual([
      {
        id: 'zylo/vendor/Exact-Text:variant',
        name: 'Exact Text',
        description: 'A text model',
        contextLength: 131072,
        promptPricePerToken: 0,
        completionPricePerToken: 0.000002,
        capabilities: ['reasoning'],
        accessTier: 'BASIC',
        provider: 'zylo',
      },
    ])
    const [minimal] = parseZyloModelsForTest({ text: [{ id: 'plain' }] })
    expect(minimal.name).toBe('plain')
    expect(minimal.maxCompletionTokens).toBeUndefined()
    expect(minimal.capabilities).toBeUndefined()
  })

  test('rejects malformed rows and never fabricates limits or prices', () => {
    for (const value of [null, [], {}, { text: 'bad' }, { data: [TEXT_ROW] }]) {
      expect(parseZyloModelsForTest(value)).toEqual([])
    }
    expect(parseZyloModelsForTest({ text: [null, 7, {}, { id: '' }] })).toEqual(
      [],
    )
    for (const limit of [0, -1, NaN, Infinity, null, '100']) {
      const [row] = parseZyloModelsForTest({
        text: [
          {
            id: 'unknown',
            context_window: limit,
            pricing: { prompt: '', completion: -1 },
            capabilities: [7, 'chat', ''],
          },
        ],
      })
      expect(row.contextLength).toBeUndefined()
      expect(row.promptPricePerToken).toBeUndefined()
      expect(row.completionPricePerToken).toBeUndefined()
      expect(row.capabilities).toEqual(['chat'])
    }
  })

  test('public fetch is keyless, omits configured credentials, caches and degrades', async () => {
    const auth: Array<string | null> = []
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('https://api.zyloai.net/v1/models')
        auth.push(new Headers(init?.headers).get('authorization'))
        return auth.length < 3
          ? Response.json(response)
          : new Response('', { status: 503 })
      },
      { preconnect: realFetch.preconnect },
    )
    const models = await fetchZyloModels()
    expect(models.map((model) => model.id)).toEqual([
      'zylo/vendor/Exact-Text:variant',
    ])
    expect(await fetchZyloModels()).toEqual(models)
    expect(auth).toEqual([null])
    fs.writeFileSync(
      path.join(configDir, 'credentials.json'),
      JSON.stringify({ providerApiKeys: { ZYLO_API_KEY: 'stored-zylo-key' } }),
    )
    process.env.ZYLO_API_KEY = 'env-zylo-key'
    expect(await fetchZyloModels(true)).toEqual(models)
    expect(auth[1]).toBeNull()
    expect(await fetchZyloModels(true)).toEqual(models)
    expect(getCachedZyloModels()).toEqual(models)
    __resetZyloCacheForTest()
    expect(getCachedZyloModels()).toEqual([])
    expect(await fetchZyloModels()).toEqual([])
    expect(auth).toEqual([null, null, null, null])
  })

  test('registry, coverage and exception ownership accompany the live parser', () => {
    expect(PROVIDER_REGISTRY.zylo.credentials.envVar).toBe('ZYLO_API_KEY')
    expect(PROVIDER_REGISTRY.zylo.idTransform).toBe('strip')
    expect(PROVIDER_REGISTRY.zylo.protocol).toBe('openai')
    expect(WINDOW_COVERAGE_REGISTER.get('zylo')?.disposition).toBe(
      'runtime-published',
    )
    expect(
      PROVIDER_EXCEPTION_MANIFEST.find((entry) => entry.providerId === 'zylo'),
    ).toEqual(
      expect.objectContaining({
        kinds: ['live-catalog'],
        owner: 'cli/src/utils/openrouter-models/zylo.ts',
      }),
    )
  })

  test('Zylo slot 18 merges before custom slot 19 and rejects to its own cache', async () => {
    process.env.ZYLO_API_KEY = 'catalog-test-key'
    globalThis.fetch = Object.assign(async () => Response.json(response), {
      preconnect: realFetch.preconnect,
    })
    const models = await fetchZyloModels()
    const custom = { id: 'custom/model', name: 'Custom', provider: 'custom' }
    const rest = Array.from({ length: 20 }, () => fulfilled([]))
    rest[18] = fulfilled(models)
    rest[19] = fulfilled([custom])
    const live = resolveGatewayLiveCatalogs(fulfilled([]), fulfilled([]), rest)
    expect(live.zyloModels).toEqual(models)
    expect(live.customModels).toEqual([custom])
    expect(assembleGatewayCatalog(live)).toContainEqual(models[0])
    const rejected = rest.map((entry, index) =>
      index === 18 ? { status: 'rejected' as const, reason: 'offline' } : entry,
    )
    expect(
      resolveGatewayLiveCatalogs(fulfilled([]), fulfilled([]), rejected)
        .zyloModels,
    ).toEqual(models)
  })
})
