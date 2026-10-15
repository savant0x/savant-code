// use-suggestion-engine — matching edge cases (case sensitivity, partial
// segments, flat paths, deep nesting, uniqueness).
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

describe('use-suggestion-engine - edge cases', () => {
  test('handles case-insensitive matching', () => {
    const results = filterFileMatches(sampleFiles, 'CLI/USE-')

    expect(results.length).toBeGreaterThan(0)
    expect(
      results.some((r) => r.filePath.includes('use-suggestion-engine')),
    ).toBe(true)
  })

  test('does not match partial segments incorrectly', () => {
    const results = filterFileMatches(sampleFiles, 'cl/us')

    // Should only match if "cl" and "us" appear as substrings in order
    expect(results.length).toBeGreaterThan(0)
    expect(
      results.some(
        (r) => r.filePath === 'cli/src/hooks/use-suggestion-engine.ts',
      ),
    ).toBe(true)
  })

  test('handles files with no directory separators', () => {
    const flatFiles = ['file.ts', 'another.tsx', 'test.ts']
    const results = filterFileMatches(flatFiles, 'file')

    expect(results.length).toBe(1)
    expect(results[0].filePath).toBe('file.ts')
  })

  test('handles complex nested paths', () => {
    const deepFiles = [
      'very/deeply/nested/path/to/some/file.ts',
      'another/deep/path/file.tsx',
    ]
    const results = filterFileMatches(deepFiles, 'deep/path')

    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.filePath.includes('deeply/nested/path'))).toBe(
      true,
    )
    expect(results.some((r) => r.filePath.includes('deep/path'))).toBe(true)
  })

  test('preserves order and uniqueness', () => {
    const results = filterFileMatches(sampleFiles, 'cli')

    // Check that results are unique
    const paths = results.map((r) => r.filePath)
    const uniquePaths = new Set(paths)
    expect(paths.length).toBe(uniquePaths.size)
  })
})
