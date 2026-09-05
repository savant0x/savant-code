import { describe, expect, test } from 'bun:test'

import {
  formatOrganicAsDocumentation,
  parseOrganicHits,
} from '../research-sources'

/** Build a Serper-shaped organic JSON string (compact). */
function serperOrganic(
  hits: Array<{ title: string; link: string; snippet: string }>,
): string {
  return JSON.stringify({ organic: hits })
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
