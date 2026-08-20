import { trackEvent } from '@savant-code/common/analytics'
import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'

import { buildHookInput, getHookEngine } from './hooks/engine'
import { demoteStaleActiveDrive } from './run-agent-step/auto-drive-driver'
import { driveAutoTurns } from './run-agent-step/auto-drive-loop'
import { driveGoalTurns } from './run-agent-step/goal-driver'
import { demoteStaleActiveGoal } from './run-agent-step/goal-engine'
import {
  assembleLocalAgentTemplates,
  getAgentTemplate,
} from './templates/agent-registry'

import type { loopAgentSteps } from './run-agent-step'
import type { AgentTemplate } from './templates/types'
import type { ClientAction } from '@savant-code/common/actions'
import type {
  RequestToolCallFn,
  SendActionFn,
} from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type {
  SessionState,
  AgentTemplateType,
  AgentOutput,
} from '@savant-code/common/types/session-state'

export async function mainPrompt(
  params: {
    action: ClientAction<'prompt'>

    onResponseChunk: (chunk: string | PrintModeEvent) => void
    localAgentTemplates: Record<string, AgentTemplate>

    requestToolCall: RequestToolCallFn
    logger: Logger
  } & ParamsExcluding<
    typeof loopAgentSteps,
    | 'userInputId'
    | 'spawnParams'
    | 'agentState'
    | 'prompt'
    | 'content'
    | 'agentType'
    | 'fingerprintId'
    | 'fileContext'
    | 'ancestorRunIds'
  > &
    ParamsExcluding<typeof getAgentTemplate, 'agentId'>,
): Promise<{
  sessionState: SessionState
  output: AgentOutput
}> {
  const { action, localAgentTemplates, logger } = params

  const {
    prompt,
    content,
    sessionState: sessionState,
    fingerprintId,
    promptId,
    agentId,
    promptParams,
  } = action
  const { fileContext, mainAgentState } = sessionState

  // Track user input analytics event
  // userId comes from params (passed through from loopAgentSteps)
  const userId = (params as { userId?: string }).userId
  if (typeof userId === 'string' && userId.trim() !== '') {
    trackEvent({
      event: AnalyticsEvent.USER_INPUT,
      userId,
      properties: {
        promptId: promptId ?? null,
        agentId: agentId ?? null,
        hasPrompt: !!prompt,
        hasContent: !!content,
        hasPromptParams: !!promptParams && Object.keys(promptParams).length > 0,
        promptParamsCount: promptParams ? Object.keys(promptParams).length : 0,
        fingerprintId: fingerprintId ?? null,
        promptLength: prompt?.length ?? 0,
        contentLength: content?.length ?? 0,
        messageHistoryLength: mainAgentState.messageHistory.length,
      },
      logger,
    })
  }

  const availableAgents = Object.keys(localAgentTemplates)

  // Determine agent type - prioritize CLI agent selection, then cost mode
  let agentType: AgentTemplateType

  if (agentId) {
    const agentTemplate = await getAgentTemplate({ ...params, agentId })
    if (!agentTemplate) {
      throw new Error(
        `Invalid agent ID: "${agentId}". Available agents: ${availableAgents.join(', ')}`,
      )
    }

    agentType = agentId
  } else {
    agentType = 'savant'
  }

  mainAgentState.agentType = agentType

  let mainAgentTemplate = await getAgentTemplate({
    ...params,
    agentId: agentType,
  })
  if (!mainAgentTemplate) {
    throw new Error(`Agent template not found for type: ${agentType}`)
  }

  // FID-2026-0814-002: a goal left `active` by an interrupted/crashed run must
  // never silently resume — demote it to `paused` at run start. The
  // continuation driver below then sees only paused/blocked records (or a
  // fresh <goal-set>/resume directive from the operator).
  demoteStaleActiveGoal(mainAgentState.goal)

  // FID-2026-0818-007 step 4: a drive left `active` by a crash must never
  // silently resume — demote it to `paused` at run start (the operator resumes
  // explicitly via `/auto resume` or `--auto --continue`). Runs before the
  // turn, so a fresh `<drive-lock>` in the same prompt re-activates a NEW
  // drive on top of the demoted stale one.
  demoteStaleActiveDrive(mainAgentState.drive)

  // FID-2026-0814-003: SessionStart/SessionEnd hooks — observation only,
  // fire-and-forget, fired at the main-agent run boundary (per prompt).
  const hookProjectRoot = fileContext.projectRoot ?? fileContext.cwd
  const sessionId = mainAgentState.runId ?? mainAgentState.agentId
  if (hookProjectRoot) {
    getHookEngine(hookProjectRoot).fireAndForgetTrigger(
      buildHookInput({
        event: 'SessionStart',
        sessionId,
        cwd: hookProjectRoot,
      }),
    )
  }

  try {
    let { agentState, output } = await driveGoalTurns({
      ...params,
      userInputId: promptId,
      spawnParams: promptParams,
      agentState: mainAgentState,
      ancestorRunIds: [],
      prompt,
      content,
      agentType,
      fingerprintId,
      fileContext,
    })

    // FID-2026-0818-004: Auto Drive supervisor. When the turn created a
    // durable drive record (from the <drive-lock> directive), drive the FID
    // queue to completion: scan dev/fids/, inject phase directives, validate
    // phase evidence from the FID file, and archive at COMPLETE.
    if (agentState.drive?.status === 'active') {
      const driveResult = await driveAutoTurns({
        ...params,
        userInputId: promptId,
        spawnParams: promptParams,
        agentState,
        ancestorRunIds: [],
        prompt,
        content,
        agentType,
        fingerprintId,
        fileContext,
      })
      agentState = driveResult.agentState
      output = driveResult.output
    }

    // Log a summary only: output can contain the full conversation
    // (type 'allMessages'), which bloats log files on long chats.
    logger.debug(
      {
        outputType: output?.type,
        messageCount:
          output && 'value' in output && Array.isArray(output.value)
            ? output.value.length
            : undefined,
      },
      'Main prompt finished',
    )

    return {
      sessionState: {
        fileContext,
        mainAgentState: agentState,
      },
      output: output ?? {
        type: 'error' as const,
        message: 'No output from agent',
      },
    }
  } finally {
    if (hookProjectRoot) {
      getHookEngine(hookProjectRoot).fireAndForgetTrigger(
        buildHookInput({
          event: 'SessionEnd',
          sessionId,
          cwd: hookProjectRoot,
        }),
      )
    }
  }
}

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
