import * as mainPromptModule from '@savant-code/agent-runtime/main-prompt'
import * as projectFileTree from '@savant-code/common/project-file-tree'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { SavantCodeClient } from '../client'
import * as databaseModule from '../impl/database'

import type { FileFilter } from '../tools/read-files'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { PathLike } from 'node:fs'

// FID-2026-0819-005 Loop 208: no-fileFilter and fileFilter-before-gitignore
// suites moved verbatim from run-file-filter.test.ts; harness
// (createNodeError, createMockFs, afterEach) copied verbatim.

interface NodeError extends Error {
  code?: string
}

const createNodeError = (message: string, code: string): NodeError => {
  const error: NodeError = new Error(message)
  error.code = code
  return error
}

function createMockFs(config: {
  files?: Record<string, { content: string; size?: number }>
}): SavantCodeFileSystem {
  const { files = {} } = config

  return {
    readFile: async (filePath: PathLike) => {
      const pathStr = String(filePath)
      if (files[pathStr]) {
        return files[pathStr].content
      }
      throw createNodeError(
        `ENOENT: no such file or directory: ${pathStr}`,
        'ENOENT',
      )
    },
    stat: async (filePath: PathLike) => {
      const pathStr = String(filePath)
      if (files[pathStr]) {
        return {
          size: files[pathStr].size ?? files[pathStr].content.length,
          isDirectory: () => false,
          isFile: () => true,
          atimeMs: Date.now(),
          mtimeMs: Date.now(),
        }
      }
      throw createNodeError(
        `ENOENT: no such file or directory: ${pathStr}`,
        'ENOENT',
      )
    },
    readdir: async () => [],
    mkdir: async () => undefined,
    writeFile: async () => undefined,
  } as unknown as SavantCodeFileSystem
}

describe('SavantCodeClientOptions fileFilter', () => {
  afterEach(() => {
    mock.restore()
  })

  it('should allow all files when no fileFilter is provided', async () => {
    spyOn(databaseModule, 'getUserInfoFromApiKey').mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      discord_id: null,
      stripe_customer_id: null,
      banned: false,
      created_at: new Date('2024-01-01T00:00:00Z'),
    })
    spyOn(databaseModule, 'fetchAgentFromDatabase').mockResolvedValue(null)
    spyOn(databaseModule, 'startAgentRun').mockResolvedValue('run-1')
    spyOn(databaseModule, 'finishAgentRun').mockResolvedValue(undefined)
    spyOn(databaseModule, 'addAgentStep').mockResolvedValue('step-1')
    spyOn(projectFileTree, 'isFileIgnored').mockResolvedValue(false)

    const mockFs = createMockFs({
      files: {
        '/project/src/index.ts': { content: 'normal file content' },
      },
    })

    let requestedFiles: Record<string, string | null> = {}

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId, requestFiles } = params
        const sessionState = getInitialSessionState(getStubProjectFileContext())

        requestedFiles = await requestFiles({
          filePaths: ['src/index.ts'],
        })

        await sendAction({
          action: {
            type: 'prompt-response',
            promptId,
            sessionState,
            output: {
              type: 'lastMessage',
              value: [],
            },
          },
        })

        return {
          sessionState,
          output: {
            type: 'lastMessage' as const,
            value: [],
          },
        }
      },
    )

    // No fileFilter provided
    const client = new SavantCodeClient({
      apiKey: 'test-key',
      cwd: '/project',
      fsSource: mockFs,
    })

    const result = await client.run({
      agent: 'savant',
      prompt: 'read files',
    })

    expect(result.output.type).toBe('lastMessage')
    expect(requestedFiles['src/index.ts']).toBe('normal file content')
  })

  it('should run fileFilter before gitignore check', async () => {
    spyOn(databaseModule, 'getUserInfoFromApiKey').mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      discord_id: null,
      stripe_customer_id: null,
      banned: false,
      created_at: new Date('2024-01-01T00:00:00Z'),
    })
    spyOn(databaseModule, 'fetchAgentFromDatabase').mockResolvedValue(null)
    spyOn(databaseModule, 'startAgentRun').mockResolvedValue('run-1')
    spyOn(databaseModule, 'finishAgentRun').mockResolvedValue(undefined)
    spyOn(databaseModule, 'addAgentStep').mockResolvedValue('step-1')

    const isFileIgnoredSpy = spyOn(
      projectFileTree,
      'isFileIgnored',
    ).mockResolvedValue(false)

    const mockFs = createMockFs({
      files: {
        '/project/blocked.ts': { content: 'blocked content' },
      },
    })

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId, requestFiles } = params
        const sessionState = getInitialSessionState(getStubProjectFileContext())

        await requestFiles({
          filePaths: ['blocked.ts'],
        })

        await sendAction({
          action: {
            type: 'prompt-response',
            promptId,
            sessionState,
            output: {
              type: 'lastMessage',
              value: [],
            },
          },
        })

        return {
          sessionState,
          output: {
            type: 'lastMessage' as const,
            value: [],
          },
        }
      },
    )

    const fileFilter: FileFilter = () => {
      // Block all files
      return { status: 'blocked' }
    }

    const client = new SavantCodeClient({
      apiKey: 'test-key',
      cwd: '/project',
      fsSource: mockFs,
      fileFilter,
    })

    await client.run({
      agent: 'savant',
      prompt: 'read files',
    })

    // isFileIgnored should not be called since fileFilter blocks the file first
    expect(isFileIgnoredSpy).not.toHaveBeenCalled()
  })
})
