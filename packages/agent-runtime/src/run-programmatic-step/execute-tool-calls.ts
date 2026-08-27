import { PROGRAMMATIC_PRIMITIVES } from '@savant-code/common/tools/constants'
import { assistantMessage } from '@savant-code/common/util/messages'

import { executeToolCall } from '../tools/tool-executor'

import type { ExecuteToolCallParams } from '../tools/tool-executor'
import type { ParsedSegment } from '../util/parse-tool-calls-from-text'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  ToolCallPart,
  ToolResultOutput,
} from '@savant-code/common/types/messages/content-part'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Represents a tool call to be executed.
 * Can optionally include `includeToolCall: false` to exclude from message history.
 */
export type ToolCallToExecute = {
  toolName: string
  input: Record<string, JSONValue>
  includeToolCall?: boolean
}

/**
 * Parameters for executing an array of tool calls.
 */
export type ExecuteToolCallsArrayParams = Omit<
  ExecuteToolCallParams,
  | 'toolName'
  | 'input'
  | 'autoInsertEndStepParam'
  | 'excludeToolFromMessageHistory'
  | 'toolCallId'
  | 'toolCallsToAddToMessageHistory'
  | 'toolResultsToAddToMessageHistory'
> & {
  agentState: AgentState
  onResponseChunk: (chunk: string | PrintModeEvent) => void
}

/**
 * Executes a single tool call.
 * Adds the tool call as an assistant message and then executes it.
 *
 * @returns The tool result from the executed tool call.
 */
