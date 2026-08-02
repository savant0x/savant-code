import { jsonToolResult } from '@savant-code/common/util/messages'
import { toLogValue } from '@savant-code/common/util/type-narrowing'

import { getAgentTemplate } from '../../../templates/agent-registry'
import { formatValueForError } from '../../../util/format-value'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { FetchAgentFromDatabaseFn } from '@savant-code/common/types/contracts/database'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentState } from '@savant-code/common/types/session-state'

type ToolName = 'set_output'
export const handleSetOutput = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<ToolName>

  agentState: AgentState
  apiKey: string
  databaseAgentCache: Map<string, AgentTemplate | null>
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  fetchAgentFromDatabase: FetchAgentFromDatabaseFn
}): Promise<{ output: SavantCodeToolOutput<ToolName> }> => {
  const { previousToolCallFinished, toolCall, agentState, logger } = params
  const output = toolCall.input
  const { data } = output ?? {}

  await previousToolCallFinished

  let agentTemplate = null
  if (agentState.agentType) {
    agentTemplate = await getAgentTemplate({
      ...params,
      agentId: agentState.agentType,
    })
  }

  let finalOutput: unknown
  if (agentTemplate?.outputSchema) {
    // When outputSchema is defined, validate against it
    try {
      agentTemplate.outputSchema.parse(output)
      finalOutput = output
    } catch (error) {
      try {
        // Fallback to the 'data' field if the whole output object is not valid
        agentTemplate.outputSchema.parse(data)
        finalOutput = data
      } catch (error2) {
        // Show whichever error has fewer issues — that represents the "closer" parse
        // attempt and gives the agent more actionable feedback for retrying.
        const issues1 = getZodIssueCount(error)
        const issues2 = getZodIssueCount(error2)
        const usedData = issues2 < issues1
        const bestError = usedData ? error2 : error
        const prefix = usedData
          ? 'Output validation error: Your output was found inside the `data` field but still failed validation. Please fix the issues and try again without wrapping in `data`. Issues: '
          : 'Output validation error: Output failed to match the output schema and was ignored. You might want to try again! Issues: '
        const errorMessage = `${prefix}${bestError}\n\nOriginal output value:\n${formatValueForError(output as JSONValue)}`
        logger.error(
          {
            output: toLogValue(output),
            agentType: agentState.agentType,
            agentId: agentState.agentId,
            topLevelError: toLogValue(error),
            dataFieldError: toLogValue(error2),
            usedDataFieldError: usedData,
          },
          'set_output validation error',
        )
        return { output: jsonToolResult({ message: errorMessage }) }
      }
    }
  } else {
    // When no outputSchema, use the data field if it is the only field
    // otherwise use the entire output object
    const keys = Object.keys(output)
    const hasOnlyDataField = keys.length === 1 && keys[0] === 'data'
    finalOutput = hasOnlyDataField ? data : output
  }

  // Set the output (completely replaces previous output)
  agentState.output = finalOutput as Record<string, JSONValue>

  return { output: jsonToolResult({ message: 'Output set' }) }
}) satisfies SavantCodeToolHandlerFunction<ToolName>

function getZodIssueCount(error: unknown): number {
  if (
    error != null &&
    typeof error === 'object' &&
    'issues' in error &&
    Array.isArray((error as { issues: unknown }).issues)
  ) {
    return (error as { issues: unknown[] }).issues.length
  }
  return Infinity
}
