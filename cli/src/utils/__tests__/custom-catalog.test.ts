// Custom-provider catalog fetcher + degradation ladder + picker merge pins
// (FID-2026-0910-004 Step 9 remainder, D10 + D9). RED-first against the
// not-yet-existing custom-catalog module; the gateway merge + grouping pins
// document the degradation ladder (live fail -> empty; free-text /model still
// routes) and the effective-registry order read for D9 grouping.
import {
  registerCustomProviders,
  resetCustomProviders,
} from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  buildGroupedItems,
  getProviderOrder,
} from '../../components/model-picker-grouping'
import { fetchGatewayModels } from '../openrouter-models'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'
import {
  __resetCustomCatalogsForTest,
  fetchCustomModels,
} from '../openrouter-models/custom-catalog'

const LIVE_CUSTOM = {
  id: 'my-gateway',
  label: 'My Gateway',
  baseUrl: 'https://gw.example.com/v1',
  apiKeyEnvVar: 'MY_GW_KEY',
  catalog: {
    source: 'live' as const,
    url: 'https://gw.example.com/v1/models',
  },
}

const INLINE_CUSTOM = {
  id: 'my-inline',
  label: 'My Inline',
  baseUrl: 'https://inline.example.com/v1',
  apiKeyEnvVar: 'MY_INLINE_KEY',
  catalog: {
    source: 'inline' as const,
    models: { 'my-inline/m1': 'M One', 'my-inline/m2': 'M Two' },
  },
}

const NONE_CUSTOM = {
  id: 'my-none',
  label: 'My None',
  baseUrl: 'https://none.example.com/v1',
  apiKeyEnvVar: 'MY_NONE_KEY',
  catalog: { source: 'none' as const },
}

