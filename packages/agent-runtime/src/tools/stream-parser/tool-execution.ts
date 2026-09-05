import { toolNames } from '@savant-code/common/tools/constants'
import { generateCompactId } from '@savant-code/common/util/string'

import {
  executeCustomToolCall,
  executeToolCall,
  tryTransformAgentToolCall,
} from '../tool-executor'
import { createResponseHandler } from './response-handler'

import type { AgentTemplate } from '../../templates/types'
import type { FileProcessingState } from '../handlers/tool/write-file'
import type { ExecuteToolCallParams, CustomToolCall } from '../tool-executor'
import type { GroundingStagerView } from './grounding-stager'
import type { StreamDoneHolder } from './stream-done'
import type { ProcessStreamParams } from './types'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * Unified callback factory for both native and custom tools
 * (FID-2026-0819-005 Loop 299: extracted verbatim from
 * `tools/stream-parser.ts`'s `createToolExecutionCallback`).
 */
export function createToolExecutionCallbackFactory(params: {
  baseParams: ProcessStreamParams
  agentTemplate: AgentTemplate
  signal: AbortSignal
  stager: GroundingStagerView
  fileProcessingState: FileProcessingState
  toolResults: ToolMessage[]
  toolResultsToAddToMessageHistory: ToolMessage[]
  toolCalls: (SavantCodeToolCall | CustomToolCall)[]
  toolCallsToAddToMessageHistory: (SavantCodeToolCall | CustomToolCall)[]
  onCostCalculated: (credits: number) => Promise<void>
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  errorMessages: Message[]
  markToolCallError: () => void
  streamDone: StreamDoneHolder
}) {
  const {
    baseParams,
    agentTemplate,
    signal,
    stager,
    fileProcessingState,
    toolResults,
    toolResultsToAddToMessageHistory,
    toolCalls,
    toolCallsToAddToMessageHistory,
    onCostCalculated,
    onResponseChunk,
    errorMessages,
    markToolCallError,
    streamDone,
  } = params

  function createToolExecutionCallback(toolName: string, isXmlMode: boolean) {
    const responseHandler = createResponseHandler({
      onResponseChunk,
      errorMessages,
      markToolCallError,
    })
    return {
      onTagStart: () => {},
      onTagEnd: async (_: string, input: Record<string, JSONValue>) => {
        if (signal.aborted) {
          return
        }
        const toolCallId = generateCompactId()
        const isNativeTool = toolNames.includes(toolName as ToolName)

        // Check if this is an agent tool call that should be transformed to spawn_agents
        const transformed = !isNativeTool
          ? tryTransformAgentToolCall({
              toolName,
              input,
              spawnableAgents: agentTemplate.spawnableAgents,
            })
          : null

        // Read previousToolCallFinished at execution time to ensure proper sequential chaining.
        // For XML mode, if this is the first tool call (still pointing to streamDonePromise),
        // start with a resolved promise so we don't wait for the stream to complete.
        const previousPromise =
          isXmlMode && streamDone.isFirstCall()
            ? Promise.resolve()
            : streamDone.previous

        // Determine which executor to use and with what parameters
        let toolPromise: Promise<void>
        if (isNativeTool || transformed) {
          // Use executeToolCall for native tools or transformed agent calls
          toolPromise = executeToolCall({
            ...baseParams,
            toolName: transformed
              ? transformed.toolName
              : (toolName as ToolName),
            input: transformed ? transformed.input : input,
            fileProcessingState,
            fullResponse: stager.fullResponseSoFar,
            previousToolCallFinished: previousPromise,
            toolCallId,
            toolCalls,
            toolCallsToAddToMessageHistory,
            toolResults,
            toolResultsToAddToMessageHistory,
            excludeToolFromMessageHistory: false,
            onCostCalculated,
            onResponseChunk: responseHandler,
          } as ExecuteToolCallParams)
        } else {
          // Use executeCustomToolCall for custom/MCP tools
          toolPromise = executeCustomToolCall({
            ...baseParams,
            toolName,
            input,

            fileProcessingState,
            fullResponse: stager.fullResponseSoFar,
            previousToolCallFinished: previousPromise,
            toolCallId,
            toolCalls,
            toolCallsToAddToMessageHistory,
            toolResults,
            toolResultsToAddToMessageHistory,
            excludeToolFromMessageHistory: false,
            onResponseChunk: responseHandler,
          } as ExecuteToolCallParams)
        }

        streamDone.set(toolPromise)

        // For XML mode, await execution so results appear inline before stream continues
        if (isXmlMode) {
          await toolPromise
        }
      },
    }
  }

  return createToolExecutionCallback
}
