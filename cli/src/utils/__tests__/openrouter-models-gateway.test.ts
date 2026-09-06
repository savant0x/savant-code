// Openrouter-models test family — combined gateway catalog (Nous,
// TokenHarbor, CommandCode). Sibling of the Loop-338 decomposition (shared
// lifecycle in ./openrouter-models-test-harness). The KiosAPI + Zen
// provider-cluster tests live in openrouter-models-gateway-providers.test.ts
// (FID-2026-0905-006 ceiling split).

import fs from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, mock, test } from 'bun:test'

import {
  fetchCommandCodeModels,
  fetchGatewayModels,
  fetchNousModels,
  getTokenHarborModels,
  hasNousCatalog,
  parseKiosapiModelsForTest,
  parseNousModelsForTest,
} from '../openrouter-models'
import { applyPersistedProviderApiKeys } from '../provider-setup'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('openrouter-models', () => {
  registerGatewayCatalogLifecycle()

  test('parses Nous ids with one internal prefix and preserves nested ids', () => {
    const models = parseNousModelsForTest({
      data: [
        { id: 'hermes-4-70b', name: 'Hermes 4 70B' },
        { id: 'anthropic/claude-sonnet-4.6' },
        { id: 'nous/already-prefixed' },
        { id: '', name: 'invalid' },
        { id: 42 },
      ],
    })

    expect(models.map((model) => model.id)).toEqual([
      'nous/already-prefixed',
      'nous/anthropic/claude-sonnet-4.6',
      'nous/hermes-4-70b',
    ])
    expect(models.every((model) => model.provider === 'nous')).toBe(true)
  })

  test('parses KiosAPI ids pass-through with one internal prefix (GLM preserved)', () => {
    const models = parseKiosapiModelsForTest({
      data: [
        { id: 'gpt-4o-mini', name: 'GPT-4o mini', created: 1686935002 },
        { id: 'z-ai/glm-5.3-free' },
        { id: 'claude-sonnet-4-6' },
        { id: 'kiosapi/already-prefixed' },
        { id: '', name: 'invalid' },
        { id: 42 },
      ],
    })

    expect(models.map((model) => model.id)).toEqual([
      'kiosapi/already-prefixed',
      'kiosapi/claude-sonnet-4-6',
      'kiosapi/gpt-4o-mini',
      'kiosapi/z-ai/glm-5.3-free',
    ])
    expect(models.every((model) => model.provider === 'kiosapi')).toBe(true)
    // GLM-5.3-free hard requirement (FID-2026-0905-002 K8-F): the free variant
    // must survive parsing with its id intact.
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'kiosapi/z-ai/glm-5.3-free' }),
      ]),
    )
    // Unix-seconds `created` normalizes to an ISO string, never drops the entry.
    expect(
      models.find((model) => model.id === 'kiosapi/gpt-4o-mini')?.created,
    ).toBe('2023-06-16T17:03:22.000Z')
  })

  test('builds the static TokenHarbor baseline catalog without network access', () => {
    const models = getTokenHarborModels()

    const expectedModelIds = [
      'tokenharbor/claude-opus-5',
      'tokenharbor/claude-fable-5',
      'tokenharbor/gpt-5.6-sol',
      'tokenharbor/kimi-k3',
      'tokenharbor/qwen3.8-max',
      'tokenharbor/gpt-5.6-terra',
      'tokenharbor/grok-4.5',
      'tokenharbor/claude-sonnet-5',
      'tokenharbor/gemini-3.6-flash',
      'tokenharbor/glm-5.2',
      'tokenharbor/gpt-5.6-luna',
      'tokenharbor/deepseek-v4-flash',
      'tokenharbor/minimax-m3',
      'tokenharbor/deepseek-v4-pro',
      'tokenharbor/mimo-v2.5-pro',
      'tokenharbor/mimo-v2.5',
      'tokenharbor/kimi-k3:free',
      'tokenharbor/deepseek-v4-flash:free',
      'tokenharbor/mimo-v2.5:free',
      'tokenharbor/th-orchestra',
    ]

    expect(models.map((model) => model.id)).toEqual(expectedModelIds)
    expect(models.every((model) => model.provider === 'tokenharbor')).toBe(true)
  })

  test('builds the CommandCode catalog from shared model definitions', () => {
    const models = fetchCommandCodeModels()

    expect(models.length).toBeGreaterThan(0)
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'commandcode/deepseek/deepseek-v4-pro',
          provider: 'commandcode',
        }),
        expect.objectContaining({
          id: 'commandcode/claude-sonnet-4.6',
          provider: 'commandcode',
        }),
      ]),
    )
    expect(models.every((model) => model.contextLength !== undefined)).toBe(
      true,
    )
  })

  test('includes Nous models in the combined gateway catalog', async () => {
    const originalNousKey = process.env.NOUS_API_KEY
    process.env.NOUS_API_KEY = 'nous-catalog-test-key'
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes('nousresearch.com')) {
            expect(new Headers(init?.headers).get('authorization')).toBe(
              'Bearer nous-catalog-test-key',
            )
            return Promise.resolve(
              makeJsonResponse({ data: [{ id: 'hermes-4-70b' }] }),
            )
          }
          return Promise.resolve(makeJsonResponse({ data: [] }))
        },
      )

      const models = await fetchGatewayModels(true)

      expect(hasNousCatalog()).toBe(true)
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'nous/hermes-4-70b',
            provider: 'nous',
          }),
        ]),
      )
    } finally {
      if (originalNousKey === undefined) delete process.env.NOUS_API_KEY
      else process.env.NOUS_API_KEY = originalNousKey
    }
  })

  test('uses a persisted Nous key for authenticated catalog refresh', async () => {
    const originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    const originalNousKey = process.env.NOUS_API_KEY
    const originalDirectProvider = process.env.DIRECT_PROVIDER
    const originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'savant-nous-catalog-'),
    )
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    delete process.env.NOUS_API_KEY
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({ providerApiKeys: { NOUS_API_KEY: 'stored-nous-key' } }),
    )

    try {
      applyPersistedProviderApiKeys()
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          expect(String(input)).toContain('inference-api.nousresearch.com')
          expect(new Headers(init?.headers).get('authorization')).toBe(
            'Bearer stored-nous-key',
          )
          return Promise.resolve(
            makeJsonResponse({ data: [{ id: 'stored-model' }] }),
          )
        },
      )

      const models = await fetchNousModels(true)
      expect(models.map((model) => model.id)).toEqual(['nous/stored-model'])
    } finally {
      if (originalConfigDir === undefined)
        delete process.env.SAVANT_CODE_CONFIG_DIR
      else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
      if (originalNousKey === undefined) delete process.env.NOUS_API_KEY
      else process.env.NOUS_API_KEY = originalNousKey
      if (originalDirectProvider === undefined)
        delete process.env.DIRECT_PROVIDER
      else process.env.DIRECT_PROVIDER = originalDirectProvider
      if (originalInferenceBaseUrl === undefined)
        delete process.env.INFERENCE_BASE_URL
      else process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('isolates Nous catalog failure while retaining other gateway models', async () => {
    process.env.NOUS_API_KEY = 'nous-catalog-test-key'
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('nousresearch.com')) {
        return Promise.resolve(new Response('unauthorized', { status: 401 }))
      }
      if (url.includes('openrouter.ai')) {
        return Promise.resolve(
          makeJsonResponse({ data: [{ id: 'openai/kept' }] }),
        )
      }
      return Promise.resolve(makeJsonResponse({ data: [] }))
    })

    const models = await fetchGatewayModels(true)

    expect(hasNousCatalog()).toBe(false)
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'openai/kept' }),
        expect.objectContaining({ id: 'tokenharbor/th-orchestra' }),
      ]),
    )
    expect(models.some((model) => model.id.startsWith('nous/'))).toBe(false)
  })

  test('includes TokenHarbor models in the combined gateway catalog', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(makeJsonResponse({ data: [] })),
    )

    const models = await fetchGatewayModels(true)

    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'tokenharbor/th-orchestra',
          provider: 'tokenharbor',
        }),
      ]),
    )
  })

  test('includes CommandCode models in the combined gateway catalog', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(makeJsonResponse({ data: [] })),
    )

    const models = await fetchGatewayModels(true)

    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'commandcode/deepseek/deepseek-v4-pro',
          provider: 'commandcode',
        }),
      ]),
    )
  })
})
