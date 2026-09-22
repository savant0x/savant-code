/**
 * FID-2026-0919-026 — the provider quota reader.
 *
 * Pins the contract the health report depends on: read the declared endpoint,
 * walk the declared JSON path, never throw, never leak the key, and degrade to
 * an `unavailable` line.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import { formatProviderQuota, readProviderQuota } from '../provider-quota'

import type { ProviderConfig } from '@savant-code/common/providers/types'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const BAI_LIKE = {
  id: 'stub',
  label: 'Stub',
  kind: 'gateway',
  credentials: { envVar: 'STUB_KEY' },
  baseUrl: 'https://stub.example/v1',
  protocol: 'openai',
  idTransform: 'strip',
  catalog: { source: 'live', url: 'https://stub.example/v1/models' },
  quota: {
    url: 'https://stub.example/v1/balance',
    valuePath: 'data.personal_balance',
    unit: 'credits',
    note: 'prepaid; top up before requests can be served',
  },
  setupAvailable: true,
  order: 1,
} satisfies ProviderConfig

function stubFetch(
  handler: (input: RequestInfo | URL) => Response | Promise<Response>,
) {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(typeof input === 'string' ? input : String(input))
    return handler(input)
  }) as typeof fetch
  return calls
}

describe('readProviderQuota', () => {
  test('walks the declared path and renders the reading with its note', async () => {
    const calls = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            data: { personal_balance: 0, active_status: 'active' },
          }),
          { status: 200 },
        ),
    )
    const result = await readProviderQuota({
      config: BAI_LIKE,
      key: 'stub-key',
    })
    expect(calls).toEqual(['https://stub.example/v1/balance'])
    expect(result).toEqual({
      status: 'ok',
      reading: '0 credits',
      note: 'prepaid; top up before requests can be served',
      url: 'https://stub.example/v1/balance',
    })
  })

  test('accepts a string reading and omits the unit when none is declared', async () => {
    const config: ProviderConfig = {
      ...BAI_LIKE,
      quota: { ...BAI_LIKE.quota, valuePath: 'status', unit: undefined },
    }
    stubFetch(
      () => new Response(JSON.stringify({ status: 'active' }), { status: 200 }),
    )
    const result = await readProviderQuota({ config, key: 'stub-key' })
    expect(result.status === 'ok' && result.reading).toBe('active')
  })

  test('sends the key as both documented headers and never returns it', async () => {
    const seenHeaders: string[] = []
    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const headers = new Headers(init?.headers)
      seenHeaders.push(
        headers.get('authorization') ?? '(none)',
        headers.get('x-api-key') ?? '(none)',
      )
      return new Response(JSON.stringify({ data: { personal_balance: 12 } }), {
        status: 200,
      })
    }) as unknown as typeof fetch

    const result = await readProviderQuota({
      config: BAI_LIKE,
      key: 'sk-secret-material',
    })
    expect(seenHeaders).toEqual([
      'Bearer sk-secret-material',
      'sk-secret-material',
    ])
    expect(JSON.stringify(result)).not.toContain('sk-secret-material')
  })

  test('is unavailable — never fatal — when there is no quota, no key, or a bad response', async () => {
    expect(
      await readProviderQuota({
        config: { ...BAI_LIKE, quota: undefined },
        key: 'k',
      }),
    ).toEqual({ status: 'unavailable', detail: 'no quota endpoint declared' })
    expect(
      await readProviderQuota({ config: BAI_LIKE, key: undefined }),
    ).toEqual({
      status: 'unavailable',
      detail: 'no key configured',
    })

    stubFetch(() => new Response('nope', { status: 401 }))
    expect(await readProviderQuota({ config: BAI_LIKE, key: 'k' })).toEqual({
      status: 'unavailable',
      detail: 'HTTP 401',
    })

    stubFetch(() => new Response(JSON.stringify({ data: {} }), { status: 200 }))
    expect(await readProviderQuota({ config: BAI_LIKE, key: 'k' })).toEqual({
      status: 'unavailable',
      detail: 'no reading at "data.personal_balance"',
    })

    stubFetch(() => new Response('{not json', { status: 200 }))
    expect(await readProviderQuota({ config: BAI_LIKE, key: 'k' })).toEqual({
      status: 'unavailable',
      detail: 'request failed',
    })
  })

  test('a slow vendor times out instead of hanging the report', async () => {
    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const signal = init?.signal
      return await new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    }) as unknown as typeof fetch

    const result = await readProviderQuota({
      config: BAI_LIKE,
      key: 'k',
      timeoutMs: 10,
    })
    expect(result).toEqual({ status: 'unavailable', detail: 'timed out' })
  })
})

describe('formatProviderQuota', () => {
  test('renders both branches as a single line', () => {
    expect(
      formatProviderQuota({
        status: 'ok',
        reading: '0 credits',
        note: 'prepaid',
        url: 'https://x/balance',
      }),
    ).toBe('0 credits — prepaid')
    expect(
      formatProviderQuota({ status: 'unavailable', detail: 'HTTP 500' }),
    ).toBe('unavailable (HTTP 500)')
  })
})
