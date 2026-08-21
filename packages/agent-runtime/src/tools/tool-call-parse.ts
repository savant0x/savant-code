import { endsAgentStepParam } from '@savant-code/common/tools/constants'
import { toolParams } from '@savant-code/common/tools/list'

import { ensureZodSchema } from './prompts'
import {
  getToolValidationHint,
  parseStringifiedToolInput,
  stringInputError,
  summarizeMissingReplacementFields,
  type ToolCallError,
} from './tool-call-repair'
import { getAgentShortName, getAgentToolName } from '../templates/prompts'

import type { ToolName } from '@savant-code/common/tools/constants'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentTemplateType } from '@savant-code/common/types/session-state'
import type { CustomToolDefinitions } from '@savant-code/common/util/file'
import type { ToolCallPart } from 'ai'

export type { ToolCallError } from './tool-call-repair'

export type CustomToolCall = {
  toolName: string
  input: Record<string, JSONValue>
} & Omit<ToolCallPart, 'type'>

export function isJSONObject(
  value: JSONValue,
): value is Record<string, JSONValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * FID-2026-0804-009: approximate lines added/touched by a write tool call,
 * used by the mechanical Verifier-criteria flag (10+ lines triggers review).
 */
export function countWriteLines(
  toolName: string,
  input: Record<string, JSONValue>,
): number {
  if (toolName === 'write_file') {
    return typeof input.content === 'string'
      ? input.content.split('\n').length
      : 0
  }
  if (toolName === 'str_replace') {
    const replacements = Array.isArray(input.replacements)
      ? input.replacements
      : []
    let added = 0
    for (const r of replacements) {
      if (r && typeof r === 'object') {
        const oldString =
          'oldString' in r && typeof r.oldString === 'string' ? r.oldString : ''
        const newString =
          'newString' in r && typeof r.newString === 'string' ? r.newString : ''
        added += Math.max(
          newString.split('\n').length - oldString.split('\n').length,
          0,
        )
      }
    }
    return added
  }
  if (toolName === 'apply_patch') {
    const operation = typeof input.operation === 'string' ? input.operation : ''
    return (operation.match(/^\+/gm) ?? []).length
  }
  return 0
}

export function parseRawToolCall<T extends ToolName = ToolName>(params: {
  rawToolCall: {
    toolName: T
    toolCallId: string
    input: JSONValue
  }
}): SavantCodeToolCall<T> | ToolCallError {
  const { rawToolCall } = params
  const toolName = rawToolCall.toolName

  const processedParameters = parseStringifiedToolInput(
    rawToolCall.input,
    toolName,
  )
  const paramsSchema = toolParams[toolName].inputSchema

  if (typeof processedParameters.input === 'string') {
    return stringInputError(
      toolName,
      rawToolCall.toolCallId,
      processedParameters.parseError,
    )
  }

  const result = paramsSchema.safeParse(processedParameters.input)

  if (!result.success) {
    const hint = getToolValidationHint(toolName)
    const summary = summarizeMissingReplacementFields(
      toolName,
      result.error.issues,
    )
    const validationDetails = JSON.stringify(result.error.issues, null, 2)
    return {
      toolName,
      toolCallId: rawToolCall.toolCallId,
      input: rawToolCall.input,
      error: `Invalid parameters for ${toolName}: ${
        summary
          ? `${summary}\n\nRaw validation issues:\n${validationDetails}`
          : validationDetails
      }${hint ? `\n\n${hint}` : ''}`,
    }
  }

  if (endsAgentStepParam in result.data) {
    delete result.data[endsAgentStepParam]
  }

  return {
    toolName,
    input: result.data,
    toolCallId: rawToolCall.toolCallId,
  } as SavantCodeToolCall<T>
}

export function parseRawCustomToolCall(params: {
  customToolDefs: CustomToolDefinitions
  rawToolCall: {
    toolName: string
    toolCallId: string
    input: JSONValue
  }
  autoInsertEndStepParam?: boolean
}): CustomToolCall | ToolCallError {
  const { customToolDefs, rawToolCall, autoInsertEndStepParam = false } = params
  const toolName = rawToolCall.toolName

  if (!(customToolDefs && toolName in customToolDefs)) {
    return {
      toolName,
      toolCallId: rawToolCall.toolCallId,
      input: rawToolCall.input,
      error: `Tool ${toolName} not found`,
    }
  }

  const parsedInput = parseStringifiedToolInput(rawToolCall.input, toolName)

  if (typeof parsedInput.input === 'string') {
    return stringInputError(
      toolName,
      rawToolCall.toolCallId,
      parsedInput.parseError,
    )
  }

  const processedParameters: Record<string, JSONValue> = {}
  for (const [param, val] of Object.entries(parsedInput.input ?? {})) {
    processedParameters[param] = val
  }

  // Add the required endsAgentStepParam (cb_easp) parameter with the correct value for this tool if requested
  if (
    autoInsertEndStepParam &&
    customToolDefs?.[toolName]?.endsAgentStep != null
  ) {
    processedParameters[endsAgentStepParam] = customToolDefs[toolName]
      .endsAgentStep as JSONValue
  }

  const rawSchema = customToolDefs?.[toolName]?.inputSchema
  if (rawSchema) {
    const paramsSchema = ensureZodSchema(rawSchema as Record<string, JSONValue>)
    const result = paramsSchema.safeParse(processedParameters)

    if (!result.success) {
      return {
        toolName: toolName,
        toolCallId: rawToolCall.toolCallId,
        input: rawToolCall.input,
        error: `Invalid parameters for ${toolName}: ${JSON.stringify(
          result.error.issues,
          null,
          2,
        )}`,
      }
    }
  }

  const input = JSON.parse(JSON.stringify(parsedInput.input))
  if (endsAgentStepParam in input) {
    delete input[endsAgentStepParam]
  }
  return {
    toolName: toolName,
    input,
    toolCallId: rawToolCall.toolCallId,
  }
}

/**
 * Checks if a tool name matches a spawnable agent and returns the transformed
 * spawn_agents input if so. Returns null if not an agent tool call.
 */
export function tryTransformAgentToolCall(params: {
  toolName: string
  input: Record<string, JSONValue>
  spawnableAgents: AgentTemplateType[]
}): { toolName: 'spawn_agents'; input: Record<string, JSONValue> } | null {
  const { toolName, input, spawnableAgents } = params

  const matchesAgentToolName = (agentType: AgentTemplateType) =>
    getAgentToolName(agentType) === toolName ||
    getAgentShortName(agentType) === toolName

  // Find the full agent type for this direct-call alias.
  const fullAgentType = spawnableAgents.find(matchesAgentToolName)
  if (!fullAgentType) {
    return null
  }

  // Convert to spawn_agents call - input already has prompt and params as top-level fields
  // (consistent with spawn_agents schema)
  const agentEntry: Record<string, JSONValue> = {
    agent_type: fullAgentType,
  }
  if (typeof input.prompt === 'string') {
    agentEntry.prompt = input.prompt
  }
  if (input.params && typeof input.params === 'object') {
    agentEntry.params = input.params
  }
  const spawnAgentsInput = {
    agents: [agentEntry],
  }

  return { toolName: 'spawn_agents', input: spawnAgentsInput }
}
