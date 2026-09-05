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

  describe('knowledge file creation', () => {
    test('creates knowledge.md when it does not exist', () => {
      existsSyncSpy.mockImplementation((_p: string) => false)

      const { postUserMessage } = handleInitializationFlowLocally()

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME),
        expect.stringContaining('# Project knowledge'),
      )

      // Check message indicates creation
      const messages = postUserMessage([])
      expect(messages.length).toBeGreaterThan(0)
      expect(getMessageText(messages)).toContain('✅ Created `knowledge.md`')
    })

    test('skips knowledge.md creation when it already exists', () => {
      existsSyncSpy.mockImplementation(
        (p: unknown) => p === path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME),
      )

      const { postUserMessage } = handleInitializationFlowLocally()

      // writeFileSync should not be called for knowledge.md
      const knowledgeWriteCalls = writeFileSyncSpy.mock.calls.filter(
        (call: unknown[]) =>
          call[0] === path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME),
      )
      expect(knowledgeWriteCalls.length).toBe(0)

      // Check message indicates file already exists
      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain(
        '📋 `knowledge.md` already exists',
      )
    })
  })

  describe('.agents directory creation', () => {
    test('creates .agents directory when it does not exist', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      expect(mkdirSyncSpy).toHaveBeenCalledWith(
        path.join(TEST_PROJECT_ROOT, '.agents'),
        { recursive: true },
      )

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain('✅ Created `.agents/`')
    })

    test('skips .agents directory creation when it already exists', () => {
      existsSyncSpy.mockImplementation(
        (p: unknown) => p === path.join(TEST_PROJECT_ROOT, '.agents'),
      )

      const { postUserMessage } = handleInitializationFlowLocally()

      // mkdirSync should not be called for .agents directory
      const agentsDirCalls = mkdirSyncSpy.mock.calls.filter(
        (call: unknown[]) =>
          call[0] === path.join(TEST_PROJECT_ROOT, '.agents'),
      )
      expect(agentsDirCalls.length).toBe(0)

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain('📋 `.agents/` already exists')
    })
  })

  describe('.agents/types directory creation', () => {
    test('creates .agents/types directory when it does not exist', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      expect(mkdirSyncSpy).toHaveBeenCalledWith(
        path.join(TEST_PROJECT_ROOT, '.agents', 'types'),
        { recursive: true },
      )

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain('✅ Created `.agents/types/`')
    })

    test('skips .agents/types directory creation when it already exists', () => {
      existsSyncSpy.mockImplementation((p: unknown) => {
        // .agents exists, .agents/types exists
        return (
          p === path.join(TEST_PROJECT_ROOT, '.agents') ||
          p === path.join(TEST_PROJECT_ROOT, '.agents', 'types')
        )
      })

      const { postUserMessage } = handleInitializationFlowLocally()

      // mkdirSync should not be called for .agents/types directory
      const typesDirCalls = mkdirSyncSpy.mock.calls.filter(
        (call: unknown[]) =>
          call[0] === path.join(TEST_PROJECT_ROOT, '.agents', 'types'),
      )
      expect(typesDirCalls.length).toBe(0)

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain(
        '📋 `.agents/types/` already exists',
      )
    })
  })

  describe('type file copying', () => {
    test('copies type files when they do not exist', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      // Check that writeFileSync was called for type files
      const typeFiles = ['agent-definition.ts', 'tools.ts', 'util-types.ts']
      for (const fileName of typeFiles) {
        const fileCalls = writeFileSyncSpy.mock.calls.filter(
          (call: unknown[]) => (call[0] as string).endsWith(fileName),
        )
        expect(fileCalls.length).toBe(1)
      }

      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      // Should have success messages for copied files
      expect(messageContent).toContain('`.agents/types/agent-definition.ts`')
      expect(messageContent).toContain('`.agents/types/tools.ts`')
      expect(messageContent).toContain('`.agents/types/util-types.ts`')
    })

    test('skips type files that already exist', () => {
      const typesDir = path.join(TEST_PROJECT_ROOT, '.agents', 'types')
      existsSyncSpy.mockImplementation((p: unknown) => {
        // Only agent-definition.ts exists
        return p === path.join(typesDir, 'agent-definition.ts')
      })

      const { postUserMessage } = handleInitializationFlowLocally()

      // agent-definition.ts should NOT be written
      const agentDefCalls = writeFileSyncSpy.mock.calls.filter(
        (call: unknown[]) =>
          (call[0] as string).endsWith('agent-definition.ts'),
      )
      expect(agentDefCalls.length).toBe(0)

      // tools.ts and util-types.ts should be written
      const toolsCalls = writeFileSyncSpy.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).endsWith('tools.ts'),
      )
      expect(toolsCalls.length).toBe(1)

      const utilTypesCalls = writeFileSyncSpy.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).endsWith('util-types.ts'),
      )
      expect(utilTypesCalls.length).toBe(1)

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain(
        '📋 `.agents/types/agent-definition.ts` already exists',
      )
    })
  })

  describe('message accumulation', () => {
    test('returns multiple messages for all operations', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      const messages = postUserMessage([])

      // Should have messages for:
      // 1. knowledge.md creation
      // 2. .agents/ creation
      // 3. .agents/types/ creation
      // 4-6. Three type file copies
      expect(messages.length).toBeGreaterThanOrEqual(6)
    })

    test('preserves previous messages in postUserMessage', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      // ChatMessage has content as a string, not an array
      const previousMessages: ChatMessage[] = [
        {
          id: 'user-123',
          variant: 'user',
          content: 'Previous message',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ]

      const messages = postUserMessage(previousMessages)

      // First message should be the previous one
      expect(messages[0]).toEqual(previousMessages[0])
      // Should have additional messages
      expect(messages.length).toBeGreaterThan(1)
    })
  })
})
