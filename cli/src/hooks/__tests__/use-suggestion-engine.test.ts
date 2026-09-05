// use-suggestion-engine — slash-separated path matching.
// Parent of the Loop 328 decomposition (non-slash matching, prioritization,
// @-mention guard cases, and edge cases live in sibling files; the shared
// filterFileMatches harness lives in ./use-suggestion-engine-harness).

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

describe('use-suggestion-engine - filterFileMatches', () => {
  describe('slash-separated path matching', () => {
    test('matches "cli/use-" to files with cli and use- segments', () => {
      const results = filterFileMatches(sampleFiles, 'cli/use-')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some((r) => r.filePath.includes('use-suggestion-engine')),
      ).toBe(true)
      expect(results.some((r) => r.filePath.includes('use-timeout'))).toBe(true)
      expect(results.some((r) => r.filePath.includes('use-usage-query'))).toBe(
        true,
      )
    })

    test('matches "cli/hooks/use-" to specific hook files', () => {
      const results = filterFileMatches(sampleFiles, 'cli/hooks/use-')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some(
          (r) => r.filePath === 'cli/src/hooks/use-suggestion-engine.ts',
        ),
      ).toBe(true)
    })

    test('matches "web/ui/button" to button component', () => {
      const results = filterFileMatches(sampleFiles, 'web/ui/button')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some((r) => r.filePath === 'web/src/components/ui/button.tsx'),
      ).toBe(true)
    })

    test('does not match when segments are not found in order', () => {
      const results = filterFileMatches(sampleFiles, 'web/cli/use-')

      // Should not match because "web" comes after "cli" in file paths
      expect(results.length).toBe(0)
    })

    test('highlights correct indices for slash-separated matches', () => {
      const results = filterFileMatches(sampleFiles, 'cli/use-')

      const suggestionEngine = results.find(
        (r) => r.filePath === 'cli/src/hooks/use-suggestion-engine.ts',
      )
      expect(suggestionEngine).toBeDefined()
      expect(suggestionEngine?.pathHighlightIndices).toBeDefined()

      // Should highlight "cli" (indices 0,1,2) and "use-" somewhere in the path
      const indices = suggestionEngine?.pathHighlightIndices || []
      expect(indices).toContain(0) // 'c' in "cli"
      expect(indices).toContain(1) // 'l' in "cli"
      expect(indices).toContain(2) // 'i' in "cli"
      // Should highlight the "use-" part (note: query is "use-" which is 4 chars but we're searching for it)
      // The path is "cli/src/hooks/use-suggestion-engine.ts"
      // "use-" appears at position 15 in the string
      expect(indices.length).toBeGreaterThanOrEqual(7) // At least "cli" + "use-"
      expect(indices.some((i) => i >= 15 && i <= 18)).toBe(true) // Some part of "use-"
    })

    test('matches empty segments (trailing slash)', () => {
      const results = filterFileMatches(sampleFiles, 'cli/')

      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.filePath.startsWith('cli/'))).toBe(true)
    })

    test('matches multiple slash segments', () => {
      const results = filterFileMatches(sampleFiles, 'cli/src/hooks')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.every(
          (r) =>
            r.filePath.includes('cli') &&
            r.filePath.includes('src') &&
            r.filePath.includes('hooks'),
        ),
      ).toBe(true)
    })
  })
})
