import * as mainPromptModule from '@savant-code/agent-runtime/main-prompt'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { SavantCodeClient } from '../client'

describe('Run Cancellation Handling', () => {
  afterEach(() => {
    mock.restore()
  })

  it('returns cancelled state when aborted before call starts', async () => {
    const abortController = new AbortController()
    // Abort before the run starts
    abortController.abort()

    const client = new SavantCodeClient({
    })

    const result = await client.run({
      agent: 'savant',
      prompt: 'test prompt',
      signal: abortController.signal,
    })

    // When aborted before starting, should return an error output
    expect(result.output.type).toBe('error')
  })

  it('does not add interruption message when not aborted', async () => {

    const serverSessionState = getInitialSessionState(
      getStubProjectFileContext(),
    )
    serverSessionState.mainAgentState.messageHistory.push(
      userMessage('User prompt'),
      assistantMessage('Done!'),
    )
    const originalHistoryLength =
      serverSessionState.mainAgentState.messageHistory.length

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
    })

    // Run without aborting
    const result = await client.run({
      agent: 'savant',
      prompt: 'test prompt',
    })

    // Message history should not have an interruption message
    const messageHistory = result.sessionState!.mainAgentState.messageHistory
    expect(messageHistory.length).toBe(originalHistoryLength)

    // Last message should be the assistant's "Done!" message, not an interruption
    const lastMessage = messageHistory[messageHistory.length - 1]
    expect(lastMessage.role).toBe('assistant')
  })
})
