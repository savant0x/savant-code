import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  resetOpenRouterApiKeyCache,
  resolveOpenRouterApiKey,
} from './openrouter-key-resolver'

const ENV_KEYS = [
  'OR_MASTER_KEY',
  'OPENROUTER_API_KEY',
  'INFERENCE_API_KEY',
] as const

describe('OpenRouter API key resolver', () => {
  let originalEnv: Record<string, string | undefined>
  let originalFetch: typeof globalThis.fetch
  let fetchCalls: number

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      ENV_KEYS.map((key) => [key, process.env[key]]),
    )
    for (const key of ENV_KEYS) delete process.env[key]
    originalFetch = globalThis.fetch
    fetchCalls = 0
    resetOpenRouterApiKeyCache()
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    globalThis.fetch = originalFetch
    resetOpenRouterApiKeyCache()
  })

  test('prefers master-key exchange over regular and inference keys', async () => {
    process.env.OR_MASTER_KEY = 'master-key'
    process.env.OPENROUTER_API_KEY = 'regular-key'
    process.env.INFERENCE_API_KEY = 'inference-key'
    globalThis.fetch = (async () => {
      fetchCalls += 1
      return new Response(JSON.stringify({ key: 'exchanged-key' }), {
        status: 200,
      })
    }) as unknown as typeof globalThis.fetch

    await expect(resolveOpenRouterApiKey()).resolves.toBe('exchanged-key')
    expect(fetchCalls).toBe(1)
  })

  test('deduplicates concurrent master-key exchanges', async () => {
    process.env.OR_MASTER_KEY = 'master-key'
    let resolveFetch: ((response: Response) => void) | undefined
    globalThis.fetch = (() => {
      fetchCalls += 1
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })
    }) as unknown as typeof globalThis.fetch

    const first = resolveOpenRouterApiKey()
    const second = resolveOpenRouterApiKey()
    expect(fetchCalls).toBe(1)
    resolveFetch?.(
      new Response(JSON.stringify({ key: 'exchanged-key' }), { status: 200 }),
    )

    await expect(first).resolves.toBe('exchanged-key')
    await expect(second).resolves.toBe('exchanged-key')
    expect(fetchCalls).toBe(1)
  })

  test('a rejected master-key exchange does not fall through to a stale regular key', async () => {
    // FID-2026-0917-004: a 401 means the configured master key is invalid.
    // Sending the stale OPENROUTER_API_KEY instead surfaced as a confusing
    // vendor 401 ("User not found.") at chat-completions time.
    process.env.OR_MASTER_KEY = 'bad-master-key'
    process.env.OPENROUTER_API_KEY = 'stale-regular-key'
    globalThis.fetch = (async () => {
      fetchCalls += 1
      return new Response(
        JSON.stringify({ error: { message: 'Invalid API key' } }),
        { status: 401 },
      )
    }) as unknown as typeof globalThis.fetch

    await expect(resolveOpenRouterApiKey()).resolves.toBeUndefined()
    expect(fetchCalls).toBe(1)
  })

  test('an auth-rejected exchange is negative-cached across calls', async () => {
    process.env.OR_MASTER_KEY = 'bad-master-key'
    globalThis.fetch = (async () => {
      fetchCalls += 1
      return new Response(JSON.stringify({ message: 'Invalid API key' }), {
        status: 401,
      })
    }) as unknown as typeof globalThis.fetch

    await expect(resolveOpenRouterApiKey()).resolves.toBeUndefined()
    await expect(resolveOpenRouterApiKey()).resolves.toBeUndefined()
    expect(fetchCalls).toBe(1)
  })

  test('a forbidden (403) master-key exchange also fails closed', async () => {
    process.env.OR_MASTER_KEY = 'forbidden-master-key'
    process.env.OPENROUTER_API_KEY = 'stale-regular-key'
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: 'Forbidden' }), {
        status: 403,
      })) as unknown as typeof globalThis.fetch

    await expect(resolveOpenRouterApiKey()).resolves.toBeUndefined()
  })

  test('a rate-limited exchange still falls through to the regular key', async () => {
    process.env.OR_MASTER_KEY = 'master-key'
    process.env.OPENROUTER_API_KEY = 'regular-key'
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: 'Rate limited' }), {
        status: 429,
      })) as unknown as typeof globalThis.fetch

    await expect(resolveOpenRouterApiKey()).resolves.toBe('regular-key')
  })

  test('a transient exchange error still falls through to the regular key', async () => {
    process.env.OR_MASTER_KEY = 'master-key'
    process.env.OPENROUTER_API_KEY = 'regular-key'
    globalThis.fetch = (async () => {
      throw new Error('network unreachable')
    }) as unknown as typeof globalThis.fetch

    await expect(resolveOpenRouterApiKey()).resolves.toBe('regular-key')
  })

  test('uses the regular key before the inference fallback', async () => {
    process.env.OPENROUTER_API_KEY = 'regular-key'
    process.env.INFERENCE_API_KEY = 'inference-key'

    await expect(resolveOpenRouterApiKey()).resolves.toBe('regular-key')
    expect(fetchCalls).toBe(0)
  })

  test('uses the inference key when no regular key exists', async () => {
    process.env.INFERENCE_API_KEY = 'inference-key'

    await expect(resolveOpenRouterApiKey()).resolves.toBe('inference-key')
  })

  test('observes a newly assigned key after a previously keyless resolution', async () => {
    await expect(resolveOpenRouterApiKey()).resolves.toBeUndefined()
    process.env.OPENROUTER_API_KEY = 'new-key'
    await expect(resolveOpenRouterApiKey()).resolves.toBe('new-key')
  })

  test('observes a changed regular key after a successful resolution', async () => {
    process.env.OPENROUTER_API_KEY = 'first-key'
    await expect(resolveOpenRouterApiKey()).resolves.toBe('first-key')
    process.env.OPENROUTER_API_KEY = 'second-key'

    await expect(resolveOpenRouterApiKey()).resolves.toBe('second-key')
  })

  test('reset observes a stored key after a cached-null resolution', async () => {
    // Simulate a negative-cached result (e.g. master-key exchange failure with
    // no regular/inference key present).
    await expect(resolveOpenRouterApiKey()).resolves.toBeUndefined()

    // A user then stores an OPENROUTER_API_KEY via /provider; the CLI calls
    // resetOpenRouterApiKeyCache() so the previously cached null is cleared.
    resetOpenRouterApiKeyCache()
    process.env.OPENROUTER_API_KEY = 'stored-key'

    await expect(resolveOpenRouterApiKey()).resolves.toBe('stored-key')
  })

  test('reset clears both the cached key and environment signature', async () => {
    process.env.OPENROUTER_API_KEY = 'first-key'
    await expect(resolveOpenRouterApiKey()).resolves.toBe('first-key')

    resetOpenRouterApiKeyCache()
    process.env.OPENROUTER_API_KEY = 'second-key'

    await expect(resolveOpenRouterApiKey()).resolves.toBe('second-key')
  })
})
