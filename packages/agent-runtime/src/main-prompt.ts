import { mainPrompt } from './main-prompt-run'
import { assembleLocalAgentTemplates } from './templates/agent-registry'

import type { ClientAction } from '@savant-code/common/actions'
import type { SendActionFn } from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'

export { mainPrompt }

export async function callMainPrompt(
  params: {
    action: ClientAction<'prompt'>
    promptId: string
    sendAction: SendActionFn
    logger: Logger
    signal: AbortSignal
  } & ParamsExcluding<
    typeof mainPrompt,
    'localAgentTemplates' | 'onResponseChunk'
  >,
) {
  const { action, promptId, sendAction, logger } = params
  const { fileContext } = action.sessionState

  // Enforce server-side state authority: reset creditsUsed to 0
  // The server controls cost tracking, clients cannot manipulate this value
  action.sessionState.mainAgentState.creditsUsed = 0
  action.sessionState.mainAgentState.directCreditsUsed = 0

  // Add any extra tool results (e.g. from user-executed terminal commands) to message history
  // This allows the AI to see context from commands run between prompts
  if (action.toolResults && action.toolResults.length > 0) {
    action.sessionState.mainAgentState.messageHistory.push(
      ...action.toolResults,
    )
  }

  // Assemble local agent templates from fileContext
  const { agentTemplates: localAgentTemplates, validationErrors } =
    assembleLocalAgentTemplates({ fileContext, logger })

  if (validationErrors.length > 0) {
    sendAction({
      action: {
        type: 'prompt-error',
        message: `Invalid agent config: ${validationErrors.map((err) => err.message).join('\n')}`,
        userInputId: promptId,
      },
    })
  }

  sendAction({
    action: {
      type: 'response-chunk',
      userInputId: promptId,
      chunk: {
        type: 'start',
        agentId: action.sessionState.mainAgentState.agentType ?? undefined,
        messageHistoryLength:
          action.sessionState.mainAgentState.messageHistory.length,
      },
    },
  })

  const result = await mainPrompt({
    ...params,
    localAgentTemplates,
    onResponseChunk: (chunk) => {
      if (!params.signal.aborted) {
        sendAction({
          action: {
            type: 'response-chunk',
            userInputId: promptId,
            chunk,
          },
        })
      }
    },
  })

  const { sessionState, output } = result

  sendAction({
    action: {
      type: 'response-chunk',
      userInputId: promptId,
      chunk: {
        type: 'finish',
        agentId: sessionState.mainAgentState.agentType ?? undefined,
        totalCost: sessionState.mainAgentState.creditsUsed,
      },
    },
  })

  // Send prompt data back
  sendAction({
    action: {
      type: 'prompt-response',
      promptId,
      sessionState,
      toolCalls: [],
      toolResults: [],
      output,
    },
  })

  return result
}
