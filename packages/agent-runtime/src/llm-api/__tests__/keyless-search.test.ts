import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'

import { keylessSearch, parseDdgHtml, parseQwantJson } from '../keyless-search'

describe('parseQwantJson', () => {
  test('parses web results and skips non-web / empty rows', () => {
    const json = JSON.stringify({
      status: 'success',
      data: {
        result: {
          items: {
            mainline: [
              {
                type: 'web',
                items: [
                  {
                    title: 'Bun docs',
                    url: 'https://bun.sh/docs',
                    desc: 'Official docs',
                  },
                  { title: '', url: 'https://empty.example', desc: 'skip' },
                  { title: 'No url', url: '', desc: 'skip' },
                ],
              },
              {
                type: 'news',
                items: [
                  { title: 'News', url: 'https://news.example', desc: 'skip' },
                ],
              },
            ],
          },
        },
      },
    })
    expect(parseQwantJson(json)).toEqual([
      {
        title: 'Bun docs',
        link: 'https://bun.sh/docs',
        snippet: 'Official docs',
      },
    ])
  })

  test('returns [] for a non-success (captcha/rate-limit) status', () => {
    expect(
      parseQwantJson(
        JSON.stringify({ status: 'error', data: { error_code: 24 } }),
      ),
    ).toEqual([])
  })

  test('returns [] for malformed JSON', () => {
    expect(parseQwantJson('not json{')).toEqual([])
  })
})

describe('parseDdgHtml', () => {
  test('parses title, unwraps uddg redirect, and decodes entities', () => {
    const html = [
      '<div class="result">',
      '<h2 class="result__title">',
      '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbun.sh%2Fdocs&amp;rut=abc">Bun &amp; docs</a>',
      '</h2>',
      '<a rel="nofollow" class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbun.sh%2Fdocs">Fast all-in-one runtime</a>',
      '</div>',
    ].join('\n')
    expect(parseDdgHtml(html)).toEqual([
      {
        title: 'Bun & docs',
        link: 'https://bun.sh/docs',
        snippet: 'Fast all-in-one runtime',
      },
    ])
  })

  test('normalizes direct (non-uddg) links and returns [] when no results', () => {
    const html =
      '<a class="result__a" href="https://example.com/x">Example</a>' +
      '<a class="result__snippet">Snippet</a>'
    expect(parseDdgHtml(html)).toEqual([
      { title: 'Example', link: 'https://example.com/x', snippet: 'Snippet' },
    ])
    expect(parseDdgHtml('<html>no results</html>')).toEqual([])
  })

  test('accepts reordered single-quoted attributes and a result without a snippet', () => {
    expect(
      parseDdgHtml(
        "<a href='https://example.com/docs' rel='nofollow' class='result__a'>Docs</a>",
      ),
    ).toEqual([
      { title: 'Docs', link: 'https://example.com/docs', snippet: undefined },
    ])
  })

  test('does not decode a destination path twice or admit executable links', () => {
    const href =
      '//duckduckgo.com/l/?uddg=' +
      encodeURIComponent('https://example.com/a%2Fb')
    const html =
      `<a data-href="https://wrong.example" href="${href}" class="result__a">Encoded path</a>` +
      '<a href="javascript:alert(1)" class="result__a">Unsafe</a>' +
      '<a class="result__snippet">A rejected result must not contaminate its predecessor.</a>' +
      '<a href="https://wrong.example" data-class="result__a">Not a result</a>'
    expect(parseDdgHtml(html)).toEqual([
      {
        title: 'Encoded path',
        link: 'https://example.com/a%2Fb',
        snippet: undefined,
      },
    ])
  })
})

describe('keylessSearch', () => {
  beforeAll(async () => {
    await mockModule('@savant-code/common/util/promise', () => ({
      withTimeout: async <T>(promise: Promise<T>) => promise,
    }))
  })

  afterAll(() => {
    clearMockedModules()
  })

  test('merges + dedupes Qwant and DDG into Serper organic shape', async () => {
    const qwant = JSON.stringify({
      status: 'success',
      data: {
        result: {
          items: {
            mainline: [
              {
                type: 'web',
                items: [
                  {
                    title: 'Shared',
                    url: 'https://shared.example',
                    desc: 'shared desc',
                  },
                  {
                    title: 'Qwant only',
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
    const ddg =
      '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fshared.example">Shared</a>' +
      '<a class="result__snippet">shared desc</a>' +
      '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fddg.example">DDG only</a>' +
      '<a class="result__snippet">ddg desc</a>'

    const fetchImpl = mock((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('api.qwant.com')) {
        return Promise.resolve(new Response(qwant, { status: 200 }))
      }
      if (url.includes('duckduckgo.com')) {
        return Promise.resolve(new Response(ddg, { status: 200 }))
      }
      return Promise.resolve(new Response('', { status: 404 }))
    }) as unknown as typeof globalThis.fetch

    const result = await keylessSearch({
      query: 'bun',
      logger: TEST_AGENT_RUNTIME_IMPL.logger,
      fetch: fetchImpl,
    })

    const parsed = JSON.parse(result!) as {
      organic: Array<{ title?: string; link?: string; position?: number }>
    }
    const links = parsed.organic.map((r) => r.link)
    expect(links).toContain('https://shared.example')
    expect(links).toContain('https://qwant.example')
    expect(links).toContain('https://ddg.example')
    expect(links.filter((l) => l === 'https://shared.example')).toHaveLength(1)
    expect(parsed.organic[0].position).toBe(1)
  })

  test('returns null when every engine fails', async () => {
    const fetchImpl = mock(() =>
      Promise.resolve(new Response('', { status: 500 })),
    ) as unknown as typeof globalThis.fetch

    const result = await keylessSearch({
      query: 'bun',
      logger: TEST_AGENT_RUNTIME_IMPL.logger,
      fetch: fetchImpl,
    })
    expect(result).toBeNull()
  })

  test('a usable DDG hit survives Qwant refusal and a missing snippet', async () => {
    const result = await keylessSearch({
      query: 'git worktrees',
      logger: TEST_AGENT_RUNTIME_IMPL.logger,
      fetch: (async (input: RequestInfo | URL) =>
        String(input).includes('api.qwant.com')
          ? new Response('', { status: 403 })
          : new Response(
              "<a href='https://example.com/worktrees' class='result__a'>Worktrees</a>",
            )) as typeof fetch,
    })
    expect(result).not.toBeNull()
    expect(JSON.parse(result ?? '{}')).toMatchObject({
      organic: [
        {
          title: 'Worktrees',
          link: 'https://example.com/worktrees',
          position: 1,
        },
      ],
    })
  })
})
