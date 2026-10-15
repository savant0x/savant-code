import { describe, expect, test } from 'bun:test'

import {
  deriveQueries,
  domainScore,
  extractOrganicHits,
  runDeepResearch,
  DEPTH_QUERY_COUNTS,
} from '../deep-research'

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as never

const serperJson = (
  organic: Array<{ title?: string; link?: string; snippet?: string }>,
): string => JSON.stringify({ organic })

const hit = (link: string, title = `Title ${link}`) => ({
  title,
  link,
  snippet: `Snippet about ${link}`,
})

// ============================================================================
// deriveQueries — depth preset counts (Loop 2 R1: 3/5/10)
// ============================================================================

describe('deriveQueries', () => {
  test('returns 3/5/10 variants by research_depth', () => {
    const q = 'Bun vs Node for CLIs'
    expect(deriveQueries(q, 'quick')).toHaveLength(DEPTH_QUERY_COUNTS.quick)
    expect(deriveQueries(q, 'standard')).toHaveLength(
      DEPTH_QUERY_COUNTS.standard,
    )
    expect(deriveQueries(q, 'thorough')).toHaveLength(
      DEPTH_QUERY_COUNTS.thorough,
    )
  })

  test('first query is the raw question', () => {
    expect(deriveQueries('question', 'standard')[0]).toBe('question')
  })
})

// ============================================================================
// domainScore — static reliability map (docs 1.0 > github 0.9 > SO 0.8 >
// dev.to 0.7 > other 0.5)
// ============================================================================

describe('domainScore', () => {
  test('scores known domains per the reliability map', () => {
    expect(domainScore('https://docs.bun.sh/runtime')).toBe(1.0)
    expect(domainScore('https://github.com/oven-sh/bun')).toBe(0.9)
    expect(domainScore('https://stackoverflow.com/questions/123/bun')).toBe(0.8)
    expect(domainScore('https://dev.to/someone/bun-tips')).toBe(0.7)
    expect(domainScore('https://example.com/bun')).toBe(0.5)
  })

  test('falls back to 0.5 for unparseable URLs', () => {
    expect(domainScore('not a url')).toBe(0.5)
  })
})

// ============================================================================
// extractOrganicHits
// ============================================================================

describe('extractOrganicHits', () => {
  test('parses organic results from the facade JSON text', () => {
    const hits = extractOrganicHits(
      serperJson([hit('https://a.example'), hit('https://b.example')]),
    )
    expect(hits).toHaveLength(2)
    expect(hits[0].link).toBe('https://a.example')
  })

  test('returns [] for garbage text', () => {
    expect(extractOrganicHits('not json')).toEqual([])
    expect(extractOrganicHits('{}')).toEqual([])
  })
})

// ============================================================================
// runDeepResearch — dedup / cap / timeout / gaps / credits
// ============================================================================

describe('runDeepResearch', () => {
  test('dedups by URL keeping the highest domain score', async () => {
    // Same URL surfaced by two queries with different scores is impossible
    // (score is derived from the URL) — but a duplicate hit in a single
    // response must collapse to one finding.
    const search = async () => ({
      result: serperJson([
        hit('https://github.com/a/b'),
        hit('https://github.com/a/b'),
        hit('https://example.com/c'),
      ]),
    })
    const out = await runDeepResearch({
      question: 'q',
      queries: ['q1', 'q2'],
      maxSources: 10,
      search,
      logger: noopLogger,
      spacingMs: 0,
    })
    expect(out.findings).toHaveLength(2)
    expect(out.citations).toHaveLength(2)
    expect(out.truncated).toBe(false)
    expect(out.incomplete).toBe(false)
  })

  test('caps citations at max_sources with truncated: true', async () => {
    const urls = Array.from(
      { length: 20 },
      (_, i) => `https://example.com/source-${i}`,
    )
    const search = async () => ({ result: serperJson(urls.map((u) => hit(u))) })
    const out = await runDeepResearch({
      question: 'q',
      queries: ['q1'],
      maxSources: 5,
      search,
      logger: noopLogger,
      spacingMs: 0,
    })
    expect(out.findings).toHaveLength(5)
    expect(out.truncated).toBe(true)
    expect(out.gaps.some((g) => g.includes('exceeded 5 sources'))).toBe(true)
  })

  test('sorts findings by domain score descending', async () => {
    const search = async () => ({
      result: serperJson([
        hit('https://example.com/low'),
        hit('https://github.com/a/b'),
        hit('https://docs.bun.sh/runtime'),
      ]),
    })
    const out = await runDeepResearch({
      question: 'q',
      queries: ['q1'],
      maxSources: 10,
      search,
      logger: noopLogger,
      spacingMs: 0,
    })
    expect(out.findings[0].url).toBe('https://docs.bun.sh/runtime')
    expect(out.findings[1].url).toBe('https://github.com/a/b')
    expect(out.findings[2].url).toBe('https://example.com/low')
  })

  test('marks incomplete with gaps when a sub-query fails', async () => {
    const search = async (query: string) => {
      if (query === 'bad') return { error: 'rate limited' }
      return { result: serperJson([hit('https://docs.bun.sh/runtime')]) }
    }
    const out = await runDeepResearch({
      question: 'q',
      queries: ['good', 'bad'],
      maxSources: 10,
      search,
      logger: noopLogger,
      spacingMs: 0,
    })
    expect(out.incomplete).toBe(true)
    expect(
      out.gaps.some((g) => g.includes('bad') && g.includes('rate limited')),
    ).toBe(true)
    expect(out.findings.length).toBeGreaterThanOrEqual(1)
  })

  test('marks incomplete when a sub-query times out (never hard-fails)', async () => {
    const search = (query: string) =>
      query === 'slow'
        ? new Promise<{ result: string }>(() => {}) // never resolves
        : Promise.resolve({
            result: serperJson([hit('https://example.com/ok')]),
          })
    const out = await runDeepResearch({
      question: 'q',
      queries: ['fast', 'slow'],
      maxSources: 10,
      search,
      logger: noopLogger,
      spacingMs: 0,
      timeoutMs: 50,
    })
    expect(out.incomplete).toBe(true)
    expect(out.gaps.some((g) => g.includes('slow'))).toBe(true)
    // The successful query's findings are still returned.
    expect(out.findings.length).toBeGreaterThanOrEqual(1)
  })

  test('aggregates creditsUsed from the search facade', async () => {
    const search = async () => ({
      result: serperJson([hit('https://example.com/ok')]),
      creditsUsed: 3,
    })
    const out = await runDeepResearch({
      question: 'q',
      queries: ['q1', 'q2', 'q3'],
      maxSources: 10,
      search,
      logger: noopLogger,
      spacingMs: 0,
    })
    expect(out.creditsUsed).toBe(9)
  })

  test('skips hits without a link', async () => {
    const search = async () => ({
      result: serperJson([{ title: 'no link' }, hit('https://example.com/ok')]),
    })
    const out = await runDeepResearch({
      question: 'q',
      queries: ['q1'],
      maxSources: 10,
      search,
      logger: noopLogger,
      spacingMs: 0,
    })
    expect(out.findings).toHaveLength(1)
  })
})
