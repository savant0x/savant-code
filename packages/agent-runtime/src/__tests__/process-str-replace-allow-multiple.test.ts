import { describe, expect, it } from 'bun:test'
import { applyPatch } from 'diff'

import { processStrReplace } from '../process-str-replace'

import type { Logger } from '@savant-code/common/types/contracts/logger'

// FID-2026-0819-005 Loop 213: allowMultiple suite moved verbatim from
// process-str-replace.test.ts; logger copied verbatim.

const logger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

describe('processStrReplace', () => {
  // New comprehensive tests for allowMultiple functionality
  describe('allowMultiple functionality', () => {
    it('should error when multiple occurrences exist and allowMultiple is false', async () => {
      const initialContent = 'const x = 1;\nconst x = 2;\nconst x = 3;\n'
      const oldStr = 'const x'
      const newStr = 'let x'

      const result = await processStrReplace({
        path: 'test.ts',
        replacements: [
          { oldString: oldStr, newString: newStr, allowMultiple: false },
        ],
        initialContentPromise: Promise.resolve(initialContent),
        logger,
      })

      expect(result).not.toBeNull()
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toContain('Found 3 occurrences')
        expect(result.error).toContain('set allowMultiple to true')
      }
    })

    it('should replace all occurrences when allowMultiple is true', async () => {
      const initialContent = 'foo bar foo baz foo'
      const oldStr = 'foo'
      const newStr = 'FOO'

      const result = await processStrReplace({
        path: 'test.ts',
        replacements: [
          { oldString: oldStr, newString: newStr, allowMultiple: true },
        ],
        initialContentPromise: Promise.resolve(initialContent),
        logger,
      })

      expect(result).not.toBeNull()
      expect('content' in result).toBe(true)
      if ('content' in result) {
        expect(result.content).toBe('FOO bar FOO baz FOO')
      }
    })

    it('should handle single occurrence with allowMultiple: true', async () => {
      const initialContent = 'const x = 1;\nconst y = 2;\n'
      const oldStr = 'const y = 2;'
      const newStr = 'const y = 3;'

      const result = await processStrReplace({
        path: 'test.ts',
        replacements: [
          { oldString: oldStr, newString: newStr, allowMultiple: true },
        ],
        initialContentPromise: Promise.resolve(initialContent),
        logger,
      })

      expect(result).not.toBeNull()
      expect('content' in result).toBe(true)
      if ('content' in result) {
        expect(result.content).toBe('const x = 1;\nconst y = 3;\n')
      }
    })

    it('should handle mixed allowMultiple settings in multiple replacements', async () => {
      const initialContent = 'foo bar foo\nbaz baz baz\nqux qux'
      const replacements = [
        { oldString: 'foo', newString: 'FOO', allowMultiple: true }, // Replace all 'foo'
        { oldString: 'baz', newString: 'BAZ', allowMultiple: false }, // Should error on multiple 'baz'
        { oldString: 'qux qux', newString: 'QUX', allowMultiple: false }, // Single occurrence, should work
      ]

      const result = await processStrReplace({
        path: 'test.ts',
        replacements,
        initialContentPromise: Promise.resolve(initialContent),
        logger,
      })

      expect(result).not.toBeNull()
      expect('content' in result).toBe(true)
      if ('content' in result) {
        // Should have applied foo->FOO and qux qux->QUX, but not baz->BAZ

        expect(result.content).toBe('FOO bar FOO\nbaz baz baz\nQUX')
        expect(result.messages).toHaveLength(1)
        expect(result.messages[0]).toContain('Found 3 occurrences of "baz"')
        expect(result.messages[0]).toContain('set allowMultiple to true')
      }
    })

    it('should replace multiple lines with allowMultiple: true', async () => {
      const initialContent = `function test() {
  console.log('debug');
}
function test2() {
  console.log('debug');
}
function test3() {
  console.log('info');
}`
      const oldStr = "console.log('debug');"
      const newStr = '// removed debug log'

      const result = await processStrReplace({
        path: 'test.ts',
        replacements: [
          { oldString: oldStr, newString: newStr, allowMultiple: true },
        ],
        initialContentPromise: Promise.resolve(initialContent),
        logger,
      })

      expect(result).not.toBeNull()
      expect('content' in result).toBe(true)
      if ('content' in result) {
        expect(result.content).toContain('// removed debug log')
        // Should have replaced both debug logs but not the info log
        expect((result.content.match(/removed debug log/g) || []).length).toBe(
          2,
        )
        expect(result.content).toContain("console.log('info');")
      }
    })

    it('should handle empty new string with allowMultiple: true (deletion)', async () => {
      const initialContent = 'remove this, keep this, remove this, keep this'
      const oldStr = 'remove this, '
      const newStr = ''

      const result = await processStrReplace({
        path: 'test.ts',
        replacements: [
          { oldString: oldStr, newString: newStr, allowMultiple: true },
        ],
        initialContentPromise: Promise.resolve(initialContent),
        logger,
      })

      expect(result).not.toBeNull()
      expect('content' in result).toBe(true)
      if ('content' in result) {
        expect(result.content).toBe('keep this, keep this')
      }
    })

    it('should handle allowMultiple with indentation matching', async () => {
      const initialContent = `  if (condition) {
    doSomething();
  }
  if (condition) {
    doSomething();
  }`
      const oldStr = 'doSomething();'
      const newStr = 'doSomethingElse();'

      const result = await processStrReplace({
        path: 'test.ts',
        replacements: [
          { oldString: oldStr, newString: newStr, allowMultiple: true },
        ],
        initialContentPromise: Promise.resolve(initialContent),
        logger,
      })

      expect(result).not.toBeNull()
      expect('content' in result).toBe(true)
      if ('content' in result) {
        expect(result.content).toContain('doSomethingElse();')
        expect((result.content.match(/doSomethingElse/g) || []).length).toBe(2)
      }
    })

    it('should handle zero occurrences with allowMultiple: true', async () => {
      const initialContent = 'const x = 1;\nconst y = 2;\n'
      const oldStr = 'const z = 3;' // This string doesn't exist
      const newStr = 'const z = 4;'

      const result = await processStrReplace({
        path: 'test.ts',
        replacements: [
          { oldString: oldStr, newString: newStr, allowMultiple: true },
        ],
        initialContentPromise: Promise.resolve(initialContent),
        logger,
      })

      expect(result).not.toBeNull()
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toContain(
          'The old string "const z = 3;" was not found',
        )
      }
    })
  })

  it('should handle applying multiple replacements on nearby lines', async () => {
    const initialContent = 'line 1\nline 2\nline 3\n'
    const replacements = [
      {
        oldString: 'line 2\n',
        newString: 'this is a new line\n',
        allowMultiple: false,
      },
      {
        oldString: 'line 3\n',
        newString: 'new line 3\n',
        allowMultiple: false,
      },
    ]

    const result = await processStrReplace({
      path: 'test.ts',
      replacements,
      initialContentPromise: Promise.resolve(initialContent),
      logger,
    })

    expect('content' in result).toBe(true)
    const successResult = result as { content: string; patch: string }
    expect(applyPatch(initialContent, successResult.patch)).toBe(
      'line 1\nthis is a new line\nnew line 3\n',
    )
  })

  it('should handle double dollar signs correctly', async () => {
    const initialContent = 'line 1\nhello $world!\nline 2\n'
    const oldStr = 'hello $world!\n'
    const newStr = 'hello $$world!\n'

    const result = await processStrReplace({
      path: 'test.ts',
      replacements: [
        { oldString: oldStr, newString: newStr, allowMultiple: false },
      ],
      initialContentPromise: Promise.resolve(initialContent),
      logger,
    })

    expect(result).not.toBeNull()
    const successResult = result as { content: string }
    expect(successResult.content).toBe('line 1\nhello $$world!\nline 2\n')
  })
})
