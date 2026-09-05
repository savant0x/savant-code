// use-suggestion-engine — prioritization by contiguous match length.
// Sibling of the Loop 328 decomposition (shared harness in
// ./use-suggestion-engine-harness).

import { describe, test, expect } from 'bun:test'

import { filterFileMatches } from './use-suggestion-engine-harness'

describe('use-suggestion-engine - prioritization', () => {
  test('prioritizes exact contiguous path matches over scattered matches', () => {
    const files = [
      'cli/src/hooks/use-suggestion.ts',
      'cli/something/use-suggestion.ts',
      'client/src/use-suggestion.ts',
    ]
    const results = filterFileMatches(files, 'cli/use-')

    // 'cli/src/hooks/use-suggestion.ts' should come first because it has longest contiguous match
    // "cli/" is contiguous (4 chars including slash), then "use-" is contiguous (4 chars)
    expect(results[0].filePath).toBe('cli/src/hooks/use-suggestion.ts')
  })

  test('prioritizes "cli/src" over "cli" + "src" scattered', () => {
    const files = ['cli/something/src/file.ts', 'cli/src/file.ts']
    const results = filterFileMatches(files, 'cli/src')

    // 'cli/src/file.ts' should come first because "cli/src" is fully contiguous (7 chars)
    expect(results[0].filePath).toBe('cli/src/file.ts')
  })

  test('prioritizes longer contiguous segments including slashes', () => {
    const files = [
      'web/src/components/ui/button.tsx',
      'web/something/ui/button.tsx',
      'website/ui/button.tsx',
    ]
    const results = filterFileMatches(files, 'web/ui')

    // 'web/src/components/ui' has the longest contiguous match 'web/'
    // but 'website/ui' has 'website/ui' which is also long
    // The actual behavior prioritizes the one with longest exact query match
    expect(results[0].filePath).toBe('web/src/components/ui/button.tsx') // Has 'web/' + 'ui' matching
  })

  test('ranks results by total contiguous match length for slash queries', () => {
    const files = [
      'a/b/c/d.ts', // "a/b" = 3 chars contiguous (exact match)
      'a/b/e.ts', // "a/b" = 3 chars contiguous (exact match)
      'ab/c/d.ts', // "ab/" = 3 chars contiguous
      'abc/d.ts', // "ab" = 2 chars only
    ]
    const results = filterFileMatches(files, 'a/b')

    // Should prioritize by longest contiguous match - all 3-char matches tie, then 2-char
    // Both 'a/b/c/d.ts' and 'ab/c/d.ts' have 3 contiguous chars matching 'a/b'
    expect(results[0].filePath).toBe('a/b/c/d.ts') // Exact 'a/b' match
    expect(results[1].filePath).toBe('a/b/e.ts') // Exact 'a/b' match
    expect(results[2].filePath).toBe('ab/c/d.ts') // 'ab/' partial match
  })

  test('prioritizes contiguous "cli/hooks" over "cli" + "hooks" scattered', () => {
    const files = [
      'cli/src/hooks/use-something.ts',
      'cli/hooks/use-something.ts',
      'cli_backup/hooks/use-something.ts',
    ]
    const results = filterFileMatches(files, 'cli/hooks')

    // 'cli/hooks/use-something.ts' has "cli/hooks" fully contiguous (9 chars)
    expect(results[0].filePath).toBe('cli/hooks/use-something.ts')
  })
})
