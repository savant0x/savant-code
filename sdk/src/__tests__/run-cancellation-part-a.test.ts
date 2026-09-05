import * as mainPromptModule from '@savant-code/agent-runtime/main-prompt'
import { withSystemTags } from '@savant-code/agent-runtime/util/messages'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
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

  it('does not duplicate user message when server responds with session state', async () => {
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

    // Server session state already includes the user's message (as the server would normally do)
    const serverSessionState = getInitialSessionState(
      getStubProjectFileContext(),
    )
    serverSessionState.mainAgentState.messageHistory.push(
      userMessage('Please fix the bug'), // Server added this
      assistantMessage('I will help you with that.'),
    )

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params

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
      prompt: 'Please fix the bug',
    })

    // The user's message should NOT be duplicated
    const messageHistory = result.sessionState!.mainAgentState.messageHistory

    const userMessages = messageHistory.filter((m) => m.role === 'user')

    // Should have exactly 1 user message, not 2
    expect(userMessages.length).toBe(1)

    // Total messages should be 2 (user + assistant), not 3
    expect(messageHistory.length).toBe(2)
  })

  it('does not duplicate user message when cancelled and server already processed the prompt', async () => {
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

    // Server session state already includes the user's message (server processed it)
    const serverSessionState = getInitialSessionState(
      getStubProjectFileContext(),
    )
    serverSessionState.mainAgentState.messageHistory.push(
      userMessage('Please fix the bug'), // Server added the user's message
      assistantMessage('I will help you with that.'),
    )

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params

        // Stream some content
        await sendAction({
          action: {
            type: 'response-chunk',
            userInputId: promptId,
            chunk: 'Working on it...',
          },
        })

        // User cancels
        abortController.abort()

        // Simulate agent runtime adding interruption message on abort
        serverSessionState.mainAgentState.messageHistory.push(
          userMessage(
            withSystemTags(
              "User interrupted the response. The assistant's previous work has been preserved.",
            ),
          ),
        )

        // Server still responds with its session state
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
      prompt: 'Please fix the bug',
      signal: abortController.signal,
    })

    // The user's message should NOT be duplicated
    const messageHistory = result.sessionState!.mainAgentState.messageHistory

    // Count user messages (excluding system interruption messages)
    const userPromptMessages = messageHistory.filter(
      (m) =>
        m.role === 'user' &&
        m.content.some(
          (c): c is TextContentBlock =>
            c.type === 'text' && c.text.includes('fix the bug'),
        ),
    )

    // Should have exactly 1 user message with the prompt, not 2
    expect(userPromptMessages.length).toBe(1)

    // Total messages should be: 1 user + 1 assistant (original) + 1 interruption = 3
    // The server state already has the content; pendingAgentResponse is not duplicated.
    expect(messageHistory.length).toBe(3)
  })
})
