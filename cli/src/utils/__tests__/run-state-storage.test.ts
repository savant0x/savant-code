import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import { getAllToggleIdsFromMessages } from '../run-state-storage'

import type { ChatMessage } from '../../types/chat'

// Point persistence at a temp dir via the explicit test override — module
// seams (mock.module, HOME, spyOn on auth) are unreliable across bun test
// files and platforms.
const mockProjectDataDir = path.join(os.tmpdir(), 'savant-code-test-project')
const mockCurrentChatDir = path.join(
  mockProjectDataDir,
  'chats',
  'test-chat-123',
)

describe('run-state-storage', () => {
  beforeEach(() => {
    // Create test directories
    if (fs.existsSync(mockProjectDataDir)) {
      fs.rmSync(mockProjectDataDir, { recursive: true })
    }
    fs.mkdirSync(mockCurrentChatDir, { recursive: true })
  })
  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(mockProjectDataDir)) {
      fs.rmSync(mockProjectDataDir, { recursive: true })
    }
  })
  describe('getAllToggleIdsFromMessages', () => {
    test('extracts agent IDs from messages', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [
            {
              type: 'agent',
              agentId: 'agent-1',
              agentName: 'TestAgent',
              agentType: 'inline',
              content: '',
              status: 'complete',
              blocks: [],
            },
          ],
        },
      ]
      const ids = getAllToggleIdsFromMessages(messages)
      expect(ids).toContain('agent-1')
    })
    test('extracts tool call IDs from messages', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [
            {
              type: 'tool',
              toolCallId: 'tool-1',
              toolName: 'glob',
              input: {},
              output: '',
            },
          ],
        },
      ]
      const ids = getAllToggleIdsFromMessages(messages)
      expect(ids).toContain('tool-1')
    })
    test('recursively extracts IDs from nested agent blocks', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [
            {
              type: 'agent',
              agentId: 'parent-agent',
              agentName: 'ParentAgent',
              agentType: 'inline',
              content: '',
              status: 'complete',
              blocks: [
                {
                  type: 'tool',
                  toolCallId: 'nested-tool',
                  toolName: 'glob',
                  input: {},
                  output: '',
                },
                {
                  type: 'agent',
                  agentId: 'child-agent',
                  agentName: 'ChildAgent',
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
        },
      ]
      const ids = getAllToggleIdsFromMessages(messages)
      expect(ids).toContain('parent-agent')
      expect(ids).toContain('nested-tool')
      expect(ids).toContain('child-agent')
      expect(ids).toContain('deep-tool')
    })
    test('handles messages with no blocks', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'user',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [],
        },
      ]
      const ids = getAllToggleIdsFromMessages(messages)
      expect(ids).toHaveLength(0)
    })
    test('handles empty messages array', () => {
      const ids = getAllToggleIdsFromMessages([])
      expect(ids).toHaveLength(0)
    })
    test('handles mixed block types in single message', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [
            { type: 'text', content: 'Some text' },
            {
              type: 'agent',
              agentId: 'agent-1',
              agentName: 'TestAgent',
              agentType: 'inline',
              content: '',
              status: 'complete',
              blocks: [],
            },
            {
              type: 'tool',
              toolCallId: 'tool-1',
              toolName: 'glob',
              input: {},
              output: '',
            },
          ],
        },
      ]
      const ids = getAllToggleIdsFromMessages(messages)
      expect(ids).toContain('agent-1')
      expect(ids).toContain('tool-1')
      expect(ids).toHaveLength(2)
    })
    test('does not deduplicate IDs (returns all occurrences)', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [
            {
              type: 'agent',
              agentId: 'shared-id',
              agentName: 'TestAgent',
              agentType: 'inline',
              content: '',
              status: 'complete',
              blocks: [],
            },
          ],
        },
        {
          id: 'msg-2',
          variant: 'agent',
          content: '',
          timestamp: new Date().toISOString(),
          blocks: [
            {
              type: 'tool',
              toolCallId: 'shared-id',
              toolName: 'glob',
              input: {},
              output: '',
            },
          ],
        },
      ]
      const ids = getAllToggleIdsFromMessages(messages)
      // Current implementation returns all occurrences without deduplication
      expect(ids.filter((id) => id === 'shared-id')).toHaveLength(2)
    })
  })
})
