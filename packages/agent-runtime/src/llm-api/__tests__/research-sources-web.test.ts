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

import { searchWebSource } from '../research-sources'

import type { Logger } from '@savant-code/common/types/contracts/logger'

const logger = TEST_AGENT_RUNTIME_IMPL.logger as Logger

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Serper-shaped organic JSON string (compact). */
function serperOrganic(
  hits: Array<{ title: string; link: string; snippet: string }>,
): string {
  return JSON.stringify({ organic: hits })
}

/**
 * Create a fetch mock that routes by URL prefix to pre-stringified response
 * bodies. Unmatched URLs return 404.
 */
function fetchRouter(
  routes: Array<[string, { body: string; status?: number }]>,
): typeof globalThis.fetch {
  return mock((input: unknown) => {
    const url = String(input)
    const match = routes.find(([prefix]) => url.includes(prefix))
    if (match) {
      return Promise.resolve(
        new Response(match[1].body, {
          status: match[1].status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return Promise.resolve(new Response('Not Found', { status: 404 }))
  }) as unknown as typeof globalThis.fetch
}

/** Save and restore an env var across a test. */
function useEnv(key: string, value: string | undefined) {
  const original = process.env[key]
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
  return () => {
    if (original === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = original
    }
  }
}

// FID-2026-0819-005 Loop 295: searchWebSource suites moved verbatim from research-sources.test.ts; header helpers copied verbatim.

// ---------------------------------------------------------------------------
// searchWebSource — BYOK priority + keyless fallback
// ---------------------------------------------------------------------------

describe('searchWebSource', () => {
  beforeAll(async () => {
    await mockModule('@savant-code/common/util/promise', () => ({
      withTimeout: async <T>(promise: Promise<T>) => promise,
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  afterAll(() => {
    clearMockedModules()
  })

  test('Serper BYOK key present → returns Serper results', async () => {
    const restore = useEnv('SERPER_API_KEY', 'test-serper-key')
    try {
      const organicResult = serperOrganic([
        { title: 'Serper Hit', link: 'https://serper.example', snippet: 's' },
      ])
      const fetch = fetchRouter([
        ['google.serper.dev', { body: organicResult }],
      ])

      const result = await searchWebSource({
        query: 'bun',
        logger,
        fetch,
      })

      // searchWeb re-serializes via JSON.stringify, so compare parsed objects.
      expect(JSON.parse(result.result!)).toEqual(JSON.parse(organicResult))
      expect(result.error).toBeUndefined()
    } finally {
      restore()
    }
  })

  test('Serper returns non-2xx → falls through to Parallel', async () => {
    const restoreSerper = useEnv('SERPER_API_KEY', 'test-serper-key')
    const restoreParallel = useEnv('PARALLEL_API_KEY', 'test-parallel-key')
    try {
      // Parallel raw API shape: { results: [{ url, title, excerpts }] }
      const parallelResult = JSON.stringify({
        results: [
          {
            url: 'https://parallel.example',
            title: 'Parallel Hit',
            excerpts: ['p snippet'],
          },
        ],
      })
      const fetch = fetchRouter([
        ['google.serper.dev', { body: '{"error":"bad key"}', status: 400 }],
        ['api.parallel.ai', { body: parallelResult }],
      ])

      const result = await searchWebSource({
        query: 'bun',
        logger,
        fetch,
      })

      expect(result.result).toBeDefined()
      expect(result.error).toBeUndefined()
      const parsed = JSON.parse(result.result!)
      expect(parsed.organic[0].link).toBe('https://parallel.example')
    } finally {
      restoreSerper()
      restoreParallel()
    }
  })

  test('no BYOK key → keyless fallback returned', async () => {
    const restoreSerper = useEnv('SERPER_API_KEY', undefined)
    const restoreParallel = useEnv('PARALLEL_API_KEY', undefined)
    const restoreTavily = useEnv('TAVILY_API_KEY', undefined)
    const restoreExa = useEnv('EXA_API_KEY', undefined)
    const restoreFirecrawl = useEnv('FIRECRAWL_API_KEY', undefined)
    try {
      // Qwant response shape (parseQwantJson expects this):
      const qwantResponse = JSON.stringify({
        status: 'success',
        data: {
          result: {
            items: {
              mainline: [
                {
                  type: 'web',
                  items: [
                    {
                      title: 'Qwant Hit',
                      url: 'https://qwant.example',
                      desc: 'qwant desc',
                    },
                  ],
                },
              ],
            },
          },
        },
      })
      // DDG response shape (parseDdgHtml expects this):
      const ddgResponse =
        '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fddg.example">DDG Hit</a>' +
        '<a class="result__snippet">ddg desc</a>'

      const fetch = fetchRouter([
        ['api.qwant.com', { body: qwantResponse }],
        ['duckduckgo.com', { body: ddgResponse }],
      ])

      const result = await searchWebSource({
        query: 'bun',
        logger,
        fetch,
      })

      expect(result.result).toBeDefined()
      expect(result.error).toBeUndefined()
    } finally {
      restoreSerper()
      restoreParallel()
      restoreTavily()
      restoreExa()
      restoreFirecrawl()
    }
  })

  test('all sources null → actionable all-fail error', async () => {
    const restoreSerper = useEnv('SERPER_API_KEY', undefined)
    const restoreParallel = useEnv('PARALLEL_API_KEY', undefined)
    const restoreTavily = useEnv('TAVILY_API_KEY', undefined)
    const restoreExa = useEnv('EXA_API_KEY', undefined)
    const restoreFirecrawl = useEnv('FIRECRAWL_API_KEY', undefined)
    try {
      const fetch = fetchRouter([])

      const result = await searchWebSource({
        query: 'bun',
        logger,
        fetch,
      })

      expect(result.error).toContain('No web search results were returned')
      expect(result.result).toBeUndefined()
    } finally {
      restoreSerper()
      restoreParallel()
      restoreTavily()
      restoreExa()
      restoreFirecrawl()
    }
  })
})
