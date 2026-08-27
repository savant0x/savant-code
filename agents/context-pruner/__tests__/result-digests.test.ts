import { describe, expect, test } from 'bun:test'

import { buildResultDigest } from '../result-digests'

describe('buildResultDigest preservation contract (FID-2026-0824-024)', () => {
  test('json part with a path yields identity plus HEAD slice', () => {
    const content = [
      {
        type: 'json',
        value: { path: 'src/x.ts', body: 'a'.repeat(50) },
      },
    ]

    const digest = buildResultDigest('read_files', content)

    expect(digest).not.toBeNull()
    expect(digest).toContain('[digest] read_files')
    expect(digest).toContain('path=src/x.ts')
    expect(digest).toContain('HEAD:')
    expect(digest).not.toContain('TAIL:')
  })

  test('long values are bounded to HEAD plus TAIL slices', () => {
    const long = 'x'.repeat(4000)

    const digest = buildResultDigest('read_files', [{ type: 'text', text: long }])

    expect(digest).not.toBeNull()
    expect(digest).toContain('…TAIL:')
    expect((digest ?? '').length).toBeLessThan(1200)
  })

  test('unknown tool without identity fields still produces a fallback digest', () => {
    const digest = buildResultDigest('some_exotic_tool', [
      { type: 'json', value: { answer: 42 } },
    ])

    expect(digest).not.toBeNull()
    expect(digest).toContain('[digest] some_exotic_tool bytes=')
  })

  test('empty or missing content returns null', () => {
    expect(buildResultDigest('read_files', null)).toBeNull()
    expect(buildResultDigest('read_files', undefined)).toBeNull()
    expect(buildResultDigest('read_files', [])).toBeNull()
    expect(buildResultDigest('read_files', [{ type: 'json' }])).toBeNull()
  })
})