import { isObject } from './rules'
import { validateSingleAgent } from './validate-single'

import type { AgentTemplate } from '../../types/agent-template'
import type { DynamicAgentTemplate } from '../../types/dynamic-agent-template'
import type { JSONValue } from '../../types/json'
import type { Logger } from '@savant-code/common/types/contracts/logger'

export { validateSingleAgent } from './validate-single'

export interface DynamicAgentValidationError {
  filePath: string
  message: string
}

/**
 * Collect all agent IDs from template files without full validation
 */
export function collectAgentIds(params: {
  agentTemplates?: Record<string, object>
  logger: Logger
}): { agentIds: string[]; spawnableAgentIds: string[] } {
  const { agentTemplates = {}, logger } = params

  const agentIds: string[] = []
  const spawnableAgentIds: string[] = []
  const jsonFiles = Object.keys(agentTemplates)

  for (const filePath of jsonFiles) {
    try {
      const content = agentTemplates[filePath]
      if (!isObject(content)) {
        continue
      }
      const record = content as Record<string, JSONValue>

      // Extract the agent ID if it exists
      if (typeof record.id === 'string' && record.id) {
        agentIds.push(record.id)
      }
      if (Array.isArray(record.spawnableAgents)) {
        for (const agentId of record.spawnableAgents) {
          if (typeof agentId === 'string') {
            spawnableAgentIds.push(agentId)
          }
        }
      }
    } catch (error) {
      // Log but don't fail the collection process for other errors
      logger.debug(
        { filePath, error },
        'Failed to extract agent ID during collection phase',
      )
    }
  }

  return { agentIds, spawnableAgentIds }
}

/**
 * Validate and load dynamic agent templates from user-provided agentTemplates
 */
export function validateAgents(params: {
  agentTemplates?: Record<string, object>
  logger: Logger
}): {
  templates: Record<string, AgentTemplate>
  dynamicTemplates: Record<string, DynamicAgentTemplate>
  validationErrors: DynamicAgentValidationError[]
} {
  const { agentTemplates = {}, logger } = params

  const templates: Record<string, AgentTemplate> = {}
  const dynamicTemplates: Record<string, DynamicAgentTemplate> = {}
  const validationErrors: DynamicAgentValidationError[] = []

  const hasAgentTemplates = Object.keys(agentTemplates).length > 0

  if (!hasAgentTemplates) {
    return {
      templates,
      dynamicTemplates,
      validationErrors,
    }
  }

  const agentKeys = Object.keys(agentTemplates)

  // Load and validate each agent template
  for (const agentKey of agentKeys) {
    const content = agentTemplates[agentKey]
    try {
      if (!content) {
        continue
      }

      const validationResult = validateSingleAgent({
        template: content,
        filePath: agentKey,
      })

      if (!validationResult.success) {
        validationErrors.push({
          filePath: agentKey,
          message: validationResult.error!,
        })
        continue
      }

      if (templates[validationResult.agentTemplate!.id]) {
        const agentContext = validationResult.agentTemplate!.displayName
          ? `Agent "${validationResult.agentTemplate!.id}" (${validationResult.agentTemplate!.displayName})`
          : `Agent "${validationResult.agentTemplate!.id}"`

        validationErrors.push({
          filePath: agentKey,
          message: `${agentContext}: Duplicate agent ID`,
        })
        continue
      }
      templates[validationResult.agentTemplate!.id] =
        validationResult.agentTemplate!
      dynamicTemplates[validationResult.dynamicAgentTemplate!.id] =
        validationResult.dynamicAgentTemplate!
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      const context = isObject(content)
        ? (content as Record<string, JSONValue>)
        : null
      const displayName =
        typeof context?.displayName === 'string' ? context.displayName : null
      const agentContext =
        typeof context?.id === 'string'
          ? `Agent "${context.id}"${displayName ? ` (${displayName})` : ''}`
          : `Agent in ${agentKey}`

      validationErrors.push({
        filePath: agentKey,
        message: `${agentContext}: ${errorMessage}`,
      })

      logger.warn(
        { filePath: agentKey, error: errorMessage },
        'Failed to load dynamic agent template',
      )
    }
  }

  return {
    templates,
    dynamicTemplates,
    validationErrors,
  }
}
