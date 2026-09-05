import * as mainPromptModule from '@savant-code/agent-runtime/main-prompt'
import { withSystemTags } from '@savant-code/agent-runtime/util/messages'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { userMessage } from '@savant-code/common/util/messages'
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

// Type for text content blocks in message history
interface TextContentBlock {
  type: 'text'
  text: string
}

import { SavantCodeClient } from '../client'
import * as databaseModule from '../impl/database'

describe('Run Cancellation Handling', () => {
  afterEach(() => {
    mock.restore()
  })

  it('preserves user message when callMainPrompt throws an error', async () => {
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

    // Simulate callMainPrompt throwing an error (network failure, server error, etc.)
    spyOn(mainPromptModule, 'callMainPrompt').mockRejectedValue(
      new Error('Network connection failed'),
    )

    const client = new SavantCodeClient({
      apiKey: 'test-key',
    })

    const result = await client.run({
      agent: 'savant',
      prompt: 'Please fix the bug in my code',
    })

    // Should return an error output
    expect(result.output.type).toBe('error')
    expect((result.output as { type: 'error'; message: string }).message).toBe(
      'Network connection failed',
    )

    // The user's message should be preserved in the session state
    expect(result.sessionState).toBeDefined()
    const messageHistory = result.sessionState!.mainAgentState.messageHistory

    // Should have: user message + interruption message
    expect(messageHistory.length).toBeGreaterThanOrEqual(2)

    // Find the user's original prompt message (should have USER_PROMPT tag)
    const userPromptMessage = messageHistory.find(
      (m) => m.role === 'user' && m.tags?.includes('USER_PROMPT'),
    )
    expect(userPromptMessage).toBeDefined()

    // Verify the message content contains the original prompt
    const textContent = userPromptMessage!.content.find(
      (c): c is TextContentBlock => c.type === 'text',
    )
    expect(textContent).toBeDefined()
    expect(textContent!.text).toContain('Please fix the bug in my code')
  })

  it('does not add empty assistant message when no streaming content', async () => {
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
    serverSessionState.mainAgentState.messageHistory.push(
      userMessage('User prompt'),
    )
    const originalHistoryLength =
      serverSessionState.mainAgentState.messageHistory.length

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params

        // Abort immediately WITHOUT any streaming chunks
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

    // Should only have: original history + 1 interruption message (NO empty assistant message)
    expect(messageHistory.length).toBe(originalHistoryLength + 1)

    // The last message should be the interruption (user role), not an empty assistant message
    const lastMessage = messageHistory[messageHistory.length - 1]
    expect(lastMessage.role).toBe('user')
    expect((lastMessage.content[0] as TextContentBlock).text).toContain(
      'User interrupted',
    )

    // Verify there's no empty assistant message before the interruption
    const secondToLastMessage = messageHistory[messageHistory.length - 2]
    // This should be the original 'User prompt' message, not an empty assistant
    expect(secondToLastMessage.role).toBe('user')
  })

  it('preserves user message with USER_PROMPT tag when error thrown during callMainPrompt', async () => {
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

    let streamedContent = ''
    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params

        // Simulate some partial streaming before error
        await sendAction({
          action: {
            type: 'response-chunk',
            userInputId: promptId,
            chunk: 'Starting to analyze...',
          },
        })

        // Then throw an error (simulating connection drop)
        throw new Error('Connection reset by peer')
      },
    )

    const client = new SavantCodeClient({
      apiKey: 'test-key',
    })

    const result = await client.run({
      agent: 'savant',
      prompt: 'Implement the feature',
      handleStreamChunk: (chunk) => {
        if (typeof chunk === 'string') {
          streamedContent += chunk
        }
      },
    })

    // Verify we received some streamed content before the error
    expect(streamedContent).toBe('Starting to analyze...')

    // Should have error output
    expect(result.output.type).toBe('error')

    // Session state should be preserved
    expect(result.sessionState).toBeDefined()
    const messageHistory = result.sessionState!.mainAgentState.messageHistory

    // Should have: user message (with USER_PROMPT tag) + error context
    expect(messageHistory.length).toBe(2)

    // First message should be the user's prompt with the tag
    const firstMessage = messageHistory[0]
    expect(firstMessage.role).toBe('user')
    expect(firstMessage.tags).toContain('USER_PROMPT')

    // Second message should be the error context
    const secondMessage = messageHistory[1]
    expect(secondMessage.role).toBe('user')
  })
})
