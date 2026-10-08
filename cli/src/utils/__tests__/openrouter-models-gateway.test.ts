// Openrouter-models test family — the Nous/KiosAPI parsers, the static
// TokenHarbor/CommandCode builders, and the empty-catalog fallback. Sibling of
// the Loop-338 decomposition (shared lifecycle in
// ./openrouter-models-test-harness). Two ceiling splits have moved out of this
// file: the provider-cluster catalogs and the combined-catalog membership pins
// (FID-2026-0905-006) live in openrouter-models-gateway-providers.test.ts, and
// the shared-cache publish contract (FID-2026-1007-006) lives in
// openrouter-models-gateway-cache.test.ts.

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
        { model_name: 'gpt-4o-mini', description: 'GPT-4o mini' },
        { model_name: 'z-ai/glm-5.3-free' },
        { model_name: 'claude-sonnet-4-6' },
        { model_name: 'kiosapi/already-prefixed' },
        { model_name: '', description: 'invalid' },
        { model_name: 42 },
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
  })

  test('kiosapi nested architecture fields stay unmapped (T96-followup probe 2026-09-28)', () => {
    const models = parseKiosapiModelsForTest({
      data: [
        {
          model_name: 'z-ai/glm-5.3-free',
          architecture: { modality: 'text->text', tokenizer: 'Other' },
          modality: 'text->text',
        } as Record<string, unknown>,
      ],
    })
    expect(models[0]?.modality).toBeUndefined()
    expect(models[0]?.tokenizer).toBeUndefined()
    expect(models[0]?.instructType).toBeUndefined()
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
      'tokenharbor/glm-5.2',
      'tokenharbor/gpt-5.6-luna',
      'tokenharbor/deepseek-v4-flash',
      'tokenharbor/deepseek-v4-pro',
      'tokenharbor/mimo-v2.5-pro',
      'tokenharbor/mimo-v2.5',
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
          id: 'commandcode/claude-sonnet-4-6',
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
})
