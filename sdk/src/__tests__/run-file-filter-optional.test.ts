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

  it('should pass fileFilter to requestOptionalFile as well', async () => {
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
        '/project/secret.key': { content: 'private key content' },
      },
    })

    let optionalFileResult: string | null = null

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId, requestOptionalFile } = params
        const sessionState = getInitialSessionState(getStubProjectFileContext())

        // Use requestOptionalFile which should also use the fileFilter
        optionalFileResult = await requestOptionalFile({
          filePath: 'secret.key',
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

    const filterCalls: string[] = []
    const fileFilter: FileFilter = (filePath) => {
      filterCalls.push(filePath)
      if (filePath.endsWith('.key')) {
        return { status: 'blocked' }
      }
      return { status: 'allow' }
    }

    const client = new SavantCodeClient({
      apiKey: 'test-key',
      cwd: '/project',
      fsSource: mockFs,
      fileFilter,
    })

    const result = await client.run({
      agent: 'savant',
      prompt: 'read optional file',
    })

    expect(result.output.type).toBe('lastMessage')
    expect(filterCalls).toContain('secret.key')
    // Optional file should return null for blocked files (via toOptionalFile)
    expect(optionalFileResult).toBeNull()
  })

  it('should tolerate absolute requestOptionalFile paths inside cwd', async () => {
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

    const optionalFileResult: { current: string | null } = { current: null }

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId, requestOptionalFile } = params
        const sessionState = getInitialSessionState(getStubProjectFileContext())

        optionalFileResult.current = await requestOptionalFile({
          filePath: '/project/src/index.ts',
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

    const client = new SavantCodeClient({
      apiKey: 'test-key',
      cwd: '/project',
      fsSource: mockFs,
    })

    const result = await client.run({
      agent: 'savant',
      prompt: 'read optional file',
    })

    expect(result.output.type).toBe('lastMessage')
    expect(optionalFileResult.current).toBe('normal file content')
  })
})
