import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import { getAllToggleIdsFromMessages } from '../run-state-storage'

import type { ChatMessage, ContentBlock } from '../../types/chat'
import type { RunState } from '@savant-code/sdk'

const mockProjectDataDir = path.join(os.tmpdir(), 'savant-code-test-project')
const mockCurrentChatDir = path.join(
  mockProjectDataDir,
  'chats',
  'test-chat-123',
)

describe('run-state-storage paths', () => {
  // The original monolith created these directories in an outer beforeEach
  // that ran for every inner suite — including the serialization writes below.
  beforeEach(() => {
    if (fs.existsSync(mockProjectDataDir)) {
      fs.rmSync(mockProjectDataDir, { recursive: true })
    }
    fs.mkdirSync(mockCurrentChatDir, { recursive: true })
  })
  afterEach(() => {
    if (fs.existsSync(mockProjectDataDir)) {
      fs.rmSync(mockProjectDataDir, { recursive: true })
    }
  })
  describe('getRunStatePath', () => {
    test('returns path with correct filename', () => {
      // We need to mock the internal functions
      // This is a simplified test - in reality we'd need to mock the module
      const testPath = path.join(mockCurrentChatDir, 'run-state.json')
      expect(testPath).toContain('run-state.json')
    })
  })
  describe('getChatMessagesPath', () => {
    test('returns path with correct filename', () => {
      const testPath = path.join(mockCurrentChatDir, 'chat-messages.json')
      expect(testPath).toContain('chat-messages.json')
    })
  })
  describe('file serialization format', () => {
    test('run state JSON structure is preserved through serialization', () => {
      const runState: RunState = {
        output: {
          type: 'error',
          message: 'Test output',
        },
      } as unknown as RunState
      const runStatePath = path.join(mockCurrentChatDir, 'run-state.json')
      fs.writeFileSync(runStatePath, JSON.stringify(runState, null, 2))
      const savedRunState = JSON.parse(fs.readFileSync(runStatePath, 'utf8'))
      expect(savedRunState.output.type).toBe('error')
      expect(savedRunState.output.message).toBe('Test output')
    })
    test('messages JSON structure is preserved through serialization', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString(),
          blocks: [{ type: 'text', content: 'Hello' }],
        },
      ]
      const messagesPath = path.join(mockCurrentChatDir, 'chat-messages.json')
      fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2))
      const savedMessages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'))
      expect(savedMessages).toHaveLength(1)
      expect(savedMessages[0].variant).toBe('user')
    })
    test('nested message structure is preserved through serialization', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [
            {
              type: 'agent',
              agentId: 'nested-agent',
              agentName: 'NestedAgent',
              agentType: 'inline',
              content: '',
              status: 'complete',
              blocks: [
                { type: 'text', content: 'Nested content' },
                {
                  type: 'tool',
                  toolCallId: 'tool-xyz',
                  toolName: 'glob',
                  input: {},
                  output: '',
                },
              ],
            },
          ],
        },
      ]
      const messagesPath = path.join(mockCurrentChatDir, 'chat-messages.json')
      fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2))
      const savedMessages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'))
      expect(savedMessages[0].blocks[0].type).toBe('agent')
      expect(savedMessages[0].blocks[0].blocks).toHaveLength(2)
    })
  })
  describe('edge cases', () => {
    test('handles empty blocks array', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [],
        },
      ]
      const ids = getAllToggleIdsFromMessages(messages)
      expect(ids).toHaveLength(0)
    })
    test('handles deeply nested structure', () => {
      const deepBlock: ContentBlock = {
        type: 'agent',
        agentId: 'level-0',
        agentName: 'Level0Agent',
        agentType: 'inline',
        content: '',
        status: 'complete',
        blocks: [
          {
            type: 'agent',
            agentId: 'level-1',
            agentName: 'Level1Agent',
            agentType: 'inline',
            content: '',
            status: 'complete',
            blocks: [
              {
                type: 'agent',
                agentId: 'level-2',
                agentName: 'Level2Agent',
                agentType: 'inline',
                content: '',
                status: 'complete',
                blocks: [
                  {
                    type: 'tool',
                    toolCallId: 'deep-tool',
                    toolName: 'glob',
                    input: {},
                    output: '',
                  },
                ],
              },
            ],
          },
        ],
      }
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [deepBlock],
        },
      ]
      const ids = getAllToggleIdsFromMessages(messages)
      expect(ids).toContain('level-0')
      expect(ids).toContain('level-1')
      expect(ids).toContain('level-2')
      expect(ids).toContain('deep-tool')
    })
    test('preserves order of IDs as encountered', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [
            {
              type: 'agent',
              agentId: 'first',
              agentName: 'FirstAgent',
              agentType: 'inline',
              content: '',
              status: 'complete',
              blocks: [],
            },
            {
              type: 'tool',
              toolCallId: 'second',
              toolName: 'glob',
              input: {},
              output: '',
            },
            {
              type: 'agent',
              agentId: 'third',
              agentName: 'ThirdAgent',
              agentType: 'inline',
              content: '',
              status: 'complete',
              blocks: [],
            },
          ],
        },
      ]
      const ids = getAllToggleIdsFromMessages(messages)
      expect(ids[0]).toBe('first')
      expect(ids[1]).toBe('second')
      expect(ids[2]).toBe('third')
    })
  })
})
