// FID-2026-0819-005 Loop 278: the cancelled-run history-continuation suite
// moved verbatim from run-cancellation-part-c.test.ts ( previousRun
// continuation across runs ); harness ( afterEach mock.restore ) copied
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

  it('preserves message history across cancelled run and subsequent run', async () => {
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

    // First run: server processes the user message and does some work, then user cancels
    const firstRunServerState = getInitialSessionState(
      getStubProjectFileContext(),
    )
    firstRunServerState.mainAgentState.messageHistory.push(
      userMessage('Fix the bug in auth.ts'),
      assistantMessage('I will analyze the authentication module.'),
    )

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params

        // Stream some content
        await sendAction({
          action: {
            type: 'response-chunk',
            userInputId: promptId,
            chunk: 'Analyzing auth.ts...',
          },
        })

        // User cancels mid-stream
        abortController.abort()

        // Agent runtime adds interruption message on abort
        firstRunServerState.mainAgentState.messageHistory.push(
          userMessage(
            withSystemTags(
              "User interrupted the response. The assistant's previous work has been preserved.",
            ),
          ),
        )

        // Server still sends the prompt-response with its session state
        await sendAction({
          action: {
            type: 'prompt-response',
            promptId,
            sessionState: firstRunServerState,
            output: {
              type: 'lastMessage',
              value: [],
            },
          },
        })

        return {
          sessionState: firstRunServerState,
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

    // Run 1: cancelled mid-stream
    const firstRunResult = await client.run({
      agent: 'savant',
      prompt: 'Fix the bug in auth.ts',
      signal: abortController.signal,
    })

    // Verify the first run preserved the user message and work
    expect(firstRunResult.sessionState).toBeDefined()
    const firstHistory =
      firstRunResult.sessionState!.mainAgentState.messageHistory
    expect(firstHistory.length).toBe(3) // user + assistant + interruption

    const firstUserMsg = firstHistory.find(
      (m) =>
        m.role === 'user' &&
        m.content.some(
          (c): c is TextContentBlock =>
            c.type === 'text' && c.text.includes('Fix the bug'),
        ),
    )
    expect(firstUserMsg).toBeDefined()

    // Now set up mock for the second run
    mock.restore()
    spyOn(databaseModule, 'getUserInfoFromApiKey').mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      discord_id: null,
      stripe_customer_id: null,
      banned: false,
      created_at: new Date('2024-01-01T00:00:00Z'),
    })
    spyOn(databaseModule, 'fetchAgentFromDatabase').mockResolvedValue(null)
    spyOn(databaseModule, 'startAgentRun').mockResolvedValue('run-2')
    spyOn(databaseModule, 'finishAgentRun').mockResolvedValue(undefined)
    spyOn(databaseModule, 'addAgentStep').mockResolvedValue('step-2')

    // Second run: server receives the previous state and adds the new user message
    const secondRunServerState = JSON.parse(
      JSON.stringify(firstRunResult.sessionState!),
    ) as typeof firstRunServerState
    secondRunServerState.mainAgentState.messageHistory.push(
      userMessage('Now also fix the login page'),
      assistantMessage('I will fix both issues.'),
    )

    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params

        await sendAction({
          action: {
            type: 'prompt-response',
            promptId,
            sessionState: secondRunServerState,
            output: {
              type: 'lastMessage',
              value: [],
            },
          },
        })

        return {
          sessionState: secondRunServerState,
          output: {
            type: 'lastMessage' as const,
            value: [],
          },
        }
      },
    )

    // Run 2: uses previousRun from the cancelled first run
    const secondRunResult = await client.run({
      agent: 'savant',
      prompt: 'Now also fix the login page',
      previousRun: firstRunResult,
    })

    // Verify the second run's session state includes history from BOTH runs
    expect(secondRunResult.sessionState).toBeDefined()
    const secondHistory =
      secondRunResult.sessionState!.mainAgentState.messageHistory

    // Should have: first user msg + first assistant msg + interruption + second user msg + second assistant msg
    expect(secondHistory.length).toBe(5)

    // The first user message should be present
    const firstUserMsgInSecond = secondHistory.find(
      (m) =>
        m.role === 'user' &&
        m.content.some(
          (c): c is TextContentBlock =>
            c.type === 'text' && c.text.includes('Fix the bug'),
        ),
    )
    expect(firstUserMsgInSecond).toBeDefined()

    // The second user message should also be present
    const secondUserMsg = secondHistory.find(
      (m) =>
        m.role === 'user' &&
        m.content.some(
          (c): c is TextContentBlock =>
            c.type === 'text' && c.text.includes('fix the login page'),
        ),
    )
    expect(secondUserMsg).toBeDefined()

    // The first assistant message should be preserved
    const firstAssistantMsg = secondHistory.find(
      (m) =>
        m.role === 'assistant' &&
        m.content.some(
          (c): c is TextContentBlock =>
            c.type === 'text' && c.text.includes('authentication module'),
        ),
    )
    expect(firstAssistantMsg).toBeDefined()
  })
})
