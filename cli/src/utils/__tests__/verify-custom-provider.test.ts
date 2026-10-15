import { afterEach, describe, expect, mock, test } from 'bun:test'

import { verifyCustomProviderKey } from '../verify-custom-provider'

import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * FID-2026-0911-003 — verify-helper contract pins (RED first).
 * One helper, three consumers (wizard terminal, /provider test, /health).
 * Protocol-aware headers; three-outcome ladder; NEVER blocks a save; the
 * key value must never appear in any error/detail text (Law 12).
 */

const REAL_FETCH = globalThis.fetch

const openaiDef: CustomProviderConfig = {
  id: 'acme',
  label: 'Acme',
  baseUrl: 'https://acme.example/v1',
  apiKeyEnvVar: 'ACME_API_KEY',
  catalog: { source: 'none' },
}

const anthropicDef: CustomProviderConfig = {
  ...openaiDef,
  id: 'claudeish',
  protocol: 'anthropic',
}

const liveCatalogDef: CustomProviderConfig = {
  ...openaiDef,
  id: 'catly',
  catalog: { source: 'live', url: 'https://catly.example/v1/models' },
}

const KEY = 'sk-test-secret-value-12345'

function mockFetchOnce(
  status: number,
  body: unknown,
  capture: { url?: string; init?: RequestInit } = {},
): void {
  globalThis.fetch = mock(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      capture.url = String(input)
      capture.init = init
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
      // biome-ignore lint/suspicious/noExplicitAny: test double
    },
  ) as any
}

function mockFetchTimeout(
  capture: { url?: string; init?: RequestInit } = {},
): void {
  globalThis.fetch = mock(
    (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const error = new Error('The operation was aborted due to timeout')
        error.name = 'TimeoutError'
        reject(error)
      }),
    // biome-ignore lint/suspicious/noExplicitAny: test double
  ) as any
}

describe('verifyCustomProviderKey (FID-2026-0911-003)', () => {
  afterEach(() => {
    globalThis.fetch = REAL_FETCH
  })

  test('openai protocol: GET {baseUrl}/models with Bearer; 200 → verified with model count', async () => {
    const capture: { url?: string; init?: RequestInit } = {}
    mockFetchOnce(
      200,
      { data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] },
      capture,
    )
    const result = await verifyCustomProviderKey(openaiDef, KEY)
    expect(result.outcome).toBe('verified')
    expect(result.modelCount).toBe(3)
    expect(capture.url).toBe('https://acme.example/v1/models')
    expect(new Headers(capture.init?.headers).get('authorization')).toBe(
      `Bearer ${KEY}`,
    )
  })

  test('anthropic protocol: x-api-key + anthropic-version headers, not Bearer', async () => {
    const capture: { url?: string; init?: RequestInit } = {}
    mockFetchOnce(200, { data: [] }, capture)
    await verifyCustomProviderKey(anthropicDef, KEY)
    const headers = new Headers(capture.init?.headers)
    expect(headers.get('x-api-key')).toBe(KEY)
    expect(headers.get('anthropic-version')).toBe('2023-06-01')
    expect(headers.get('authorization')).toBeNull()
  })

  test('live catalog source probes the catalog URL, not {baseUrl}/models', async () => {
    const capture: { url?: string; init?: RequestInit } = {}
    mockFetchOnce(200, { data: [{ id: 'x' }] }, capture)
    await verifyCustomProviderKey(liveCatalogDef, KEY)
    expect(capture.url).toBe('https://catly.example/v1/models')
  })

  test('401 → rejected; 403 → rejected', async () => {
    const capture: { url?: string; init?: RequestInit } = {}
    mockFetchOnce(401, { error: { message: 'bad key' } }, capture)
    const rejected = await verifyCustomProviderKey(openaiDef, KEY)
    expect(rejected.outcome).toBe('rejected')

    mockFetchOnce(403, { error: { message: 'forbidden' } })
    const forbidden = await verifyCustomProviderKey(openaiDef, KEY)
    expect(forbidden.outcome).toBe('rejected')
  })

  test('404/non-200 → unverifiable (endpoint may not serve model listing)', async () => {
    mockFetchOnce(404, { error: { message: 'nope' } })
    const result = await verifyCustomProviderKey(openaiDef, KEY)
    expect(result.outcome).toBe('unverifiable')
  })

  test('timeout/network error → unverifiable (never throws)', async () => {
    const capture: { url?: string; init?: RequestInit } = {}
    mockFetchTimeout(capture)
    const result = await verifyCustomProviderKey(openaiDef, KEY)
    expect(result.outcome).toBe('unverifiable')
  })

  test('a malformed JSON body still verifies auth (200 = key accepted)', async () => {
    globalThis.fetch = mock(
      async () => new Response('<html>not json</html>', { status: 200 }),
      // biome-ignore lint/suspicious/noExplicitAny: test double
    ) as any
    const result = await verifyCustomProviderKey(openaiDef, KEY)
    // The probe is an AUTH check first: a 200 means the key was accepted
    // even when the body is not a catalog (some gateways serve HTML on
    // /models). Auth is what the wizard is verifying.
    expect(result.outcome).toBe('verified')
    expect(result.modelCount).toBeUndefined()
  })

  test('the key value NEVER appears in the result text (Law 12)', async () => {
    mockFetchOnce(401, {
      error: { message: 'Invalid key sk-test-secret-value-12345' },
    })
    const result = await verifyCustomProviderKey(openaiDef, KEY)
    const text = JSON.stringify(result)
    expect(text.includes(KEY)).toBe(false)
  })
})
