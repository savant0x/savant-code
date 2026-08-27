import { toolNames } from '@savant-code/common/tools/constants'
import { AbortError } from '@savant-code/common/util/error'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import { generateCompactId } from '@savant-code/common/util/string'

import { INCLUDE_REASONING_IN_MESSAGE_HISTORY } from '../constants'
import {
  executeCustomToolCall,
  executeToolCall,
  tryTransformAgentToolCall,
} from './tool-executor'
import { isAgentGrounded } from '../echo/grounding'
import { getSteeringMessage } from '../run-agent-step/constants'
import { processStreamWithTools } from '../tool-stream-parser'
import { withSystemTags } from '../util/messages'
import { createYagniCheckStreamStripper } from '../util/think-tags'
import { buildFinalMessageHistory } from './stream-parser/finalize'
import { createResponseHandler } from './stream-parser/response-handler'

import type { CustomToolCall, ExecuteToolCallParams } from './tool-executor'
import type { AgentTemplate } from '../templates/types'
import type { FileProcessingState } from './handlers/tool/write-file'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { Logger as RuntimeLogger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { WriteToolName } from '@savant-code/common/types/provenance'
import type { Subgoal } from '@savant-code/common/types/session-state'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@savant-code/common/util/file'

/** FID-2026-0816-012: native tools whose arguments are commonly large enough to
 *  truncate mid-stream on flash-class models. Recovery steers the model to
 *  split these instead of re-emitting the same oversized payload. The write
 *  tools reuse the canonical `WriteToolName` union (Law 13 — one source of
 *  truth); `read_files` joins it for multi-path reads; `run_terminal_command`
 *  joins it because chained bash commands routinely truncate the same way. */
const NATIVE_TOOL_CALL_STEER_SPLIT_TOOLS = new Set<
  WriteToolName | 'read_files' | 'run_terminal_command'
>([
  'write_file',
  'str_replace',
  'apply_patch',
  'read_files',
  'run_terminal_command',
])

export async function processStream(
  params: {
    agentContext: Record<string, Subgoal>
    agentTemplate: AgentTemplate
    ancestorRunIds: string[]
    fileContext: ProjectFileContext
    fingerprintId: string
    fullResponse: string
    logger: RuntimeLogger
    messages: Message[]
    repoId: string | undefined
    runId: string
    signal: AbortSignal
    userId: string | undefined
    /** FID-2026-0802-005 H8: step-built custom tool data (incl. MCP tools). */
    customToolDefinitions?: CustomToolDefinitions

    onCostCalculated: (credits: number) => Promise<void>
    onResponseChunk: (chunk: string | PrintModeEvent) => void
  } & Omit<
    ExecuteToolCallParams<string>,
    | 'fileProcessingState'
    | 'fullResponse'
    | 'input'
    | 'previousToolCallFinished'
    | 'state'
    | 'toolCallId'
    | 'toolCalls'
    | 'toolCallsToAddToMessageHistory'
    | 'toolName'
    | 'toolResults'
    | 'toolResultsToAddToMessageHistory'
  > &
    ParamsExcluding<
      typeof processStreamWithTools,
      'processors' | 'defaultProcessor' | 'loggerOptions' | 'executeXmlToolCall'
    >,
) {
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
  const fullResponseChunks: string[] = [fullResponse]
  // FID-2026-0802-005 H1: incremental accumulator — the previous
  // `fullResponseChunks.join('')` on every tool call was O(k·L) copying for
  // tool-dense responses. The chunks array is kept only for the final return.
  let fullResponseSoFar = fullResponse
  // FID-2026-0822-004: the Forge emits a <yagni_check> JSON block at the top
  // of its response. This streaming stripper removes the block (and truncated
  // fragments) from what persists/renders — assistantMessages and
  // onResponseChunk — while `fullResponseSoFar` below keeps the RAW text so
  // the enforcement gate's assistant-text channel can still parse the block
  // (gate read is non-destructive; strip is emit-time only).
  const yagniStripper = createYagniCheckStreamStripper()
  // FID-2026-0812-005: stage all main-agent assistant output until the
  // grounding checkpoint is complete. The completion gate runs after stream
  // consumption, so forwarding text or reasoning immediately would let an
  // ungrounded first response flash in the host UI. Staged output is flushed
  // only after successful grounding reads settle; otherwise it is discarded.
  const pendingGroundingOutput: Array<{
    kind: 'text' | 'reasoning'
    text: string
  }> = []
  // Match the enforcement factory's arming predicate rather than the optional
  // protocolVariant field. Legacy/SDK states may have a protocol file without
  // a variant; those sessions are still gated and must stage output.
  const groundingGateArmed =
    !agentState.parentId && Boolean(agentState.protocolFile)

  const emitCommittedText = (text: string): void => {
    if (!text) return
    // fullResponseSoFar keeps the RAW text (FID-2026-0822-004): the YAGNI
    // gate's assistant-text channel reads it at beforeToolCall time and must
    // see the <yagni_check> block the model emitted. Only the user-visible
    // channel below (assistantMessages + onResponseChunk) is stripped — the
    // block never reaches the transcript or the relayed message history.
    fullResponseSoFar += text
    if (fullResponseChunks[0] === fullResponse) {
      fullResponseChunks[0] = fullResponse + text
    } else {
      fullResponseChunks.push(text)
    }
    // FID-2026-0822-004: strip <yagni_check> scaffolding from the
    // user-visible + persisted channels. A block may span chunks, so the
    // stateful stripper holds text from an unclosed opener until its closer
    // arrives (or the stream ends via flush).
    const cleaned = yagniStripper.push(text)
    if (cleaned.length === 0) return
    assistantMessages.push(assistantMessage(cleaned))
    onResponseChunk(cleaned)
  }
  const emitCommittedReasoning = (text: string): void => {
    if (!text) return
    if (INCLUDE_REASONING_IN_MESSAGE_HISTORY) {
      const last = assistantMessages[assistantMessages.length - 1]
      const lastPart =
        last?.role === 'assistant' && Array.isArray(last.content)
          ? last.content[last.content.length - 1]
          : undefined
      if (lastPart?.type === 'reasoning') {
        lastPart.text += text
      } else {
        assistantMessages.push(assistantMessage({ type: 'reasoning', text }))
      }
    }
    onResponseChunk({
      type: 'reasoning_delta',
      text,
      ancestorRunIds,
      runId,
      agentId: agentState.agentId,
    })
  }
  const emitGroundedText = (text: string): void => {
    if (!text) return
    if (groundingGateArmed && !isAgentGrounded(agentState)) {
      pendingGroundingOutput.push({ kind: 'text', text })
      return
    }
    emitCommittedText(text)
  }
  const emitGroundedReasoning = (text: string): void => {
    if (!text) return
    if (groundingGateArmed && !isAgentGrounded(agentState)) {
      pendingGroundingOutput.push({ kind: 'reasoning', text })
      return
    }
    emitCommittedReasoning(text)
  }
  const flushGroundingOutput = (): void => {
    if (groundingGateArmed && !isAgentGrounded(agentState)) {
      pendingGroundingOutput.length = 0
      return
    }
    const staged = pendingGroundingOutput.splice(0)
    for (const output of staged) {
      if (output.kind === 'text') emitCommittedText(output.text)
      else emitCommittedReasoning(output.text)
    }
  }

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
  const { promise: streamDonePromise, resolve: resolveStreamDonePromise } =
    Promise.withResolvers<void>()
  let previousToolCallFinished = streamDonePromise

  const fileProcessingState: FileProcessingState = {
    promisesByPath: {},
    allPromises: [],
    fileChangeErrors: [],
    fileChanges: [],
    firstFileProcessed: false,
  }

  // === RESPONSE HANDLER ===
  // Creates a response handler that captures tool events into assistantMessages.
  // When isXmlMode=true, also captures tool_result events for interleaved ordering.
  const createResponseHandlerForStream = () =>
    createResponseHandler({
      onResponseChunk,
      errorMessages,
      markToolCallError: () => {
        hadToolCallError = true
      },
    })

  // === TOOL EXECUTION ===
  // Unified callback factory for both native and custom tools.
  function createToolExecutionCallback(toolName: string, isXmlMode: boolean) {
    const responseHandler = createResponseHandlerForStream()
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
          isXmlMode && previousToolCallFinished === streamDonePromise
            ? Promise.resolve()
            : previousToolCallFinished

        // Determine which executor to use and with what parameters
        let toolPromise: Promise<void>
        if (isNativeTool || transformed) {
          // Use executeToolCall for native tools or transformed agent calls
          toolPromise = executeToolCall({
            ...params,
            toolName: transformed
              ? transformed.toolName
              : (toolName as ToolName),
            input: transformed ? transformed.input : input,
            fileProcessingState,
            fullResponse: fullResponseSoFar,
            previousToolCallFinished: previousPromise,
            toolCallId,
            toolCalls,
            toolCallsToAddToMessageHistory,
            toolResults,
            toolResultsToAddToMessageHistory,
            excludeToolFromMessageHistory: false,
            onCostCalculated,
            onResponseChunk: responseHandler,
          })
        } else {
          // Use executeCustomToolCall for custom/MCP tools
          toolPromise = executeCustomToolCall({
            ...params,
            toolName,
            input,

            fileProcessingState,
            fullResponse: fullResponseSoFar,
            previousToolCallFinished: previousPromise,
            toolCallId,
            toolCalls,
            toolCallsToAddToMessageHistory,
            toolResults,
            toolResultsToAddToMessageHistory,
            excludeToolFromMessageHistory: false,
            onResponseChunk: responseHandler,
          })
        }

        previousToolCallFinished = toolPromise

        // For XML mode, await execution so results appear inline before stream continues
        if (isXmlMode) {
          await toolPromise
        }
      },
    }
  }

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
        if ('errorClass' in chunk && chunk.errorClass === 'native-incomplete') {
          hasNativeIncompleteToolCall = true
          lastIncompleteToolName = chunk.toolName
          // FID-2026-0816-012 step 4: an incomplete native call for a tool
          // unknown to the runtime is provider-tool-set drift, not model
          // truncation — surface it so it is observable instead of being
          // misread as a payload-size problem.
          if (
            chunk.toolName !== undefined &&
            !toolNames.includes(chunk.toolName as ToolName)
          ) {
            logger.warn(
              {
                agentType: agentTemplate.id,
                runId,
                toolName: chunk.toolName,
              },
              'Native tool call flagged incomplete for a tool unknown to the runtime (possible provider tool-set drift)',
            )
          }
        }
        // FID-2026-0819-004: tool-specific steering with progressive
        // escalation. Strike 1 = hint, strike 2 = explicit, 3+ = example.
        // We use strike=1 here (first occurrence); loop-iteration.ts may
        // append a second error with escalating guidance on retries.
        const steering =
          'errorClass' in chunk &&
          chunk.errorClass === 'native-incomplete' &&
          chunk.toolName !== undefined &&
          NATIVE_TOOL_CALL_STEER_SPLIT_TOOLS.has(
            chunk.toolName as
              WriteToolName | 'read_files' | 'run_terminal_command',
          )
            ? getSteeringMessage(chunk.toolName, 1)
            : ''
        errorMessages.push(
          userMessage({
            content: withSystemTags(
              `Error during tool call: ${chunk.message}. Please check the tool name and arguments and try again.${steering}`,
            ),
            tags: ['TOOL_CALL_ERROR'],
          }),
        )
      } else if (chunk.type === 'tool-call') {
      } else {
        chunk satisfies never
        throw new Error(`Unhandled chunk type: ${JSON.stringify(chunk)}`)
      }
    }

    // FID-2026-0802-005 H7: settle the initial tool-call chain before
    // awaiting it on the normal path (in native mode the first call is
    // chained on streamDonePromise, so it must be resolved first).
    resolveStreamDonePromise()
    if (!signal.aborted) {
      await previousToolCallFinished
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
    resolveStreamDonePromise()
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
    fullResponse: fullResponseSoFar,
    fullResponseChunks,
    hadToolCallError,
    hasNativeIncompleteToolCall,
    lastIncompleteToolName,
    messageId,
    toolCalls,
    toolResults,
  }
}
