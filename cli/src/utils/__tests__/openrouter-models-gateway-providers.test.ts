// Openrouter-models test family — provider-cluster catalogs (KiosAPI,
// OpenCode Zen). Split from openrouter-models-gateway.test.ts
// (FID-2026-0905-006 ceiling split; verbatim moves). Shares the family
// lifecycle in ./openrouter-models-test-harness.

import fs from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, mock, test } from 'bun:test'

import {
  fetchGatewayModels,
  fetchKiosapiModels,
  fetchZenModels,
  getCachedZenModels,
  hasKiosapiCatalog,
  hasZenCatalog,
  parseZenModelsForTest,
} from '../openrouter-models'
import { applyPersistedProviderApiKeys } from '../provider-setup'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('openrouter-models provider clusters', () => {
  registerGatewayCatalogLifecycle()

  test('includes KiosAPI models in the combined gateway catalog', async () => {
    const originalKiosapiKey = process.env.KIOSAPI_API_KEY
    process.env.KIOSAPI_API_KEY = 'kiosapi-catalog-test-key'
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes('kiosapi.com')) {
            expect(new Headers(init?.headers).get('authorization')).toBe(
              'Bearer kiosapi-catalog-test-key',
            )
            return Promise.resolve(
              makeJsonResponse({
                data: [{ id: 'z-ai/glm-5.3-free' }, { id: 'gpt-4o-mini' }],
              }),
            )
          }
          return Promise.resolve(makeJsonResponse({ data: [] }))
        },
      )

      const models = await fetchGatewayModels(true)

      expect(hasKiosapiCatalog()).toBe(true)
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'kiosapi/z-ai/glm-5.3-free',
            provider: 'kiosapi',
          }),
          expect.objectContaining({
            id: 'kiosapi/gpt-4o-mini',
            provider: 'kiosapi',
          }),
        ]),
      )
    } finally {
      if (originalKiosapiKey === undefined) delete process.env.KIOSAPI_API_KEY
      else process.env.KIOSAPI_API_KEY = originalKiosapiKey
    }
  })

  test('uses a persisted KiosAPI key for authenticated catalog refresh', async () => {
    const originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    const originalKiosapiKey = process.env.KIOSAPI_API_KEY
    const originalDirectProvider = process.env.DIRECT_PROVIDER
    const originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'savant-kiosapi-catalog-'),
    )
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    delete process.env.KIOSAPI_API_KEY
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { KIOSAPI_API_KEY: 'stored-kiosapi-key' },
      }),
    )

    try {
      applyPersistedProviderApiKeys()
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          expect(String(input)).toContain('kiosapi.com/v1/models')
          expect(new Headers(init?.headers).get('authorization')).toBe(
            'Bearer stored-kiosapi-key',
          )
          return Promise.resolve(
            makeJsonResponse({ data: [{ id: 'stored-model' }] }),
          )
        },
      )

      const models = await fetchKiosapiModels(true)
      expect(models.map((model) => model.id)).toEqual(['kiosapi/stored-model'])
    } finally {
      if (originalConfigDir === undefined)
        delete process.env.SAVANT_CODE_CONFIG_DIR
      else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
      if (originalKiosapiKey === undefined) delete process.env.KIOSAPI_API_KEY
      else process.env.KIOSAPI_API_KEY = originalKiosapiKey
      if (originalDirectProvider === undefined)
        delete process.env.DIRECT_PROVIDER
      else process.env.DIRECT_PROVIDER = originalDirectProvider
      if (originalInferenceBaseUrl === undefined)
        delete process.env.INFERENCE_BASE_URL
      else process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('isolates KiosAPI catalog failure while retaining other gateway models', async () => {
    const originalKiosapiKey = process.env.KIOSAPI_API_KEY
    process.env.KIOSAPI_API_KEY = 'kiosapi-catalog-test-key'
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('kiosapi.com')) {
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

      expect(hasKiosapiCatalog()).toBe(false)
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'openai/kept' }),
          expect.objectContaining({ id: 'tokenharbor/th-orchestra' }),
        ]),
      )
      expect(models.some((model) => model.id.startsWith('kiosapi/'))).toBe(
        false,
      )
    } finally {
      if (originalKiosapiKey === undefined) delete process.env.KIOSAPI_API_KEY
      else process.env.KIOSAPI_API_KEY = originalKiosapiKey
    }
  })

  test('parses Zen ids pass-through with one internal prefix (GLM + free preserved)', () => {
    const models = parseZenModelsForTest({
      data: [
        { id: 'gpt-5.5', name: 'GPT 5.5', created: 1762047082 },
        { id: 'glm-5.3' },
        { id: 'mimo-v2.5-free' },
        { id: 'claude-sonnet-4-6' },
        { id: 'opencode-zen/already-prefixed' },
        { id: '', name: 'invalid' },
        { id: 42 },
      ],
    })

    expect(models.map((model) => model.id)).toEqual([
      'opencode-zen/already-prefixed',
      'opencode-zen/claude-sonnet-4-6',
      'opencode-zen/glm-5.3',
      'opencode-zen/gpt-5.5',
      'opencode-zen/mimo-v2.5-free',
    ])
    expect(models.every((model) => model.provider === 'opencode-zen')).toBe(
      true,
    )
    // Zen GLM + free variants must survive parsing with ids intact.
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'opencode-zen/glm-5.3' }),
        expect.objectContaining({ id: 'opencode-zen/mimo-v2.5-free' }),
      ]),
    )
  })

  test('includes Zen models in the combined gateway catalog without a key', async () => {
    const originalZenKey = process.env.OPENCODE_API_KEY
    delete process.env.OPENCODE_API_KEY
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes('opencode.ai/zen/v1/models')) {
            // Public endpoint: no Authorization header is sent.
            expect(new Headers(init?.headers).get('authorization')).toBeNull()
            return Promise.resolve(
              makeJsonResponse({
                data: [{ id: 'glm-5.3' }, { id: 'mimo-v2.5-free' }],
              }),
            )
          }
          return Promise.resolve(makeJsonResponse({ data: [] }))
        },
      )

      const models = await fetchGatewayModels(true)

      expect(hasZenCatalog()).toBe(true)
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'opencode-zen/glm-5.3',
            provider: 'opencode-zen',
          }),
          expect.objectContaining({
            id: 'opencode-zen/mimo-v2.5-free',
            provider: 'opencode-zen',
          }),
        ]),
      )
      expect(getCachedZenModels().length).toBeGreaterThan(0)
    } finally {
      if (originalZenKey === undefined) delete process.env.OPENCODE_API_KEY
      else process.env.OPENCODE_API_KEY = originalZenKey
    }
  })

  test('isolates Zen catalog failure while retaining other gateway models', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('opencode.ai/zen')) {
        return Promise.resolve(new Response('error', { status: 500 }))
      }
      if (url.includes('openrouter.ai')) {
        return Promise.resolve(
          makeJsonResponse({ data: [{ id: 'openai/kept' }] }),
        )
      }
      return Promise.resolve(makeJsonResponse({ data: [] }))
    })

    const models = await fetchGatewayModels(true)

    expect(hasZenCatalog()).toBe(false)
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'openai/kept' }),
        expect.objectContaining({ id: 'tokenharbor/th-orchestra' }),
      ]),
    )
    expect(models.some((model) => model.id.startsWith('opencode-zen/'))).toBe(
      false,
    )
  })

  test('fetches the Zen catalog directly without credentials', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(makeJsonResponse({ data: [{ id: 'kimi-k3' }] })),
    )

    const models = await fetchZenModels(true)
    expect(models.map((model) => model.id)).toEqual(['opencode-zen/kimi-k3'])
  })
})
