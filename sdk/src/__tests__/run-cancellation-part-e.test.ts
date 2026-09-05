// FID-2026-0819-005 Loop 277: the session-state-preservation and
// interruption-format suites moved verbatim from
// run-cancellation-part-b.test.ts ( abort + tool-call preservation,
// withSystemTags format ); harness ( afterEach mock.restore ) copied
// verbatim. Import header carried verbatim from the original file.
import * as mainPromptModule from '@savant-code/agent-runtime/main-prompt'
import { withSystemTags } from '@savant-code/agent-runtime/util/messages'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
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

  it('preserves session state from server when aborted and appends interruption message', async () => {
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

    // Create a session state with some existing message history to verify it's preserved
    const serverSessionState = getInitialSessionState(
      getStubProjectFileContext(),
    )
    serverSessionState.mainAgentState.messageHistory.push(
      userMessage('User prompt'),
      assistantMessage('I will help you with that.'),
    )

    // Add a tool call to simulate work done by the assistant
    serverSessionState.mainAgentState.messageHistory.push({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me read that file...' } as TextContentBlock,
        {
          type: 'tool-call',
          toolCallId: 'tool-1',
          toolName: 'read_files',
          input: { paths: ['file.ts'] },
        } as ToolCallContentBlock,
      ],
    })
    serverSessionState.mainAgentState.messageHistory.push({
      role: 'tool',
      toolCallId: 'tool-1',
      toolName: 'read_files',
      content: [
        { type: 'json', value: [{ path: 'file.ts', content: 'const x = 1;' }] },
      ],
    })

    const originalHistoryLength =
      serverSessionState.mainAgentState.messageHistory.length

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params

        // Simulate some streaming chunks before abort
        await sendAction({
          action: {
            type: 'response-chunk',
            userInputId: promptId,
            chunk: 'Analyzing the code...',
          },
        })

        // Abort the signal to simulate user cancellation
        abortController.abort()

        // Simulate agent runtime adding interruption message on abort
        serverSessionState.mainAgentState.messageHistory.push(
          userMessage(
            withSystemTags(
              "User interrupted the response. The assistant's previous work has been preserved.",
            ),
          ),
        )

        // Server still sends the prompt-response with the full session state
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
    })

    // Verify session state is returned (not undefined/null)
    expect(result.sessionState).toBeDefined()
    expect(result.sessionState).not.toBeNull()

    // Verify the original message history is preserved
    const messageHistory = result.sessionState!.mainAgentState.messageHistory

    // Should have original messages + 1 interruption message
    // The server state already has the content; pendingAgentResponse is not duplicated.
    expect(messageHistory.length).toBe(originalHistoryLength + 1)

    // Verify the original tool call is still present (work was preserved)
    const toolCallMessage = messageHistory.find(
      (m) =>
        m.role === 'assistant' &&
        m.content.some(
          (c): c is ToolCallContentBlock =>
            c.type === 'tool-call' && c.toolCallId === 'tool-1',
        ),
    )
    expect(toolCallMessage).toBeDefined()

    const toolResultMessage = messageHistory.find(
      (m) => m.role === 'tool' && m.toolCallId === 'tool-1',
    )
    expect(toolResultMessage).toBeDefined()

    // Verify the interruption message was appended
    const lastMessage = messageHistory[messageHistory.length - 1]
    expect(lastMessage.role).toBe('user')
  })

  it('interruption message uses withSystemTags format', async () => {
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

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params

        // Abort before sending response
        abortController.abort()

        // Simulate agent runtime adding interruption message on abort
        serverSessionState.mainAgentState.messageHistory.push(
          userMessage(
            withSystemTags(
              "User interrupted the response. The assistant's previous work has been preserved.",
            ),
          ),
        )

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
    })

    const messageHistory = result.sessionState!.mainAgentState.messageHistory
    const lastMessage = messageHistory[messageHistory.length - 1]

    // Verify the message content uses withSystemTags format
    expect(lastMessage.role).toBe('user')
    expect(Array.isArray(lastMessage.content)).toBe(true)

    const textContent = lastMessage.content.find(
      (c): c is TextContentBlock => c.type === 'text',
    )
    expect(textContent).toBeDefined()

    // The text should be wrapped in <system> tags
    const expectedText = withSystemTags(
      "User interrupted the response. The assistant's previous work has been preserved.",
    )
    expect(textContent!.text).toBe(expectedText)

    // Verify the tag format explicitly
    expect(textContent!.text).toContain('<system>')
    expect(textContent!.text).toContain('</system>')
    expect(textContent!.text).toContain('User interrupted the response')
  })
})
