import { HandleStepsYieldValueSchema } from '@savant-code/common/types/agent-template'
import { getErrorObject } from '@savant-code/common/util/error'
import { assistantMessage } from '@savant-code/common/util/messages'
import {
  toLogValue,
  safeToJSONValue,
} from '@savant-code/common/util/type-narrowing'
import { cloneDeep } from 'lodash'

import { deserializeHandleSteps } from './run-programmatic-step/deserialize'
import {
  executeSegmentsArray,
  executeSingleToolCall,
  type ToolCallToExecute,
} from './run-programmatic-step/execute-tool-calls'
import { getPublicAgentState } from './run-programmatic-step/public-state'
import { sanitizeYieldToolCallInput } from './run-programmatic-step/sanitize-yield-input'
import {
  clearProgrammaticRunState,
  getStoredGenerator,
  runIdToStepAll,
  storeGenerator,
} from './run-programmatic-step/state'
import { parseTextWithToolCalls } from './util/parse-tool-calls-from-text'

import type {
  RunProgrammaticStepParams,
  RunProgrammaticStepResult,
} from './run-programmatic-step/types'
import type { FileProcessingState } from './tools/handlers/tool/write-file'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'
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

  // Run with either a generator or a sandbox.
  let generator = getStoredGenerator(agentState.runId)

  // Check if we need to initialize a generator
  if (!generator) {
    const createLogMethod =
      (level: 'debug' | 'info' | 'warn' | 'error') =>
      (data: unknown, msg?: string) => {
        const logValue = toLogValue(data)
        const jsonValue = safeToJSONValue(data)
        logger[level](logValue, msg) // Log to backend
        handleStepsLogChunk({
          userInputId,
          runId: agentState.runId ?? 'undefined',
          level,
          data: jsonValue,
          message: msg,
        })
      }

    const streamingLogger = {
      debug: createLogMethod('debug'),
      info: createLogMethod('info'),
      warn: createLogMethod('warn'),
      error: createLogMethod('error'),
    }

    // Prefer the live function when present: the stringified form of a
    // bundled function can reference out-of-scope bundler helpers (esbuild
    // keepNames' `__name`, minified to a bare identifier), which makes the
    // eval'd generator throw ReferenceError on its first step.
    const generatorFn =
      template.handleStepsFn ??
      (typeof template.handleSteps === 'string'
        ? deserializeHandleSteps(template.handleSteps)
        : template.handleSteps)

    // Initialize native generator
    generator = generatorFn({
      agentState,
      prompt,
      params: toolCallParams as Record<string, JSONValue> | undefined,
      logger: streamingLogger,
    })
    storeGenerator(agentState.runId, generator)
  }

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

  // Initialize state for tool execution
  const toolCalls: SavantCodeToolCall[] = []
  const toolResults: ToolMessage[] = []
  const fileProcessingState: FileProcessingState = {
    promisesByPath: {},
    allPromises: [],
    fileChangeErrors: [],
    fileChanges: [],
    firstFileProcessed: false,
  }
  const agentContext = cloneDeep(agentState.agentContext)
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

    // A ReferenceError from an eval'd handleSteps string almost always means
    // the source was serialized from a bundled/minified function and
    // references an out-of-scope bundler helper. Call it out so the failure
    // is diagnosable from the message alone.
    const minifiedSourceHint =
      error instanceof ReferenceError &&
      !template.handleStepsFn &&
      typeof template.handleSteps === 'string'
        ? ' (handleSteps was deserialized from a string that references an out-of-scope identifier — likely a minified bundle serialized the function; ship the live function or unminified source)'
        : ''
    const errorMessage = `Error executing handleSteps for agent ${template.id}: ${
      error instanceof Error ? error.message : 'Unknown error'
    }${minifiedSourceHint}`
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
