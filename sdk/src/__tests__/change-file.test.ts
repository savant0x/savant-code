import { createMockFs } from '@savant-code/common/testing/mocks/filesystem'
import { describe, expect, test } from 'bun:test'

import { changeFile } from '../tools/change-file'

describe('changeFile', () => {
  test('returns a simple success message for string replacements', async () => {
    const fs = createMockFs({
      files: {
        '/repo/src/file.ts': 'const value = 1\n',
      },
    })

    const result = await changeFile({
      parameters: {
        type: 'patch',
        path: 'src/file.ts',
        content: '@@ -1,1 +1,1 @@\n-const value = 1\n+const value = 2\n',
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result).toEqual([
      {
        type: 'json',
        value: {
          file: 'src/file.ts',
          message: 'String replace applied successfully.',
        },
      },
    ])
    expect(await fs.readFile('/repo/src/file.ts', 'utf-8')).toBe(
      'const value = 2\n',
    )
  })

  test('tolerates absolute paths inside the project for string replacements', async () => {
    const fs = createMockFs({
      files: {
        '/repo/src/file.ts': 'const value = 1\n',
      },
    })

    const result = await changeFile({
      parameters: {
        type: 'patch',
        path: '/repo/src/file.ts',
        content: '@@ -1,1 +1,1 @@\n-const value = 1\n+const value = 2\n',
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result).toEqual([
      {
        type: 'json',
        value: {
          file: 'src/file.ts',
          message: 'String replace applied successfully.',
        },
      },
    ])
    expect(await fs.readFile('/repo/src/file.ts', 'utf-8')).toBe(
      'const value = 2\n',
    )
  })

  test('returns a simple success message for new file writes', async () => {
    const fs = createMockFs()

    const result = await changeFile({
      parameters: {
        type: 'file',
        path: 'src/file.ts',
        content: 'const value = 1\n',
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result).toEqual([
      {
        type: 'json',
        value: {
          file: 'src/file.ts',
          message: 'Created file successfully.',
        },
      },
    ])
    expect(await fs.readFile('/repo/src/file.ts', 'utf-8')).toBe(
      'const value = 1\n',
    )
  })

  test('tolerates absolute paths inside the project for file writes', async () => {
    const fs = createMockFs()

    const result = await changeFile({
      parameters: {
        type: 'file',
        path: '/repo/src/file.ts',
        content: 'const value = 1\n',
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result).toEqual([
      {
        type: 'json',
        value: {
          file: 'src/file.ts',
          message: 'Created file successfully.',
        },
      },
    ])
    expect(await fs.readFile('/repo/src/file.ts', 'utf-8')).toBe(
      'const value = 1\n',
    )
  })

  test('accepts paths whose file names start with two dots inside the project', async () => {
    const fs = createMockFs()

    const result = await changeFile({
      parameters: {
        type: 'file',
        path: '/repo/..config',
        content: 'value = true\n',
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result).toEqual([
      {
        type: 'json',
        value: {
          file: '..config',
          message: 'Created file successfully.',
        },
      },
    ])
    expect(await fs.readFile('/repo/..config', 'utf-8')).toBe('value = true\n')
  })

  test('returns a simple success message for overwritten file writes', async () => {
    const fs = createMockFs({
      files: {
        '/repo/src/file.ts': 'const value = 1\n',
      },
    })

    const result = await changeFile({
      parameters: {
        type: 'file',
        path: 'src/file.ts',
        content: 'const value = 2\n',
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    expect(result).toEqual([
      {
        type: 'json',
        value: {
          file: 'src/file.ts',
          message: 'Overwrote file successfully.',
        },
      },
    ])
    expect(await fs.readFile('/repo/src/file.ts', 'utf-8')).toBe(
      'const value = 2\n',
    )
  })

  test('rejects absolute paths outside the project (FID-014 v2 security fix)', async () => {
    const fs = createMockFs()

    const result = await changeFile({
      parameters: {
        type: 'file',
        path: '/outside/file.ts',
        content: 'const value = 1\n',
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })

    // FID-014 v2: writes outside the project are now blocked. Prior
    // behavior allowed /outside/file.ts to succeed (vulnerability fixed).
    expect(result[0]?.type).toBe('json')
    if (result[0]?.type !== 'json') {
      throw new Error('Expected JSON tool result')
    }
    expect('errorMessage' in result[0].value).toBe(true)
    if (!('errorMessage' in result[0].value)) {
      throw new Error('Expected errorMessage in tool result')
    }
    expect(result[0].value.errorMessage).toMatch(/escapes|outside|containment/)
    expect(result[0].value.file).toBe('/outside/file.ts')
  })
})
