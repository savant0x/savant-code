import * as mainPromptModule from '@savant-code/agent-runtime/main-prompt'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
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

  it('a subsequent run after error includes the preserved in-progress history', async () => {
    setupDatabaseMocks()

    // Run 1: agent does some work then hits an error
    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const mainAgentState = params.action.sessionState.mainAgentState

        mainAgentState.messageHistory = [
          ...mainAgentState.messageHistory,
          {
            role: 'user',
            content: [{ type: 'text', text: 'Investigate the login bug' }],
            tags: ['USER_PROMPT'],
          },
          assistantMessage('I found the problem in auth.ts on line 42.'),
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'read-login',
                toolName: 'read_files',
                input: { paths: ['login.ts'] },
              } as ToolCallContentBlock,
            ],
          },
          {
            role: 'tool',
            toolCallId: 'read-login',
            toolName: 'read_files',
            content: [
              {
                type: 'json',
                value: [{ path: 'login.ts', content: 'login code' }],
              },
            ],
          },
        ]

        const error = new Error('Service Unavailable') as Error & {
          statusCode: number
        }
        error.statusCode = 503
        throw error
      },
    )

    const client = new SavantCodeClient({ apiKey: 'test-key' })
    const firstResult = await client.run({
      agent: 'savant',
      prompt: 'Investigate the login bug',
    })

    expect(firstResult.output.type).toBe('error')

    // Run 2: use the failed run as previousRun
    mock.restore()
    setupDatabaseMocks()

    let historyReceivedByRuntime:
      | Array<{
          role?: string
          content?: Array<{ type?: string; toolCallId?: string }>
        }>
      | undefined
    spyOn(mainPromptModule, 'callMainPrompt').mockImplementation(
      async (params: Parameters<typeof mainPromptModule.callMainPrompt>[0]) => {
        const { sendAction, promptId } = params
        historyReceivedByRuntime = [
          ...params.action.sessionState.mainAgentState.messageHistory,
        ]

        const responseSessionState = getInitialSessionState(
          getStubProjectFileContext(),
        )
        responseSessionState.mainAgentState.messageHistory = [
          ...params.action.sessionState.mainAgentState.messageHistory,
          userMessage('Now try again'),
          assistantMessage('Continuing with the fix.'),
        ]

        await sendAction({
          action: {
            type: 'prompt-response',
            promptId,
            sessionState: responseSessionState,
            output: { type: 'lastMessage', value: [] },
          },
        })

        return {
          sessionState: responseSessionState,
          output: { type: 'lastMessage' as const, value: [] },
        }
      },
    )

    const secondResult = await client.run({
      agent: 'savant',
      prompt: 'Now try again',
      previousRun: firstResult,
    })

    // The runtime should have received history containing the work from the first run
    expect(historyReceivedByRuntime).toBeDefined()
    const receivedReadCall = historyReceivedByRuntime!.find(
      (m) =>
        (m as { role: string }).role === 'assistant' &&
        (
          (m as { content: Array<{ type: string; toolCallId?: string }> })
            .content ?? []
        ).some((c) => c.type === 'tool-call' && c.toolCallId === 'read-login'),
    )
    expect(receivedReadCall).toBeDefined()

    const receivedToolResult = historyReceivedByRuntime!.find(
      (m) =>
        (m as { role: string }).role === 'tool' &&
        (m as { toolCallId: string }).toolCallId === 'read-login',
    )
    expect(receivedToolResult).toBeDefined()

    // Final result should preserve history
    const finalHistory =
      secondResult.sessionState!.mainAgentState.messageHistory
    const finalReadCall = finalHistory.find(
      (m) =>
        m.role === 'assistant' &&
        (m.content as Array<{ type: string; toolCallId?: string }>).some(
          (c) => c.type === 'tool-call' && c.toolCallId === 'read-login',
        ),
    )
    expect(finalReadCall).toBeDefined()
  })
})
