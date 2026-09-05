import { createMockFs } from '@savant-code/common/testing/mocks/filesystem'
import { describe, expect, test } from 'bun:test'

import { applyPatchTool } from '../tools/apply-patch'

describe('applyPatchTool', () => {
  test('applies a standard update patch', async () => {
    const fs = createMockFs({
      files: {
        '/repo/src/file.ts': 'const a = 1\n',
      },
    })

    const result = await applyPatchTool({
      parameters: {
        operation: {
          type: 'update_file',
          path: 'src/file.ts',
          diff: '@@ -1,1 +1,1 @@\n-const a = 1\n+const a = 2\n',
        },
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result[0]?.type).toBe('json')
    if (result[0]?.type !== 'json') {
      throw new Error('Expected JSON tool result')
    }

    expect('errorMessage' in result[0].value).toBe(false)
    if ('errorMessage' in result[0].value) {
      throw new Error(`Unexpected error: ${result[0].value.errorMessage}`)
    }
    expect(result[0].value.applied[0]?.action).toBe('update')

    const updated = await fs.readFile('/repo/src/file.ts', 'utf-8')
    expect(updated).toContain('const a = 2')
  })

  test('applies update patch when hunks use bare @@ headers', async () => {
    const fs = createMockFs({
      files: {
        '/repo/src/file.ts': ['line1', 'line2', 'line3', ''].join('\n'),
      },
    })

    const result = await applyPatchTool({
      parameters: {
        operation: {
          type: 'update_file',
          path: 'src/file.ts',
          diff: ['@@', ' line1', '-line2', '+line2 changed', ' line3', ''].join(
            '\n',
          ),
        },
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result[0]?.type).toBe('json')
    if (result[0]?.type !== 'json') {
      throw new Error('Expected JSON tool result')
    }

    expect('errorMessage' in result[0].value).toBe(false)
    if ('errorMessage' in result[0].value) {
      throw new Error(`Unexpected error: ${result[0].value.errorMessage}`)
    }

    const updated = await fs.readFile('/repo/src/file.ts', 'utf-8')
    expect(updated).toBe(['line1', 'line2 changed', 'line3', ''].join('\n'))
  })

  test('applies update patch when hunk header ranges are incorrect', async () => {
    const fs = createMockFs({
      files: {
        '/repo/src/file.ts': ['line1', 'line2', 'line3', ''].join('\n'),
      },
    })

    const result = await applyPatchTool({
      parameters: {
        operation: {
          type: 'update_file',
          path: 'src/file.ts',
          diff: [
            '@@ -39,6 +39,39 @@',
            ' line1',
            '-line2',
            '+line2 changed',
            ' line3',
            '',
          ].join('\n'),
        },
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result[0]?.type).toBe('json')
    if (result[0]?.type !== 'json') {
      throw new Error('Expected JSON tool result')
    }

    expect('errorMessage' in result[0].value).toBe(false)
    if ('errorMessage' in result[0].value) {
      throw new Error(`Unexpected error: ${result[0].value.errorMessage}`)
    }

    const updated = await fs.readFile('/repo/src/file.ts', 'utf-8')
    expect(updated).toBe(['line1', 'line2 changed', 'line3', ''].join('\n'))
  })

  test('applies update patch when unified hunk header is malformed', async () => {
    const fs = createMockFs({
      files: {
        '/repo/src/file.ts': ['line1', 'line2', 'line3', ''].join('\n'),
      },
    })

    const result = await applyPatchTool({
      parameters: {
        operation: {
          type: 'update_file',
          path: 'src/file.ts',
          diff: [
            '@@ -1 +1 @@',
            ' line1',
            '-line2',
            '+line2 changed',
            ' line3',
            '',
          ].join('\n'),
        },
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result[0]?.type).toBe('json')
    if (result[0]?.type !== 'json') {
      throw new Error('Expected JSON tool result')
    }

    expect('errorMessage' in result[0].value).toBe(false)
    if ('errorMessage' in result[0].value) {
      throw new Error(`Unexpected error: ${result[0].value.errorMessage}`)
    }

    const updated = await fs.readFile('/repo/src/file.ts', 'utf-8')
    expect(updated).toBe(['line1', 'line2 changed', 'line3', ''].join('\n'))
  })

  test('applies update patch with codex-style @@ anchor headers', async () => {
    const fs = createMockFs({
      files: {
        '/repo/src/file.ts': ['before', 'target', 'after', ''].join('\n'),
      },
    })

    const result = await applyPatchTool({
      parameters: {
        operation: {
          type: 'update_file',
          path: 'src/file.ts',
          diff: ['@@ target', '+inserted', ' after', ''].join('\n'),
        },
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result[0]?.type).toBe('json')
    if (result[0]?.type !== 'json') {
      throw new Error('Expected JSON tool result')
    }

    expect('errorMessage' in result[0].value).toBe(false)
    if ('errorMessage' in result[0].value) {
      throw new Error(`Unexpected error: ${result[0].value.errorMessage}`)
    }

    const updated = await fs.readFile('/repo/src/file.ts', 'utf-8')
    expect(updated).toBe(
      ['before', 'target', 'inserted', 'after', ''].join('\n'),
    )
  })

  test('applies update patch when file has CRLF line endings', async () => {
    const fs = createMockFs({
      files: {
        '/repo/src/file.ts': 'line1\r\nline2\r\n',
      },
    })

    const result = await applyPatchTool({
      parameters: {
        operation: {
          type: 'update_file',
          path: 'src/file.ts',
          diff: '@@ -1,2 +1,2 @@\n-line1\n-line2\n+line1 changed\n+line2\n',
        },
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result[0]?.type).toBe('json')
    if (result[0]?.type !== 'json') {
      throw new Error('Expected JSON tool result')
    }

    expect('errorMessage' in result[0].value).toBe(false)
    if ('errorMessage' in result[0].value) {
      throw new Error(`Unexpected error: ${result[0].value.errorMessage}`)
    }
    expect(result[0].value.applied[0]?.action).toBe('update')

    const updated = await fs.readFile('/repo/src/file.ts', 'utf-8')
    expect(updated).toContain('line1 changed')
    expect(updated).toContain('\r\n')
  })
})
