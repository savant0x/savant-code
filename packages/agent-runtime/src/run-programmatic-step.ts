import { HandleStepsYieldValueSchema } from '@savant-code/common/types/agent-template'
import { getErrorObject } from '@savant-code/common/util/error'
import { assistantMessage } from '@savant-code/common/util/messages'
import { toLogValue } from '@savant-code/common/util/type-narrowing'

import { ensureProgrammaticGenerator } from './run-programmatic-step/ensure-generator'
import {
  executeSegmentsArray,
  executeSingleToolCall,
  type ToolCallToExecute,
} from './run-programmatic-step/execute-tool-calls'
import { handleStepsErrorMessage } from './run-programmatic-step/handle-steps-error'
import { getPublicAgentState } from './run-programmatic-step/public-state'
import { sanitizeYieldToolCallInput } from './run-programmatic-step/sanitize-yield-input'
import {
  clearProgrammaticRunState,
  runIdToStepAll,
} from './run-programmatic-step/state'
import { initToolExecutionState } from './run-programmatic-step/step-state'
import { parseTextWithToolCalls } from './util/parse-tool-calls-from-text'

import type {
  RunProgrammaticStepParams,
  RunProgrammaticStepResult,
} from './run-programmatic-step/types'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type { AgentState } from '@savant-code/common/types/session-state'

