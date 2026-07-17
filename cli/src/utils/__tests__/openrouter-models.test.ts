import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  __resetOpenRouterModelsCacheForTest,
  fetchOpenRouterModels,
  getCachedOpenRouterModels,
  hasOpenRouterCatalog,
} from '../openrouter-models'

const REAL_FETCH = globalThis.fetch

const makeJsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('openrouter-models', () => {
  beforeEach(() => {
    __resetOpenRouterModelsCacheForTest()
    globalThis.fetch = REAL_FETCH
  })

  afterEach(() => {
    __resetOpenRouterModelsCacheForTest()
    globalThis.fetch = REAL_FETCH
    mock.restore()
  })

  test('parses the live catalog shape (id, name, context, pricing)', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [
            {
              id: 'anthropic/claude-sonnet-4',
              name: 'Anthropic: Claude Sonnet 4',
              context_length: 200000,
              pricing: { prompt: '0.000003', completion: '0.000015' },
            },
            { id: 'openai/gpt-4o', name: 'OpenAI: GPT-4o' },
          ],
        }),
      ),
    )

    const models = await fetchOpenRouterModels(true)
    expect(models).toHaveLength(2)
    expect(models[0].id).toBe('anthropic/claude-sonnet-4')
    expect(models[0].name).toBe('Anthropic: Claude Sonnet 4')
    expect(models[0].contextLength).toBe(200000)
    expect(models[0].promptPricePerToken).toBe(0.000003)
    expect(models[0].completionPricePerToken).toBe(0.000015)
    // Sorted by id
    expect(models[1].id).toBe('openai/gpt-4o')
    expect(hasOpenRouterCatalog()).toBe(true)
    expect(getCachedOpenRouterModels()).toHaveLength(2)
  })

  test('skips entries without an id', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({ data: [{ name: 'no id' }, { id: 'x/y' }] }),
      ),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models).toHaveLength(1)
    expect(models[0].id).toBe('x/y')
  })

  test('degrades to empty list on fetch failure (never throws)', async () => {
    // @ts-expect-error - mock fetch to reject
    globalThis.fetch = mock(() => Promise.reject(new Error('network down')))
    const models = await fetchOpenRouterModels(true)
    expect(models).toEqual([])
  })

  test('degrades to empty list on non-200 response', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('err', { status: 500 })),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models).toEqual([])
  })

  test('returns cached catalog without refetching when fresh', async () => {
    let calls = 0
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() => {
      calls++
      return Promise.resolve(
        makeJsonResponse({ data: [{ id: 'a/b' }, { id: 'c/d' }] }),
      )
    })
    await fetchOpenRouterModels(true)
    const firstCalls = calls
    // Within TTL: should not call fetch again.
    const cached = await fetchOpenRouterModels()
    expect(cached.length).toBe(2)
    expect(calls).toBe(firstCalls)
  })
})
