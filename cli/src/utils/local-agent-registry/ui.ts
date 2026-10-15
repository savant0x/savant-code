import { pluralize } from '@savant-code/common/util/string'

import { logger } from '../logger'
import { loadLocalAgents, findAgentsDirectory } from './directory'

import type { LocalAgentInfo } from './state'

// ============================================================================
// UI/Display utilities
// ============================================================================

export const announceLoadedAgents = (): void => {
  const agents = loadLocalAgents()
  const agentsDir = findAgentsDirectory()

  if (!agentsDir) {
    logger.debug('[agents] No .agents directory found in this project.')
    return
  }

  if (!agents.length) {
    logger.debug({ agentsDir }, '[agents] No agent files found')
    return
  }

  const agentIdentifiers = agents.map((agent) =>
    agent.displayName && agent.displayName !== agent.id
      ? `${agent.displayName} (${agent.id})`
      : agent.displayName || agent.id,
  )

  logger.debug(
    { agentsDir, agents: agentIdentifiers },
    `[agents] Loaded ${pluralize(agents.length, 'local agent')}`,
  )
}

export const getLoadedAgentsMessage = (): string | null => {
  const agents = loadLocalAgents()
  const agentsDir = findAgentsDirectory()

  if (!agentsDir || !agents.length) {
    return null
  }

  const agentCount = agents.length
  const header = `Loaded ${pluralize(agentCount, 'local agent')} from ${agentsDir}`
  const agentList = agents
    .map((agent) => {
      const identifier =
        agent.displayName && agent.displayName !== agent.id
          ? `${agent.displayName} (${agent.id})`
          : agent.displayName || agent.id
      return `  - ${identifier}`
    })
    .join('\n')

  return `${header}\n${agentList}`
}

export const getLoadedAgentsData = (): {
  agents: LocalAgentInfo[]
  agentsDir: string
} | null => {
  const agents = loadLocalAgents()
  const agentsDir = findAgentsDirectory()

  if (!agentsDir || !agents.length) {
    return null
  }

  return { agents, agentsDir }
}
