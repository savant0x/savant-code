import { describe, expect, it } from 'bun:test'

import { processStrReplace } from '../process-str-replace'

import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * FID-2026-1012-020: a mismatch is a diagnosed failure and a no-op is a
 * completed outcome. The old code reported both through one message
 * ("No change to the file"), so a genuine failure read as a benign no-op and a
 * benign no-op read as a failure.
 */

const logger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

describe('processStrReplace outcomes', () => {
  it('reports a mismatch as a diagnosed failure, never as a no-op', async () => {
    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        {
          oldString: 'const z = 9;',
          newString: 'const z = 10;',
          allowMultiple: false,
        },
      ],
      initialContentPromise: Promise.resolve('const x = 1;\nconst y = 2;\n'),
      logger,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toStartWith('The old string')
      expect(result.error).toContain('Why: no line of your old string appears')
      expect(result.error).not.toContain('No change to the file')
    }
  })

  it('names the closest verbatim line when the block around it differs', async () => {
    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        {
          oldString: 'const y = 2;\nconst w = 9;',
          newString: 'const y = 20;',
          allowMultiple: false,
        },
      ],
      initialContentPromise: Promise.resolve(
        'const x = 1;\nconst y = 2;\nconst z = 3;\n',
      ),
      logger,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('Why: a line of your old string appears')
      expect(result.error).toContain('Closest line 2: "const y = 2;"')
    }
  })

  it('reports an edit that changes nothing as a completed no-op', async () => {
    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        {
          oldString: 'const x = 1;',
          newString: 'const x = 1;',
          allowMultiple: false,
        },
      ],
      initialContentPromise: Promise.resolve('const x = 1;\n'),
      logger,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toStartWith('No change to the file')
      expect(result.error).toContain('completed outcome, not a failure')
      expect(result.error).toContain('proceed to the next step')
      expect(result.error).not.toContain('was not found')
    }
  })
})