export async function executeSingleToolCall(
  toolCallToExecute: ToolCallToExecute,
  params: ExecuteToolCallsArrayParams,
): Promise<ToolResultOutput[] | undefined> {
  const { agentState, onResponseChunk, toolResults } = params

  // FID-2026-0803-001 ECHO-1: bound the programmatic bypass. handleSteps may
  // call tools declared in `toolNames`, tools declared in
  // `programmaticToolNames`, or the central PROGRAMMATIC_PRIMITIVES plumbing
  // set — anything else fails closed with a diagnosable declaration error.
  const allowedProgrammaticTools = new Set<string>([
    ...(params.agentTemplate.toolNames ?? []),
    ...(params.agentTemplate.programmaticToolNames ?? []),
    ...PROGRAMMATIC_PRIMITIVES,
  ])
  if (!allowedProgrammaticTools.has(toolCallToExecute.toolName)) {
    throw new Error(
      `handleSteps for agent ${params.agentTemplate.id} yielded tool "${toolCallToExecute.toolName}" which is not declared in toolNames/programmaticToolNames and is not a programmatic primitive. Declare it in the agent's programmaticToolNames (or toolNames) or add it to PROGRAMMATIC_PRIMITIVES in common/src/tools/constants.ts.`,
    )
  }

  const toolCallId = crypto.randomUUID()
  const excludeToolFromMessageHistory =
    toolCallToExecute.includeToolCall === false

  // Add assistant message with the tool call before executing it
  if (!excludeToolFromMessageHistory) {
    const toolCallPart: ToolCallPart = {
      type: 'tool-call',
      toolCallId,
      toolName: toolCallToExecute.toolName,
      input: toolCallToExecute.input,
    }
    // FID-2026-0802-005 H5: messageHistory is a mutable Message[] — the
    // previous per-call array copy was O(n) per tool call (O(n²) per step for
    // tool-dense generators). The generator holds the same agentState object,
    // so in-place push is visible to handleSteps (already the pattern in the
    // catch path below).
    agentState.messageHistory.push(assistantMessage(toolCallPart))
  }

  const toolResultsToAddToMessageHistory: ToolMessage[] = []
  // FID-2026-0820-016: gate blocks (FSM phase, sandbox policy, EHEL, hooks,
  // ZTAP, spawn validation) emit an `error` chunk and then return from the
  // executor WITHOUT creating a tool result. Capturing the reason here lets
  // the synthesis below deliver it to the generator instead of dropping it
  // silently.
  let lastBlockReason: string | undefined = undefined
  // FID-2026-0821-004 D1: the shared toolResults array is cumulative across
  // all yields of a run (created once in run-programmatic-step.ts). Capture
  // its length BEFORE this call so the return below slices out ONLY the
  // results this call produced — never a prior yield's output.
  const toolResultsStartLength = toolResults.length
  // Execute with a narrow template copy that exposes only this validated
  // programmatic tool to the executor. No caller-provided bypass flag or
  // capability set is trusted by the executor.
  const programmaticAgentTemplate = {
    ...params.agentTemplate,
    toolNames: [
      ...new Set([
        ...(params.agentTemplate.toolNames ?? []),
        toolCallToExecute.toolName,
      ]),
    ],
  }
  await executeToolCall({
    ...params,
    agentTemplate: programmaticAgentTemplate,
    toolName: toolCallToExecute.toolName as ToolName,
    input: toolCallToExecute.input,
    autoInsertEndStepParam: true,
    excludeToolFromMessageHistory,
    toolCallId,
    toolCalls: [],
    toolCallsToAddToMessageHistory: [],
    toolResultsToAddToMessageHistory,

    onResponseChunk: (chunk: string | PrintModeEvent) => {
      if (typeof chunk === 'string') {
        onResponseChunk(chunk)
        return
      }

      // FID-2026-0820-016: all gate-block sites emit an `error` chunk before
      // their bare early return — capture the reason for the synthesis below.
      if (chunk.type === 'error') {
        lastBlockReason = chunk.message
      }

      // Only add parentAgentId if this programmatic agent has a parent (i.e., it's nested)
      // This ensures we don't add parentAgentId to top-level spawns
      if (agentState.parentId) {
        const parentAgentId = agentState.agentId

        switch (chunk.type) {
          case 'subagent_start':
          case 'subagent_finish':
            if (!chunk.parentAgentId) {
              onResponseChunk({
                ...chunk,
                parentAgentId,
              })
              return
            }
            break
          case 'tool_call':
          case 'tool_result': {
            if (!chunk.parentAgentId) {
              onResponseChunk({
                ...chunk,
                parentAgentId,
              })
              return
            }
            break
          }
          default:
            break
        }
      }

      // For other events or top-level spawns, send as-is
      onResponseChunk(chunk)
    },
  })

  agentState.messageHistory.push(...toolResultsToAddToMessageHistory)

  // FID-2026-0820-016: a gate block (FSM phase, sandbox policy, EHEL, hooks,
  // ZTAP, spawn validation) returns from the executor without creating a tool
  // result — leaving an orphaned tool-call part in history and delivering
  // nothing to the generator (the silent relay loss). Synthesize the blocking
  // result so the call/result pair stays complete and the model sees the
  // actual reason. Scoped to the gate-block signature (a captured error
  // chunk): result-less tools like end_turn never emit one and are
  // unaffected. The abort gate emits no chunk by design — an aborted run
  // surfaces as an LLM AbortError before any STEP completes, so its
  // transient orphan is discarded with the run.
  if (
    toolResultsToAddToMessageHistory.length === 0 &&
    lastBlockReason !== undefined
  ) {
    const blockedResult: ToolMessage = {
      role: 'tool',
      toolName: toolCallToExecute.toolName,
      toolCallId,
      content: [
        { type: 'json', value: { blocked: true, reason: lastBlockReason } },
      ],
    }
    if (!excludeToolFromMessageHistory) {
      agentState.messageHistory.push(blockedResult)
    }
    return blockedResult.content
  }

  // FID-2026-0821-004 D1: return only the results produced by THIS call
  // (the executor pushed exactly its own result(s) into the shared array
  // after the captured start length). A silent gate block — one that returns
  // without an error chunk (e.g. the abort gate, which emits none by design)
  // — yields an empty slice, so the generator receives undefined instead of
  // a PRIOR call's output masquerading as this one's.
  const ownResults = toolResults.slice(toolResultsStartLength)
  return ownResults[ownResults.length - 1]?.content
}

/**
 * Executes an array of segments (text and tool calls) sequentially.
 * Text segments are added as assistant messages.
 * Tool calls are added as assistant messages and then executed.
 *
 * @returns The tool result from the last executed tool call.
 */
export async function executeSegmentsArray(
  segments: ParsedSegment[],
  params: ExecuteToolCallsArrayParams,
): Promise<ToolResultOutput[] | undefined> {
  const { agentState, onResponseChunk } = params

  let toolResults: ToolResultOutput[] = []

  for (const segment of segments) {
    if (segment.type === 'text') {
      // Add text as an assistant message
      agentState.messageHistory.push(assistantMessage(segment.text))

      // Stream assistant text
      onResponseChunk(segment.text)
    } else {
      // Handle tool call segment
      const toolResult = await executeSingleToolCall(segment, params)
      if (toolResult) {
        toolResults.push(...toolResult)
      }
    }
  }

  return toolResults
}
