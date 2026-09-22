import { toolNames } from '@savant-code/common/tools/constants'
import { toJSONValue } from '@savant-code/common/util/type-narrowing'

import { resolveSpawnableAgent } from '../handlers/tool/spawn-agent-utils'
import { batchSpawnRejectionMessage } from '../handlers/tool/spawn-inline-only'
import { isJSONObject } from '../tool-call-parse'

import type { ExecuteToolCallParams } from './types'
import type { AgentTemplate } from '../../templates/types'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * Pre-validates spawn_agents to filter out non-existent agents before
 * streaming the tool call. Also repairs the common model mistake of
 * stringifying the `agents` array (FID-2026-0723-004). Returns the effective
 * input (possibly filtered) or `rejected: true` when an error chunk was
 * emitted and the caller should return early.
 */
export async function validateSpawnAgentsInput(params: {
  toolName: string
  effectiveInput: Record<string, JSONValue>
  agentTemplate: AgentTemplate
  localAgentTemplates: Record<string, AgentTemplate>
  fetchAgentFromDatabase: ExecuteToolCallParams['fetchAgentFromDatabase']
  databaseAgentCache: ExecuteToolCallParams['databaseAgentCache']
  apiKey: string
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
}): Promise<{ rejected: boolean; input: Record<string, JSONValue> }> {
  const {
    toolName,
    effectiveInput: effectiveInputParam,
    agentTemplate,
    localAgentTemplates,
    fetchAgentFromDatabase,
    databaseAgentCache,
    apiKey,
    logger,
    onResponseChunk,
  } = params
  let effectiveInput = effectiveInputParam

  // FID-2026-0723-004: Some models stringify the `agents` array. Attempt to
  // parse it back into an array before validation so the agent gets a clear
  // error instead of a silent schema failure.
  if (typeof effectiveInput.agents === 'string') {
    try {
      const parsed = toJSONValue(JSON.parse(effectiveInput.agents))
      if (!Array.isArray(parsed)) {
        onResponseChunk({
          type: 'error',
          message: `Invalid parameters for spawn_agents: the "agents" argument must be an array of objects, but received a string that parsed to a non-array. Expected shape: { "agents": [{ "agent_type": string, "prompt"?: string, "params"?: object }] }. Re-issue the tool call with the full arguments object and properly escaped string values.`,
        })
        return { rejected: true, input: effectiveInput }
      }
      effectiveInput = { ...effectiveInput, agents: parsed as JSONValue }
    } catch (parseError) {
      onResponseChunk({
        type: 'error',
        message: `Invalid parameters for spawn_agents: the "agents" argument must be an array of objects, but received a string. JSON.parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}. Expected shape: { "agents": [{ "agent_type": string, "prompt"?: string, "params"?: object }] }. Re-issue the tool call with the full arguments object and properly escaped string values.`,
      })
      return { rejected: true, input: effectiveInput }
    }
  }
  const agents = effectiveInput.agents
  if (Array.isArray(agents)) {
    // FID-2026-0802-005 H4: validation delegates to the single shared
    // resolver (resolveSpawnableAgent) used by the spawn handlers — no more
    // duplicated getMatchingSpawn + getAgentTemplate per agent. The handler
    // still re-resolves via validateAndGetAgentTemplate as defense in depth.
    const validationResults = await Promise.allSettled(
      agents.map(async (agent) => {
        if (!isJSONObject(agent)) {
          return { valid: false as const, error: 'Invalid agent entry' }
        }
        const agentTypeStr = agent.agent_type
        if (typeof agentTypeStr !== 'string' || !agentTypeStr) {
          return {
            valid: false as const,
            error: 'Agent entry missing agent_type',
          }
        }

        // FID-2026-0919-027: harness-owned inline agents are rejected BEFORE
        // dispatch — batch spawning one would succeed and change nothing.
        const inlineOnlyRejection = batchSpawnRejectionMessage(agentTypeStr)
        if (inlineOnlyRejection !== null) {
          return { valid: false as const, error: inlineOnlyRejection }
        }

        const resolved = await resolveSpawnableAgent({
          agentTypeStr,
          parentAgentTemplate: agentTemplate,
          localAgentTemplates,
          fetchAgentFromDatabase,
          databaseAgentCache,
          logger,
          apiKey,
        })
        if (!resolved.ok) {
          if (toolNames.includes(agentTypeStr as ToolName)) {
            return {
              valid: false as const,
              error: `"${agentTypeStr}" is a tool, not an agent. Call it directly as a tool instead of wrapping it in spawn_agents.`,
            }
          }
          if (resolved.code === 'not-spawnable') {
            return {
              valid: false as const,
              error: `Agent "${agentTypeStr}" is not available to spawn`,
            }
          }
          if (resolved.code === 'load-failed') {
            return {
              valid: false as const,
              error: `Agent "${agentTypeStr}" could not be loaded`,
            }
          }
          return {
            valid: false as const,
            error: `Agent "${agentTypeStr}" does not exist`,
          }
        }

        return { valid: true as const, agent }
      }),
    )

    const validAgents: Array<Record<string, JSONValue>> = []
    const errors: string[] = []

    for (const result of validationResults) {
      if (result.status === 'rejected') {
        errors.push('Agent validation failed unexpectedly')
      } else if (result.value.valid) {
        validAgents.push(result.value.agent)
      } else {
        errors.push(result.value.error)
      }
    }

    if (errors.length > 0) {
      if (validAgents.length === 0) {
        const errorMsg = `Failed to spawn agents: ${errors.join('; ')}`
        onResponseChunk({ type: 'error', message: errorMsg })
        logger.debug(
          { toolName, errors },
          'All agents in spawn_agents are invalid, not streaming tool call',
        )
        return { rejected: true, input: effectiveInput }
      }
      const errorMsg = `Some agents could not be spawned: ${errors.join('; ')}. Proceeding with valid agents only.`
      onResponseChunk({ type: 'error', message: errorMsg })
      effectiveInput = { ...effectiveInput, agents: validAgents }
    }
  }

  return { rejected: false, input: effectiveInput }
}
