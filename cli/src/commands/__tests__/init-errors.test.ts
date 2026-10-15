import * as fs from 'fs'
import path from 'path'

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

import * as projectFiles from '../../project-files'
import { handleInitializationFlowLocally } from '../init'
import { COMMON_TYPE_FILES } from '../init-type-files'

import type { ChatMessage } from '../../types/chat'

/** Helper to extract text content from ChatMessages returned by getSystemMessage */
const getMessageText = (messages: ChatMessage[]): string => {
  return messages
    .map((m) => {
      // ChatMessage has content as a string, not an array
      if (typeof m.content === 'string') {
        return m.content
      }
      return ''
    })
    .join('')
}

describe('handleInitializationFlowLocally', () => {
  const TEST_PROJECT_ROOT = '/test/project'
  const KNOWLEDGE_FILE_NAME = 'knowledge.md'

  let existsSyncSpy: ReturnType<typeof spyOn>
  let writeFileSyncSpy: ReturnType<typeof spyOn>
  let mkdirSyncSpy: ReturnType<typeof spyOn>
  let _getProjectRootSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    // Mock getProjectRoot
    _getProjectRootSpy = spyOn(projectFiles, 'getProjectRoot').mockReturnValue(
      TEST_PROJECT_ROOT,
    )

    // Mock fs functions
    existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(false)
    writeFileSyncSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {})
    mkdirSyncSpy = spyOn(fs, 'mkdirSync').mockImplementation(() => undefined)
  })

  afterEach(() => {
    mock.restore()
  })

  // FID-2026-0819-005 Loop 296: error-handling and integration suites moved verbatim from init.test.ts; harness copied verbatim.

  describe('error handling', () => {
    test('handles writeFileSync errors for type files gracefully', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('tools.ts')) {
          throw new Error('Permission denied')
        }
      })

      const { postUserMessage } = handleInitializationFlowLocally()

      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      // Should have error message for tools.ts
      expect(messageContent).toContain(
        '⚠️ Failed to copy `.agents/types/tools.ts`',
      )
      expect(messageContent).toContain('Permission denied')
    })

    test('handles writeFileSync errors for knowledge.md gracefully', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith(KNOWLEDGE_FILE_NAME)) {
          throw new Error('Disk full')
        }
      })

      // The function should throw when knowledge.md write fails
      // since knowledge.md write is not wrapped in try-catch
      expect(() => handleInitializationFlowLocally()).toThrow('Disk full')
    })

    test('handles mkdirSync errors for .agents directory gracefully', () => {
      existsSyncSpy.mockReturnValue(false)
      mkdirSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('.agents')) {
          throw new Error('Cannot create directory')
        }
        return undefined
      })

      // The function should throw when .agents directory creation fails
      // since mkdirSync is not wrapped in try-catch
      expect(() => handleInitializationFlowLocally()).toThrow(
        'Cannot create directory',
      )
    })

    test('handles mkdirSync errors for .agents/types directory gracefully', () => {
      existsSyncSpy.mockImplementation((p: unknown) => {
        // .agents exists but .agents/types doesn't
        return p === path.join(TEST_PROJECT_ROOT, '.agents')
      })
      mkdirSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('types')) {
          throw new Error('Permission denied for types dir')
        }
        return undefined
      })

      // The function should throw when .agents/types directory creation fails
      expect(() => handleInitializationFlowLocally()).toThrow(
        'Permission denied for types dir',
      )
    })

    test('continues copying other files when one type file fails', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        // Only fail for agent-definition.ts
        if ((p as string).endsWith('agent-definition.ts')) {
          throw new Error('File locked')
        }
      })

      const { postUserMessage } = handleInitializationFlowLocally()
      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      // Should have error for agent-definition.ts
      expect(messageContent).toContain(
        '⚠️ Failed to copy `.agents/types/agent-definition.ts`',
      )
      expect(messageContent).toContain('File locked')

      // But should still succeed for tools.ts and util-types.ts
      expect(messageContent).toContain('✅ Copied `.agents/types/tools.ts`')
      expect(messageContent).toContain(
        '✅ Copied `.agents/types/util-types.ts`',
      )
    })

    test('handles non-Error exceptions in type file copying', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('util-types.ts')) {
          // Throw a non-Error value
          throw 'string error'
        }
      })

      const { postUserMessage } = handleInitializationFlowLocally()
      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      // Should handle non-Error exceptions gracefully
      expect(messageContent).toContain(
        '⚠️ Failed to copy `.agents/types/util-types.ts`',
      )
      expect(messageContent).toContain('string error')
    })

    test('handles null/undefined exceptions in type file copying', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('tools.ts')) {
          // Throw null
          throw null
        }
      })

      const { postUserMessage } = handleInitializationFlowLocally()
      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      // Should handle null exceptions with 'Unknown' fallback
      expect(messageContent).toContain(
        '⚠️ Failed to copy `.agents/types/tools.ts`',
      )
      expect(messageContent).toContain('Unknown')
    })
  })

  describe('integration scenarios', () => {
    test('handles partial initialization state correctly', () => {
      const agentsDir = path.join(TEST_PROJECT_ROOT, '.agents')
      const typesDir = path.join(agentsDir, 'types')

      // Scenario: knowledge.md exists, .agents exists, but .agents/types and type files don't exist
      existsSyncSpy.mockImplementation((p: unknown) => {
        return (
          p === path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME) ||
          p === agentsDir
        )
      })

      const { postUserMessage } = handleInitializationFlowLocally()

      // Should NOT create knowledge.md
      const knowledgeWriteCalls = writeFileSyncSpy.mock.calls.filter(
        (call: unknown[]) =>
          call[0] === path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME),
      )
      expect(knowledgeWriteCalls.length).toBe(0)

      // Should NOT create .agents directory
      const agentsDirCalls = mkdirSyncSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === agentsDir,
      )
      expect(agentsDirCalls.length).toBe(0)

      // Should create .agents/types directory
      const typesDirCalls = mkdirSyncSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === typesDir,
      )
      expect(typesDirCalls.length).toBe(1)

      // Should copy type files (Loop 358: the scaffold grew from 3 to 8 files
      // when the agent-definition/tools type monoliths decomposed — assert
      // against the live scaffold inventory, not a stale count)
      const typeFileCalls = writeFileSyncSpy.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).startsWith(typesDir),
      )
      expect(typeFileCalls.length).toBe(COMMON_TYPE_FILES.length)

      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      expect(messageContent).toContain('📋 `knowledge.md` already exists')
      expect(messageContent).toContain('📋 `.agents/` already exists')
      expect(messageContent).toContain('✅ Created `.agents/types/`')
    })

    test('handles fully initialized project correctly', () => {
      // Everything exists
      existsSyncSpy.mockReturnValue(true)

      const { postUserMessage } = handleInitializationFlowLocally()

      // Nothing should be created
      expect(writeFileSyncSpy).not.toHaveBeenCalled()
      expect(mkdirSyncSpy).not.toHaveBeenCalled()

      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      // All messages should indicate existing files
      expect(messageContent).toContain('📋 `knowledge.md` already exists')
      expect(messageContent).toContain('📋 `.agents/` already exists')
      expect(messageContent).toContain('📋 `.agents/types/` already exists')
      expect(messageContent).toContain(
        '📋 `.agents/types/agent-definition.ts` already exists',
      )
      expect(messageContent).toContain(
        '📋 `.agents/types/tools.ts` already exists',
      )
      expect(messageContent).toContain(
        '📋 `.agents/types/util-types.ts` already exists',
      )
    })
  })
})
