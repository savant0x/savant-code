import { trackEvent } from '@savant-code/common/analytics'
import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'

import { buildHookInput, getHookEngine } from './hooks/engine'
import { buildSessionOutcome } from './hooks/run-outcome'
import { demoteStaleActiveDrive } from './run-agent-step/auto-drive-driver'
import { driveAutoTurns } from './run-agent-step/auto-drive-loop'
import { driveGoalTurns } from './run-agent-step/goal-driver'
import { demoteStaleActiveGoal } from './run-agent-step/goal-engine'
import { getAgentTemplate } from './templates/agent-registry'

import type { loopAgentSteps } from './run-agent-step'
import type { AgentTemplate } from './templates/types'
import type { ClientAction } from '@savant-code/common/actions'
import type { RequestToolCallFn } from '@savant-code/common/types/contracts/client'
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

  // FID-2026-0919-030: SessionEnd fires in the `finally` below, so the outcome
  // must be computed on EVERY path — return, thrown, and the no-output arm.
  // The default is the truthful "unknown ⇒ failed"; each path replaces it. Same
  // contract as the subagent lifecycle (FID-2026-0919-029), one boundary up.
  let outcome = buildSessionOutcome({})
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

    // The EFFECTIVE output: a run that produced nothing is the error form, so
    // the outcome must see the same value the caller does — otherwise a
    // no-output run would report `completed` at the hook and fail at the caller.
    const effectiveOutput = output ?? {
      type: 'error' as const,
      message: 'No output from agent',
    }
    outcome = buildSessionOutcome({
      result: { agentState, output: effectiveOutput },
    })

    return {
      sessionState: {
        fileContext,
        mainAgentState: agentState,
      },
      output: effectiveOutput,
    }
  } catch (error) {
    outcome = buildSessionOutcome({ error })
    throw error
  } finally {
    if (hookProjectRoot) {
      getHookEngine(hookProjectRoot).fireAndForgetTrigger(
        buildHookInput({
          event: 'SessionEnd',
          sessionId,
          cwd: hookProjectRoot,
          toolResult: outcome,
          ...(outcome.errorMessage !== undefined
            ? { errorMessage: outcome.errorMessage }
            : {}),
        }),
      )
    }
  }
}
