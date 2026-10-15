import { createMockFs } from '@savant-code/common/testing/mocks/filesystem'
import { describe, expect, test } from 'bun:test'

import { applyPatchTool } from '../tools/apply-patch'
import { changeFile } from '../tools/change-file'
import { listDirectory } from '../tools/list-directory'

import type { LogValue } from '@savant-code/common/types/contracts/logger'

describe('FID-020 SDK edit boundary diagnostics', () => {
  test('a failed legacy patch returns diagnosis without echoing its payload', async () => {
    const secret = 'sk-fixture-secretvalue123456'
    const content = `const token = '${secret}'\nconst value = 1\n`
    const fs = createMockFs({ files: { '/repo/file.ts': content } })
    const result = await changeFile({
      parameters: {
        type: 'patch',
        path: 'file.ts',
        content: `@@ -1,2 +1,2 @@\n const token = '${secret}'\n-absent\n+attempted-payload\n`,
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })
    const text = JSON.stringify(result)
    expect(text).toContain('Closest line 1')
    expect(text).toContain('[REDACTED]')
    expect(text).not.toContain(secret)
    expect(text).not.toContain('attempted-payload')
    expect(await fs.readFile('/repo/file.ts', 'utf-8')).toBe(content)
  })

  test('apply_patch diagnostics never echo parser context or addition payloads', async () => {
    const secret = 'sk-fixture-secretvalue123456'
    const fs = createMockFs({
      files: { '/repo/file.ts': `known\n${secret}\n` },
    })
    const result = await applyPatchTool({
      parameters: {
        operation: {
          type: 'update_file',
          path: 'file.ts',
          diff: `@@\n known\n-${secret}\n-missing-context\n+attempted-payload\n`,
        },
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })
    const text = JSON.stringify(result)
    expect(text).toContain('Closest line')
    expect(text).not.toContain(secret)
    expect(text).not.toContain('attempted-payload')
  })

  test('a valid deletion of all content writes an empty file', async () => {
    const fs = createMockFs({ files: { '/repo/file.ts': 'one\n' } })
    const result = await applyPatchTool({
      parameters: {
        operation: {
          type: 'update_file',
          path: 'file.ts',
          diff: '@@\n-one\n',
        },
      },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
    })
    expect(JSON.stringify(result)).not.toContain('errorMessage')
    expect(await fs.readFile('/repo/file.ts', 'utf-8')).toBe('')
  })

  test('missing directories carry a code and repair action without raw exception text', async () => {
    const fs = createMockFs({
      readdirImpl: async () => {
        throw Object.assign(new Error('private exception payload'), {
          code: 'ENOENT',
        })
      },
    })
    const result = await listDirectory({
      directoryPath: 'missing',
      projectPath: '/repo',
      fs,
    })
    const text = JSON.stringify(result)
    expect(text).toContain('ENOENT')
    expect(text).toContain('parent directory')
    expect(text).not.toContain('private exception payload')
  })

  test('write failures expose filesystem metadata, never file bodies or exception payloads', async () => {
    const body = 'private-file-body sk-fixture-secretvalue123456'
    const logs: string[] = []
    const fs = createMockFs({
      writeFileImpl: async () => {
        throw Object.assign(new Error(`failure ${body}`), { code: 'EACCES' })
      },
    })
    const result = await changeFile({
      parameters: { type: 'file', path: 'file.ts', content: body },
      cwd: '/repo',
      fs,
      realpathFn: (p) => p,
      logger: {
        error: (value: LogValue): void => {
          logs.push(JSON.stringify(value))
        },
      },
    })
    expect(JSON.stringify(result)).toContain('EACCES')
    expect(JSON.stringify(result)).not.toContain(body)
    expect(logs.join('\n')).not.toContain(body)
    expect(logs.join('\n')).toContain('contentChars')
  })
})
