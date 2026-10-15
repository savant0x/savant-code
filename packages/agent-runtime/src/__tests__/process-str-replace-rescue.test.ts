import { describe, expect, it } from 'bun:test'

import { processStrReplace } from '../process-str-replace'

import type { Logger } from '@savant-code/common/types/contracts/logger'

const logger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

/**
 * Indentation rescue (FID-2026-0910-003; FID-2026-0913-002 split from
 * process-str-replace.test.ts — the exact-match pins stay in the base file,
 * the rescue-variant family lives here).
 */
describe('indentation rescue (FID-2026-0910-003)', () => {
  it('(a) uniform-indent rescue writes the re-indented replacement', async () => {
    const initialContent = '    alpha\n    beta\n'

    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        {
          oldString: 'alpha\nbeta',
          newString: 'gamma\ndelta',
          allowMultiple: false,
        },
      ],
      initialContentPromise: Promise.resolve(initialContent),
      logger,
    })

    expect('content' in result).toBe(true)
    if ('content' in result) {
      expect(result.content).toBe('    gamma\n    delta\n')
    }
  })

  it('(b) rescues a first-line-dedented oldString and mirrors the indent', async () => {
    const initialContent = '  const a = 1;\n  first\n  second\n'

    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        {
          oldString: '\nfirst\n  second',
          newString: '\nFIRST\n  SECOND',
          allowMultiple: false,
        },
      ],
      initialContentPromise: Promise.resolve(initialContent),
      logger,
    })

    expect('content' in result).toBe(true)
    if ('content' in result) {
      expect(result.content).toBe('  const a = 1;\n  FIRST\n  SECOND\n')
    }
  })

  it('(c) an exact multi-line match never consults the rescue', async () => {
    const initialContent = '  alpha\n  beta\n'

    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        {
          oldString: '  alpha\n  beta',
          newString: '  gamma\n  delta',
          allowMultiple: false,
        },
      ],
      initialContentPromise: Promise.resolve(initialContent),
      logger,
    })

    expect('content' in result).toBe(true)
    if ('content' in result) {
      expect(result.content).toBe('  gamma\n  delta\n')
    }
  })

  it('(d) a non-matchable oldString still yields the canonical not-found error', async () => {
    const initialContent = '  const a = 1;\n'

    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        {
          oldString: 'zzz\n  qqq',
          newString: 'yy',
          allowMultiple: false,
        },
      ],
      initialContentPromise: Promise.resolve(initialContent),
      logger,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('was not found in the file')
    }
  })

  it('(e) prefers the uniform-indent rescue over the first-line variant', async () => {
    const initialContent = 'X\n  alpha\n    beta\nY\n  alpha\n  beta\nZ\n'

    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        {
          oldString: '\nalpha\n  beta',
          newString: '\nGAMMA\n  DELTA',
          allowMultiple: false,
        },
      ],
      initialContentPromise: Promise.resolve(initialContent),
      logger,
    })

    expect('content' in result).toBe(true)
    if ('content' in result) {
      // The uniform +2 variant matches region U first; the first-line +2
      // region F stays untouched — precedence is uniform-before-first-line.
      expect(result.content).toBe(
        'X\n  GAMMA\n    DELTA\nY\n  alpha\n  beta\nZ\n',
      )
    }
  })

  it('(f) an all-empty-line replacement lands raw (no indent mirrored)', async () => {
    const initialContent = '  const a = 1;\n  first\n  second\n'

    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        {
          oldString: '\nfirst\n  second',
          newString: '\n',
          allowMultiple: false,
        },
      ],
      initialContentPromise: Promise.resolve(initialContent),
      logger,
    })

    expect('content' in result).toBe(true)
    if ('content' in result) {
      expect(result.content).toBe('  const a = 1;\n\n')
    }
  })
})
