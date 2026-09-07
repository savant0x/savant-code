// Openrouter-models test family — the TabiToken / GoRouter / VyceAI gateway
// cluster (FID-2026-0906-008). All three are OpenAI-compatible gateways with
// authenticated `/v1/models` endpoints (live-probed 2026-09-06: TabiToken and
// GoRouter are "New API" instances — `new_api_error` 401 shape; VyceAI is a
// textbook OpenAI `authentication_error` proxy). Sibling of the KiosAPI + Zen
// cluster tests in openrouter-models-gateway-providers.test.ts, sharing the
// family lifecycle in ./openrouter-models-test-harness.

import fs from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, mock, test } from 'bun:test'

import {
  fetchGatewayModels,
  fetchTabitokenModels,
  fetchVyceaiModels,
  hasGorouterCatalog,
  hasTabitokenCatalog,
  hasVyceaiCatalog,
  parseGorouterModelsForTest,
  parseTabitokenModelsForTest,
  parseVyceaiModelsForTest,
} from '../openrouter-models'
import { applyPersistedProviderApiKeys } from '../provider-setup'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('openrouter-models gateway cluster (TabiToken/GoRouter/VyceAI)', () => {
  registerGatewayCatalogLifecycle()

  test('parses TabiToken ids pass-through with one internal prefix', () => {
    const models = parseTabitokenModelsForTest({
      data: [
        { id: 'gpt-4o-mini', name: 'GPT-4o mini', created: 1686935002 },
        { id: 'z-ai/glm-5.3-free' },
        { id: 'claude-sonnet-4-6' },
        { id: 'tabitoken/already-prefixed' },
        { id: '', name: 'invalid' },
        { id: 42 },
      ],
    })

    expect(models.map((model) => model.id)).toEqual([
      'tabitoken/already-prefixed',
      'tabitoken/claude-sonnet-4-6',
      'tabitoken/gpt-4o-mini',
      'tabitoken/z-ai/glm-5.3-free',
    ])
    expect(models.every((model) => model.provider === 'tabitoken')).toBe(true)
    // Free/GLM variants must survive parsing with ids intact (pass-through).
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tabitoken/z-ai/glm-5.3-free' }),
      ]),
    )
    // Unix-seconds `created` normalizes to an ISO string, never drops the entry.
    expect(
      models.find((model) => model.id === 'tabitoken/gpt-4o-mini')?.created,
    ).toBe('2023-06-16T17:03:22.000Z')
  })

  test('parses GoRouter ids pass-through with one internal prefix', () => {
    const models = parseGorouterModelsForTest({
      data: [
        { id: 'gpt-5.5', name: 'GPT 5.5' },
        { id: 'deepseek-v4-flash' },
        { id: 'gorouter/already-prefixed' },
        { id: '', name: 'invalid' },
        { id: 42 },
      ],
    })

    expect(models.map((model) => model.id)).toEqual([
      'gorouter/already-prefixed',
      'gorouter/deepseek-v4-flash',
      'gorouter/gpt-5.5',
    ])
    expect(models.every((model) => model.provider === 'gorouter')).toBe(true)
  })

  test('parses VyceAI ids pass-through with one internal prefix', () => {
    const models = parseVyceaiModelsForTest({
      data: [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
        { id: 'gpt-5.5' },
        { id: 'deepseek-v4-pro' },
        { id: 'vyceai/already-prefixed' },
        { id: '', name: 'invalid' },
        { id: 42 },
      ],
    })

    expect(models.map((model) => model.id)).toEqual([
      'vyceai/already-prefixed',
      'vyceai/claude-sonnet-4-6',
      'vyceai/deepseek-v4-pro',
      'vyceai/gpt-5.5',
    ])
    expect(models.every((model) => model.provider === 'vyceai')).toBe(true)
  })

  test('includes TabiToken models in the combined gateway catalog', async () => {
    const originalTabitokenKey = process.env.TABITOKEN_API_KEY
    process.env.TABITOKEN_API_KEY = 'tabitoken-catalog-test-key'
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes('tabitoken.com')) {
            expect(new Headers(init?.headers).get('authorization')).toBe(
              'Bearer tabitoken-catalog-test-key',
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

      expect(hasTabitokenCatalog()).toBe(true)
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'tabitoken/z-ai/glm-5.3-free',
            provider: 'tabitoken',
          }),
          expect.objectContaining({
            id: 'tabitoken/gpt-4o-mini',
            provider: 'tabitoken',
          }),
        ]),
      )
    } finally {
      if (originalTabitokenKey === undefined)
        delete process.env.TABITOKEN_API_KEY
      else process.env.TABITOKEN_API_KEY = originalTabitokenKey
    }
  })

  test('uses a persisted VyceAI key for authenticated catalog refresh', async () => {
    const originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    const originalVyceaiKey = process.env.VYCEAI_API_KEY
    const originalDirectProvider = process.env.DIRECT_PROVIDER
    const originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'savant-vyceai-catalog-'),
    )
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    delete process.env.VYCEAI_API_KEY
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { VYCEAI_API_KEY: 'stored-vyceai-key' },
      }),
    )

    try {
      applyPersistedProviderApiKeys()
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          expect(String(input)).toContain('vyceai.com/v1/models')
          expect(new Headers(init?.headers).get('authorization')).toBe(
            'Bearer stored-vyceai-key',
          )
          return Promise.resolve(
            makeJsonResponse({ data: [{ id: 'stored-model' }] }),
          )
        },
      )

      const models = await fetchVyceaiModels(true)
      expect(models.map((model) => model.id)).toEqual(['vyceai/stored-model'])
    } finally {
      if (originalConfigDir === undefined)
        delete process.env.SAVANT_CODE_CONFIG_DIR
      else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
      if (originalVyceaiKey === undefined) delete process.env.VYCEAI_API_KEY
      else process.env.VYCEAI_API_KEY = originalVyceaiKey
      if (originalDirectProvider === undefined)
        delete process.env.DIRECT_PROVIDER
      else process.env.DIRECT_PROVIDER = originalDirectProvider
      if (originalInferenceBaseUrl === undefined)
        delete process.env.INFERENCE_BASE_URL
      else process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('isolates GoRouter catalog failure while retaining other gateway models', async () => {
    const originalGorouterKey = process.env.GOROUTER_API_KEY
    process.env.GOROUTER_API_KEY = 'gorouter-catalog-test-key'
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('gorouter.app')) {
          // The live-probed New API auth failure shape.
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

      expect(hasGorouterCatalog()).toBe(false)
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'openai/kept' }),
          expect.objectContaining({ id: 'tokenharbor/th-orchestra' }),
        ]),
      )
      expect(models.some((model) => model.id.startsWith('gorouter/'))).toBe(
        false,
      )
    } finally {
      if (originalGorouterKey === undefined) delete process.env.GOROUTER_API_KEY
      else process.env.GOROUTER_API_KEY = originalGorouterKey
    }
  })
})
