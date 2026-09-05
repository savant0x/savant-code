import { toolNames } from '@savant-code/common/tools/constants'
import { AbortError } from '@savant-code/common/util/error'

import { processStreamWithTools } from '../tool-stream-parser'
import { handleStreamErrorChunk } from './stream-parser/error-chunk'
import { buildFinalMessageHistory } from './stream-parser/finalize'
import { createGroundingStager } from './stream-parser/grounding-stager'
import { createStreamDoneHolder } from './stream-parser/stream-done'
import { createToolExecutionCallbackFactory } from './stream-parser/tool-execution'

import type { FileProcessingState } from './handlers/tool/write-file'
import type { ProcessStreamParams } from './stream-parser/types'
import type { CustomToolCall } from './tool-executor'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type {
  ToolMessage,
  Message,
} from '@savant-code/common/types/messages/savant-code-message'

/**
 * Consumes a model stream, executing tool calls as they arrive and building
 * the assistant message history (FID-2026-0819-005 Loop 299: decomposed into
 * `stream-parser/` modules — grounding stager, tool execution, error-chunk
 * handling, shared types — with this file as the orchestrator).
 */
export async function processStream(params: ProcessStreamParams) {
  const {
    agentState,
    agentTemplate,
    ancestorRunIds,
    fileContext,
    fullResponse,
    logger,
    onCostCalculated,
    onResponseChunk,
    runId,
    signal,
    userId,
  } = params
  // === MUTABLE STATE ===
  const toolResults: ToolMessage[] = []
  const toolResultsToAddToMessageHistory: ToolMessage[] = []
  const toolCalls: (SavantCodeToolCall | CustomToolCall)[] = []
  const toolCallsToAddToMessageHistory: (
    SavantCodeToolCall | CustomToolCall
  )[] = []
  const assistantMessages: Message[] = []
  let hadToolCallError = false
  let hasNativeIncompleteToolCall = false
  let lastIncompleteToolName: string | undefined
  const errorMessages: Message[] = []
  const streamDone = createStreamDoneHolder()
  const fileProcessingState: FileProcessingState = {
    promisesByPath: {},
    allPromises: [],
    fileChangeErrors: [],
    fileChanges: [],
    firstFileProcessed: false,
  }
  const stager = createGroundingStager({
    agentState,
    fullResponse,
    assistantMessages,
    onResponseChunk,
    ancestorRunIds,
    runId,
  })
  const {
    fullResponseChunks,
    yagniStripper,
    emitGroundedText,
    emitGroundedReasoning,
    flushGroundingOutput,
  } = stager
  const createToolExecutionCallback = createToolExecutionCallbackFactory({
    baseParams: params,
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
    markToolCallError: () => {
      hadToolCallError = true
    },
    streamDone,
  })
  // === STREAM PROCESSING ===
  const streamWithTags = processStreamWithTools({
    ...params,
    processors: Object.fromEntries([
      ...toolNames.map((name) => [
        name,
        createToolExecutionCallback(name, false),
      ]),
      ...Object.keys(fileContext.customToolDefinitions ?? {}).map((name) => [
        name,
        createToolExecutionCallback(name, false),
      ]),
    ]),
    defaultProcessor: (name: string) =>
      createToolExecutionCallback(name, false),
    loggerOptions: {
      userId,
      model: agentTemplate.model,
      agentName: agentTemplate.id,
    },
    onResponseChunk: (chunk) => {
      if (chunk.type === 'text') {
        // Text is committed only by the stream-consumption branch below,
        // after the grounding predicate has been evaluated.
        return
      }
      if (chunk.type === 'error') {
        return onResponseChunk(chunk)
      }
      chunk satisfies never
      throw new Error(
        `Internal error: unhandled chunk type: ${JSON.stringify(chunk)}`,
      )
    },
    // Execute XML-parsed tool calls immediately during streaming
    executeXmlToolCall: async ({ toolName, input }) => {
      if (signal.aborted) {
        return
      }
      const callback = createToolExecutionCallback(toolName, true)
      await callback.onTagEnd(toolName, input as Record<string, string>)
    },
  })

  // === STREAM CONSUMPTION LOOP ===
  let messageId: string | null = null

  // Wrap in try/finally so that the finalization (message history update) always
  // runs even when the stream throws an AbortError mid-iteration.
  try {
    while (true) {
      if (signal.aborted) {
        break
      }
      const { value: chunk, done } = await streamWithTags.next()
      if (done) {
        // Handle PromptResult: extract value if success, null if aborted
        if (chunk && typeof chunk === 'object' && 'aborted' in chunk) {
          messageId = chunk.aborted ? null : chunk.value
        } else {
          messageId = chunk
        }
        break
      }

      if (chunk.type === 'reasoning') {
        emitGroundedReasoning(chunk.text)
      } else if (chunk.type === 'text') {
        emitGroundedText(chunk.text)
      } else if (chunk.type === 'error') {
        onResponseChunk(chunk)
        hadToolCallError = true
        const errorOutcome = handleStreamErrorChunk({
          chunk,
          errorMessages,
          loggerWarn: (payload, message) => {
            logger.warn(
              payload as {
                agentType: string
                runId: string
                toolName: string
              },
              message,
            )
          },
          agentTemplate,
          runId,
        })
        hasNativeIncompleteToolCall =
          hasNativeIncompleteToolCall ||
          errorOutcome.hasNativeIncompleteToolCall
        if (errorOutcome.lastIncompleteToolName !== undefined) {
          lastIncompleteToolName = errorOutcome.lastIncompleteToolName
        }
      } else if (chunk.type === 'tool-call') {
      } else {
        chunk satisfies never
        throw new Error(`Unhandled chunk type: ${JSON.stringify(chunk)}`)
      }
    }

    // FID-2026-0802-005 H7: settle the initial tool-call chain before
    // awaiting it on the normal path (in native mode the first call is
    // chained on streamDonePromise, so it must be resolved first).
    streamDone.resolve()
    if (!signal.aborted) {
      await streamDone.previous
      // Native tool results (including grounding reads) settle after the
      // provider stream ends. Flush staged assistant output only after those
      // results positively complete; otherwise the safety contract discards it.
      flushGroundingOutput()
    }
  } finally {
    // FID-2026-0802-005 H7: ALWAYS settle streamDonePromise — even on abort
    // or a mid-stream error — so suspended first-call handlers resume (and
    // observe signal.aborted) instead of dangling forever with lost credits.
    // Idempotent: already resolved on the normal path. Trade-off (per FID): a
    // resumed handler runs to completion bounded by its own signal checks.
    streamDone.resolve()
    // === FINALIZATION ===
    // Trigger cleanup of the processStreamWithTools generator so it flushes any
    // remaining buffered text to assistantMessages before we build the history.
    // On path B (AbortError thrown mid-stream) the generator is already completed
    // so .return() is a no-op. On path A (cooperative signal.aborted break) the
    // generator is still suspended and .return() triggers its finally → flush().
    try {
      await streamWithTags.return({ aborted: true })
    } catch {
      // Generator cleanup failed; assistantMessages may be incomplete but
      // we must not swallow the original error.
    }

    // FID-2026-0822-004: stream ended — drop any held unclosed <yagni_check>
    // block (truncated scaffolding). Held text was never emitted to
    // assistantMessages/onResponseChunk, so dropping it leaves both clean.
    yagniStripper.flush()

    // This runs even when the stream throws (e.g., AbortError mid-iteration).
    // Build message history from the current agentState.messageHistory so that
    // inline agent modifications (e.g. set_messages) are preserved, while
    // tool_calls and tool_results are still appended in deterministic order.
    //
    // When the signal was aborted, tool calls are added synchronously but tool
    // results arrive asynchronously via .then(). Because we skip awaiting
    // previousToolCallFinished on abort, some tool calls may not have matching
    // tool results yet. Including orphaned tool calls in the message history
    // causes provider errors ("unexpected tool_use_id found in tool_result
    // blocks"). Filter them out so every tool_call has a corresponding
    // tool_result.
    agentState.messageHistory = buildFinalMessageHistory({
      agentState,
      assistantMessages,
      toolCallsToAddToMessageHistory,
      toolResultsToAddToMessageHistory,
      errorMessages,
    })
  }

  if (signal.aborted) {
    throw new AbortError()
  }

  return {
    fullResponse: stager.fullResponseSoFar,
    fullResponseChunks,
    hadToolCallError,
    hasNativeIncompleteToolCall,
    lastIncompleteToolName,
    messageId,
    toolCalls,
    toolResults,
  }
}