// Function to handle programmatic agents
export async function runProgrammaticStep(
  params: RunProgrammaticStepParams,
): Promise<RunProgrammaticStepResult> {
  const {
    agentState,
    template,
    clientSessionId: _clientSessionId,
    prompt,
    toolCallParams,
    nResponses,
    system: _system,
    userId: _userId,
    userInputId,
    repoId: _repoId,
    fingerprintId: _fingerprintId,
    onResponseChunk,
    localAgentTemplates: _localAgentTemplates,
    stepsComplete,
    handleStepsLogChunk,
    addAgentStep,
    logger,
  } = params
  let { stepNumber } = params

  if (!template.handleSteps) {
    throw new Error('No step handler found for agent template ' + template.id)
  }

  if (!agentState.runId) {
    throw new Error('Agent state has no run ID')
  }

  // Run with either a generator or a sandbox. Creation phase extracted to
  // run-programmatic-step/ensure-generator.ts (FID-2026-0819-005 Loop 156);
  // the streaming logger's chunk payload keeps the original userInputId.
  const generator = ensureProgrammaticGenerator({
    runId: agentState.runId,
    agentState,
    prompt,
    toolCallParams: toolCallParams as Record<string, JSONValue> | undefined,
    template,
    logger,
    handleStepsLogChunk: (input) =>
      handleStepsLogChunk({ ...input, userInputId }),
  })

  // Definite-assignment guard (FID-2026-0803-005 C3): generatorFn may be an
  // eval'd/deserialized function that returns undefined at runtime. Fail with
  // a diagnosable error instead of dereferencing undefined in the loop below,
  // which would surface as a misleading generic handleSteps error.
  if (!generator) {
    throw new Error(
      `handleSteps for agent ${template.id} did not return a generator`,
    )
  }

  // Check if we're in STEP_ALL mode
  if (runIdToStepAll.has(agentState.runId)) {
    if (stepsComplete) {
      // Clear the STEP_ALL mode. Stepping can continue if handleSteps doesn't return.
      runIdToStepAll.delete(agentState.runId)
    } else {
      return { agentState, endTurn: false, stepNumber }
    }
  }

  const agentStepId = crypto.randomUUID()

  // Initialize state for tool execution (factory extracted to
  // run-programmatic-step/step-state.ts — FID-2026-0819-005 Loop 164).
  const { toolCalls, toolResults, fileProcessingState, agentContext } =
    initToolExecutionState(agentState)
  // FID-2026-0802-005 L7: `_sendSubagentChunk` (and its sendAction wiring)
  // were removed — defined but never called (Law 4 dead code).

  let toolResult: ToolResultOutput[] | undefined = undefined
  let endTurn = false
  let generateN: number | undefined = undefined

  let startTime = new Date()
  let creditsBefore = agentState.directCreditsUsed
  let childrenBefore = agentState.childRunIds.length

  try {
    // Execute tools synchronously as the generator yields them
    do {
      startTime = new Date()
      creditsBefore = agentState.directCreditsUsed
      childrenBefore = agentState.childRunIds.length

      const result = generator.next({
        agentState: getPublicAgentState(
          agentState as AgentState & Required<Pick<AgentState, 'runId'>>,
        ),
        toolResult: toolResult ?? [],
        stepsComplete,
        nResponses,
      })

      if (result.done) {
        endTurn = true
        break
      }

      // FID-2026-0823-009: generators may include optional keys holding
      // explicit undefined values; z.record(z.string(), jsonValueSchema)
      // rejects undefined as invalid JSON. Sanitize before validating and
      // execute the sanitized call so undefined keys never flow downstream.
      const yieldValue = sanitizeYieldToolCallInput(result.value)
      const parseResult = HandleStepsYieldValueSchema.safeParse(yieldValue)
      if (!parseResult.success) {
        throw new Error(
          `Invalid yield value from handleSteps in agent ${template.id}: ${parseResult.error.message}. ` +
            `Received: ${JSON.stringify(result.value)}`,
        )
      }

      if (result.value === 'STEP') {
        break
      }
      if (result.value === 'STEP_ALL') {
        runIdToStepAll.add(agentState.runId)
        break
      }

      if ('type' in result.value && result.value.type === 'STEP_TEXT') {
        // Parse text and tool calls, preserving interleaved order
        const segments = parseTextWithToolCalls(result.value.text)

        if (segments.length > 0) {
          // Execute segments (text and tool calls) in order
          toolResult = await executeSegmentsArray(segments, {
            ...params,
            agentContext,
            agentStepId,
            agentTemplate: template,
            agentState,
            fileProcessingState,
            fullResponse: '',
            previousToolCallFinished: Promise.resolve(),
            toolCalls,
            toolResults,
            onResponseChunk,
          })
        }
        continue
      }

      if ('type' in result.value && result.value.type === 'GENERATE_N') {
        logger.info(
          { resultValue: toLogValue(result.value) },
          'GENERATE_N yielded',
        )
        // Handle GENERATE_N: generate n responses using the LLM
        generateN = result.value.n
        endTurn = false
        break
      }

      // Process tool calls yielded by the generator (sanitized —
      // FID-2026-0823-009).
      const toolCall = yieldValue as ToolCallToExecute

      toolResult = await executeSingleToolCall(toolCall, {
        ...params,
        agentContext,
        agentStepId,
        agentTemplate: template,
        agentState,
        fileProcessingState,
        fullResponse: '',
        previousToolCallFinished: Promise.resolve(),
        toolCalls,
        toolResults,
        onResponseChunk,
      })

      if (agentState.runId) {
        await addAgentStep({
          ...params,
          agentRunId: agentState.runId,
          stepNumber,
          credits: agentState.directCreditsUsed - creditsBefore,
          childRunIds: agentState.childRunIds.slice(childrenBefore),
          status: 'completed',
          startTime,
          messageId: null,
        })
      } else {
        logger.error('No runId found for agent state after finishing agent run')
      }
      stepNumber++

      if (toolCall.toolName === 'end_turn') {
        endTurn = true
        break
      }
    } while (true)

    return {
      agentState,
      endTurn,
      stepNumber,
      generateN,
    }
  } catch (error) {
    endTurn = true

    // Message construction extracted to run-programmatic-step/
    // handle-steps-error.ts (FID-2026-0819-005 Loop 164).
    const errorMessage = handleStepsErrorMessage(error, template)
    logger.error(
      { error: getErrorObject(error), template: template.id },
      errorMessage,
    )

    onResponseChunk(errorMessage)

    agentState.messageHistory.push(assistantMessage(errorMessage))
    agentState.output = {
      ...agentState.output,
      error: errorMessage,
    }

    if (agentState.runId) {
      await addAgentStep({
        ...params,
        agentRunId: agentState.runId,
        stepNumber,
        credits: agentState.directCreditsUsed - creditsBefore,
        childRunIds: agentState.childRunIds.slice(childrenBefore),
        status: 'skipped',
        startTime,
        errorMessage,
        messageId: null,
        logger,
      })
    } else {
      logger.error('No runId found for agent state after failed agent run')
    }
    stepNumber++

    return {
      agentState,
      endTurn,
      stepNumber,
      generateN: undefined,
    }
  } finally {
    if (endTurn) {
      clearProgrammaticRunState(agentState.runId)
    }
  }
}

export { getPublicAgentState }
export {
  clearAgentGeneratorCache,
  clearProgrammaticRunState,
  runIdToStepAll,
} from './run-programmatic-step/state'
