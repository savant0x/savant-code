import * as mainPromptModule from '@savant-code/agent-runtime/main-prompt'
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { SavantCodeClient } from '../client'
import * as databaseModule from '../impl/database'

import type { JSONValue } from '@savant-code/common/types/json'

interface ToolCallContentBlock {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input: Record<string, JSONValue>
}

const setupDatabaseMocks = () => {
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
}

describe('Error preserves in-progress message history', () => {
  afterEach(() => {
    mock.restore()
  })

  it('preserves in-progress assistant work on error (simulated via shared state mutation)', async () => {
    setupDatabaseMocks()

    // Simulate the agent runtime:
    // 1. Mutates the shared session state with the user message and partial work
    // 2. Then throws due to a downstream timeout/service error
    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const mainAgentState = params.action.sessionState.mainAgentState

        // Match the real runtime's behavior: replace messageHistory with a new
        // array that includes the user prompt as its first entry. The SDK
        // detects runtime progress via reference inequality, so we must
        // reassign the array rather than pushing into it.
        mainAgentState.messageHistory = [
          ...mainAgentState.messageHistory,
          {
            role: 'user',
            content: [{ type: 'text', text: 'Fix the bug in auth.ts' }],
            tags: ['USER_PROMPT'],
          },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me read the auth file first.' },
              {
                type: 'tool-call',
                toolCallId: 'read-1',
                toolName: 'read_files',
                input: { paths: ['auth.ts'] },
              } as ToolCallContentBlock,
            ],
          },
          {
            role: 'tool',
            toolCallId: 'read-1',
            toolName: 'read_files',
            content: [
              {
                type: 'json',
                value: [{ path: 'auth.ts', content: 'const auth = ...' }],
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Found the issue, writing the fix now.' },
              {
                type: 'tool-call',
                toolCallId: 'write-1',
                toolName: 'write_file',
                input: { path: 'auth.ts', content: 'const auth = fixed' },
              } as ToolCallContentBlock,
            ],
          },
          {
            role: 'tool',
            toolCallId: 'write-1',
            toolName: 'write_file',
            content: [
              {
                type: 'json',
                value: { file: 'auth.ts', message: 'File written' },
              },
            ],
          },
        ]

        // Now simulate a server timeout on the next LLM call
        const timeoutError = new Error('Service Unavailable') as Error & {
          statusCode: number
          responseBody: string
        }
        timeoutError.statusCode = 503
        timeoutError.responseBody = JSON.stringify({
          message: 'Request timeout after 30s',
        })
        throw timeoutError
      },
    )

    const client = new SavantCodeClient({ apiKey: 'test-key' })
    const result = await client.run({
      agent: 'savant',
      prompt: 'Fix the bug in auth.ts',
    })

    // Error output with correct status code
    expect(result.output.type).toBe('error')
    const errorOutput = result.output as {
      type: 'error'
      message: string
      statusCode?: number
    }
    expect(errorOutput.statusCode).toBe(503)

    const history = result.sessionState!.mainAgentState.messageHistory

    // The user's prompt should appear exactly once
    const userPromptMessages = history.filter(
      (m) =>
        m.role === 'user' &&
        (m.content as Array<{ type: string; text?: string }>).some(
          (c) => c.type === 'text' && c.text?.includes('Fix the bug'),
        ),
    )
    expect(userPromptMessages.length).toBe(1)

    // Assistant text messages from both steps should be preserved
    const firstAssistantText = history.find(
      (m) =>
        m.role === 'assistant' &&
        (m.content as Array<{ type: string; text?: string }>).some(
          (c) => c.type === 'text' && c.text?.includes('read the auth file'),
        ),
    )
    expect(firstAssistantText).toBeDefined()

    const secondAssistantText = history.find(
      (m) =>
        m.role === 'assistant' &&
        (m.content as Array<{ type: string; text?: string }>).some(
          (c) => c.type === 'text' && c.text?.includes('writing the fix'),
        ),
    )
    expect(secondAssistantText).toBeDefined()

    // Both tool calls and both tool results should be preserved
    const readToolCall = history.find(
      (m) =>
        m.role === 'assistant' &&
        (m.content as Array<{ type: string; toolCallId?: string }>).some(
          (c) => c.type === 'tool-call' && c.toolCallId === 'read-1',
        ),
    )
    expect(readToolCall).toBeDefined()

    const writeToolCall = history.find(
      (m) =>
        m.role === 'assistant' &&
        (m.content as Array<{ type: string; toolCallId?: string }>).some(
          (c) => c.type === 'tool-call' && c.toolCallId === 'write-1',
        ),
    )
    expect(writeToolCall).toBeDefined()

    const readToolResult = history.find(
      (m) => m.role === 'tool' && m.toolCallId === 'read-1',
    )
    expect(readToolResult).toBeDefined()

    const writeToolResult = history.find(
      (m) => m.role === 'tool' && m.toolCallId === 'write-1',
    )
    expect(writeToolResult).toBeDefined()
  })
})
