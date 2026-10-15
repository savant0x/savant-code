import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'
import {
  createAgentTemplate,
  getAgentTemplate,
  updateAgentTemplate,
} from '@savant-code/database/service'

import { logger } from '../logger'
import { getBundledAgents, getUserAgentDefinitions } from './init'
import { agentRegistryState, ORCHESTRATOR_IDS } from './state'

import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
import type { JSONValue } from '@savant-code/common/types/json'

// ============================================================================
// Agent loading - AgentDefinition (full definitions for runtime)
// ============================================================================

/**
 * Save agent definitions to database
 */
function agentDefinitionToRecord(
  def: AgentDefinition,
): Record<string, JSONValue> | undefined {
  const jsonValue = safeToJSONValue(def)
  if (typeof jsonValue !== 'object' || jsonValue === null) {
    logger.warn(
      { defId: def.id },
      'Agent definition serialized to a non-object; skipping DB save',
    )
    return undefined
  }
  return jsonValue as Record<string, JSONValue>
}

export const saveAgentDefinitionsToDb = (
  definitions: AgentDefinition[],
): void => {
  try {
    for (const def of definitions) {
      const existing = getAgentTemplate(def.id)
      const record = agentDefinitionToRecord(def)
      if (!record) {
        continue
      }
      if (existing) {
        updateAgentTemplate(def.id, record)
      } else {
        createAgentTemplate(record)
      }
    }
    logger.debug(
      { count: definitions.length },
      'Saved agent definitions to database',
    )
  } catch (error) {
    logger.warn({ error }, 'Failed to save agent definitions to database')
  }
}

/**
 * Load agent definitions from bundled agents and user's .agents directory.
 * Bundled agents are compiled into the CLI binary at build time.
 * User agents from .agents/ are loaded via SDK at startup and cached.
 * User agents can override bundled agents with the same ID.
 *
 * Additionally, all user agent IDs are automatically added to the spawnableAgents
 * of any base agent (agents with IDs starting with 'base'), so users can spawn
 * their custom agents without needing to modify the base agent definition.
 */
export const loadAgentDefinitions = (): AgentDefinition[] => {
  // Start with bundled agents - these are the default SavantCode agents
  const bundledAgents = getBundledAgents()
  const definitions: AgentDefinition[] = Object.values(bundledAgents).map(
    (def) => ({ ...def }),
  )
  const bundledIds = new Set(Object.keys(bundledAgents))

  // Get user agents from the SDK-loaded cache
  const userAgentDefs = getUserAgentDefinitions()
  const userAgentIds = userAgentDefs.map((def) => def.id)

  for (const agentDef of userAgentDefs) {
    // User agents override bundled agents with the same ID
    if (bundledIds.has(agentDef.id)) {
      const idx = definitions.findIndex((d) => d.id === agentDef.id)
      if (idx !== -1) {
        definitions[idx] = { ...agentDef }
      }
    } else {
      definitions.push({ ...agentDef })
    }
  }

  // Auto-add user agent IDs to spawnableAgents of orchestrator agents
  // This allows users to spawn their custom agents without needing to
  // explicitly add them to the orchestrator's spawnableAgents list
  if (userAgentIds.length > 0) {
    for (const def of definitions) {
      if (ORCHESTRATOR_IDS.has(def.id) && def.spawnableAgents) {
        const existingSpawnable = new Set(def.spawnableAgents)
        for (const userAgentId of userAgentIds) {
          if (!existingSpawnable.has(userAgentId)) {
            def.spawnableAgents = [...def.spawnableAgents, userAgentId]
          }
        }
      }
    }
  }

  // Merge MCP servers from mcp.json into orchestrator agents
  // This allows users to configure MCP tools that are available to the main agent
  if (Object.keys(agentRegistryState.mcpServersCache).length > 0) {
    for (const def of definitions) {
      if (ORCHESTRATOR_IDS.has(def.id)) {
        if (!def.mcpServers) {
          def.mcpServers = {}
        }
        def.mcpServers = {
          ...def.mcpServers,
          ...agentRegistryState.mcpServersCache,
        }
      }
    }
  }

  // Save to database for persistence
  saveAgentDefinitionsToDb(definitions)

  return definitions
}
