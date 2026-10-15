import { buildArray } from '@savant-code/common/util/array'
import { assistantMessage } from '@savant-code/common/util/messages'

import type { CustomToolCall } from '../tool-executor'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Builds the final message history from the captured assistant messages, tool
 * calls, and tool results. Orphaned tool calls (those without a matching tool
 * result, e.g. after an abort) are filtered out so every tool_call has a
 * corresponding tool_result — otherwise providers reject the history with
 * "unexpected tool_use_id found in tool_result blocks".
 * (FID-2026-0809-016: extracted from `tools/stream-parser.ts`.)
 */
export function buildFinalMessageHistory(params: {
  agentState: AgentState
  assistantMessages: Message[]
  toolCallsToAddToMessageHistory: (SavantCodeToolCall | CustomToolCall)[]
  toolResultsToAddToMessageHistory: ToolMessage[]
  errorMessages: Message[]
}): Message[] {
  const {
    agentState,
    assistantMessages,
    toolCallsToAddToMessageHistory,
    toolResultsToAddToMessageHistory,
    errorMessages,
  } = params

  const completedToolCallIds = new Set(
    toolResultsToAddToMessageHistory.map((r) => r.toolCallId),
  )
  const filteredToolCalls = toolCallsToAddToMessageHistory.filter((tc) =>
    completedToolCallIds.has(tc.toolCallId),
  )

  return buildArray<Message>([
    ...agentState.messageHistory,
    ...assistantMessages,
    ...filteredToolCalls.map((toolCall) =>
      assistantMessage({ ...toolCall, type: 'tool-call' }),
    ),
    ...toolResultsToAddToMessageHistory,
    ...errorMessages,
  ])
}
