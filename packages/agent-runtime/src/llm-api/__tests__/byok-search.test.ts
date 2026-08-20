import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from 'bun:test'

import {
  searchExa,
  searchFirecrawl,
  searchParallel,
  searchTavily,
} from '../byok-search'

import type { Logger } from '@savant-code/common/types/contracts/logger'

const logger = TEST_AGENT_RUNTIME_IMPL.logger as Logger
const baseOptions = {
  logger,
  apiKey: 'test-key',
  query: 'bun compile',
  fetch: mock(() => Promise.resolve(new Response('{}', { status: 200 }))),
} as const

type BaseOptions = Omit<typeof baseOptions, 'query'>

function respondWith(body: unknown, status = 200): typeof globalThis.fetch {
  return mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as unknown as typeof globalThis.fetch
}

describe('BYOK search facades', () => {
  beforeAll(async () => {
    await mockModule('@savant-code/common/util/promise', () => ({
      withTimeout: async <T>(promise: Promise<T>, timeout: number) => promise,
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  afterAll(() => {
    clearMockedModules()
  })

  test('Parallel: maps results/excerpts to the organic shape and sends x-api-key', async () => {
    const fetch = respondWith({
      results: [
        {
          url: 'https://bun.sh/docs',
          title: 'Bun Docs',
          publish_date: '2026-01-01',
          excerpts: ['Bun is a fast JavaScript runtime.'],
        },
      ],
    })

    const result = await searchParallel({
      ...(baseOptions as unknown as BaseOptions),
      query: 'bun compile',
      fetch,
    })

    const parsed = JSON.parse(result!) as {
      organic: Array<{
        title?: string
        link?: string
        snippet?: string
        position?: number
      }>
    }
    expect(parsed.organic[0]).toMatchObject({
      title: 'Bun Docs',
      link: 'https://bun.sh/docs',
    })
    expect(parsed.organic[0].snippet).toContain('fast JavaScript runtime')
    expect(parsed.organic[0].position).toBe(1)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.parallel.ai/v1/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
      }),
    )
  })

  test('Tavily: maps results/content and sends Bearer auth', async () => {
    const fetch = respondWith({
      results: [
        { title: 'Tavily Hit', url: 'https://tavily.example', content: 'abc' },
      ],
    })

    const result = await searchTavily({
      ...(baseOptions as unknown as BaseOptions),
      query: 'bun compile',
      fetch,
    })

    const parsed = JSON.parse(result!) as {
      organic: Array<{ link?: string }>
    }
    expect(parsed.organic[0].link).toBe('https://tavily.example')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        body: JSON.stringify({
          query: 'bun compile',
          max_results: 5,
          search_depth: 'advanced',
          topic: 'general',
        }),
      }),
    )
  })

  test('Tavily: deep depth raises max_results', async () => {
    const fetch = respondWith({ results: [] })

    await searchTavily({
      ...(baseOptions as unknown as BaseOptions),
      query: 'bun compile',
      depth: 'deep',
      fetch,
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        body: JSON.stringify({
          query: 'bun compile',
          max_results: 10,
          search_depth: 'advanced',
          topic: 'general',
        }),
      }),
    )
  })

  test('Exa: maps highlights and requests contents.highlights', async () => {
    const fetch = respondWith({
      results: [
        {
          title: 'Exa Hit',
          url: 'https://exa.example',
          highlights: ['first highlight', 'second highlight'],
          publishedDate: '2026-02-01',
        },
      ],
    })

    const result = await searchExa({
      ...(baseOptions as unknown as BaseOptions),
      query: 'bun compile',
      fetch,
    })

    const parsed = JSON.parse(result!) as {
      organic: Array<{ snippet?: string }>
    }
    expect(parsed.organic[0].snippet).toContain('first highlight')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.exa.ai/search',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
        body: JSON.stringify({
          query: 'bun compile',
          numResults: 5,
          type: 'auto',
          contents: { highlights: true },
        }),
      }),
    )
  })

  test('Firecrawl: maps data.web and sends Bearer auth', async () => {
    const fetch = respondWith({
      success: true,
      data: {
        web: [
          {
            title: 'Firecrawl Hit',
            url: 'https://firecrawl.example',
            description: 'desc',
            highlights: ['hl'],
          },
        ],
      },
    })

    const result = await searchFirecrawl({
      ...(baseOptions as unknown as BaseOptions),
      query: 'bun compile',
      fetch,
    })

    const parsed = JSON.parse(result!) as {
      organic: Array<{ link?: string; snippet?: string }>
    }
    expect(parsed.organic[0].link).toBe('https://firecrawl.example')
    expect(parsed.organic[0].snippet).toContain('desc')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.firecrawl.dev/v2/search',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        body: JSON.stringify({ query: 'bun compile', limit: 5 }),
      }),
    )
  })

  test('Firecrawl: tolerates the { data: [...] } fallback shape', async () => {
    const fetch = respondWith({
      data: [{ title: 'Flat Hit', url: 'https://flat.example' }],
    })

    const result = await searchFirecrawl({
      ...(baseOptions as unknown as BaseOptions),
      query: 'bun compile',
      fetch,
    })

    expect(JSON.parse(result!).organic[0].link).toBe('https://flat.example')
  })

  test('each facade returns null on non-2xx responses', async () => {
    const fetch = respondWith({ error: 'nope' }, 401)

    expect(
      await searchParallel({
        ...(baseOptions as unknown as BaseOptions),
        query: 'q',
        fetch,
      }),
    ).toBeNull()
    expect(
      await searchTavily({
        ...(baseOptions as unknown as BaseOptions),
        query: 'q',
        fetch,
      }),
    ).toBeNull()
    expect(
      await searchExa({
        ...(baseOptions as unknown as BaseOptions),
        query: 'q',
        fetch,
      }),
    ).toBeNull()
    expect(
      await searchFirecrawl({
        ...(baseOptions as unknown as BaseOptions),
        query: 'q',
        fetch,
      }),
    ).toBeNull()
  })

  test('each facade returns null on empty or malformed results', async () => {
    expect(
      await searchParallel({
        ...(baseOptions as unknown as BaseOptions),
        query: 'q',
        fetch: respondWith({ results: [] }),
      }),
    ).toBeNull()
    expect(
      await searchTavily({
        ...(baseOptions as unknown as BaseOptions),
        query: 'q',
        fetch: respondWith({ results: [{ title: 'no url' }] }),
      }),
    ).toBeNull()
    expect(
      await searchExa({
        ...(baseOptions as unknown as BaseOptions),
        query: 'q',
        fetch: respondWith(['not-an-object']),
      }),
    ).toBeNull()
    expect(
      await searchFirecrawl({
        ...(baseOptions as unknown as BaseOptions),
        query: 'q',
        fetch: respondWith({ data: {} }),
      }),
    ).toBeNull()
  })
})
