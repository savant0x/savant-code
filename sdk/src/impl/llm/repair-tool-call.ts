/**
 * Spawnable-agent tool-call repair for the LLM stream entry point
 * (FID-2026-0805-003). Extracted from the experimental_repairToolCall closure
 * in impl/llm.ts verbatim.
 */

import { toJSONValue } from '@savant-code/common/util/type-narrowing'

import type { JSONValue } from '@savant-code/common/types/json'

export interface SpawnableAgentTransform {
  toolName: 'spawn_agents'
  input: string
  /** The parsed transform payload, logged by the caller (same shape as before). */
  spawnAgentsInput: {
    agents: Array<{
      agent_type: string
      prompt?: string
      params?: Record<string, JSONValue>
    }>
  }
}

/**
 * Transform a NoSuchToolError tool call for a spawnable agent into a
 * spawn_agents call. Returns null when the tool name matches neither a
 * spawnable agent nor a local agent template.
 */
export function transformSpawnableAgentToolCall(params: {
  toolName: string
  toolCallInput: unknown
  spawnableAgents: string[]
  localAgentTemplates: Record<string, unknown>
}): SpawnableAgentTransform | null {
  const { toolName, toolCallInput, spawnableAgents, localAgentTemplates } =
    params

  // Also check for underscore variant (e.g., "file_picker" -> "file-picker")
  const toolNameWithHyphens = toolName.replace(/_/g, '-')

  const matchingAgentId = spawnableAgents.find((agentId) => {
    const withoutVersion = agentId.split('@')[0]
    const parts = withoutVersion.split('/')
    const agentName = parts[parts.length - 1]
    return (
      agentName === toolName ||
      agentName === toolNameWithHyphens ||
      agentId === toolName
    )
  })
  const isSpawnableAgent = matchingAgentId !== undefined
  const isLocalAgent =
    toolName in localAgentTemplates ||
    toolNameWithHyphens in localAgentTemplates

  if (!isSpawnableAgent && !isLocalAgent) {
    return null
  }

  // Transform agent tool call to spawn_agents
  // FID-2026-0802-008 V4: bounded recursion — tool-call input is
  // model-generated, but a deeply nested value could otherwise
  // overflow the stack.
  const deepParseJson = (value: JSONValue, depth = 0): JSONValue => {
    if (depth > 100) return value
    if (typeof value === 'string') {
      try {
        return deepParseJson(toJSONValue(JSON.parse(value)), depth + 1)
      } catch {
        return value
      }
    }
    if (Array.isArray(value)) {
      return value.map((v) => deepParseJson(v, depth + 1))
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, deepParseJson(v, depth + 1)]),
      )
    }
    return value
  }
  let input: Record<string, JSONValue> = {}
  try {
    const rawInput =
      typeof toolCallInput === 'string'
        ? (JSON.parse(toolCallInput) as JSONValue)
        : (toolCallInput as JSONValue)
    input = deepParseJson(rawInput) as Record<string, JSONValue>
  } catch {
    // If parsing fails, use empty object
  }

  const prompt = typeof input.prompt === 'string' ? input.prompt : undefined
  const agentParams = Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => !(key === 'prompt' && typeof value === 'string'),
    ),
  )

  // Use the matching agent ID or corrected name with hyphens
  const correctedAgentType =
    matchingAgentId ??
    (toolNameWithHyphens in localAgentTemplates
      ? toolNameWithHyphens
      : toolName)

  const spawnAgentsInput: SpawnableAgentTransform['spawnAgentsInput'] = {
    agents: [
      {
        agent_type: correctedAgentType,
        ...(prompt !== undefined && { prompt }),
        ...(Object.keys(agentParams).length > 0 && {
          params: agentParams,
        }),
      },
    ],
  }

  return {
    toolName: 'spawn_agents',
    input: JSON.stringify(spawnAgentsInput),
    spawnAgentsInput,
  }
}
