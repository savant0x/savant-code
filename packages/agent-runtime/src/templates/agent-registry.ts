import { validateAgents } from '@savant-code/common/templates/agent-validation'
import { normalizeAgentIdForLookup } from '@savant-code/common/util/agent-id-parsing'

import type { DynamicAgentValidationError } from '@savant-code/common/templates/agent-validation'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ProjectFileContext } from '@savant-code/common/util/file'

/**
 * Single function to look up an agent template.
 *
 * FID-2026-0929-005 (gut the backend): local templates only. The former
 * tiers 2/3 (database cache + database query) fetched published agents from
 * the SavantCode backend, which does not exist; the SEC-6 capability clamp
 * they fed (database-template-clamp.ts) is deleted with them. Priority is
 * now: exact id, then the normalized id.
 */
export async function getAgentTemplate(params: {
  agentId: string
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
}): Promise<AgentTemplate | null> {
  const { agentId, localAgentTemplates, logger } = params
  const normalizedAgentId = normalizeAgentIdForLookup(agentId)

  if (localAgentTemplates[agentId]) {
    return localAgentTemplates[agentId]
  }
  if (normalizedAgentId !== agentId && localAgentTemplates[normalizedAgentId]) {
    return localAgentTemplates[normalizedAgentId]
  }

  logger.debug(
    { agentId },
    'getAgentTemplate: agent not found in local templates',
  )
  return null
}

/**
 * Assemble local agent templates from fileContext
 */
export function assembleLocalAgentTemplates(params: {
  fileContext: ProjectFileContext
  logger: Logger
}): {
  agentTemplates: Record<string, AgentTemplate>
  validationErrors: DynamicAgentValidationError[]
} {
  const { fileContext, logger } = params
  // Load dynamic agents using the service
  const { templates: dynamicTemplates, validationErrors } = validateAgents({
    agentTemplates: fileContext.agentTemplates,
    logger,
  })

  // Use dynamic templates only

  const agentTemplates = { ...dynamicTemplates }
  return { agentTemplates, validationErrors }
}
