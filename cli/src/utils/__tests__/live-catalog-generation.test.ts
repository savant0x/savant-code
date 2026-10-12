// FID-2026-1011-006 R20 — provider-catalog generations. The gateway fetcher's
// build token already gates publication; this suite pins the same ownership at
// the generic per-provider fetcher, which is the seam every live provider uses.

import { describe, expect, mock, test } from 'bun:test'

import { createLiveCatalogFetcher } from '../openrouter-models/live-catalog'

import type { OpenRouterModel } from '../openrouter-models/types'

type Deferred = {
  promise: Promise<Response>
  resolve(response: Response): void
  reject(error: Error): void
}

function defer(): Deferred {
  let resolve!: (response: Response) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Response>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function modelsResponse(id: string): Response {
  return new Response(JSON.stringify({ data: [{ id, name: id }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function parseModels(json: {
  data: Array<{ id: string; name: string }>
}): OpenRouterModel[] {
  return json.data.map((model) => ({ id: model.id, name: model.name }))
}

describe('FID-2026-1011-006 catalog ownership', () => {
  test('a reset supersedes an in-flight load without letting it clear the newer slot', async () => {
    const first = defer()
    const second = defer()
    const responses = [first.promise, second.promise]
    let request = 0
    const fetchMock = mock(() => responses[request++]!)
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const fetcher = createLiveCatalogFetcher({
      url: 'https://catalog.test/models',
      logLabel: 'TestProvider',
      parse: parseModels as (json: unknown) => OpenRouterModel[],
    })

    const pendingA = fetcher.fetchModels()
    fetcher.resetForTest()
    const pendingB = fetcher.fetchModels()
    // A third caller joins the CURRENT in-flight load, not the superseded one.
    const pendingC = fetcher.fetchModels()
    await new Promise((resolve) => setTimeout(resolve, 0))
    // Only two live loads were issued: A was superseded, C joined B.
    expect(fetchMock).toHaveBeenCalledTimes(2)

    first.resolve(modelsResponse('a'))
    second.resolve(modelsResponse('b'))
    expect((await pendingA).map((model) => model.id)).toEqual(['a'])
    // A resolved first: its superseded result never becomes the cache, and its
    // cleanup cannot clear B's slot.
    expect(fetcher.getCachedModels().map((model) => model.id)).toEqual(['b'])
    expect((await pendingC).map((model) => model.id)).toEqual(['b'])
    expect((await pendingB).map((model) => model.id)).toEqual(['b'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('B resolving first is not overwritten by the superseded A', async () => {
    const first = defer()
    const second = defer()
    const responses = [first.promise, second.promise]
    let request = 0
    globalThis.fetch = mock(
      () => responses[request++]!,
    ) as unknown as typeof fetch
    const fetcher = createLiveCatalogFetcher({
      url: 'https://catalog.test/models',
      logLabel: 'TestProvider',
      parse: parseModels as (json: unknown) => OpenRouterModel[],
    })

    const pendingA = fetcher.fetchModels()
    fetcher.resetForTest()
    const pendingB = fetcher.fetchModels()

    second.resolve(modelsResponse('b'))
    expect((await pendingB).map((model) => model.id)).toEqual(['b'])
    first.resolve(modelsResponse('a'))
    await pendingA
    expect(fetcher.getCachedModels().map((model) => model.id)).toEqual(['b'])
    expect(fetcher.hasCatalog()).toBe(true)
  })

  test('a failed load degrades to the stale catalog, then to empty', async () => {
    let fail = false
    globalThis.fetch = mock(() => {
      if (fail) return Promise.reject(new Error('network down'))
      return Promise.resolve(modelsResponse('cached'))
    }) as unknown as typeof fetch
    const fetcher = createLiveCatalogFetcher({
      url: 'https://catalog.test/models',
      logLabel: 'TestProvider',
      parse: parseModels as (json: unknown) => OpenRouterModel[],
    })

    await fetcher.fetchModels()
    expect(fetcher.getCachedModels().map((model) => model.id)).toEqual([
      'cached',
    ])

    fail = true
    // Forced refresh bypasses the TTL and takes the failure path.
    expect(await fetcher.fetchModels(true)).toEqual(fetcher.getCachedModels())
    expect(fetcher.getCachedModels().map((model) => model.id)).toEqual([
      'cached',
    ])

    fetcher.resetForTest()
    expect(await fetcher.fetchModels()).toEqual([])
    expect(fetcher.hasCatalog()).toBe(false)
  })

  test('a rejecting credential resolver never becomes a cache entry', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(modelsResponse('should-not-load')),
    ) as unknown as typeof fetch
    const fetcher = createLiveCatalogFetcher({
      url: 'https://catalog.test/models',
      logLabel: 'TestProvider',
      parse: parseModels as (json: unknown) => OpenRouterModel[],
      resolveKey: () => {
        throw new Error('credential unavailable')
      },
    })

    // The resolver runs inside the guarded build: the failure degrades to the
    // empty fallback instead of rejecting the picker.
    expect(await fetcher.fetchModels()).toEqual([])
    expect(fetcher.hasCatalog()).toBe(false)
  })

  test('credential changes invalidate the process cache', async () => {
    globalThis.fetch = mock((_input: string, init?: RequestInit) => {
      const header = (init?.headers as Record<string, string> | undefined)
        ?.Authorization
      return Promise.resolve(modelsResponse(header ?? 'anonymous'))
    }) as unknown as typeof fetch
    let key = 'key-one'
    const fetcher = createLiveCatalogFetcher({
      url: 'https://catalog.test/models',
      logLabel: 'TestProvider',
      parse: parseModels as (json: unknown) => OpenRouterModel[],
      resolveKey: () => key,
    })

    expect((await fetcher.fetchModels()).map((model) => model.id)).toEqual([
      'Bearer key-one',
    ])
    // A rotation is visible only through an explicit invalidation at the
    // mutation seam — the cached catalog is otherwise served for its TTL.
    key = 'key-two'
    expect((await fetcher.fetchModels()).map((model) => model.id)).toEqual([
      'Bearer key-one',
    ])
    fetcher.resetForTest()
    expect((await fetcher.fetchModels()).map((model) => model.id)).toEqual([
      'Bearer key-two',
    ])
  })
})