describe('custom provider catalogs (Step 9 remainder)', () => {
  registerGatewayCatalogLifecycle()

  beforeEach(() => {
    __resetCustomCatalogsForTest()
  })

  afterEach(() => {
    resetCustomProviders()
    __resetCustomCatalogsForTest()
  })

  test('synthesizes inline catalogs without any network call', async () => {
    registerCustomProviders([INLINE_CUSTOM])
    // Any network attempt fails the test: inline must be pure synthesis.
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() => {
      throw new Error('inline catalogs must not hit the network')
    })

    const models = await fetchCustomModels('my-inline')
    expect(models.map((m) => ({ id: m.id, name: m.name }))).toEqual([
      { id: 'my-inline/m1', name: 'M One' },
      { id: 'my-inline/m2', name: 'M Two' },
    ])
    expect(models.every((m) => m.provider === 'my-inline')).toBe(true)
  })

  test('parses live catalogs with the provider prefix (already-prefixed kept)', async () => {
    registerCustomProviders([LIVE_CUSTOM])
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      if (String(input).includes('gw.example.com')) {
        return Promise.resolve(
          makeJsonResponse({
            data: [
              { id: 'model-a', name: 'Model A' },
              { id: 'my-gateway/already', name: 'Already' },
            ],
          }),
        )
      }
      return Promise.resolve(makeJsonResponse({ data: [] }))
    })

    const models = await fetchCustomModels('my-gateway')
    expect(models.map((m) => m.id)).toEqual([
      'my-gateway/already',
      'my-gateway/model-a',
    ])
    expect(models.every((m) => m.provider === 'my-gateway')).toBe(true)
    expect(models.find((m) => m.id === 'my-gateway/model-a')?.name).toBe(
      'Model A',
    )
  })

  test('drops malformed live-catalog entries fail-closed', async () => {
    registerCustomProviders([LIVE_CUSTOM])
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [{ id: 'ok-one' }, { id: '' }, { id: 42 }, {}, { name: 'x' }],
        }),
      ),
    )

    const models = await fetchCustomModels('my-gateway')
    expect(models.map((m) => m.id)).toEqual(['my-gateway/ok-one'])
  })

  test('returns [] for none-catalog, unknown, and built-in ids (fail-closed)', async () => {
    registerCustomProviders([NONE_CUSTOM])
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() => {
      throw new Error('none/unknown/built-in ids must not hit the network')
    })

    expect(await fetchCustomModels('my-none')).toEqual([])
    expect(await fetchCustomModels('does-not-exist')).toEqual([])
    expect(await fetchCustomModels('openrouter')).toEqual([])
  })

  test('sends the stored key for the custom env var; no header without one', async () => {
    const originalKey = process.env.MY_GW_KEY
    process.env.MY_GW_KEY = 'gw-catalog-key'
    try {
      registerCustomProviders([LIVE_CUSTOM])
      const seenAuth: Array<string | null> = []
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          if (String(input).includes('gw.example.com')) {
            seenAuth.push(
              new Headers(init?.headers).get('authorization') ?? null,
            )
            return Promise.resolve(makeJsonResponse({ data: [] }))
          }
          return Promise.resolve(makeJsonResponse({ data: [] }))
        },
      )

      await fetchCustomModels('my-gateway')
      expect(seenAuth).toEqual(['Bearer gw-catalog-key'])

      // Without a key the request stays public.
      delete process.env.MY_GW_KEY
      __resetCustomCatalogsForTest()
      seenAuth.length = 0
      await fetchCustomModels('my-gateway')
      expect(seenAuth).toEqual([null])
    } finally {
      if (originalKey === undefined) delete process.env.MY_GW_KEY
      else process.env.MY_GW_KEY = originalKey
    }
  })

  test('merges live + inline custom models into the gateway catalog', async () => {
    registerCustomProviders([LIVE_CUSTOM, INLINE_CUSTOM])
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      if (String(input).includes('gw.example.com')) {
        return Promise.resolve(
          makeJsonResponse({ data: [{ id: 'model-a', name: 'Model A' }] }),
        )
      }
      return Promise.resolve(makeJsonResponse({ data: [] }))
    })

    const models = await fetchGatewayModels(true)
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'my-gateway/model-a',
          provider: 'my-gateway',
        }),
        expect.objectContaining({
          id: 'my-inline/m1',
          name: 'M One',
          provider: 'my-inline',
        }),
        expect.objectContaining({
          id: 'my-inline/m2',
          name: 'M Two',
          provider: 'my-inline',
        }),
      ]),
    )
  })

  test('a failed live custom fetch degrades to empty while built-ins survive (D10)', async () => {
    registerCustomProviders([LIVE_CUSTOM])
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      if (String(input).includes('gw.example.com')) {
        return Promise.resolve(new Response('error', { status: 500 }))
      }
      if (String(input).includes('openrouter.ai')) {
        return Promise.resolve(
          makeJsonResponse({ data: [{ id: 'openai/kept' }] }),
        )
      }
      return Promise.resolve(makeJsonResponse({ data: [] }))
    })

    const models = await fetchGatewayModels(true)
    expect(models.some((m) => m.id.startsWith('my-gateway/'))).toBe(false)
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'openai/kept' }),
        expect.objectContaining({ id: 'tokenharbor/th-orchestra' }),
      ]),
    )
  })

  test('groups custom providers after every built-in (D9 order 5, effective registry)', () => {
    registerCustomProviders([LIVE_CUSTOM])

    // D9: the order must come from the EFFECTIVE registry (customs carry 5),
    // not the built-in-only registry whose unknown-id fallback would tie 4.
    expect(getProviderOrder('my-gateway')).toBe(5)

    const items = buildGroupedItems([
      { id: 'openai/kept', name: 'Kept', provider: 'openrouter' },
      { id: 'tokenharbor/th-orchestra', name: 'TH', provider: 'tokenharbor' },
      { id: 'my-gateway/model-a', name: 'Model A', provider: 'my-gateway' },
    ])
    const groupOrder = items
      .filter((item) => item.type === 'header')
      .map((item) => item.provider)
    expect(groupOrder).toEqual(['openrouter', 'tokenharbor', 'my-gateway'])
  })
})
