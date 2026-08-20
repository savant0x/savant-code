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
  formatOrganicAsDocumentation,
  parseOrganicHits,
  readDocsSource,
  searchWebSource,
} from '../research-sources'

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

// ---------------------------------------------------------------------------
// Pure helper tests (formatOrganicAsDocumentation, parseOrganicHits)
// ---------------------------------------------------------------------------

describe('formatOrganicAsDocumentation', () => {
  const serperShape = serperOrganic([
    {
      title: 'Bun — Bundler docs',
      link: 'https://bun.sh/docs/bundler',
      snippet: 'Bundle your frontend with Bun.',
    },
    {
      title: 'Bun — Test runner',
      link: 'https://bun.sh/docs/cli/test',
      snippet: 'Fast built-in test runner.',
    },
  ])

  test('formats organic hits into readable documentation text', () => {
    const doc = formatOrganicAsDocumentation(serperShape, 'Bun', 'bundler')
    expect(doc).toContain('Documentation for "Bun" (topic: bundler)')
    expect(doc).toContain('- Bun — Bundler docs')
    expect(doc).toContain('https://bun.sh/docs/bundler')
    expect(doc).toContain('Bundle your frontend with Bun.')
  })

  test('returns null for a non-organic result or empty hits', () => {
    expect(formatOrganicAsDocumentation('{"organic":[]}', 'Bun')).toBeNull()
    expect(formatOrganicAsDocumentation('not json{', 'Bun')).toBeNull()
    expect(formatOrganicAsDocumentation('{"foo":"bar"}', 'Bun')).toBeNull()
  })

  test('handles hits missing title or link', () => {
    const doc = formatOrganicAsDocumentation(
      JSON.stringify({
        organic: [{ link: 'https://only-link.example' }],
      }),
      'Lib',
    )
    expect(doc).toContain('https://only-link.example')
  })
})

describe('parseOrganicHits', () => {
  test('parses the organic array from facade JSON', () => {
    const hits = parseOrganicHits(
      JSON.stringify({
        organic: [
          { title: 'A', link: 'https://a', snippet: 's' },
          { link: 'https://b' },
        ],
      }),
    )
    expect(hits).toHaveLength(2)
    expect(hits[0]).toEqual({ title: 'A', link: 'https://a', snippet: 's' })
  })

  test('returns [] for malformed or non-organic payloads', () => {
    expect(parseOrganicHits('not json{')).toEqual([])
    expect(parseOrganicHits('{"organic":"nope"}')).toEqual([])
    expect(parseOrganicHits('{"foo":"bar"}')).toEqual([])
  })
})

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

// ---------------------------------------------------------------------------
// readDocsSource — Context7 BYOK primary → keyless fallback
// ---------------------------------------------------------------------------

describe('readDocsSource', () => {
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

  test('Context7 BYOK key present + docs returned → returned directly', async () => {
    const restore = useEnv('CONTEXT7_API_KEY', 'test-context7-key')
    try {
      // Context7 API: search returns { results: [{ id, ... }] },
      // then docs fetch returns { content: [{ text }] }.
      const searchResult = JSON.stringify({
        results: [
          { id: 'bun/bun', title: 'Bun', totalTokens: 1000, stars: 50 },
        ],
      })
      const docsResult = JSON.stringify({
        content: [{ text: 'Indexed docs for Bun from Context7' }],
      })
      const fetch = fetchRouter([
        ['context7.com/api/v1/search', { body: searchResult }],
        ['context7.com/api/v1/bun/bun', { body: docsResult }],
      ])

      const result = await readDocsSource({
        libraryTitle: 'Bun',
        logger,
        fetch,
      })

      expect(result.documentation).toBeDefined()
      expect(result.error).toBeUndefined()
    } finally {
      restore()
    }
  })

  test('Context7 BYOK key present + returns empty results → keyless fallback', async () => {
    const restore = useEnv('CONTEXT7_API_KEY', 'test-context7-key')
    try {
      // Context7 returns no results → fetchContext7LibraryDocumentation returns null.
      const context7Empty = JSON.stringify({ results: [] })
      // Qwant response shape:
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
                      title: 'Docs Hit',
                      url: 'https://docs.example',
                      desc: 'docs desc',
                    },
                  ],
                },
              ],
            },
          },
        },
      })
      const ddgResponse =
        '<a class="result__a" href="https://ddg.example">DDG</a>' +
        '<a class="result__snippet">ddg snippet</a>'

      const fetch = fetchRouter([
        ['context7.com', { body: context7Empty }],
        ['api.qwant.com', { body: qwantResponse }],
        ['duckduckgo.com', { body: ddgResponse }],
      ])

      const result = await readDocsSource({
        libraryTitle: 'Bun',
        logger,
        fetch,
      })

      // Falls through to keylessReadDocs → searchWebSource → keylessSearch
      expect(result.documentation).toBeDefined()
    } finally {
      restore()
    }
  })

  test('no Context7 key → keyless path invoked without calling Context7', async () => {
    const restoreContext7 = useEnv('CONTEXT7_API_KEY', undefined)
    const restoreSerper = useEnv('SERPER_API_KEY', undefined)
    const restoreParallel = useEnv('PARALLEL_API_KEY', undefined)
    const restoreTavily = useEnv('TAVILY_API_KEY', undefined)
    const restoreExa = useEnv('EXA_API_KEY', undefined)
    const restoreFirecrawl = useEnv('FIRECRAWL_API_KEY', undefined)
    try {
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
                      title: 'Docs Hit',
                      url: 'https://docs.example',
                      desc: 'docs desc',
                    },
                  ],
                },
              ],
            },
          },
        },
      })
      const ddgResponse =
        '<a class="result__a" href="https://ddg.example">DDG</a>' +
        '<a class="result__snippet">ddg snippet</a>'

      let context7Called = false
      const innerFetch = fetchRouter([
        ['api.qwant.com', { body: qwantResponse }],
        ['duckduckgo.com', { body: ddgResponse }],
      ])
      const wrappedFetch: typeof globalThis.fetch = ((
        ...args: Parameters<typeof globalThis.fetch>
      ) => {
        const url = String(args[0])
        if (url.includes('context7.com')) {
          context7Called = true
        }
        return innerFetch(...args)
      }) as typeof globalThis.fetch

      const result = await readDocsSource({
        libraryTitle: 'Bun',
        logger,
        fetch: wrappedFetch,
      })

      expect(context7Called).toBe(false)
      expect(result.documentation).toBeDefined()
    } finally {
      restoreContext7()
      restoreSerper()
      restoreParallel()
      restoreTavily()
      restoreExa()
      restoreFirecrawl()
    }
  })
})
