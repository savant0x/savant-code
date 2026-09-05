// FID-2026-0819-005 Loop 278: the mid-stream abort preservation suite moved
// verbatim from run-cancellation-part-c.test.ts ( multi-tool-call session
// state ); harness ( afterEach mock.restore ) copied verbatim. Import
// header carried verbatim from the original file.
import * as mainPromptModule from '@savant-code/agent-runtime/main-prompt'
import { withSystemTags } from '@savant-code/agent-runtime/util/messages'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { userMessage } from '@savant-code/common/util/messages'
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

// Type for tool call content blocks in message history
interface ToolCallContentBlock {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input: Record<string, JSONValue>
}

// Type for text content blocks in message history
interface TextContentBlock {
  type: 'text'
  text: string
}

import { SavantCodeClient } from '../client'
import * as databaseModule from '../impl/database'

import type { JSONValue } from '@savant-code/common/types/json'

describe('Run Cancellation Handling', () => {
  afterEach(() => {
    mock.restore()
  })

  it('preserves session state even when abort happens mid-stream', async () => {
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

    const abortController = new AbortController()
    const serverSessionState = getInitialSessionState(
      getStubProjectFileContext(),
    )

    // Simulate multiple tool calls and results (more complex work done)
    serverSessionState.mainAgentState.messageHistory.push(
      userMessage('Fix the bug'),
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I will analyze the issue.',
          } as TextContentBlock,
          {
            type: 'tool-call',
            toolCallId: 'read-1',
            toolName: 'read_files',
            input: { paths: ['src/bug.ts'] },
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
            value: [{ path: 'src/bug.ts', content: 'buggy code' }],
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Found the bug, fixing now.',
          } as TextContentBlock,
          {
            type: 'tool-call',
            toolCallId: 'write-1',
            toolName: 'write_file',
            input: { path: 'src/bug.ts', content: 'fixed code' },
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
            value: { file: 'src/bug.ts', message: 'File written' },
          },
        ],
      },
    )

    const streamedChunks: string[] = []

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params

        // Stream some chunks
        for (const chunk of ['Working', ' on', ' the', ' next', ' step']) {
          await sendAction({
            action: {
              type: 'response-chunk',
              userInputId: promptId,
              chunk,
            },
          })
        }

        // User aborts mid-stream
        abortController.abort()

        // Simulate agent runtime adding interruption message on abort
        serverSessionState.mainAgentState.messageHistory.push(
          userMessage(
            withSystemTags(
              "User interrupted the response. The assistant's previous work has been preserved.",
            ),
          ),
        )

        // Server still returns the full session state
        await sendAction({
          action: {
            type: 'prompt-response',
            promptId,
            sessionState: serverSessionState,
            output: {
              type: 'lastMessage',
              value: [],
            },
          },
        })

        return {
          sessionState: serverSessionState,
          output: {
            type: 'lastMessage' as const,
            value: [],
          },
        }
      },
    )

    const client = new SavantCodeClient({
      apiKey: 'test-key',
    })

    const result = await client.run({
      agent: 'savant',
      prompt: 'test prompt',
      signal: abortController.signal,
      handleStreamChunk: (chunk) => {
        if (typeof chunk === 'string') {
          streamedChunks.push(chunk)
        }
      },
    })

    // Verify session state is preserved with all the work
    expect(result.sessionState).toBeDefined()
    const messageHistory = result.sessionState!.mainAgentState.messageHistory

    // Should have: user message + 4 assistant/tool messages + 1 interruption
    // The server state already has the content; pendingAgentResponse is not duplicated.
    expect(messageHistory.length).toBe(6)

    // Verify the write_file tool result is still there (work was preserved)
    const writeToolResult = messageHistory.find(
      (m) => m.role === 'tool' && m.toolCallId === 'write-1',
    )
    expect(writeToolResult).toBeDefined()

    // Verify interruption message was added at the end
    const lastMessage = messageHistory[messageHistory.length - 1]
    expect(lastMessage.role).toBe('user')
    expect((lastMessage.content[0] as TextContentBlock).text).toContain(
      'User interrupted the response',
    )
  })
})
