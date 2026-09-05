// use-suggestion-engine — non-slash query matching (original behavior).
// Sibling of the Loop 328 decomposition (shared harness in
// ./use-suggestion-engine-harness).

import { describe, test, expect } from 'bun:test'

import { filterFileMatches } from './use-suggestion-engine-harness'

const sampleFiles = [
  'cli/src/hooks/use-suggestion-engine.ts',
  'cli/src/hooks/use-timeout.ts',
  'cli/src/hooks/use-usage-query.ts',
  'cli/src/components/suggestion-menu.tsx',
  'cli/src/chat.tsx',
  'web/src/components/ui/button.tsx',
  'backend/src/tools/definitions/list.ts',
  'common/src/util/file.ts',
  'packages/agent-runtime/src/index.ts',
]

describe('use-suggestion-engine - filterFileMatches (non-slash queries)', () => {
  test('matches file name prefix', () => {
    const results = filterFileMatches(sampleFiles, 'use-')

    expect(results.length).toBeGreaterThan(0)
    expect(
      results.some((r) => r.filePath.includes('use-suggestion-engine')),
    ).toBe(true)
    expect(results.some((r) => r.filePath.includes('use-timeout'))).toBe(true)
  })

  test('matches path prefix', () => {
    const results = filterFileMatches(sampleFiles, 'cli')

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.filePath.startsWith('cli'))).toBe(true)
  })

  test('matches substring in file name', () => {
    const results = filterFileMatches(sampleFiles, 'suggestion')

    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.filePath.includes('suggestion-engine'))).toBe(
      true,
    )
    expect(results.some((r) => r.filePath.includes('suggestion-menu'))).toBe(
      true,
    )
  })

  test('matches substring in path', () => {
    const results = filterFileMatches(sampleFiles, 'components')

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.filePath.includes('components'))).toBe(true)
  })

  test('returns empty array for empty query', () => {
    const results = filterFileMatches(sampleFiles, '')
    expect(results.length).toBe(0)
  })

  test('returns empty array for no matches', () => {
    const results = filterFileMatches(sampleFiles, 'nonexistent')
    expect(results.length).toBe(0)
  })
})
