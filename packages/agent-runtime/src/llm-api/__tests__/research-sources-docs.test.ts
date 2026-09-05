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

import { readDocsSource } from '../research-sources'

import type { Logger } from '@savant-code/common/types/contracts/logger'

const logger = TEST_AGENT_RUNTIME_IMPL.logger as Logger

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// FID-2026-0819-005 Loop 295: readDocsSource suites moved verbatim from research-sources.test.ts; header helpers copied verbatim.

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
