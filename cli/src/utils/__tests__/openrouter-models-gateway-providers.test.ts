// Openrouter-models test family — provider-cluster catalogs (KiosAPI). Split from
// openrouter-models-gateway.test.ts (FID-2026-0905-006 ceiling split; verbatim
// moves), sharing the family lifecycle in ./openrouter-models-test-harness.
// (The FID-2026-0906-008 gateway cluster was removed by operator direction —
// see that FID's Resolution for the live-test findings.)

import fs from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, mock, test } from 'bun:test'

import {
  fetchGatewayModels,
  fetchKiosapiModels,
  hasKiosapiCatalog,
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
})
