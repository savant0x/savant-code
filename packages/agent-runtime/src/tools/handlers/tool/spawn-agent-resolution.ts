import { BASE_AGENTS } from '@savant-code/common/constants/agents'
import { toolNames } from '@savant-code/common/tools/constants'
import {
  normalizeAgentIdForLookup,
  parseAgentId,
} from '@savant-code/common/util/agent-id-parsing'

import { getAgentTemplate } from '../../../templates/agent-registry'
import { formatValueForError } from '../../../util/format-value'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentTemplateType } from '@savant-code/common/types/session-state'

/**
 * Checks if a parent agent is allowed to spawn a child agent
 */
export function getMatchingSpawn(
  spawnableAgents: AgentTemplateType[],
  childFullAgentId: string,
) {
  const {
    publisherId: childPublisherId,
    agentId: childAgentId,
    version: childVersion,
  } = parseAgentId(normalizeAgentIdForLookup(childFullAgentId))

  if (!childAgentId) {
    return null
  }

  for (const spawnableAgent of spawnableAgents) {
    const {
      publisherId: spawnablePublisherId,
      agentId: spawnableAgentId,
      version: spawnableVersion,
    } = parseAgentId(normalizeAgentIdForLookup(spawnableAgent))

    if (!spawnableAgentId) {
      continue
    }

    if (
      spawnableAgentId === childAgentId &&
      spawnablePublisherId === childPublisherId &&
      spawnableVersion === childVersion
    ) {
      return spawnableAgent
    }
    if (!childVersion && childPublisherId) {
      if (
        spawnablePublisherId === childPublisherId &&
        spawnableAgentId === childAgentId
      ) {
        return spawnableAgent
      }
    }
    if (!childPublisherId && childVersion) {
      if (
        spawnableAgentId === childAgentId &&
        spawnableVersion === childVersion
      ) {
        return spawnableAgent
      }
    }

    if (!childVersion && !childPublisherId) {
      if (spawnableAgentId === childAgentId) {
        return spawnableAgent
      }
    }
  }
  return null
}

/**
 * Resolves a child agent for a spawn: applies the spawnableAgents allowlist
 * (or the base-agent bypass), then loads the template. FID-2026-0802-005 H4:
 * this is the single implementation shared by the executor's spawn_agents
 * pre-validation and the spawn handlers — getMatchingSpawn + getAgentTemplate
 * run in exactly one place instead of twice per agent.
 */
export async function resolveSpawnableAgent(
  params: {
    agentTypeStr: string
    parentAgentTemplate: AgentTemplate
  } & ParamsExcluding<typeof getAgentTemplate, 'agentId'>,
): Promise<
  | { ok: true; agentType: string; agentTemplate: AgentTemplate }
  | { ok: false; code: 'not-spawnable' | 'not-found' | 'load-failed' }
> {
  const { agentTypeStr, parentAgentTemplate } = params
  const isBaseAgent = BASE_AGENTS.includes(parentAgentTemplate.id)
  const agentType = isBaseAgent
    ? normalizeAgentIdForLookup(agentTypeStr)
    : getMatchingSpawn(parentAgentTemplate.spawnableAgents, agentTypeStr)

  if (!agentType) {
    return { ok: false, code: 'not-spawnable' }
  }

  try {
    const agentTemplate = await getAgentTemplate({
      ...params,
      agentId: agentType,
    })
    if (!agentTemplate) {
      return { ok: false, code: 'not-found' }
    }
    return { ok: true, agentType, agentTemplate }
  } catch {
    return { ok: false, code: 'load-failed' }
  }
}

/**
 * Validates agent template and permissions (thin wrapper over
 * resolveSpawnableAgent that converts the result into the handler-facing
 * throw contract).
 */
export async function validateAndGetAgentTemplate(
  params: {
    agentTypeStr: string
    parentAgentTemplate: AgentTemplate
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
  } & ParamsExcluding<typeof getAgentTemplate, 'agentId'>,
): Promise<{ agentTemplate: AgentTemplate; agentType: string }> {
  const { agentTypeStr, parentAgentTemplate } = params
  const resolved = await resolveSpawnableAgent({
    ...params,
    parentAgentTemplate,
  })

  if (!resolved.ok) {
    if ((toolNames as readonly string[]).includes(agentTypeStr)) {
      throw new Error(
        `"${agentTypeStr}" is a tool, not an agent. Call it directly as a tool instead of wrapping it in spawn_agents.`,
      )
    }
    if (resolved.code === 'not-spawnable') {
      throw new Error(
        `Agent type ${parentAgentTemplate.id} is not allowed to spawn child agent type ${agentTypeStr}.`,
      )
    }
    throw new Error(`Agent type ${agentTypeStr} not found.`)
  }

  return {
    agentTemplate: resolved.agentTemplate,
    agentType: resolved.agentType,
  }
}

/**
 * Validates prompt and params against agent schema
 */
export function validateAgentInput(
  agentTemplate: AgentTemplate,
  agentType: string,
  prompt?: string,
  params?: JSONValue,
): void {
  const { inputSchema } = agentTemplate

  // Validate prompt requirement
  if (inputSchema.prompt) {
    const result = inputSchema.prompt.safeParse(prompt ?? '')
    if (!result.success) {
      throw new Error(
        `Invalid prompt for agent ${agentType}: ${JSON.stringify(result.error.issues, null, 2)}\n\nOriginal prompt value:\n${formatValueForError(prompt ?? '')}`,
      )
    }
  }

  // Validate params if schema exists
  if (inputSchema.params) {
    const result = inputSchema.params.safeParse(params ?? {})
    if (!result.success) {
      throw new Error(
        `Invalid params for agent ${agentType}: ${JSON.stringify(result.error.issues, null, 2)}\n\nOriginal params value:\n${formatValueForError(params ?? {})}`,
      )
    }
  }
}
